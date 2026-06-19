import { enableCors } from "../../lib/cors.js";
import { createOAuthClient } from "../../lib/googleAuth.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  try {

    const { code } = req.query;

    if (!code) {

      return res.status(400).json({
        error: "Geen authorization code ontvangen"
      });

    }

    const oauth2Client =
      createOAuthClient();

    const { tokens } =
      await oauth2Client.getToken(code);

    return res.status(200).json({

      success: true,

      tokens

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      error: error.message

    });

  }

}
