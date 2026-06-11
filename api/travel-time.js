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
      fromLat,
      fromLng,
      toLat,
      toLng
    } = req.query;

    if (
      !fromLat ||
      !fromLng ||
      !toLat ||
      !toLng
    ) {

      return res.status(400).json({
        error:
          "fromLat, fromLng, toLat en toLng zijn verplicht"
      });

    }

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
              "routes.distanceMeters,routes.duration"

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

    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    const route =
      data.routes?.[0];

if (!route) {

  return res.status(404).json({

    error:
      "Geen route gevonden",

    googleResponse:
      data

  });

}

    const distanceKm =
      Math.round(
        route.distanceMeters / 1000
      );

    const travelMinutes =
      Math.round(
        parseInt(
          route.duration
        ) / 60
      );

    return res.status(200).json({

      distance_km:
        distanceKm,

      travel_minutes:
        travelMinutes

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error.message
    });

  }

}
