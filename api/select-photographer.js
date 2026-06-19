import {
  searchTickets,
  getTicketAssociations,
  getContact,
  updateTicket
} from "../lib/hubspot.js";

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
const searchData =
  await searchTickets({

    filterGroups: [
      {
        filters: [
          {
            propertyName:
              "request_id",
            operator: "EQ",
            value:
              request_id
          }
        ]
      }
    ],

    properties: [
      "request_id"
    ],

    limit: 1

  });

    if (
      !searchData.results ||
      searchData.results.length === 0
    ) {

      return res.status(404).json({
        error:
          "Ticket niet gevonden"
      });

    }

    const ticketId =
      searchData.results[0].id;

    // Gekoppeld contact ophalen
const associationData =
  await getTicketAssociations(
    ticketId,
    "contacts"
  );

    const contactId =
      associationData.results?.[0]?.toObjectId;

    let contactName = "";
    let contactEmail = "";

    if (contactId) {

const customerData =
  await getContact(
    contactId,
    [
      "firstname",
      "lastname",
      "email"
    ]
  );

      console.log(
        "CUSTOMER DATA",
        JSON.stringify(
          customerData,
          null,
          2
        )
      );

      contactName =
        `${customerData.properties.firstname || ""} ${customerData.properties.lastname || ""}`.trim();

      contactEmail =
        customerData.properties.email || "";

    }

    console.log(
      "ASSOCIATIONS",
      JSON.stringify(
        associationData,
        null,
        2
      )
    );

    // Fotograaf ophalen
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

    console.log(
      "CONTACT DATA"
    );

    console.log(
      JSON.stringify(
        contactData,
        null,
        2
      )
    );

    const calendlyLink =
      contactData?.properties?.calendly_link || "";

    const photographerName =
      `${contactData?.properties?.firstname || ""} ${contactData?.properties?.lastname || ""}`.trim();

    // Ticket updaten
    const updateData =
  await updateTicket(
    ticketId,
    {
      geselecteerde_fotograaf:
        photographer_id,

      fotograaf_geselecteerd_op:
        new Date().toISOString(),

      booking_status:
        "Fotograaf gekozen"
    }
  );

    return res.status(200).json({

      success: true,

      ticketId,

      photographer_id,

      photographerName,

      calendlyLink,

      contactName,

      contactEmail,

      updateData

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

}
