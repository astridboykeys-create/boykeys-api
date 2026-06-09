function distanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;

  const dLat =
    (lat2 - lat1) *
    Math.PI / 180;

  const dLon =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;

}

export default async function handler(req, res) {

  try {

    const { ticketId } = req.query;

    if (!ticketId) {
      return res.status(400).json({
        error: "ticketId ontbreekt"
      });
    }

    // Ticket ophalen
    const ticketResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}?properties=latitude,longitude,diensten`,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        }
      }
    );

    const ticketData =
      await ticketResponse.json();

    const woningLat =
      parseFloat(
        ticketData.properties.latitude
      );

    const woningLng =
      parseFloat(
        ticketData.properties.longitude
      );

    const gevraagdeDiensten =
      (ticketData.properties?.diensten || "")
        .split(";")
        .filter(Boolean);

    // Fotografen ophalen
    const contactsResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,diensten,is_fotograaf,latitude,longitude,max_reistijd_minuten",
      {
        headers: {
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        }
      }
    );

    const contactsData =
      await contactsResponse.json();

    const fotografen =
      contactsData.results

        // Alleen fotografen
        .filter(c =>
          c.properties.is_fotograaf === "true"
        )

        // Juiste diensten
        .filter(c => {

          const diensten =
            (c.properties.diensten || "")
              .split(";")
              .filter(Boolean);

          return gevraagdeDiensten.every(
            dienst =>
              diensten.includes(dienst)
          );

        })

        // Afstand berekenen
        .map(c => {

          const afstandKm =
            distanceKm(
              woningLat,
              woningLng,
              parseFloat(
                c.properties.latitude
              ),
              parseFloat(
                c.properties.longitude
              )
            );

          return {

            id: c.id,

            firstname:
              c.properties.firstname,

            lastname:
              c.properties.lastname,

            diensten:
              c.properties.diensten,

            latitude:
              c.properties.latitude,

            longitude:
              c.properties.longitude,

            max_reistijd_minuten:
              c.properties.max_reistijd_minuten,

            afstand_km:
              Math.round(
                afstandKm * 10
              ) / 10

          };

        })

        // Dichtstbij eerst
        .sort(
          (a, b) =>
            a.afstand_km -
            b.afstand_km
        );

    return res.status(200).json({

      woning: {

        latitude:
          ticketData.properties.latitude,

        longitude:
          ticketData.properties.longitude,

        diensten:
          ticketData.properties.diensten

      },

      fotografen

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }

}
