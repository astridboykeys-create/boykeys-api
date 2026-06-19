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

  const query =
    properties.length
      ? `?properties=${properties.join(",")}`
      : "";

  return hubspotRequest(

    `/crm/v3/objects/contacts/${contactId}${query}`

  );

}
