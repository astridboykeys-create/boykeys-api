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

export async function searchTickets(body) {

  return hubspotRequest(

    "/crm/v3/objects/tickets/search",

    "POST",

    body

  );

}
