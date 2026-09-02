import crypto from "crypto";
import { createRequire } from "node:module";


// ==========================================
// HUBSPOT PIPELINE STAGES
// ==========================================

const STAGE_OPNAMEDAG =
  "5980739821";

const STAGE_PAKKET_IN_BEHANDELING =
  "5980739822";

const STAGE_AFGEROND =
  "4";


// ==========================================
// HUBSPOT ASSOCIATION TYPES
// ==========================================

const ASSOCIATION_TYPE_MAKELAAR =
  81;


// ==========================================
// DROPBOX
// ==========================================

const DROPBOX_REDIRECT_URI =
  "https://boykeys-api.vercel.app/api/microsoft/connect";

const DROPBOX_ARCHIVE_PATH =
  "/Boykeys - 4rchive";


// ==========================================
// PERFORMANCE CACHE
// ==========================================
//
// Deze cache versnelt herhaalde requests op
// dezelfde warme Vercel instance. De werking
// van de sync is er niet van afhankelijk.
//
// ==========================================

const EXCEL_CACHE_TTL_MS =
  60 * 1000;

const TOKEN_REFRESH_MARGIN_MS =
  60 * 1000;


let microsoftAccessTokenCache = {
  token: null,
  expiresAt: 0
};


let dropboxAccessTokenCache = {
  token: null,
  expiresAt: 0
};


let excelBookingMapCache = {
  value: null,
  expiresAt: 0,
  promise: null
};


// ==========================================
// CORS
// ==========================================

function enableCors(
  req,
  res
) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "*"
  );


  if (
    req.method ===
    "OPTIONS"
  ) {

    res
      .status(200)
      .end();

    return true;

  }


  return false;

}


// ==========================================
// COOKIE
// ==========================================

function getCookie(
  req,
  name
) {

  const cookieHeader =
    req.headers?.cookie ||
    "";


  const cookies =
    cookieHeader
      .split(";")
      .map(
        value =>
          value.trim()
      );


  for (
    const cookie of cookies
  ) {

    const index =
      cookie.indexOf("=");


    if (
      index === -1
    ) {

      continue;

    }


    const cookieName =
      cookie.slice(
        0,
        index
      );


    const cookieValue =
      cookie.slice(
        index + 1
      );


    if (
      cookieName ===
      name
    ) {

      return decodeURIComponent(
        cookieValue
      );

    }

  }


  return null;

}


// ==========================================
// DROPBOX APP SETTINGS
// ==========================================

function getDropboxAppSettings() {

  const appKey =
    process.env.DROPBOX_APP_KEY;

  const appSecret =
    process.env.DROPBOX_APP_SECRET;


  if (
    !appKey ||
    !appSecret
  ) {

    throw new Error(
      "DROPBOX_APP_KEY of DROPBOX_APP_SECRET ontbreekt in Vercel."
    );

  }


  return {

    appKey,
    appSecret

  };

}


// ==========================================
// DROPBOX ACCESS TOKEN
// ==========================================

async function getDropboxAccessToken() {

  const now =
    Date.now();


  if (
    dropboxAccessTokenCache.token &&
    dropboxAccessTokenCache.expiresAt >
      now + TOKEN_REFRESH_MARGIN_MS
  ) {

    return dropboxAccessTokenCache.token;

  }


  const refreshToken =
    process.env.DROPBOX_REFRESH_TOKEN;


  if (refreshToken) {

    const {
      appKey,
      appSecret
    } =
      getDropboxAppSettings();


    const response =
      await fetch(
        "https://api.dropboxapi.com/oauth2/token",
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/x-www-form-urlencoded"

          },

          body:
            new URLSearchParams({

              grant_type:
                "refresh_token",

              refresh_token:
                refreshToken,

              client_id:
                appKey,

              client_secret:
                appSecret

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      console.error(
        "DROPBOX REFRESH TOKEN ERROR",
        data
      );


      throw new Error(
        data.error_description ||
        data.error ||
        "Dropbox access token vernieuwen mislukt."
      );

    }


    if (
      !data.access_token
    ) {

      throw new Error(
        "Dropbox heeft geen access token teruggegeven."
      );

    }


    const expiresInSeconds =
      Number(
        data.expires_in
      ) ||
      (4 * 60 * 60);


    dropboxAccessTokenCache = {

      token:
        data.access_token,

      expiresAt:
        Date.now() +
        (expiresInSeconds * 1000)

    };


    return data.access_token;

  }


  const temporaryToken =
    process.env.DROPBOX_ACCESS_TOKEN;


  if (temporaryToken) {

    dropboxAccessTokenCache = {

      token:
        temporaryToken,

      expiresAt:
        Date.now() +
        (15 * 60 * 1000)

    };


    return temporaryToken;

  }


  throw new Error(
    "Geen DROPBOX_REFRESH_TOKEN of DROPBOX_ACCESS_TOKEN gevonden."
  );

}


// ==========================================
// DROPBOX API REQUEST
// ==========================================

async function dropboxRequest(
  endpoint,
  body = {}
) {

  const accessToken =
    await getDropboxAccessToken();


  const response =
    await fetch(
      `https://api.dropboxapi.com/2/${endpoint}`,
      {

        method:
          "POST",

        headers: {

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(
            body
          )

      }
    );


  const text =
    await response.text();


  let data =
    null;


  if (text) {

    try {

      data =
        JSON.parse(
          text
        );

    }

    catch {

      data =
        text;

    }

  }


  if (!response.ok) {

    console.error(
      "DROPBOX API ERROR",
      response.status,
      data
    );


    const error =
      new Error(
        data?.error_summary ||
        data?.error?.[".tag"] ||
        `Dropbox API fout ${response.status}`
      );


    error.status =
      response.status;

    error.dropboxData =
      data;


    throw error;

  }


  return data;

}


// ==========================================
// DROPBOX VERBINDING TEST
// ==========================================

async function testDropboxConnection() {

  const account =
    await dropboxRequest(
      "users/get_current_account"
    );


  const root =
    await dropboxRequest(
      "files/list_folder",
      {

        path:
          "",

        recursive:
          false,

        include_deleted:
          false,

        include_has_explicit_shared_members:
          false,

        include_mounted_folders:
          true,

        limit:
          100

      }
    );


  const entries =
    (
      root.entries ||
      []
    ).map(
      item => ({

        type:
          item[".tag"] ||
          null,

        name:
          item.name ||
          null,

        path:
          item.path_display ||
          item.path_lower ||
          null,

        id:
          item.id ||
          null

      })
    );


  return {

    account: {

      accountId:
        account.account_id ||
        null,

      name:
        account.name?.display_name ||
        null,

      email:
        account.email ||
        null

    },

    root: {

      count:
        entries.length,

      hasMore:
        Boolean(
          root.has_more
        ),

      entries

    }

  };

}


// ==========================================
// DROPBOX SEARCH METADATA
// ==========================================

function getDropboxSearchMetadata(
  match
) {

  if (!match) {

    return null;

  }


  const wrapper =
    match.metadata;


  if (!wrapper) {

    return null;

  }


  if (
    wrapper.metadata
  ) {

    return wrapper.metadata;

  }


  return wrapper;

}


// ==========================================
// DROPBOX TAGS
// ==========================================

async function getDropboxTagsForPaths(
  paths
) {

  if (
    !Array.isArray(paths) ||
    paths.length === 0
  ) {

    return [];

  }


  const result =
    await dropboxRequest(
      "files/tags/get",
      {

        paths

      }
    );


  return (
    result.paths_to_tags ||
    []
  );

}


// ==========================================
// DROPBOX MAP ZOEKEN OP EXACTE TAG
// ==========================================

async function findDropboxFolderByTag(
  bookingCode
) {

  const cleanCode =
    String(
      bookingCode ||
      ""
    )
      .trim()
      .toLowerCase();


  if (!cleanCode) {

    throw new Error(
      "Geen boekingscode opgegeven."
    );

  }


  const startedAt =
    Date.now();


  const search =
    await dropboxRequest(
      "files/search_v2",
      {

        query:
          cleanCode,

        options: {

          path:
            DROPBOX_ARCHIVE_PATH,

          max_results:
            100,

          file_status:
            "active",

          filename_only:
            false

        },

        match_field_options: {

          include_highlights:
            false

        }

      }
    );


  const rawMatches =
    search.matches ||
    [];


  const candidates =
    [];

  const seenPaths =
    new Set();


  for (
    const match of rawMatches
  ) {

    const metadata =
      getDropboxSearchMetadata(
        match
      );


    if (!metadata) {

      continue;

    }


    if (
      metadata[".tag"] !==
      "folder"
    ) {

      continue;

    }


    const path =
      metadata.path_display ||
      metadata.path_lower ||
      null;


    if (!path) {

      continue;

    }


    const lowerPath =
      String(
        path
      ).toLowerCase();


    const lowerArchivePath =
      DROPBOX_ARCHIVE_PATH
        .toLowerCase();


    if (
      lowerPath !==
        lowerArchivePath &&
      !lowerPath.startsWith(
        `${lowerArchivePath}/`
      )
    ) {

      continue;

    }


    if (
      seenPaths.has(
        lowerPath
      )
    ) {

      continue;

    }


    seenPaths.add(
      lowerPath
    );


    candidates.push({

      id:
        metadata.id ||
        null,

      name:
        metadata.name ||
        null,

      path,

      matchType:
        match.match_type?.[".tag"] ||
        match.match_type ||
        null

    });

  }


  if (
    candidates.length ===
    0
  ) {

    return {

      found:
        false,

      boekingscode:
        cleanCode,

      archivePath:
        DROPBOX_ARCHIVE_PATH,

      searchMatches:
        rawMatches.length,

      folderCandidates:
        0,

      tagsChecked:
        0,

      matchesCount:
        0,

      durationMs:
        Date.now() -
        startedAt,

      matches:
        []

    };

  }


  const tagsResults =
    await getDropboxTagsForPaths(
      candidates.map(
        item =>
          item.path
      )
    );


  const candidateByPath =
    new Map();


  for (
    const candidate of candidates
  ) {

    candidateByPath.set(
      candidate.path.toLowerCase(),
      candidate
    );

  }


  const matches =
    [];


  for (
    const item of tagsResults
  ) {

    const path =
      item.path ||
      null;


    if (!path) {

      continue;

    }


    const candidate =
      candidateByPath.get(
        String(
          path
        ).toLowerCase()
      );


    if (!candidate) {

      continue;

    }


    const tags =
      (
        item.tags ||
        []
      )
        .map(
          tag => {

            if (
              tag?.tag_text
            ) {

              return String(
                tag.tag_text
              );

            }


            if (
              tag?.user_generated_tag?.tag_text
            ) {

              return String(
                tag
                  .user_generated_tag
                  .tag_text
              );

            }


            return "";

          }
        )
        .filter(
          Boolean
        );


    const hasExactBookingTag =
      tags.some(
        tag =>
          tag
            .trim()
            .toLowerCase() ===
          cleanCode
      );


    if (
      !hasExactBookingTag
    ) {

      continue;

    }


    matches.push({

      id:
        candidate.id,

      name:
        candidate.name,

      path:
        candidate.path,

      tags,

      matchType:
        candidate.matchType

    });

  }


  return {

    found:
      matches.length >
      0,

    boekingscode:
      cleanCode,

    archivePath:
      DROPBOX_ARCHIVE_PATH,

    searchMatches:
      rawMatches.length,

    folderCandidates:
      candidates.length,

    tagsChecked:
      tagsResults.length,

    matchesCount:
      matches.length,

    durationMs:
      Date.now() -
      startedAt,

    matches

  };

}


// ==========================================
// BESTAANDE SHARED LINK
// ==========================================

async function getExistingDropboxSharedLink(
  folderPath
) {

  const result =
    await dropboxRequest(
      "sharing/list_shared_links",
      {

        path:
          folderPath,

        direct_only:
          true

      }
    );


  const links =
    result.links ||
    [];


  if (
    links.length ===
    0
  ) {

    return null;

  }


  const link =
    links[0];


  return {

    created:
      false,

    url:
      link.url ||
      null,

    id:
      link.id ||
      null,

    name:
      link.name ||
      null,

    pathLower:
      link.path_lower ||
      null,

    visibility:
      link.link_permissions
        ?.resolved_visibility
        ?.[ ".tag" ] ||
      link.link_permissions
        ?.requested_visibility
        ?.[ ".tag" ] ||
      null

  };

}


// ==========================================
// NIEUWE SHARED LINK
// ==========================================

async function createDropboxSharedLink(
  folderPath
) {

  try {

    const link =
      await dropboxRequest(
        "sharing/create_shared_link_with_settings",
        {

          path:
            folderPath

        }
      );


    return {

      created:
        true,

      url:
        link.url ||
        null,

      id:
        link.id ||
        null,

      name:
        link.name ||
        null,

      pathLower:
        link.path_lower ||
        null,

      visibility:
        link.link_permissions
          ?.resolved_visibility
          ?.[ ".tag" ] ||
        link.link_permissions
          ?.requested_visibility
          ?.[ ".tag" ] ||
        null

    };

  }

  catch (error) {

    const summary =
      String(
        error?.dropboxData?.error_summary ||
        error?.message ||
        ""
      )
        .toLowerCase();


    if (
      summary.includes(
        "shared_link_already_exists"
      )
    ) {

      const existing =
        await getExistingDropboxSharedLink(
          folderPath
        );


      if (existing) {

        return existing;

      }

    }


    throw error;

  }

}


// ==========================================
// SHARED LINK OPHALEN OF MAKEN
// ==========================================

async function getOrCreateDropboxSharedLink(
  folderPath
) {

  const existing =
    await getExistingDropboxSharedLink(
      folderPath
    );


  if (existing) {

    return existing;

  }


  return createDropboxSharedLink(
    folderPath
  );

}


// ==========================================
// DROPBOX PAKKET OPHALEN
// ==========================================

async function getDropboxPackageByBookingCode(
  bookingCode,
  createLink = false
) {

  const search =
    await findDropboxFolderByTag(
      bookingCode
    );


  if (
    !search.found
  ) {

    return {

      valid:
        false,

      reason:
        "folder_not_found",

      boekingscode:
        search.boekingscode,

      folder:
        null,

      sharedLink:
        null

    };

  }


  if (
    search.matchesCount !==
    1
  ) {

    return {

      valid:
        false,

      reason:
        "multiple_folders_found",

      boekingscode:
        search.boekingscode,

      matchesCount:
        search.matchesCount,

      folder:
        null,

      sharedLink:
        null

    };

  }


  const folder =
    search.matches[0];


  let sharedLink =
    await getExistingDropboxSharedLink(
      folder.path
    );


  if (
    !sharedLink &&
    createLink
  ) {

    sharedLink =
      await getOrCreateDropboxSharedLink(
        folder.path
      );

  }


  return {

    valid:
      Boolean(
        sharedLink?.url
      ),

    reason:
      sharedLink?.url
        ? "ready"
        : "shared_link_missing",

    boekingscode:
      search.boekingscode,

    folder: {

      id:
        folder.id,

      name:
        folder.name,

      path:
        folder.path,

      tags:
        folder.tags

    },

    sharedLink:
      sharedLink
        ? {

            url:
              sharedLink.url,

            created:
              Boolean(
                sharedLink.created
              ),

            visibility:
              sharedLink.visibility ||
              null

          }
        : null

  };

}


// ==========================================
// DROPBOX LINK TEST
// ==========================================

async function getDropboxPackageLinkByBookingCode(
  bookingCode
) {

  const startedAt =
    Date.now();


  const result =
    await getDropboxPackageByBookingCode(
      bookingCode,
      true
    );


  return {

    found:
      Boolean(
        result.folder
      ),

    valid:
      result.valid,

    reason:
      result.reason,

    boekingscode:
      result.boekingscode,

    archivePath:
      DROPBOX_ARCHIVE_PATH,

    folder:
      result.folder,

    sharedLink:
      result.sharedLink,

    durationMs:
      Date.now() -
      startedAt

  };

}


// ==========================================
// DROPBOX OAUTH START
// ==========================================

function startDropboxOAuth(
  req,
  res
) {

  const {
    appKey
  } =
    getDropboxAppSettings();


  const state =
    crypto
      .randomBytes(24)
      .toString("hex");


  res.setHeader(
    "Set-Cookie",
    [
      `dropbox_oauth_state=${state}`,
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=600"
    ].join("; ")
  );


  const params =
    new URLSearchParams({

      client_id:
        appKey,

      response_type:
        "code",

      redirect_uri:
        DROPBOX_REDIRECT_URI,

      token_access_type:
        "offline",

      state

    });


  return res.redirect(
    302,
    `https://www.dropbox.com/oauth2/authorize?${params.toString()}`
  );

}


// ==========================================
// DROPBOX OAUTH CALLBACK
// ==========================================

async function handleDropboxOAuthCallback(
  req,
  res
) {

  const code =
    String(
      req.query?.code ||
      ""
    );


  const state =
    String(
      req.query?.state ||
      ""
    );


  const storedState =
    getCookie(
      req,
      "dropbox_oauth_state"
    );


  if (
    !code ||
    !state
  ) {

    return res
      .status(400)
      .send(
        "Dropbox OAuth code of state ontbreekt."
      );

  }


  if (
    !storedState ||
    state !== storedState
  ) {

    return res
      .status(400)
      .send(
        "Dropbox OAuth state klopt niet of is verlopen."
      );

  }


  const {
    appKey,
    appSecret
  } =
    getDropboxAppSettings();


  const response =
    await fetch(
      "https://api.dropboxapi.com/oauth2/token",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/x-www-form-urlencoded"

        },

        body:
          new URLSearchParams({

            code,

            grant_type:
              "authorization_code",

            client_id:
              appKey,

            client_secret:
              appSecret,

            redirect_uri:
              DROPBOX_REDIRECT_URI

          })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    return res
      .status(500)
      .send(
        `Dropbox koppelen mislukt: ${
          data.error_description ||
          data.error ||
          "onbekende fout"
        }`
      );

  }


  if (
    !data.refresh_token
  ) {

    return res
      .status(500)
      .send(
        "Dropbox heeft geen refresh token teruggegeven."
      );

  }


  res.setHeader(
    "Set-Cookie",
    [
      "dropbox_oauth_state=",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=0"
    ].join("; ")
  );


  const safeRefreshToken =
    String(
      data.refresh_token
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );


  return res
    .status(200)
    .send(`
      <!doctype html>
      <html lang="nl">
        <head>
          <meta charset="utf-8">
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >
          <title>Dropbox gekoppeld</title>
        </head>

        <body>

          <h1>Dropbox is gekoppeld</h1>

          <p>
            Zet onderstaande waarde in Vercel als:
          </p>

          <strong>DROPBOX_REFRESH_TOKEN</strong>

          <pre>${safeRefreshToken}</pre>

          <p>
            Deel deze waarde nergens.
          </p>

        </body>
      </html>
    `);

}


// ==========================================
// MICROSOFT ACCESS TOKEN
// ==========================================

async function getAccessToken() {

  const now =
    Date.now();


  if (
    microsoftAccessTokenCache.token &&
    microsoftAccessTokenCache.expiresAt >
      now + TOKEN_REFRESH_MARGIN_MS
  ) {

    return microsoftAccessTokenCache.token;

  }


  const clientId =
    process.env.MICROSOFT_CLIENT_ID;

  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET;

  const refreshToken =
    process.env.MICROSOFT_REFRESH_TOKEN;


  if (
    !clientId ||
    !clientSecret ||
    !refreshToken
  ) {

    throw new Error(
      "Microsoft refresh-token environment variables ontbreken."
    );

  }


  const response =
    await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/x-www-form-urlencoded"

        },

        body:
          new URLSearchParams({

            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              refreshToken,

            grant_type:
              "refresh_token",

            scope:
              [
                "offline_access",
                "User.Read",
                "Files.Read.All"
              ].join(" ")

          })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error_description ||
      data.error ||
      "Microsoft access token ophalen mislukt."
    );

  }


  if (
    !data.access_token
  ) {

    throw new Error(
      "Microsoft heeft geen access token teruggegeven."
    );

  }


  const expiresInSeconds =
    Number(
      data.expires_in
    ) ||
    3600;


  microsoftAccessTokenCache = {

    token:
      data.access_token,

    expiresAt:
      Date.now() +
      (expiresInSeconds * 1000)

  };


  return data.access_token;

}


// ==========================================
// ONEDRIVE SHARE URL -> GRAPH SHARE ID
// ==========================================

function encodeSharingUrl(
  sharingUrl
) {

  const base64 =
    Buffer
      .from(
        sharingUrl,
        "utf8"
      )
      .toString(
        "base64"
      );


  const base64Url =
    base64
      .replace(
        /=+$/,
        ""
      )
      .replace(
        /\//g,
        "_"
      )
      .replace(
        /\+/g,
        "-"
      );


  return `u!${base64Url}`;

}


// ==========================================
// EXCEL INFO
// ==========================================

async function getExcelFileInfo() {

  const shareUrl =
    process.env.MICROSOFT_EXCEL_SHARE_URL;


  if (!shareUrl) {

    throw new Error(
      "MICROSOFT_EXCEL_SHARE_URL ontbreekt."
    );

  }


  const accessToken =
    await getAccessToken();


  const shareId =
    encodeSharingUrl(
      shareUrl
    );


  const response =
    await fetch(
      `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem?$select=id,name,size,webUrl,parentReference,file,lastModifiedDateTime`,
      {

        headers: {

          Authorization:
            `Bearer ${accessToken}`

        }

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error?.message ||
      "Excelbestand via sharelink ophalen mislukt."
    );

  }


  return {

    name:
      data.name ||
      null,

    itemId:
      data.id ||
      null,

    driveId:
      data.parentReference?.driveId ||
      null,

    size:
      data.size ||
      null,

    webUrl:
      data.webUrl ||
      null,

    mimeType:
      data.file?.mimeType ||
      null,

    lastModifiedDateTime:
      data.lastModifiedDateTime ||
      null

  };

}


// ==========================================
// EXCEL DOWNLOAD
// ==========================================

async function downloadExcelFile() {

  const fileInfo =
    await getExcelFileInfo();


  const accessToken =
    await getAccessToken();


  const response =
    await fetch(
      `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
        fileInfo.driveId
      )}/items/${encodeURIComponent(
        fileInfo.itemId
      )}/content`,
      {

        headers: {

          Authorization:
            `Bearer ${accessToken}`

        },

        redirect:
          "follow"

      }
    );


  if (!response.ok) {

    throw new Error(
      `Excel download mislukt: ${response.status}`
    );

  }


  const arrayBuffer =
    await response.arrayBuffer();


  return {

    fileInfo,

    buffer:
      Buffer.from(
        arrayBuffer
      )

  };

}


// ==========================================
// XLSX
// ==========================================

function loadXlsx() {

  const require =
    createRequire(
      import.meta.url
    );


  return require(
    "xlsx"
  );

}


// ==========================================
// CELL VALUE
// ==========================================

function getCellValue(
  cell
) {

  if (!cell) {

    return "";

  }


  return String(
    cell.v ??
    cell.w ??
    ""
  ).trim();

}


// ==========================================
// EXCEL BOOKING MAP
// ==========================================

async function buildExcelBookingMap() {

  const result =
    await downloadExcelFile();


  const XLSX =
    loadXlsx();


  const workbook =
    XLSX.read(
      result.buffer,
      {

        type:
          "buffer",

        cellDates:
          true

      }
    );


  const bookings =
    new Map();


  for (
    const sheetName of workbook.SheetNames
  ) {

    const worksheet =
      workbook.Sheets[
        sheetName
      ];


    if (
      !worksheet ||
      !worksheet["!ref"]
    ) {

      continue;

    }


    const range =
      XLSX.utils.decode_range(
        worksheet["!ref"]
      );


    for (
      let row = range.s.r;
      row <= range.e.r;
      row++
    ) {

      const bookingCode =
        getCellValue(
          worksheet[
            XLSX.utils.encode_cell({
              c: 2,
              r: row
            })
          ]
        )
          .toLowerCase();


      if (!bookingCode) {

        continue;

      }


      const excelStatus =
        getCellValue(
          worksheet[
            XLSX.utils.encode_cell({
              c: 3,
              r: row
            })
          ]
        )
          .toLowerCase();


      bookings.set(
        bookingCode,
        {

          boekingscode:
            bookingCode,

          excel_status:
            excelStatus,

          productiestatus:
            excelStatus === "done"
              ? "klaar"
              : "in_behandeling",

          sheet:
            sheetName,

          row:
            row + 1

        }
      );

    }

  }


  return {

    fileInfo:
      result.fileInfo,

    bookings

  };

}


// ==========================================
// EXCEL BOOKING MAP - CACHE
// ==========================================

async function getExcelBookingMap() {

  const now =
    Date.now();


  if (
    excelBookingMapCache.value &&
    excelBookingMapCache.expiresAt >
      now
  ) {

    return excelBookingMapCache.value;

  }


  if (
    excelBookingMapCache.promise
  ) {

    return excelBookingMapCache.promise;

  }


  excelBookingMapCache.promise =
    buildExcelBookingMap()
      .then(
        value => {

          excelBookingMapCache = {

            value,

            expiresAt:
              Date.now() +
              EXCEL_CACHE_TTL_MS,

            promise:
              null

          };


          return value;

        }
      )
      .catch(
        error => {

          excelBookingMapCache.promise =
            null;


          throw error;

        }
      );


  return excelBookingMapCache.promise;

}


// ==========================================
// BOEKING STATUS
// ==========================================

async function getBookingStatus(
  bookingCode
) {

  const cleanCode =
    String(
      bookingCode ||
      ""
    )
      .trim()
      .toLowerCase();


  const excel =
    await getExcelBookingMap();


  const booking =
    excel.bookings.get(
      cleanCode
    );


  if (!booking) {

    return {

      found:
        false,

      boekingscode:
        cleanCode

    };

  }


  return {

    found:
      true,

    ...booking

  };

}


// ==========================================
// HUBSPOT TOKEN
// ==========================================

function getHubSpotToken() {

  const token =
    process.env.HUBSPOT_ACCESS_TOKEN ||
    process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
    process.env.HUBSPOT_TOKEN;


  if (!token) {

    throw new Error(
      "HubSpot access token ontbreekt in Vercel."
    );

  }


  return token;

}


// ==========================================
// HUBSPOT REQUEST
// ==========================================

async function hubSpotRequest(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {

        ...options,

        headers: {

          Authorization:
            `Bearer ${getHubSpotToken()}`,

          "Content-Type":
            "application/json",

          ...(options.headers || {})

        }

      }
    );


  const text =
    await response.text();


  let data =
    null;


  if (text) {

    try {

      data =
        JSON.parse(
          text
        );

    }

    catch {

      data =
        text;

    }

  }


  if (!response.ok) {

    console.error(
      "HUBSPOT API ERROR",
      response.status,
      data
    );


    throw new Error(
      data?.message ||
      `HubSpot API fout ${response.status}`
    );

  }


  return data;

}


// ==========================================
// HUBSPOT TICKETS
// ==========================================

async function getHubSpotTicketsWithBookingCode() {

  const tickets =
    [];


  let after =
    null;


  do {

    const body = {

      filterGroups: [
        {

          filters: [
            {

              propertyName:
                "boekingscode",

              operator:
                "HAS_PROPERTY"

            }
          ]

        }
      ],

      properties: [
        "boekingscode",
        "hs_pipeline_stage",
        "subject",
        "adres",
        "afspraak_start",
        "afspraak_einde",
        "download_link"
      ],

      limit:
        100

    };


    if (after) {

      body.after =
        after;

    }


    const data =
      await hubSpotRequest(
        "https://api.hubapi.com/crm/v3/objects/tickets/search",
        {

          method:
            "POST",

          body:
            JSON.stringify(
              body
            )

        }
      );


    tickets.push(
      ...(data.results || [])
    );


    after =
      data.paging?.next?.after ||
      null;

  }
  while (after);


  return tickets;

}


// ==========================================
// TICKET VAN MAKELAAR?
// ==========================================

async function ticketBelongsToMakelaar(
  ticketId,
  contactId
) {

  const data =
    await hubSpotRequest(
      `https://api.hubapi.com/crm/v4/objects/tickets/${encodeURIComponent(
        ticketId
      )}/associations/contacts?limit=100`
    );


  for (
    const association of
    data.results ||
    []
  ) {

    if (
      String(
        association.toObjectId ||
        association.id ||
        ""
      ) !==
      String(
        contactId ||
        ""
      )
    ) {

      continue;

    }


    const types =
      association.associationTypes ||
      association.types ||
      [];


    if (
      types.some(
        type =>
          Number(
            type.typeId
          ) ===
          ASSOCIATION_TYPE_MAKELAAR
      )
    ) {

      return true;

    }

  }


  return false;

}


// ==========================================
// HUBSPOT TICKET UPDATE
// ==========================================

async function updateHubSpotTicket(
  ticketId,
  properties
) {

  return hubSpotRequest(
    `https://api.hubapi.com/crm/v3/objects/tickets/${encodeURIComponent(
      ticketId
    )}`,
    {

      method:
        "PATCH",

      body:
        JSON.stringify({

          properties

        })

    }
  );

}


// ==========================================
// HUBSPOT / EXCEL / DROPBOX SYNC
// ==========================================

async function syncHubSpotWithExcel(
  dryRun = true,
  contactId = null
) {

  const startedAt =
    Date.now();


  const [
    excel,
    tickets
  ] =
    await Promise.all([

      getExcelBookingMap(),

      getHubSpotTicketsWithBookingCode()

    ]);


  const results =
    [];


  let matched =
    0;

  let changed =
    0;

  let unchanged =
    0;

  let skipped =
    0;

  let notFound =
    0;

  let notOwned =
    0;

  let owned =
    0;

  let dropboxReady =
    0;

  let dropboxNotFound =
    0;

  let dropboxMultiple =
    0;

  let dropboxLinkMissing =
    0;


  for (
    const ticket of tickets
  ) {

    const bookingCode =
      String(
        ticket.properties?.boekingscode ||
        ""
      )
        .trim()
        .toLowerCase();


    const currentStage =
      String(
        ticket.properties?.hs_pipeline_stage ||
        ""
      );


    const currentDownloadLink =
      String(
        ticket.properties?.download_link ||
        ""
      )
        .trim();


    if (
      !bookingCode ||
      (
        currentStage !==
          STAGE_OPNAMEDAG &&
        currentStage !==
          STAGE_PAKKET_IN_BEHANDELING
      )
    ) {

      skipped++;

      continue;

    }


    if (contactId) {

      const belongs =
        await ticketBelongsToMakelaar(
          ticket.id,
          contactId
        );


      if (!belongs) {

        notOwned++;

        continue;

      }


      owned++;

    }


    const excelBooking =
      excel.bookings.get(
        bookingCode
      );


    if (!excelBooking) {

      notFound++;

      continue;

    }


    matched++;


    // ======================================
    // EXCEL NOG NIET DONE
    // ======================================

    if (
      excelBooking.excel_status !==
      "done"
    ) {

      const targetStage =
        STAGE_PAKKET_IN_BEHANDELING;


      if (
        currentStage ===
        targetStage
      ) {

        unchanged++;


        results.push({

          ticketId:
            ticket.id,

          boekingscode:
            bookingCode,

          adres:
            ticket.properties?.adres ||
            null,

          excel_status:
            excelBooking.excel_status,

          currentStage,

          targetStage,

          dropbox:
            "niet_nodig",

          action:
            "geen_wijziging"

        });


        continue;

      }


      if (!dryRun) {

        await updateHubSpotTicket(
          ticket.id,
          {

            hs_pipeline_stage:
              targetStage

          }
        );

      }


      changed++;


      results.push({

        ticketId:
          ticket.id,

        boekingscode:
          bookingCode,

        adres:
          ticket.properties?.adres ||
          null,

        excel_status:
          excelBooking.excel_status,

        currentStage,

        targetStage,

        dropbox:
          "niet_nodig",

        action:
          dryRun
            ? "zou_naar_pakket_in_behandeling"
            : "naar_pakket_in_behandeling"

      });


      continue;

    }


    // ======================================
    // EXCEL = DONE
    // DAN MOET DROPBOX OOK KLOPPEN
    // ======================================

    const dropboxPackage =
      await getDropboxPackageByBookingCode(
        bookingCode,
        !dryRun
      );


    // --------------------------------------
    // MAP NIET GEVONDEN
    // --------------------------------------

    if (
      dropboxPackage.reason ===
      "folder_not_found"
    ) {

      dropboxNotFound++;


      const targetStage =
        STAGE_PAKKET_IN_BEHANDELING;


      if (
        currentStage !==
        targetStage
      ) {

        if (!dryRun) {

          await updateHubSpotTicket(
            ticket.id,
            {

              hs_pipeline_stage:
                targetStage

            }
          );

        }


        changed++;

      }

      else {

        unchanged++;

      }


      results.push({

        ticketId:
          ticket.id,

        boekingscode:
          bookingCode,

        adres:
          ticket.properties?.adres ||
          null,

        excel_status:
          "done",

        currentStage,

        targetStage,

        dropbox:
          "map_niet_gevonden_in_4rchive",

        action:
          currentStage ===
          targetStage
            ? "wachten_op_dropbox"
            : (
              dryRun
                ? "zou_wachten_op_dropbox"
                : "wachten_op_dropbox"
            )

      });


      continue;

    }


    // --------------------------------------
    // MEERDERE MAPPEN GEVONDEN
    // --------------------------------------

    if (
      dropboxPackage.reason ===
      "multiple_folders_found"
    ) {

      dropboxMultiple++;


      const targetStage =
        STAGE_PAKKET_IN_BEHANDELING;


      if (
        currentStage !==
        targetStage
      ) {

        if (!dryRun) {

          await updateHubSpotTicket(
            ticket.id,
            {

              hs_pipeline_stage:
                targetStage

            }
          );

        }


        changed++;

      }

      else {

        unchanged++;

      }


      results.push({

        ticketId:
          ticket.id,

        boekingscode:
          bookingCode,

        adres:
          ticket.properties?.adres ||
          null,

        excel_status:
          "done",

        currentStage,

        targetStage,

        dropbox:
          "meerdere_mappen_gevonden",

        matchesCount:
          dropboxPackage.matchesCount ||
          null,

        action:
          "handmatige_controle_nodig"

      });


      continue;

    }


    // --------------------------------------
    // PREVIEW:
    // MAP BESTAAT MAAR NOG GEEN SHARED LINK
    // --------------------------------------

    if (
      dropboxPackage.reason ===
      "shared_link_missing"
    ) {

      dropboxLinkMissing++;


      results.push({

        ticketId:
          ticket.id,

        boekingscode:
          bookingCode,

        adres:
          ticket.properties?.adres ||
          null,

        excel_status:
          "done",

        currentStage,

        targetStage:
          STAGE_AFGEROND,

        dropbox:
          "map_gevonden_link_ontbreekt",

        folder:
          dropboxPackage.folder,

        action:
          dryRun
            ? "zou_shared_link_maken_en_afronden"
            : "shared_link_ontbreekt"

      });


      continue;

    }


    // --------------------------------------
    // DROPBOX VOLLEDIG KLAAR
    // --------------------------------------

    if (
      !dropboxPackage.valid ||
      !dropboxPackage.sharedLink?.url
    ) {

      dropboxLinkMissing++;

      continue;

    }


    dropboxReady++;


    const downloadLink =
      dropboxPackage.sharedLink.url;


    const needsStageUpdate =
      currentStage !==
      STAGE_AFGEROND;


    const needsLinkUpdate =
      currentDownloadLink !==
      downloadLink;


    if (
      !needsStageUpdate &&
      !needsLinkUpdate
    ) {

      unchanged++;


      results.push({

        ticketId:
          ticket.id,

        boekingscode:
          bookingCode,

        adres:
          ticket.properties?.adres ||
          null,

        excel_status:
          "done",

        currentStage,

        targetStage:
          STAGE_AFGEROND,

        dropbox:
          "klaar",

        downloadLink,

        action:
          "geen_wijziging"

      });


      continue;

    }


    if (!dryRun) {

      await updateHubSpotTicket(
        ticket.id,
        {

          hs_pipeline_stage:
            STAGE_AFGEROND,

          download_link:
            downloadLink

        }
      );

    }


    changed++;


    results.push({

      ticketId:
        ticket.id,

      boekingscode:
        bookingCode,

      adres:
        ticket.properties?.adres ||
        null,

      excel_status:
        "done",

      currentStage,

      targetStage:
        STAGE_AFGEROND,

      dropbox:
        "klaar",

      folder:
        dropboxPackage.folder,

      downloadLink,

      sharedLinkCreated:
        Boolean(
          dropboxPackage.sharedLink.created
        ),

      action:
        dryRun
          ? "zou_download_link_opslaan_en_afronden"
          : "download_link_opgeslagen_en_afgerond"

    });

  }


  return {

    dryRun,

    scope:
      contactId
        ? "makelaar"
        : "all",

    contactId:
      contactId ||
      null,

    excelFile: {

      name:
        excel.fileInfo.name,

      lastModifiedDateTime:
        excel.fileInfo.lastModifiedDateTime,

      bookings:
        excel.bookings.size

    },

    hubspot: {

      ticketsWithBookingCode:
        tickets.length,

      ownedTicketsChecked:
        contactId
          ? owned
          : null

    },

    summary: {

      matched,

      changed,

      unchanged,

      skipped,

      notFound,

      notOwned:
        contactId
          ? notOwned
          : 0,

      dropboxReady,

      dropboxNotFound,

      dropboxMultiple,

      dropboxLinkMissing

    },

    performance: {

      durationMs:
        Date.now() -
        startedAt,

      excelCacheTtlMs:
        EXCEL_CACHE_TTL_MS,

      ownershipMode:
        contactId
          ? "bestaande_per_ticket_check"
          : "niet_van_toepassing"

    },

    results

  };

}


// ==========================================
// MICROSOFT SHARED FILES
// ==========================================

async function getSharedFiles() {

  const accessToken =
    await getAccessToken();


  const response =
    await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?allowexternal=true",
      {

        headers: {

          Authorization:
            `Bearer ${accessToken}`

        }

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error?.message ||
      "Gedeelde bestanden ophalen mislukt."
    );

  }


  return data.value ||
    [];

}


// ==========================================
// API HANDLER
// ==========================================

export default async function handler(
  req,
  res
) {

  if (
    enableCors(
      req,
      res
    )
  ) {

    return;

  }


  if (
    req.method !==
    "GET"
  ) {

    return res
      .status(405)
      .json({

        success:
          false,

        message:
          "Method not allowed"

      });

  }


  try {

    const dropboxState =
      getCookie(
        req,
        "dropbox_oauth_state"
      );


    if (
      req.query?.code &&
      req.query?.state &&
      dropboxState
    ) {

      return await handleDropboxOAuthCallback(
        req,
        res
      );

    }


    const action =
      req.query?.action ||
      "connect";


    // ======================================
    // DROPBOX CONNECT
    // ======================================

    if (
      action ===
      "dropbox-connect"
    ) {

      return startDropboxOAuth(
        req,
        res
      );

    }


    // ======================================
    // DROPBOX TEST
    // ======================================

    if (
      action ===
      "dropbox-test"
    ) {

      const result =
        await testDropboxConnection();


      return res
        .status(200)
        .json({

          success:
            true,

          message:
            "Dropbox verbinding werkt.",

          authentication:
            process.env.DROPBOX_REFRESH_TOKEN
              ? "refresh_token"
              : "temporary_access_token",

          dropbox:
            result

        });

    }


    // ======================================
    // DROPBOX TAG TEST
    // ======================================

    if (
      action ===
      "dropbox-tag-test"
    ) {

      const code =
        req.query?.code;


      if (!code) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Parameter code ontbreekt."

          });

      }


      const result =
        await findDropboxFolderByTag(
          code
        );


      return res
        .status(200)
        .json({

          success:
            true,

          method:
            "search_v2_then_exact_tag_check",

          ...result

        });

    }


    // ======================================
    // DROPBOX LINK TEST
    // ======================================

    if (
      action ===
      "dropbox-link-test"
    ) {

      const code =
        req.query?.code;


      if (!code) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Parameter code ontbreekt."

          });

      }


      const result =
        await getDropboxPackageLinkByBookingCode(
          code
        );


      return res
        .status(
          result.valid
            ? 200
            : 404
        )
        .json({

          success:
            result.valid,

          ...result

        });

    }


    // ======================================
    // HUBSPOT SYNC PREVIEW
    // ======================================

    if (
      action ===
      "hubspot-sync-preview"
    ) {

      const contactId =
        req.query?.contact_id
          ? String(
              req.query.contact_id
            )
          : null;


      const result =
        await syncHubSpotWithExcel(
          true,
          contactId
        );


      return res
        .status(200)
        .json({

          success:
            true,

          ...result

        });

    }


    // ======================================
    // HUBSPOT SYNC
    // ======================================

    if (
      action ===
      "hubspot-sync"
    ) {

      const contactId =
        req.query?.contact_id
          ? String(
              req.query.contact_id
            )
          : null;


      const result =
        await syncHubSpotWithExcel(
          false,
          contactId
        );


      return res
        .status(200)
        .json({

          success:
            true,

          ...result

        });

    }


    // ======================================
    // BOOKING STATUS
    // ======================================

    if (
      action ===
      "booking-status"
    ) {

      const booking =
        await getBookingStatus(
          req.query?.code
        );


      return res
        .status(
          booking.found
            ? 200
            : 404
        )
        .json({

          success:
            booking.found,

          ...booking

        });

    }


    // ======================================
    // EXCEL INFO
    // ======================================

    if (
      action ===
      "excel-info"
    ) {

      return res
        .status(200)
        .json({

          success:
            true,

          file:
            await getExcelFileInfo()

        });

    }


    // ======================================
    // EXCEL DOWNLOAD TEST
    // ======================================

    if (
      action ===
      "excel-download-test"
    ) {

      const result =
        await downloadExcelFile();


      return res
        .status(200)
        .json({

          success:
            true,

          bytes:
            result.buffer.length,

          file:
            result.fileInfo

        });

    }


    // ======================================
    // XLSX TEST
    // ======================================

    if (
      action ===
      "xlsx-test"
    ) {

      const XLSX =
        loadXlsx();


      return res
        .status(200)
        .json({

          success:
            true,

          version:
            XLSX.version ||
            null

        });

    }


    // ======================================
    // SHARED FILES
    // ======================================

    if (
      action ===
      "shared-files"
    ) {

      const files =
        await getSharedFiles();


      return res
        .status(200)
        .json({

          success:
            true,

          count:
            files.length,

          files

        });

    }


    // ======================================
    // DEFAULT MICROSOFT OAUTH
    // ======================================

    const clientId =
      process.env.MICROSOFT_CLIENT_ID;

    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI;


    const state =
      crypto
        .randomBytes(24)
        .toString("hex");


    res.setHeader(
      "Set-Cookie",
      [
        `microsoft_oauth_state=${state}`,
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=600"
      ].join("; ")
    );


    const params =
      new URLSearchParams({

        client_id:
          clientId,

        response_type:
          "code",

        redirect_uri:
          redirectUri,

        response_mode:
          "query",

        scope:
          [
            "offline_access",
            "User.Read",
            "Files.Read.All"
          ].join(" "),

        state,

        prompt:
          "select_account"

      });


    return res.redirect(
      302,
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
    );

  }

  catch (error) {

    console.error(
      "INTEGRATION CONNECT ERROR",
      error
    );


    return res
      .status(500)
      .json({

        success:
          false,

        message:
          error.message

      });

  }

}
