export default async function handler(req, res) {

  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "*"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      request_id,
      photographer_id
    } = req.body;

    if (!request_id) {
      return res.status(400).json({
        error: "request_id ontbreekt"
      });
    }

    if (!photographer_id) {
      return res.status(400).json({
        error: "photographer_id ontbreekt"
      });
    }

    // Ticket zoeken op request_id
    const searchResponse = await fetch(
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
                  value: request_id
                }
              ]
            }
          ],
          properties: [
            "request_id"
          ],
          limit: 1
        })
      }
    );

    const searchData =
      await searchResponse.json();

    if (
      !searchData.results ||
      searchData.results.length === 0
    ) {
      return res.status(404).json({
        error: "Ticket niet gevonden"
      });
    }

    const ticketId =
      searchData.results[0].id;

    const associationResponse = await fetch(
  `https://api.hubapi.com/crm/v4/objects/tickets/${ticketId}/associations/contacts`,
  {
    headers: {
      Authorization:
        `Bearer ${process.env.HUBSPOT_TOKEN}`
    }
  }
);

const associationData =
  await associationResponse.json();

console.log(
  "ASSOCIATIONS",
  JSON.stringify(
    associationData,
    null,
    2
  )
);

    // Ticket updaten
    const updateResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({
          properties: {
            gekozen_fotograaf:
              photographer_id
          }
        })
      }
    );

    const updateData =
      await updateResponse.json();

    // Contact ophalen
    const contactResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${photographer_id}?properties=calendly_link,firstname,lastname`,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        }
      }
    );

    const contactData =
      await contactResponse.json();

    console.log("CONTACT DATA");
    console.log(
      JSON.stringify(
        contactData,
        null,
        2
      )
    );

    const calendlyLink =
      contactData?.properties?.calendly_link || "";

    return res.status(200).json({
      success: true,
      ticketId,
      photographer_id,
      calendlyLink,
      updateData
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });

  }

}
