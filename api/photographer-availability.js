export default async function handler(
  req,
  res
) {

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

    const searchResponse =
      await fetch(
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
              "latitude",
              "longitude",
              "afspraak_start",
              "afspraak_einde"

            ],

            limit: 100

          })
        }
      );

    const searchData =
      await searchResponse.json();

    const bookings =
      (searchData.results || [])
        .map(ticket => ({

          ticketId:
            ticket.id,

          adres:
            ticket.properties
              .volledig_adres_google,

          latitude:
            ticket.properties
              .latitude,

          longitude:
            ticket.properties
              .longitude,

          start:
            ticket.properties
              .afspraak_start,

          einde:
            ticket.properties
              .afspraak_einde

        }))

        .sort(
          (a, b) =>
            new Date(a.einde) -
            new Date(b.einde)
        );

    if (
      bookings.length === 0
    ) {

      return res.status(200).json({

        photographer_id,

        hasBookings:
          false,

        availableNow:
          true

      });

    }

    const laatsteBoeking =
      bookings[
        bookings.length - 1
      ];

    const bufferMinutes =
      parseInt(
        process.env
          .DEFAULT_BUFFER_MINUTES || "15"
      );

    const beschikbaarVanaf =
      new Date(
        new Date(
          laatsteBoeking.einde
        ).getTime() +

        bufferMinutes *
        60 *
        1000
      );

    return res.status(200).json({

      photographer_id,

      hasBookings:
        true,

      laatste_boeking:
        laatsteBoeking,

      buffer_minutes:
        bufferMinutes,

      beschikbaar_vanaf:
        beschikbaarVanaf

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      error:
        error.message

    });

  }

}
