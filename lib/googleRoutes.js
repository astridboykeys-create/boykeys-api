export async function getTravelInfo(
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
            "routes.distanceMeters,routes.duration"

        },

        body: JSON.stringify({

          origin: {
            location: {
              latLng: {
                latitude: parseFloat(fromLat),
                longitude: parseFloat(fromLng)
              }
            }
          },

          destination: {
            location: {
              latLng: {
                latitude: parseFloat(toLat),
                longitude: parseFloat(toLng)
              }
            }
          },

          travelMode: "DRIVE"

        })

      }
    );

  const data =
    await response.json();

  const route =
    data.routes?.[0];

  if (!route) {
    throw new Error(
      "Geen route gevonden"
    );
  }

  return {

    distance_km:
      Math.round(
        route.distanceMeters / 1000
      ),

    travel_minutes:
      Math.round(
        parseInt(route.duration) / 60
      )

  };

}
