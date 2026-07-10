const BASE_URL =
  "https://api.hubapi.com";

function getHeaders() {

  return {

    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${process.env.HUBSPOT_TOKEN}`

  };

}

export async function hubspotRequest(

  endpoint,

  method = "GET",

  body = null

) {

  const options = {

    method,

    headers:
      getHeaders()

  };

  if (body) {

    options.body =
      JSON.stringify(body);

  }

  const response =
    await fetch(
      `${BASE_URL}${endpoint}`,
      options
    );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(

      data.message ||

      "HubSpot fout"

    );

  }

  return data;

}

export async function getObject(
  objectType,
  objectId,
  properties = []
) {

  const query =
    properties.length
      ? `?properties=${properties.join(",")}`
      : "";

  return hubspotRequest(
    `/crm/v3/objects/${objectType}/${objectId}${query}`
  );

}

export async function searchObject(
  objectType,
  body
) {

  return hubspotRequest(
    `/crm/v3/objects/${objectType}/search`,
    "POST",
    body
  );

}

export async function searchTickets(
  body
) {

  return searchObject(
    "tickets",
    body
  );

}

export async function getTicket(
  ticketId,
  properties = []
) {

  return getObject(
    "tickets",
    ticketId,
    properties
  );

}

export async function getTicketAssociations(
  ticketId,
  toObjectType
) {

  return hubspotRequest(
    `/crm/v4/objects/tickets/${ticketId}/associations/${toObjectType}`
  );

}

export async function searchContacts(
  body
) {

  return searchObject(
    "contacts",
    body
  );

}

export async function searchPhotographers(
  body
) {

  return searchContacts(body);

}

function parseHomeLocation(thuislocatie) {

  if (!thuislocatie) {
    return {
      latitude: null,
      longitude: null
    };
  }

  const [latitude, longitude] =
    thuislocatie.split(",").map(Number);

  return {
    latitude,
    longitude
  };

}

export async function getPhotographers() {

  const response =
    await searchPhotographers({

    
      filterGroups: [
        {
          filters: [
            {
              propertyName: "is_fotograaf",
              operator: "EQ",
              value: "true"
            }
          ]
        }
      ],
      

      properties: [
        "firstname",
        "lastname",
        "diensten",
        "thuislocatie",
        "max_reistijd_minuten"
      ],

      limit: 100

    });

  response.results.forEach(contact => {
  console.log(contact.properties);
});

  return response.results.map((contact) => {

    const location =
      parseHomeLocation(
        contact.properties.thuislocatie
      );

    return {

      id: contact.id,

      firstname:
        contact.properties.firstname,

      lastname:
        contact.properties.lastname,

      diensten:
        contact.properties.diensten || "",

      max_reistijd_minuten:
        Number(
          contact.properties.max_reistijd_minuten
        ) || 30,

      latitude:
        location.latitude,

      longitude:
        location.longitude

    };

  });

}

export async function updateTicket(
  ticketId,
  properties
) {

  return hubspotRequest(

    `/crm/v3/objects/tickets/${ticketId}`,

    "PATCH",

    {
      properties
    }

  );

}

// Contact zoeken op e-mailadres
export async function findContactByEmail(email) {

  const response = await searchContacts({

    filterGroups: [
      {
        filters: [
          {
            propertyName: "email",
            operator: "EQ",
            value: email
          }
        ]
      }
    ],

    properties: [
      "firstname",
      "lastname",
      "email"
    ],

    limit: 1

  });

  return response.results[0] || null;

}

// Nieuw contact aanmaken
export async function createContact(properties) {

  return hubspotRequest(

    "/crm/v3/objects/contacts",

    "POST",

    {
      properties
    }

  );

}

// Nieuw ticket aanmaken
export async function createTicket(properties) {

  return hubspotRequest(

    "/crm/v3/objects/tickets",

    "POST",

    {
      properties
    }

  );

}

// Ticket koppelen aan contact
export async function associateTicketWithContact(
  ticketId,
  contactId
) {

  return hubspotRequest(

    `/crm/v4/objects/tickets/${ticketId}/associations/default/contacts/${contactId}`,

    "PUT"

  );

}

export async function getContact(
  contactId,
  properties = []
) {

  return getObject(
    "contacts",
    contactId,
    properties
  );

}

export async function getBookings(
  photographerId
) {

  return searchTickets({

    filterGroups: [
      {
        filters: [

          {
            propertyName:
              "selected_photographer_id",
            operator: "EQ",
            value:
              photographerId
          }

        ]
      }
    ],

    properties: [

      "afspraak_start",

      "afspraak_einde",

      "hs_pipeline_stage",

      "adres"

    ],

    limit: 100

  });

}
export async function getMyJobs(photographerId) {

  return searchTickets({

    filterGroups: [
      {
        filters: [
          {
            propertyName: "selected_photographer_id",
            operator: "EQ",
            value: photographerId
          },
          {
            propertyName: "hs_pipeline_stage",
            operator: "NEQ",
            value: "Gesloten"
          }
        ]
      }
    ],

    properties: [
      "Adres",
      "afspraak_start",
      "afspraak_einde",
      "Diensten",
      "hs_pipeline_stage"
    ],

    limit: 100

  });

}
