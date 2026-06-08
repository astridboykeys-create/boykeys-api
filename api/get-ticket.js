export default async function handler(req, res) {

  const requestId = req.query.request_id;

  if (!requestId) {
    return res.status(400).json({
      error: "request_id ontbreekt"
    });
  }

  try {

    // Ticket zoeken
    const ticketResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/tickets/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "request_id",
                  operator: "EQ",
                  value: requestId
                }
              ]
            }
          ],
          properties: [
            "beschikbare_fotografen"
          ],
          limit: 1
        })
      }
    );

    const ticketData =
      await ticketResponse.json();

    if (
      !ticketData.results ||
      ticketData.results.length === 0
    ) {
      return res.status(404).json({
        error: "Ticket niet gevonden"
      });
    }

    const ticket =
      ticketData.results[0];

    const ids =
      (ticket.properties.beschikbare_fotografen || "")
        .split(";")
        .map(id => id.trim())
        .filter(Boolean);

    const photographers = [];

    // Fotografen ophalen
    for (const id of ids) {

      const contactResponse =
        await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${id}?properties=firstname,lastname,regio`,
          {
            headers: {
              Authorization:
                `Bearer ${process.env.HUBSPOT_TOKEN}`
            }
          }
        );

      const contact =
        await contactResponse.json();

      photographers.push({
        id,
        firstname:
          contact.properties?.firstname || "",
        lastname:
          contact.properties?.lastname || "",
        regio:
          contact.properties?.regio || ""
      });

    }

    return res.status(200).json({
      photographers
    });

  } catch (error) {

    return res.status(500).json({
      error: error.message
    });

  }

}
