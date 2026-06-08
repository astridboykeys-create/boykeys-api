export default async function handler(req, res) {

  const requestId = req.query.request_id;

  if (!requestId) {
    return res.status(400).json({
      error: "request_id ontbreekt"
    });
  }

  try {

    const response = await fetch(
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
            "request_id",
            "beschikbare_fotografen"
          ],
          limit: 1
        })
      }
    );

    const data = await response.json();

    if (
      !data.results ||
      data.results.length === 0
    ) {
      return res.status(404).json({
        error: "Ticket niet gevonden"
      });
    }

    const ticket = data.results[0];

    return res.status(200).json({
      ticketId: ticket.id,
      request_id:
        ticket.properties.request_id,
      beschikbare_fotografen:
        ticket.properties.beschikbare_fotografen
    });

  } catch (error) {

    return res.status(500).json({
      error: error.message
    });

  }

}
