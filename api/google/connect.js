import { enableCors } from "../../lib/cors.js";
import { createOAuthClient } from "../../lib/googleAuth.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  const oauth2Client =
    createOAuthClient();

  const url =
    oauth2Client.generateAuthUrl({

      access_type: "offline",

      prompt: "consent",

      scope: [
        "https://www.googleapis.com/auth/calendar"
      ]

    });

  return res.redirect(url);

}
