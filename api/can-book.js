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
      start,
      einde
    } = req.query;

    if (
      !photographer_id ||
      !start ||
      !einde
    ) {

      return res.status(400).json({
        error:
          "photographer_id, start en einde zijn verplicht"
      });

    }

    const nieuweStart =
      new Date(start);

    const nieuweEinde =
      new Date(einde);

    // Alle ingeplande tickets ophalen
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
  "afspraak_start",
  "afspraak_einde",
  "latitude",
  "longitude"

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

      start:
        ticket.properties
          .afspraak_start,

      einde:
        ticket.properties
          .afspraak_einde,

      latitude:
        ticket.properties
          .latitude,

      longitude:
        ticket.properties
          .longitude

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
    nieuweStart
  ) {

    previousBooking =
      booking;

  }

  if (
    bookingStart >=
      nieuweEinde &&
    !nextBooking
  ) {

    nextBooking =
      booking;

  }

}

    let overlapFound =
      false;

    let overlapBooking =
      null;

    for (
      const ticket of
      searchData.results || []
    ) {

      const bestaandeStart =
        new Date(
          ticket.properties
            .afspraak_start
        );

      const bestaandeEinde =
        new Date(
          ticket.properties
            .afspraak_einde
        );

      const overlap =

        nieuweStart <
          bestaandeEinde &&

        nieuweEinde >
          bestaandeStart;

      if (overlap) {

        overlapFound =
          true;

        overlapBooking = {

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
              .afspraak_einde

        };

        break;

      }

    }

    console.log(
  "Previous booking:",
  previousBooking
);

console.log(
  "Next booking:",
  nextBooking
);

   return res.status(200).json({

  canBook:
    !overlapFound,

  overlap:
    overlapFound,

  conflict:
    overlapBooking,

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
