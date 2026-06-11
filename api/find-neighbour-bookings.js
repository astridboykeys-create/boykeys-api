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
      photographer_id,
      requested_start
    } = req.query;

    if (
      !photographer_id ||
      !requested_start
    ) {

      return res.status(400).json({
        error:
          "photographer_id en requested_start zijn verplicht"
      });

    }

    const requestedDate =
      new Date(
        requested_start
      );

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
            new Date(a.start) -
            new Date(b.start)
        );

    let previousBooking =
      null;

    let nextBooking =
      null;

    for (
      const booking of bookings
    ) {

      const bookingStart =
        new Date(
          booking.start
        );

      const bookingEnd =
        new Date(
          booking.einde
        );

      if (
        bookingEnd <=
        requestedDate
      ) {

        previousBooking =
          booking;

      }

      if (
        bookingStart >
          requestedDate &&
        !nextBooking
      ) {

        nextBooking =
          booking;

      }

    }

    return res.status(200).json({

      requested_start:
        requestedDate,

      previousBooking,

      nextBooking

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error.message
    });

  }

}
