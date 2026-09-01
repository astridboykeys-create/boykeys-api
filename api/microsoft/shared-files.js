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
      "Microsoft environment variables ontbreken."
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

    const accessToken =
      await getAccessToken();


    // ======================================
    // GEDEELDE BESTANDEN OPHALEN
    // allowexternal=true is belangrijk voor
    // bestanden uit andere tenants/accounts
    // ======================================

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


      return res
        .status(response.status)
        .json({
          success: false,
          message:
            data.error?.message ||
            "Gedeelde bestanden ophalen mislukt."
        });

    }


    // ======================================
    // RESULTAAT OPSCHONEN
    // ======================================

    const files =
      (data.value || [])
        .map(
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

  catch (error) {

    console.error(
      "MICROSOFT SHARED FILES ERROR",
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
