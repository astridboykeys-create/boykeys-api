const BASE_URL =
  "https://api.hubapi.com";


const CLOSED_STAGE_ID =
  "4";


const CANCELLED_STAGE_ID =
  "5960765665";


// ==========================================
// HEADERS
// ==========================================

function getHeaders() {

  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${process.env.HUBSPOT_TOKEN}`
  };

}


// ==========================================
// ALGEMENE HUBSPOT REQUEST
// ==========================================

export async function hubspotRequest(
  endpoint,
  method = "GET",
  body = null
) {

  const options = {
    method,
    headers: getHeaders()
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


  const text =
    await response.text();


  let data = {};


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      message: text
    };

  }


  if (!response.ok) {

    console.error(
      "================================"
    );

    console.error(
      "HubSpot API FOUT"
    );

    console.error(
      "Endpoint:",
      endpoint
    );

    console.error(
      "Status:",
      response.status
    );

    console.error(
      "Response:",
      data
    );

    console.error(
      "================================"
    );

    console.error(
      JSON.stringify(
        data,
        null,
        2
      )
    );

    console.error(
      "================================"
    );


    throw new Error(
      JSON.stringify(
        data,
        null,
        2
      )
    );

  }


  return data;

}


// ==========================================
// GENERIEKE OBJECT FUNCTIES
// ==========================================

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


// ==========================================
// TICKETS
// ==========================================

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


export async function createTicket(
  properties
) {

  return hubspotRequest(
    "/crm/v3/objects/tickets",
    "POST",
    {
      properties
    }
  );

}


// ==========================================
// TICKET ASSOCIATIES
// ==========================================

export async function getTicketAssociations(
  ticketId,
  toObjectType
) {

  return hubspotRequest(
    `/crm/v4/objects/tickets/${ticketId}/associations/${toObjectType}`
  );

}


export async function associateTicketWithContact(
  ticketId,
  contactId
) {

  return hubspotRequest(
    `/crm/v4/objects/tickets/${ticketId}/associations/default/contacts/${contactId}`,
    "PUT"
  );

}


// ==========================================
// CONTACTEN
// ==========================================

export async function searchContacts(
  body
) {

  return searchObject(
    "contacts",
    body
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


export async function createContact(
  properties
) {

  return hubspotRequest(
    "/crm/v3/objects/contacts",
    "POST",
    {
      properties
    }
  );

}


export async function findContactByEmail(
  email
) {

  const response =
    await searchContacts({

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "email",

              operator:
                "EQ",

              value:
                email
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


  return (
    response.results[0] ||
    null
  );

}


// ==========================================
// CONTACT -> TICKETS
// ==========================================

export async function getContactTicketAssociations(
  contactId
) {

  return hubspotRequest(
    `/crm/v4/objects/contacts/${contactId}/associations/tickets`
  );

}


// ==========================================
// FOTOGRAFEN ZOEKEN
// ==========================================

export async function searchPhotographers(
  body
) {

  return searchContacts(
    body
  );

}


// ==========================================
// THUISLOCATIE PARSEN
// ==========================================

function parseHomeLocation(
  thuislocatie
) {

  if (!thuislocatie) {

    return {
      latitude: null,
      longitude: null
    };

  }


  const [
    latitude,
    longitude
  ] =
    thuislocatie
      .split(",")
      .map(Number);


  return {
    latitude,
    longitude
  };

}


// ==========================================
// ALLE FOTOGRAFEN
// ==========================================

export async function getPhotographers() {

  const response =
    await searchPhotographers({

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "portal_role",

              operator:
                "EQ",

              value:
                "fotograaf"
            }
          ]
        }
      ],

      properties: [
        "firstname",
        "lastname",
        "portal_role",
        "diensten",
        "thuislocatie",
        "max_reistijd_minuten"
      ],

      limit: 100

    });


  console.log(
    "================================"
  );

  console.log(
    "HUBSPOT RAW RESPONSE"
  );

  console.log(
    JSON.stringify(
      response,
      null,
      2
    )
  );

  console.log(
    "================================"
  );


  response.results.forEach(
    contact => {

      console.log(
        contact.properties
      );

    }
  );


  return response.results.map(
    contact => {

      const location =
        parseHomeLocation(
          contact.properties
            .thuislocatie
        );


      return {

        id:
          contact.id,

        firstname:
          contact.properties
            .firstname,

        lastname:
          contact.properties
            .lastname,

        diensten:
          contact.properties
            .diensten || "",

        max_reistijd_minuten:
          Number(
            contact.properties
              .max_reistijd_minuten
          ) || 30,

        latitude:
          location.latitude,

        longitude:
          location.longitude

      };

    }
  );

}


// ==========================================
// BOOKINGS VOOR PLANNER
//
// Closed en Cancelled blokkeren GEEN slot.
// ==========================================

export async function getBookings(
  photographerId
) {

  const response =
    await searchTickets({

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "selected_photographer_id",

              operator:
                "EQ",

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


  const results =
    (response.results || [])
      .filter(
        ticket => {

          const stage =
            String(
              ticket.properties
                ?.hs_pipeline_stage ||
              ""
            );


          return (
            stage !==
              CLOSED_STAGE_ID &&

            stage !==
              CANCELLED_STAGE_ID
          );

        }
      );


  return {
    ...response,
    results
  };

}


// ==========================================
// ACTIEVE OPDRACHTEN FOTOGRAAF
//
// Closed en Cancelled niet tonen.
// Makelaar wordt erbij opgehaald.
// ==========================================

export async function getMyJobs(
  photographerId
) {

  const response =
    await searchTickets({

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "selected_photographer_id",

              operator:
                "EQ",

              value:
                photographerId
            }
          ]
        }
      ],

      properties: [
        "adres",
        "afspraak_start",
        "afspraak_einde",
        "diensten",
        "hs_pipeline_stage"
      ],

      limit: 100

    });


  const activeTickets =
    (response.results || [])
      .filter(
        ticket => {

          const stage =
            String(
              ticket.properties
                ?.hs_pipeline_stage ||
              ""
            );


          return (
            stage !==
              CLOSED_STAGE_ID &&

            stage !==
              CANCELLED_STAGE_ID
          );

        }
      );


  const jobs =
    await Promise.all(

      activeTickets.map(
        async ticket => {

          try {

            const associations =
              await getTicketAssociations(
                ticket.id,
                "contacts"
              );


            const contactId =
              associations.results?.[0]
                ?.toObjectId;


            if (!contactId) {

              return {
                ...ticket,
                makelaar: null
              };

            }


            const contact =
              await getContact(
                contactId,
                [
                  "firstname",
                  "lastname",
                  "email"
                ]
              );


            return {

              ...ticket,

              makelaar: {

                id:
                  contact.id,

                firstname:
                  contact.properties
                    ?.firstname || "",

                lastname:
                  contact.properties
                    ?.lastname || "",

                email:
                  contact.properties
                    ?.email || ""

              }

            };


          } catch (error) {

            console.error(
              `Kon contact voor ticket ${ticket.id} niet ophalen`,
              error
            );


            return {
              ...ticket,
              makelaar: null
            };

          }

        }
      )

    );


  return {
    ...response,
    results: jobs
  };

}


// ==========================================
// OPDRACHTEN VAN MAKELAAR
//
// Hier filteren we NIETS weg.
// Cancelled blijft dus zichtbaar.
// Closed blijft ook zichtbaar.
// ==========================================

export async function getMyOrders(
  contactId
) {

  const associations =
    await getContactTicketAssociations(
      contactId
    );


  const ticketIds =
    (associations.results || [])
      .map(
        item =>
          String(
            item.toObjectId ||
            item.id ||
            ""
          )
      )
      .filter(Boolean);


  if (!ticketIds.length) {

    return [];

  }


  const tickets =
    await Promise.all(

      ticketIds.map(
        async ticketId => {

          const ticket =
            await getTicket(
              ticketId,
              [
                "adres",
                "diensten",
                "selected_photographer_id",
                "afspraak_start",
                "afspraak_einde",
                "hs_pipeline_stage",
                "createdate"
              ]
            );


          const photographerId =
            ticket.properties
              ?.selected_photographer_id;


          if (!photographerId) {

            return {
              ...ticket,
              fotograaf: null
            };

          }


          try {

            const photographer =
              await getContact(
                photographerId,
                [
                  "firstname",
                  "lastname",
                  "email"
                ]
              );


            return {

              ...ticket,

              fotograaf: {

                id:
                  photographer.id,

                firstname:
                  photographer.properties
                    ?.firstname || "",

                lastname:
                  photographer.properties
                    ?.lastname || "",

                email:
                  photographer.properties
                    ?.email || ""

              }

            };


          } catch (error) {

            console.error(
              `Kon fotograaf ${photographerId} niet ophalen`,
              error
            );


            return {
              ...ticket,
              fotograaf: null
            };

          }

        }
      )

    );


  return tickets;

}
