export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

    const {
      request_id,
      photographer_id
    } = req.body;

    // ticket zoeken
    const ticketSearch = await fetch(
      "https://api.hubapi.com/crm/v3/objects/tickets/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "request_id",
                  operator: "EQ",
                  value: request_id
                }
              ]
            }
          ],
          properties: ["request_id"],
          limit: 1
        })
      }
    );

    const ticketData = await ticketSearch.json();

    if (!ticketData.results?.length) {
      return res.status(404).json({
        error: "ticket niet gevonden"
      });
    }

    const ticketId =
      ticketData.results[0].id;

    // ticket updaten
    await fetch(
      `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({
          properties: {
            geselecteerde_fotograaf:
              photographer_id,
            fotograaf_geselecteerd_op:
              new Date().toISOString()
          }
        })
      }
    );

    return res.status(200).json({
      success: true
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
