const BASE_URL = "https://api.hubapi.com";


// ==========================================
// PIPELINE STAGE IDS
// ==========================================
//
// Deze IDs gebruiken we alleen voor LOGICA.
// De zichtbare labels halen we dynamisch
// uit HubSpot.
//
// ==========================================

export const STAGE_NEW =
  "1";

export const STAGE_REVIEW =
  "2";

export const STAGE_APPROVED =
  "3";

export const STAGE_REJECTED =
  "5960815822";

export const STAGE_CLOSED =
  "4";

export const STAGE_CANCELLED =
  "5960765665";


// ==========================================
// HEADERS
// ==========================================

function getHeaders() {

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`
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
// TICKET PIPELINES / STATUSSEN
// ==========================================

export async function getTicketPipelineStages() {

  const response =
    await hubspotRequest(
      "/crm/v3/pipelines/tickets"
    );


  const stages = [];


  for (
    const pipeline of
      response.results || []
  ) {

    for (
      const stage of
        pipeline.stages || []
    ) {

      stages.push({

        id:
          String(
            stage.id
          ),

        label:
          stage.label || "",

        displayOrder:
          stage.displayOrder ?? 0,

        pipeline_id:
          String(
            pipeline.id
          ),

        pipeline_label:
          pipeline.label || ""

      });

    }

  }


  return stages;

}


// ==========================================
// STATUS MAP
// ==========================================

export async function getTicketStageMap() {

  const stages =
    await getTicketPipelineStages();


  const map = {};


  for (
    const stage of stages
  ) {

    map[
      String(stage.id)
    ] =
      stage;

  }


  return map;

}


// ==========================================
// STATUS LABEL OPHALEN
// ==========================================

export async function getTicketStageLabel(
  stageId
) {

  const stageMap =
    await getTicketStageMap();


  return (
    stageMap[
      String(stageId)
    ]?.label ||
    "Onbekend"
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


// ==========================================
// CONTACT BIJWERKEN
// ==========================================

export async function updateContact(
  contactId,
  properties
) {

  return hubspotRequest(
    `/crm/v3/objects/contacts/${contactId}`,
    "PATCH",
    {
      properties
    }
  );

}


// ==========================================
// CONTACT ZOEKEN OP EMAIL
// ==========================================

export async function findContactByEmail(
  email
) {

  if (!email) {
    return null;
  }


  const response =
    await searchContacts({

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
        "email",
        "portal_role"
      ],

      limit: 1

    });


  return (
    response.results?.[0] ||
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
// FOTOGRAFEN
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
    String(thuislocatie)
      .split(",")
      .map(Number);


  return {
    latitude:
      Number.isFinite(latitude)
        ? latitude
        : null,

    longitude:
      Number.isFinite(longitude)
        ? longitude
        : null
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


  return (
    response.results ||
    []
  ).map(
    contact => {

      const location =
        parseHomeLocation(
          contact.properties
            ?.thuislocatie
        );


      return {

        id:
          contact.id,

        firstname:
          contact.properties
            ?.firstname || "",

        lastname:
          contact.properties
            ?.lastname || "",

        diensten:
          contact.properties
            ?.diensten || "",

        max_reistijd_minuten:
          Number(
            contact.properties
              ?.max_reistijd_minuten
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
// BOOKINGS
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
                String(
                  photographerId
                )
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
    (
      response.results ||
      []
    ).filter(
      ticket => {

        const stage =
          String(
            ticket.properties
              ?.hs_pipeline_stage ||
            ""
          );


        if (
          stage ===
          STAGE_REJECTED
        ) {
          return false;
        }


        if (
          stage ===
          STAGE_CLOSED
        ) {
          return false;
        }


        if (
          stage ===
          STAGE_CANCELLED
        ) {
          return false;
        }


        return true;

      }
    );


  return {
    ...response,
    results
  };

}


// ==========================================
// MIJN OPDRACHTEN - FOTOGRAAF
// ==========================================

export async function getMyJobs(
  photographerId
) {

  const [
    response,
    stageMap
  ] =
    await Promise.all([

      searchTickets({

        filterGroups: [
          {
            filters: [
              {
                propertyName:
                  "selected_photographer_id",

                operator:
                  "EQ",

                value:
                  String(
                    photographerId
                  )
              }
            ]
          }
        ],

        properties: [
          "adres",
          "afspraak_start",
          "afspraak_einde",
          "diensten",
          "opmerking_klant",
          "hs_pipeline_stage"
        ],

        limit: 100

      }),

      getTicketStageMap()

    ]);


  const activeTickets =
    (
      response.results ||
      []
    ).filter(
      ticket => {

        const stage =
          String(
            ticket.properties
              ?.hs_pipeline_stage ||
            ""
          );


        return (
          stage ===
          STAGE_APPROVED
        );

      }
    );


  const jobs =
    await Promise.all(

      activeTickets.map(
        async ticket => {

          const stageId =
            String(
              ticket.properties
                ?.hs_pipeline_stage ||
              ""
            );


          const status = {

            id:
              stageId,

            label:
              stageMap[
                stageId
              ]?.label ||
              "Onbekend"

          };


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
                status,
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

              status,

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

              status,

              makelaar:
                null

            };

          }

        }
      )

    );


  return {

    ...response,

    results:
      jobs

  };

}


// ==========================================
// MIJN BOEKINGEN - MAKELAAR
// ==========================================

export async function getMyOrders(
  contactId
) {

  const [
    associations,
    stageMap
  ] =
    await Promise.all([

      getContactTicketAssociations(
        contactId
      ),

      getTicketStageMap()

    ]);


  const ticketIds =
    (
      associations.results ||
      []
    )
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
                "opmerking_klant",
                "selected_photographer_id",
                "afspraak_start",
                "afspraak_einde",
                "hs_pipeline_stage",
                "planner_reason",
                "planner_note",
                "planner_approved_at",
                "createdate"
              ]
            );


          const stageId =
            String(
              ticket.properties
                ?.hs_pipeline_stage ||
              ""
            );


          const stage =
            stageMap[
              stageId
            ];


          const status = {

            id:
              stageId,

            label:
              stage?.label ||
              "Onbekend",

            pipeline_id:
              stage?.pipeline_id ||
              null,

            pipeline_label:
              stage?.pipeline_label ||
              ""

          };


          const photographerId =
            ticket.properties
              ?.selected_photographer_id;


          if (
            !photographerId
          ) {

            return {

              ...ticket,

              status,

              fotograaf:
                null

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

              status,

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

              status,

              fotograaf:
                null

            };

          }

        }
      )

    );


  tickets.sort(
    (a, b) => {

      const aDate =
        new Date(
          a.properties
            ?.createdate ||
          0
        ).getTime();


      const bDate =
        new Date(
          b.properties
            ?.createdate ||
          0
        ).getTime();


      return (
        bDate -
        aDate
      );

    }
  );


  return tickets;

}


// ==========================================
// DIENSTEN
// ==========================================

export async function getServiceOptions() {

  const property =
    await hubspotRequest(
      "/crm/v3/properties/contacts/diensten"
    );


  return (
    property.options ||
    []
  )
    .filter(
      option =>
        !option.hidden
    )
    .map(
      option => ({

        value:
          option.value,

        label:
          option.label

      })
    );

}


// ==========================================
// PLANNER SETTINGS
// ==========================================

export async function getPlannerSettings() {

  const settings =
    await getObject(
      "2-252594460",
      "448174037212",
      [
        "slot_interval_minutes",
        "booking_duration_minutes"
      ]
    );


  const properties =
    settings.properties ||
    {};


  const slotIntervalMinutes =
    Number(
      properties.slot_interval_minutes
    );


  const bookingDurationMinutes =
    Number(
      properties.booking_duration_minutes
    );


  if (
    !slotIntervalMinutes ||
    !bookingDurationMinutes
  ) {

    throw new Error(
      "Planner instellingen ontbreken of zijn ongeldig in HubSpot."
    );

  }


  return {

    slotIntervalMinutes,

    bookingDurationMinutes

  };

}
