function getCookie(
  req,
  name
) {

  const cookieHeader =
    req.headers.cookie || "";

  const cookies =
    cookieHeader
      .split(";")
      .map(
        cookie =>
          cookie.trim()
      );


  for (
    const cookie of cookies
  ) {

    const separatorIndex =
      cookie.indexOf("=");


    if (
      separatorIndex === -1
    ) {
      continue;
    }


    const key =
      cookie.slice(
        0,
        separatorIndex
      );

    const value =
      cookie.slice(
        separatorIndex + 1
      );


    if (
      key === name
    ) {

      return decodeURIComponent(
        value
      );

    }

  }


  return null;

}


export default async function handler(
  req,
  res
) {

  if (
    req.method !== "GET"
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

    const {
      code,
      state,
      error,
      error_description
    } =
      req.query || {};


    // ==========================================
    // MICROSOFT ERROR
    // ==========================================

    if (error) {

      return res
        .status(400)
        .send(`
          <html>
            <body style="
              font-family: Arial, sans-serif;
              padding: 40px;
            ">
              <h1>Microsoft-login mislukt</h1>
              <p>${String(
                error_description ||
                error
              )}</p>
            </body>
          </html>
        `);

    }


    // ==========================================
    // VALIDATIE
    // ==========================================

    if (!code) {

      return res
        .status(400)
        .json({
          success: false,
          message:
            "Authorization code ontbreekt."
        });

    }


    const storedState =
      getCookie(
        req,
        "microsoft_oauth_state"
      );


    if (
      !state ||
      !storedState ||
      state !== storedState
    ) {

      return res
        .status(400)
        .json({
          success: false,
          message:
            "OAuth state is ongeldig of verlopen."
        });

    }


    const clientId =
      process.env.MICROSOFT_CLIENT_ID;

    const clientSecret =
      process.env.MICROSOFT_CLIENT_SECRET;

    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI;


    if (
      !clientId ||
      !clientSecret ||
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


    // ==========================================
    // AUTHORIZATION CODE -> TOKENS
    // ==========================================

    const tokenResponse =
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

              code:
                String(code),

              redirect_uri:
                redirectUri,

              grant_type:
                "authorization_code",

              scope:
                [
                  "offline_access",
                  "User.Read",
                  "Files.Read.All"
                ].join(" ")

            })

        }
      );


    const tokenData =
      await tokenResponse.json();


    if (
      !tokenResponse.ok
    ) {

      console.error(
        "MICROSOFT TOKEN ERROR",
        tokenData
      );


      return res
        .status(500)
        .json({

          success:
            false,

          message:
            tokenData.error_description ||
            tokenData.error ||
            "Token ophalen mislukt."

        });

    }


    const accessToken =
      tokenData.access_token;

    const refreshToken =
      tokenData.refresh_token;


    if (
      !accessToken ||
      !refreshToken
    ) {

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Microsoft heeft geen access- en/of refresh token teruggegeven."
        });

    }


    // ==========================================
    // TEST GRAPH LOGIN
    // ==========================================

    const meResponse =
      await fetch(
        "https://graph.microsoft.com/v1.0/me",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );


    const meData =
      await meResponse.json();


    if (
      !meResponse.ok
    ) {

      console.error(
        "MICROSOFT GRAPH /ME ERROR",
        meData
      );


      return res
        .status(500)
        .json({
          success: false,
          message:
            "Microsoft-login werkte, maar Graph kon het account niet uitlezen."
        });

    }


    // ==========================================
    // STATE COOKIE VERWIJDEREN
    // ==========================================

    res.setHeader(
      "Set-Cookie",
      [
        "microsoft_oauth_state=",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=0"
      ].join("; ")
    );


    // ==========================================
    // EERSTE INSTALLATIE:
    // REFRESH TOKEN EENMALIG TONEN
    // ==========================================

    const safeDisplayName =
      String(
        meData.displayName ||
        "Microsoft-gebruiker"
      )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");


    const safeRefreshToken =
      String(
        refreshToken
      )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");


    return res
      .status(200)
      .send(`
<!DOCTYPE html>

<html lang="nl">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>
    Boykeys Excel Sync
  </title>

</head>

<body
  style="
    font-family:
      Arial,
      sans-serif;

    max-width:
      900px;

    margin:
      50px auto;

    padding:
      0 24px;

    line-height:
      1.5;
  "
>

  <h1>
    Microsoft gekoppeld ✅
  </h1>

  <p>
    Ingelogd als:
    <strong>
      ${safeDisplayName}
    </strong>
  </p>

  <p>
    De Microsoft Graph API werkt.
  </p>

  <hr>

  <h2>
    Laatste installatiestap
  </h2>

  <p>
    Kopieer onderstaande refresh token
    en zet hem in Vercel als:
  </p>

  <p>
    <strong>
      MICROSOFT_REFRESH_TOKEN
    </strong>
  </p>

  <textarea
    readonly
    style="
      width: 100%;
      min-height: 180px;
      padding: 12px;
      box-sizing: border-box;
      font-family: monospace;
    "
  >${safeRefreshToken}</textarea>

  <p>
    <strong>
      Deel deze token nergens.
    </strong>
    Hij geeft toegang tot de Microsoft-bestanden
    waarvoor je toestemming hebt gegeven.
  </p>

</body>

</html>
      `);

  }

  catch (error) {

    console.error(
      "MICROSOFT CALLBACK ERROR",
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
