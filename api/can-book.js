function addMinutes(date, minutes) {

  return new Date(
    date.getTime() +
    minutes * 60 * 1000
  );

}

function subtractMinutes(date, minutes) {

  return new Date(
    date.getTime() -
    minutes * 60 * 1000
  );

}

function hasOverlap(
  start1,
  end1,
  start2,
  end2
) {

  return (
    start1 < end2 &&
    end1 > start2
  );

}

async function getTravelTime(
  fromLat,
  fromLng,
  toLat,
  toLng
) {

  const response =
    await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "X-Goog-Api-Key":
            process.env.GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters"
        },
        body: JSON.stringify({

          origin: {
            location: {
              latLng: {
                latitude:
                  parseFloat(fromLat),
                longitude:
                  parseFloat(fromLng)
              }
            }
          },

          destination: {
            location: {
              latLng: {
                latitude:
                  parseFloat(toLat),
                longitude:
                  parseFloat(toLng)
              }
            }
          },

          travelMode:
            "DRIVE"

        })

      }
    );

  const data =
    await response.json();

  if (
    !data.routes ||
    !data.routes.length
  ) {

    throw new Error(
      "Geen route gevonden"
    );

  }

  const duration =
    data.routes[0].duration;

  const distanceMeters =
    data.routes[0].distanceMeters;

  return {

    travel_minutes:
      Math.round(
        parseInt(duration) / 60
      ),

    distance_km:
      Math.round(
        distanceMeters / 1000
      )

  };

}


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
  hasOverlap(

    nieuweStart,
    nieuweEinde,

    bestaandeStart,
    bestaandeEinde

  );

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
