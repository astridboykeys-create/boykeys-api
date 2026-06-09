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
      `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}?properties=latitude,longitude`,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        }
      }
    );

    const ticketData =
      await ticketResponse.json();

    // Fotografen ophalen
    const contactsResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,latitude,longitude,max_reistijd_minuten",
      {
        headers: {
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        }
      }
    );

    const contactsData =
      await contactsResponse.json();

    return res.status(200).json({

      woning: {
        latitude:
          ticketData.properties?.latitude,
        longitude:
          ticketData.properties?.longitude
      },

      fotografen:
        contactsData.results.map(c => ({
          id: c.id,
          firstname:
            c.properties.firstname,
          lastname:
            c.properties.lastname,
          latitude:
            c.properties.latitude,
          longitude:
            c.properties.longitude,
          max_reistijd_minuten:
            c.properties.max_reistijd_minuten
        }))

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }

}
