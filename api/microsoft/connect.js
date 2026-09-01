import crypto from "crypto";


// ==========================================
// MICROSOFT ACCESS TOKEN VIA REFRESH TOKEN
// ==========================================

async function getAccessToken() {

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

    console.error(
      "MICROSOFT REFRESH TOKEN ERROR",
      data
    );


    throw new Error(
      data.error_description ||
      data.error ||
      "Microsoft access token ophalen mislukt."
    );

  }


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
// EXCELBESTAND VIA SHARELINK OPHALEN
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

    console.error(
      "MICROSOFT EXCEL FILE ERROR",
      data
    );


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
// GEDEELDE BESTANDEN OPHALEN
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

    console.error(
      "MICROSOFT SHARED FILES ERROR",
      data
    );


    throw new Error(
      data.error?.message ||
      "Gedeelde bestanden ophalen mislukt."
    );

  }


  return (
    data.value ||
    []
  ).map(
    item => {

      const remoteItem =
        item.remoteItem ||
        {};


      return {

        name:
          remoteItem.name ||
          item.name ||
          null,

        itemId:
          remoteItem.id ||
          item.id ||
          null,

        driveId:
          remoteItem.parentReference?.driveId ||
          item.parentReference?.driveId ||
          null,

        path:
          remoteItem.parentReference?.path ||
          item.parentReference?.path ||
          null,

        webUrl:
          remoteItem.webUrl ||
          item.webUrl ||
          null,

        size:
          remoteItem.size ||
          item.size ||
          null,

        fileType:
          remoteItem.file?.mimeType ||
          item.file?.mimeType ||
          null

      };

    }
  );

}


// ==========================================
// API HANDLER
// ==========================================

export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "GET"
  ) {

    return res
      .status(405)
      .json({
        success: false,
        message:
          "Method not allowed"
      });

  }


  try {

    const action =
      req.query?.action ||
      "connect";


    // ======================================
    // ACTION: EXCEL INFO
    // ======================================

    if (
      action ===
      "excel-info"
    ) {

      const file =
        await getExcelFileInfo();


      return res
        .status(200)
        .json({

          success:
            true,

          file:
            file

        });

    }


    // ======================================
    // ACTION: SHARED FILES
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

          files:
            files

        });

    }


    // ======================================
    // DEFAULT ACTION:
    // MICROSOFT OAUTH LOGIN
    // ======================================

    const clientId =
      process.env.MICROSOFT_CLIENT_ID;

    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI;


    if (
      !clientId ||
      !redirectUri
    ) {

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Microsoft environment variables ontbreken."
        });

    }


    // ======================================
    // CSRF STATE
    // ======================================

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


    // ======================================
    // MICROSOFT OAUTH URL
    // ======================================

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

        state:
          state,

        prompt:
          "select_account"

      });


    const authorizationUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;


    return res.redirect(
      302,
      authorizationUrl
    );

  }

  catch (error) {

    console.error(
      "MICROSOFT CONNECT ERROR",
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
