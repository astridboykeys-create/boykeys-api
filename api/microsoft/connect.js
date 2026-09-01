import crypto from "crypto";

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }


  try {

    const clientId =
      process.env.MICROSOFT_CLIENT_ID;

    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI;


    if (
      !clientId ||
      !redirectUri
    ) {

      return res.status(500).json({
        success: false,
        message:
          "Microsoft environment variables ontbreken."
      });

    }


    // ==========================================
    // CSRF STATE
    // ==========================================

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


    // ==========================================
    // MICROSOFT OAUTH URL
    // ==========================================

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


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

}
