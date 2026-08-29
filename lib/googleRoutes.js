// ============================================
// Google Routes / Geocoding
// ============================================


// ============================================
// Adres -> latitude / longitude
// ============================================

export async function geocodeAddress(
  address
) {

  if (!address) {

    throw new Error(
      "Geen adres opgegeven voor geocoding."
    );

  }


  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    "?address=" +
    encodeURIComponent(address) +
    "&region=nl" +
    "&key=" +
    encodeURIComponent(
      process.env.GOOGLE_MAPS_API_KEY
    );


  const response =
    await fetch(url);


  const data =
    await response.json();


  if (
    !response.ok ||
    data.status !== "OK" ||
    !data.results?.length
  ) {

    console.error(
      "GEOCODING ERROR:",
      address,
      data
    );


    throw new Error(
      `Adres kon niet worden gevonden: ${address}`
    );

  }


  const location =
    data.results[0]
      .geometry
      .location;


  return {

    latitude:
      location.lat,

    longitude:
      location.lng,

    formatted_address:
      data.results[0]
        .formatted_address

  };

}


// ============================================
// Reistijd tussen twee coördinaten
// ============================================

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

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          "X-Goog-Api-Key":
            process.env.GOOGLE_MAPS_API_KEY,

          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration"

        },

        body:
          JSON.stringify({

            origin: {

              location: {

                latLng: {

                  latitude:
                    parseFloat(
                      fromLat
                    ),

                  longitude:
                    parseFloat(
                      fromLng
                    )

                }

              }

            },


            destination: {

              location: {

                latLng: {

                  latitude:
                    parseFloat(
                      toLat
                    ),

                  longitude:
                    parseFloat(
                      toLng
                    )

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


  if (!response.ok) {

    console.error(
      "GOOGLE ROUTES ERROR:",
      data
    );


    throw new Error(
      data.error?.message ||
      "Google Routes fout"
    );

  }


  const route =
    data.routes?.[0];


  if (!route) {

    throw new Error(
      "Geen route gevonden"
    );

  }


  /*
   * Google geeft duration bijvoorbeeld terug als:
   *
   * "1078s"
   *
   * parseInt maakt daar 1078 van.
   */

  const durationSeconds =
    parseInt(
      route.duration,
      10
    );


  /*
   * Reistijd bewust OMHOOG afronden.
   *
   * 18,1 minuut wordt dus 19 minuten.
   * Voor planning is dat veiliger dan
   * Math.round().
   */

  const travelMinutes =
    Math.ceil(
      durationSeconds / 60
    );


  return {

    distance_km:
      Math.round(
        route.distanceMeters /
        1000
      ),

    travel_minutes:
      travelMinutes

  };

}
