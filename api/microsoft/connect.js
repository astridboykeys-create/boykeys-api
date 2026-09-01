import crypto from "crypto";
import { createRequire } from "node:module";


// ==========================================
// HUBSPOT PIPELINE STAGES
// ==========================================

const STAGE_OPNAMEDAG = "5980739821";
const STAGE_PAKKET_IN_BEHANDELING = "5980739822";
const STAGE_AFGEROND = "4";


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
        method: "POST",

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


  if (!data.access_token) {

    throw new Error(
      "Microsoft heeft geen access token teruggegeven."
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
// EXCELBESTAND DOWNLOADEN
// ==========================================

async function downloadExcelFile() {

  const fileInfo =
    await getExcelFileInfo();


  if (
    !fileInfo.driveId ||
    !fileInfo.itemId
  ) {

    throw new Error(
      "Geen driveId of itemId gevonden voor het Excelbestand."
    );

  }


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

    const text =
      await response.text();


    console.error(
      "MICROSOFT EXCEL DOWNLOAD ERROR",
      response.status,
      text
    );


    throw new Error(
      `Excel download mislukt: ${response.status}`
    );

  }


  const arrayBuffer =
    await response.arrayBuffer();


  const buffer =
    Buffer.from(
      arrayBuffer
    );


  return {

    fileInfo:
      fileInfo,

    buffer:
      buffer

  };

}


// ==========================================
// XLSX PACKAGE LADEN
// ==========================================

function loadXlsx() {

  try {

    const require =
      createRequire(
        import.meta.url
      );


    return require(
      "xlsx"
    );

  }

  catch (error) {

    console.error(
      "XLSX PACKAGE LOAD ERROR",
      error
    );


    throw new Error(
      `XLSX package kon niet worden geladen: ${error.message}`
    );

  }

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
// EXCEL PRODUCTIESTATUSSEN INLEZEN
//
// C = boekingscode
// D = productiestatus
// ==========================================

async function getExcelBookingMap() {

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

      const bookingCell =
        worksheet[
          XLSX.utils.encode_cell({
            c: 2,
            r: row
          })
        ];


      const statusCell =
        worksheet[
          XLSX.utils.encode_cell({
            c: 3,
            r: row
          })
        ];


      const bookingCode =
        getCellValue(
          bookingCell
        )
          .toLowerCase();


      if (!bookingCode) {
        continue;
      }


      const excelStatus =
        getCellValue(
          statusCell
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

    bookings:
      bookings

  };

}


// ==========================================
// ÉÉN BOEKING ZOEKEN
// ==========================================

async function getBookingStatus(
  bookingCode
) {

  const cleanBookingCode =
    String(
      bookingCode ||
      ""
    )
      .trim()
      .toLowerCase();


  if (!cleanBookingCode) {

    throw new Error(
      "Geen boekingscode opgegeven."
    );

  }


  const excel =
    await getExcelBookingMap();


  const booking =
    excel.bookings.get(
      cleanBookingCode
    );


  if (!booking) {

    return {

      found:
        false,

      boekingscode:
        cleanBookingCode,

      excel_status:
        null,

      productiestatus:
        null

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

  const token =
    getHubSpotToken();


  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {

          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          ...(options.headers || {})

        }
      }
    );


  let data =
    null;


  const text =
    await response.text();


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
// HUBSPOT TICKETS MET BOEKINGSCODE OPHALEN
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
        "afspraak_einde"
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
// HUBSPOT TICKETSTAGE WIJZIGEN
// ==========================================

async function updateHubSpotTicketStage(
  ticketId,
  stageId
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

          properties: {

            hs_pipeline_stage:
              stageId

          }

        })
    }
  );

}


// ==========================================
// BEPALEN WAT ER MET EEN TICKET MOET GEBEUREN
// ==========================================

function determineTargetStage(
  currentStage,
  excelStatus
) {

  if (
    currentStage !==
      STAGE_OPNAMEDAG &&
    currentStage !==
      STAGE_PAKKET_IN_BEHANDELING
  ) {

    return null;

  }


  if (
    excelStatus ===
    "done"
  ) {

    return STAGE_AFGEROND;

  }


  return STAGE_PAKKET_IN_BEHANDELING;

}


// ==========================================
// HUBSPOT / EXCEL SYNC
//
// dryRun = true  -> alleen bekijken
// dryRun = false -> HubSpot echt wijzigen
// ==========================================

async function syncHubSpotWithExcel(
  dryRun = true
) {

  const excel =
    await getExcelBookingMap();


  const hubSpotTickets =
    await getHubSpotTicketsWithBookingCode();


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


  for (
    const ticket of hubSpotTickets
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


    if (!bookingCode) {

      skipped++;

      continue;

    }


    // Alleen productie-gerelateerde stages.
    if (
      currentStage !==
        STAGE_OPNAMEDAG &&
      currentStage !==
        STAGE_PAKKET_IN_BEHANDELING
    ) {

      skipped++;

      continue;

    }


    const excelBooking =
      excel.bookings.get(
        bookingCode
      );


    if (!excelBooking) {

      notFound++;


      results.push({

        ticketId:
          ticket.id,

        boekingscode:
          bookingCode,

        adres:
          ticket.properties?.adres ||
          null,

        currentStage:
          currentStage,

        action:
          "niet_gevonden_in_excel"

      });


      continue;

    }


    matched++;


    const targetStage =
      determineTargetStage(
        currentStage,
        excelBooking.excel_status
      );


    if (!targetStage) {

      skipped++;

      continue;

    }


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

        currentStage:
          currentStage,

        targetStage:
          targetStage,

        action:
          "geen_wijziging"

      });


      continue;

    }


    if (!dryRun) {

      await updateHubSpotTicketStage(
        ticket.id,
        targetStage
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

      excel_sheet:
        excelBooking.sheet,

      excel_row:
        excelBooking.row,

      currentStage:
        currentStage,

      targetStage:
        targetStage,

      action:
        dryRun
          ? "zou_wijzigen"
          : "gewijzigd"

    });

  }


  return {

    dryRun:
      dryRun,

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
        hubSpotTickets.length

    },

    summary: {

      matched:
        matched,

      changed:
        changed,

      unchanged:
        unchanged,

      skipped:
        skipped,

      notFound:
        notFound

    },

    results:
      results

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
        success:
          false,

        message:
          "Method not allowed"
      });

  }


  try {

    const action =
      req.query?.action ||
      "connect";


    // ======================================
    // HUBSPOT SYNC PREVIEW
    // GEEN WIJZIGINGEN
    // ======================================

    if (
      action ===
      "hubspot-sync-preview"
    ) {

      const result =
        await syncHubSpotWithExcel(
          true
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
    // WIJZIGT TICKETS ECHT
    // ======================================

    if (
      action ===
      "hubspot-sync"
    ) {

      const result =
        await syncHubSpotWithExcel(
          false
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


      const booking =
        await getBookingStatus(
          code
        );


      if (!booking.found) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Boekingscode niet gevonden in Excel.",

            boekingscode:
              booking.boekingscode

          });

      }


      return res
        .status(200)
        .json({

          success:
            true,

          boekingscode:
            booking.boekingscode,

          excel_status:
            booking.excel_status,

          productiestatus:
            booking.productiestatus,

          sheet:
            booking.sheet,

          row:
            booking.row

        });

    }


    // ======================================
    // EXCEL INFO
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
    // EXCEL DOWNLOAD TEST
    // ======================================

    if (
      action ===
      "excel-download-test"
    ) {

      const result =
        await downloadExcelFile();


      const bytes =
        result.buffer.length;


      return res
        .status(200)
        .json({

          success:
            true,

          file: {

            name:
              result.fileInfo.name,

            driveId:
              result.fileInfo.driveId,

            itemId:
              result.fileInfo.itemId,

            mimeType:
              result.fileInfo.mimeType,

            lastModifiedDateTime:
              result.fileInfo.lastModifiedDateTime,

            bytes:
              bytes,

            megabytes:
              Number(
                (
                  bytes /
                  1024 /
                  1024
                ).toFixed(2)
              )

          }

        });

    }


    // ======================================
    // XLSX PACKAGE TEST
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

          message:
            "XLSX package is geladen.",

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

          files:
            files

        });

    }


    // ======================================
    // DEFAULT: MICROSOFT OAUTH
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

          success:
            false,

          message:
            "Microsoft environment variables ontbreken."

        });

    }


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
