import { google } from "googleapis";

export function createGoogleCalendarClient() {

  const credentials =
    JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT
    );

  const auth =
    new google.auth.GoogleAuth({

      credentials,

      scopes: [
        "https://www.googleapis.com/auth/calendar"
      ]

    });

  return google.calendar({

    version: "v3",

    auth

  });

}
