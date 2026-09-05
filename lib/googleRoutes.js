// ============================================
// Google Routes / Geocoding
// ============================================


// ============================================
// CONSTANTS
// ============================================

const ROUTE_MATRIX_CHUNK_SIZE =
  25;


// ============================================
// HELPERS
// ============================================

function parseDurationSeconds(
  value
) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return null;
  }


  const seconds =
    parseFloat(
      String(
        value
      ).replace(
        "s",
        ""
      )
    );


  if (
    !Number.isFinite(
      seconds
    )
  ) {

    return null;
  }


  return seconds;
}


function durationToMinutes(
  value
) {

  const seconds =
    parseDurationSeconds(
      value
    );


  if (
    seconds === null
  ) {

    return null;
  }


  return Math.ceil(
    seconds /
    60
  );
}


function distanceToKm(
  distanceMeters
) {

  const meters =
    Number(
      distanceMeters
    );


  if (
    !Number.isFinite(
      meters
    )
  ) {

    return null;
  }


  return Math.round(
    meters /
    1000
  );
}


function chunkArray(
  items,
  size
) {

  const chunks =
    [];


  for (
    let index = 0;
    index <
      items.length;
    index +=
      size
  ) {

    chunks.push(
      items.slice(
        index,
        index +
          size
      )
    );
  }


  return chunks;
}


function normalizeMatrixNode(
  node
) {

  if (
    !node
  ) {

    return null;
  }


  const key =
    String(
      node.key ||
      ""
    ).trim();


  const latitude =
    Number(
      node.latitude
    );


  const longitude =
    Number(
      node.longitude
    );


  if (
    !key ||
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {

    return null;
  }


  return {

    ...node,

    key,

    latitude,

    longitude

  };
}


function nodeToRouteMatrixWaypoint(
  node
) {

  return {

    waypoint: {

      location: {

        latLng: {

          latitude:
            node.latitude,

          longitude:
            node.longitude

        }

      }

    }

  };
}


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
   */


  const travelMinutes =
    durationToMinutes(
      route.duration
    );


  if (
    travelMinutes ===
    null
  ) {

    throw new Error(
      "Google Routes gaf geen geldige reistijd terug."
    );

  }


  return {

    distance_km:
      distanceToKm(
        route.distanceMeters
      ),

    travel_minutes:
      travelMinutes

  };

}


// ============================================
// ÉÉN ROUTE MATRIX REQUEST
// ============================================

async function requestTravelMatrixChunk(
  originNodes,
  destinationNodes
) {

  if (
    !originNodes.length ||
    !destinationNodes.length
  ) {

    return [];
  }


  const response =
    await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          "X-Goog-Api-Key":
            process.env.GOOGLE_MAPS_API_KEY,

          "X-Goog-FieldMask":
            [
              "originIndex",
              "destinationIndex",
              "duration",
              "distanceMeters",
              "status",
              "condition"
            ].join(",")

        },

        body:
          JSON.stringify({

            origins:
              originNodes.map(
                node =>
                  nodeToRouteMatrixWaypoint(
                    node
                  )
              ),

            destinations:
              destinationNodes.map(
                node =>
                  nodeToRouteMatrixWaypoint(
                    node
                  )
              ),

            travelMode:
              "DRIVE"

          })

      }
    );


  const text =
    await response.text();


  let data =
    null;


  try {

    data =
      JSON.parse(
        text
      );

  } catch (
    error
  ) {

    console.error(
      "GOOGLE ROUTE MATRIX INVALID JSON:",
      text
    );


    throw new Error(
      "Google Route Matrix gaf een ongeldige response terug."
    );
  }


  if (
    !response.ok
  ) {

    console.error(
      "GOOGLE ROUTE MATRIX ERROR:",
      data
    );


    throw new Error(
      data?.error?.message ||
      "Google Route Matrix fout"
    );
  }


  if (
    !Array.isArray(
      data
    )
  ) {

    console.error(
      "GOOGLE ROUTE MATRIX ONVERWACHTE RESPONSE:",
      data
    );


    throw new Error(
      "Google Route Matrix gaf geen matrix terug."
    );
  }


  return data;
}


// ============================================
// ROUTE MATRIX
//
// Input:
// [
//   {
//     key: "home",
//     latitude: 51.123,
//     longitude: 5.123
//   },
//   {
//     key: "booking:123",
//     latitude: 51.456,
//     longitude: 5.456
//   }
// ]
//
// Output:
//
// {
//   home: {
//     "booking:123": {
//       travel_minutes: 28,
//       distance_km: 24
//     }
//   },
//
//   "booking:123": {
//     home: {
//       travel_minutes: 27,
//       distance_km: 24
//     }
//   }
// }
//
// De matrix is bewust directioneel.
// A -> B kan dus een andere reistijd hebben dan B -> A.
// ============================================

export async function getTravelMatrix(
  nodes
) {

  const normalizedNodes =
    (
      Array.isArray(
        nodes
      )
        ? nodes
        : []
    )
      .map(
        normalizeMatrixNode
      )
      .filter(
        Boolean
      );


  // ==========================================
  // UNIEKE KEYS
  // ==========================================

  const uniqueNodesMap =
    new Map();


  for (
    const node of
      normalizedNodes
  ) {

    if (
      !uniqueNodesMap.has(
        node.key
      )
    ) {

      uniqueNodesMap.set(
        node.key,
        node
      );
    }
  }


  const uniqueNodes =
    Array.from(
      uniqueNodesMap.values()
    );


  const matrix =
    {};


  // ==========================================
  // BASISSTRUCTUUR
  // ==========================================

  for (
    const node of
      uniqueNodes
  ) {

    matrix[
      node.key
    ] =
      {};


    /*
     * Zelfde locatie / node:
     * altijd 0 minuten.
     *
     * Google kan default 0-waarden uit de
     * response weglaten, dus die vullen we
     * zelf expliciet in.
     */

    matrix[
      node.key
    ][
      node.key
    ] =
      {

        travel_minutes:
          0,

        distance_km:
          0

      };
  }


  if (
    uniqueNodes.length <
    2
  ) {

    return matrix;
  }


  // ==========================================
  // CHUNKS
  //
  // We houden 25 × 25 aan.
  //
  // Daardoor blijft iedere matrix request
  // maximaal 625 combinaties groot.
  // ==========================================

  const originChunks =
    chunkArray(
      uniqueNodes,
      ROUTE_MATRIX_CHUNK_SIZE
    );


  const destinationChunks =
    chunkArray(
      uniqueNodes,
      ROUTE_MATRIX_CHUNK_SIZE
    );


  for (
    const originNodes of
      originChunks
  ) {

    for (
      const destinationNodes of
        destinationChunks
    ) {

      const results =
        await requestTravelMatrixChunk(
          originNodes,
          destinationNodes
        );


      for (
        const element of
          results
      ) {

        const originIndex =
          Number(
            element.originIndex ??
            0
          );


        const destinationIndex =
          Number(
            element.destinationIndex ??
            0
          );


        const origin =
          originNodes[
            originIndex
          ];


        const destination =
          destinationNodes[
            destinationIndex
          ];


        if (
          !origin ||
          !destination
        ) {

          continue;
        }


        /*
         * Zelfde node hebben we hierboven
         * al expliciet op 0 gezet.
         */

        if (
          origin.key ===
          destination.key
        ) {

          continue;
        }


        // ====================================
        // GEEN GELDIGE ROUTE
        // ====================================

        if (
          element.condition &&
          element.condition !==
            "ROUTE_EXISTS"
        ) {

          console.warn(
            "GOOGLE MATRIX GEEN ROUTE:",
            origin.key,
            "->",
            destination.key,
            element.condition
          );


          continue;
        }


        /*
         * Een status-object zonder code is OK.
         * Als Google wel een foutcode meestuurt,
         * slaan we die combinatie over.
         */

        if (
          element.status &&
          element.status.code !==
            undefined &&
          Number(
            element.status.code
          ) !==
            0
        ) {

          console.warn(
            "GOOGLE MATRIX ROUTE STATUS:",
            origin.key,
            "->",
            destination.key,
            element.status
          );


          continue;
        }


        const travelMinutes =
          durationToMinutes(
            element.duration
          );


        if (
          travelMinutes ===
          null
        ) {

          console.warn(
            "GOOGLE MATRIX GEEN DUUR:",
            origin.key,
            "->",
            destination.key,
            element
          );


          continue;
        }


        if (
          !matrix[
            origin.key
          ]
        ) {

          matrix[
            origin.key
          ] =
            {};
        }


        matrix[
          origin.key
        ][
          destination.key
        ] =
          {

            travel_minutes:
              travelMinutes,

            distance_km:
              distanceToKm(
                element.distanceMeters
              )

          };
      }
    }
  }


  return matrix;
}
