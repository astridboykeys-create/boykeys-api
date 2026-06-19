import { hubspotRequest }
from "../lib/hubspot.js";

export default async function handler(req, res) {

  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "*"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const requestId = req.query.request_id;

  if (!requestId) {
    return res.status(400).json({
      error: "request_id ontbreekt"
    });
  }

  try {

   const ticketData =
  await hubspotRequest(

    "/crm/v3/objects/tickets/search",

    "POST",

    {
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

    }

  );

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
