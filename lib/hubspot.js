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

export async function getPhotographers() {

  return searchPhotographers({

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
      "is_fotograaf",
      "latitude",
      "longitude",
      "max_reistijd_minuten",
      "max_reisafstand_km"
    ],

    limit: 100

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
  photographerId,
  properties = [
    "volledig_adres_google",
    "afspraak_start",
    "afspraak_einde",
    "latitude",
    "longitude"
  ]
) {

  return searchTickets({

    filterGroups: [
      {
        filters: [

          {
            propertyName:
              "geselecteerde_fotograaf",
            operator: "EQ",
            value:
              photographerId
          },

          {
            propertyName:
              "booking_status",
            operator: "EQ",
            value:
              "Ingepland"
          }

        ]
      }
    ],

   properties,

    limit: 100

  });

}

export async function getMyJobs(
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
      "Adres",
      "afspraak_start",
      "afspraak_einde",
      "Diensten",
      "hs_pipeline_stage"
    ],

    limit: 100

  });

}
