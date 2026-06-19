import { google } from "googleapis";

export function createGoogleCalendarClient() {

  const auth =
    new google.auth.GoogleAuth({

      credentials: {

        project_id:
          process.env.GOOGLE_PROJECT_ID,

        client_email:
          process.env.GOOGLE_CLIENT_EMAIL,

        private_key:
          process.env.GOOGLE_PRIVATE_KEY.replace(
            /\\n/g,
            "\n"
          )

      },

      scopes: [
        "https://www.googleapis.com/auth/calendar"
      ]

    });

  return google.calendar({

    version: "v3",

    auth

  });

}
