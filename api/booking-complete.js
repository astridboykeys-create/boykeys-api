export default async function handler(
  req,
  res
) {

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
      calendly_event_uri,
      calendly_invitee_uri
    } = req.body;

    console.log(
      "BOOKING COMPLETE"
    );

    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );

    // Ticket zoeken
    const searchResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/tickets/search",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName:
                    "request_id",
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
        success: false,
        error:
          "Ticket niet gevonden"
      });

    }

    const ticketId =
      searchData.results[0].id;

    const calendlyResponse = await fetch(
  calendly_event_uri,
  {
    headers: {
      Authorization:
        `Bearer ${process.env.CALENDLY_TOKEN}`
    }
  }
);

const calendlyData =
  await calendlyResponse.json();

console.log(
  "CALENDLY EVENT",
  JSON.stringify(
    calendlyData,
    null,
    2
  )
);

    console.log(
      "Ticket gevonden:",
      ticketId
    );

    // Ticket updaten
    const updateResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        },
        body: JSON.stringify({
          properties: {

  booking_status:
    "Ingepland",

  calendly_event_uri:
    calendly_event_uri,

  calendly_invitee_uri:
    calendly_invitee_uri,

  afspraak_start:
    calendlyData.resource.start_time,

  afspraak_einde:
    calendlyData.resource.end_time

}
        })
      }
    );

    const updateData =
      await updateResponse.json();

    console.log(
      "Ticket bijgewerkt"
    );

    return res.status(200).json({
      success: true,
      ticketId,
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
