import { createGoogleCalendarClient }
  from "../../lib/googleCalendar.js";

export default async function handler(
  req,
  res
) {

  try {

    const calendar =
      createGoogleCalendarClient();

    const response =
      await calendar.events.insert({

        calendarId:
          "c_b43ebbbd82bf277769656887fbb4e07d53dd964228b510111722e51dfb8cb607@group.calendar.google.com",

        requestBody: {

          summary:
            "Test Boykeys",

          start: {

            dateTime:
              new Date(
                Date.now() +
                600000
              ).toISOString()

          },

          end: {

            dateTime:
              new Date(
                Date.now() +
                960000
              ).toISOString()

          }

        }

      });

    return res.json({

      success: true,

      eventId:
        response.data.id

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

}
