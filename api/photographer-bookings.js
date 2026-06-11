export default async function handler(
  req,
  res
) {

  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "*"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      photographer_id
    } = req.query;

    if (!photographer_id) {

      return res.status(400).json({
        error:
          "photographer_id ontbreekt"
      });

    }

    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/tickets/search",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({

          filterGroups: [
            {
              filters: [

                {
                  propertyName:
                    "geselecteerde_fotograaf",
                  operator: "EQ",
                  value:
                    photographer_id
                },

                {
                  propertyName:
                    "booking_status",
                  operator: "EQ",
                  value:
                    "Ingepland"
                }

              ]
            }
          ],

          properties: [

            "volledig_adres_google",
            "afspraak_start",
            "afspraak_einde",
            "booking_status",
            "geselecteerde_fotograaf"

          ],

          limit: 100

        })
      }
    );

    const data =
      await response.json();

    console.log(
      "TICKETS GEVONDEN"
    );

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    const bookings =
      (data.results || [])
        .map(ticket => ({

          ticketId:
            ticket.id,

          adres:
            ticket.properties
              .volledig_adres_google,

          start:
            ticket.properties
              .afspraak_start,

          einde:
            ticket.properties
              .afspraak_einde,

          booking_status:
            ticket.properties
              .booking_status

        }));

    return res.status(200).json({

      photographer_id,

      totaal:
        bookings.length,

      bookings

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }

}
