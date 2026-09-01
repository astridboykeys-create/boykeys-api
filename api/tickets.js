import { enableCors } from "../lib/cors.js";

import {
  hubspotRequest,
  getMyJobs,
  getMyOrders,
  updateTicket,
  updateContact,
  getTicketAssociations,
  getServiceOptions,
  getTicket,
  getContact,
  getBookings,
  findContactByEmail,

  STAGE_REVIEW,
  STAGE_APPROVED,
  STAGE_REJECTED,
  STAGE_CANCELLED
} from "../lib/hubspot.js";

import {
  getAvailability
} from "../lib/availability.js";

import {
  getBlocks
} from "../lib/blocks.js";

import {
  geocodeAddress,
  getTravelInfo
} from "../lib/googleRoutes.js";


// ============================================
// HELPERS
// ============================================

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];


function normalizeEpoch(
  value
) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }


  const numeric =
    Number(value);


  if (
    Number.isFinite(
      numeric
    ) &&
    numeric > 0
  ) {

    return numeric;

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date.getTime();

}


function validatePlannerTimes(
  start,
  end
) {

  const startMs =
    normalizeEpoch(
      start
    );


  const endMs =
    normalizeEpoch(
      end
    );


  if (
    !startMs ||
    !endMs
  ) {

    return {
      valid: false,
      error:
        "Begin- en eindtijd zijn verplicht."
    };

  }


  if (
    endMs <= startMs
  ) {

    return {
      valid: false,
      error:
        "De eindtijd moet na de begintijd liggen."
    };

  }


  return {
    valid: true,
    startMs,
    endMs
  };

}


// ============================================
// AMSTERDAM DATUM/TIJD
// ============================================

function getAmsterdamDate(
  value
) {

  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return new Intl.DateTimeFormat(
    "en-CA",
    {
      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      timeZone:
        "Europe/Amsterdam"
    }
  ).format(date);

}


function getAmsterdamTime(
  value
) {

  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  const parts =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,

        timeZone:
          "Europe/Amsterdam"
      }
    ).formatToParts(
      date
    );


  const hour =
    parts.find(
      part =>
        part.type ===
        "hour"
    )?.value;


  const minute =
    parts.find(
      part =>
        part.type ===
        "minute"
    )?.value;


  if (
    hour === undefined ||
    minute === undefined
  ) {

    return null;

  }


  return `${hour}:${minute}`;

}


function getDayKey(
  dateString
) {

  const [
    year,
    month,
    day
  ] =
    dateString
      .split("-")
      .map(Number);


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
        0,
        0
      )
    );


  return DAY_KEYS[
    date.getUTCDay()
  ];

}


function getTimeZoneOffsetMs(
  date,
  timeZone
) {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",

        timeZone
      }
    ).formatToParts(
      date
    );


  const values =
    {};


  for (
    const part of parts
  ) {

    if (
      part.type !==
      "literal"
    ) {

      values[
        part.type
      ] =
        Number(
          part.value
        );

    }

  }


  const asUtc =
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );


  return (
    asUtc -
    date.getTime()
  );

}


function createAmsterdamDate(
  dateString,
  timeString
) {

  const [
    year,
    month,
    day
  ] =
    dateString
      .split("-")
      .map(Number);


  const [
    hour,
    minute
  ] =
    timeString
      .split(":")
      .map(Number);


  const naiveUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0
    );


  let candidate =
    new Date(
      naiveUtc
    );


  let offset =
    getTimeZoneOffsetMs(
      candidate,
      "Europe/Amsterdam"
    );


  candidate =
    new Date(
      naiveUtc -
      offset
    );


  const correctedOffset =
    getTimeZoneOffsetMs(
      candidate,
      "Europe/Amsterdam"
    );


  if (
    correctedOffset !==
    offset
  ) {

    candidate =
      new Date(
        naiveUtc -
        correctedOffset
      );

  }


  return candidate;

}


// ============================================
// REPEATING BLOCKS
// ============================================

function normalizeRepeatDays(
  value
) {

  if (!value) {
    return [];
  }


  if (
    Array.isArray(
      value
    )
  ) {

    return value;

  }


  return String(
    value
  )
    .split(";")
    .map(
      value =>
        value.trim()
    )
    .filter(Boolean);

}


function expandBlocksForDate(
  blocks,
  selectedDate
) {

  const result =
    [];


  const selectedDay =
    getDayKey(
      selectedDate
    );


  for (
    const block of
      blocks || []
  ) {

    const repeatType =
      block.repeat_type ||
      "none";


    if (
      repeatType ===
      "none"
    ) {

      result.push(
        block
      );

      continue;

    }


    if (
      repeatType !==
      "weekly"
    ) {

      continue;

    }


    const repeatDays =
      normalizeRepeatDays(
        block.repeat_days
      );


    if (
      !repeatDays.includes(
        selectedDay
      )
    ) {

      continue;

    }


    const originalStartDate =
      getAmsterdamDate(
        block.start_at
      );


    if (
      !originalStartDate ||
      selectedDate <
        originalStartDate
    ) {

      continue;

    }


    if (
      block.repeat_until
    ) {

      const repeatUntilDate =
        getAmsterdamDate(
          block.repeat_until
        );


      if (
        repeatUntilDate &&
        selectedDate >
          repeatUntilDate
      ) {

        continue;

      }

    }


    const startTime =
      getAmsterdamTime(
        block.start_at
      );


    const endTime =
      getAmsterdamTime(
        block.end_at
      );


    if (
      !startTime ||
      !endTime
    ) {

      continue;

    }


    result.push({

      ...block,

      start_at:
        createAmsterdamDate(
          selectedDate,
          startTime
        ).toISOString(),

      end_at:
        createAmsterdamDate(
          selectedDate,
          endTime
        ).toISOString()

    });

  }


  return result;

}


// ============================================
// BOOKING HELPERS
// ============================================

function ticketToBooking(
  ticket
) {

  const p =
    ticket.properties ||
    {};


  const startMs =
    normalizeEpoch(
      p.afspraak_start
    );


  const endMs =
    normalizeEpoch(
      p.afspraak_einde
    );


  if (
    !startMs ||
    !endMs
  ) {

    return null;

  }


  return {

    id:
      ticket.id,

    start:
      new Date(
        startMs
      ),

    end:
      new Date(
        endMs
      ),

    adres:
      p.adres || ""

  };

}


function hasOverlap(
  start1,
  end1,
  start2,
  end2
) {

  return (
    start1 < end2 &&
    end1 > start2
  );

}


function parseHomeLocation(
  value
) {

  if (!value) {

    return {
      latitude: null,
      longitude: null
    };

  }


  const [
    latitude,
    longitude
  ] =
    String(
      value
    )
      .split(",")
      .map(Number);


  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {

    return {
      latitude: null,
      longitude: null
    };

  }


  return {
    latitude,
    longitude
  };

}


// ============================================
// VOLLEDIGE PLANNER VALIDATIE
// ============================================

async function validatePlannerBooking({
  ticketId,
  photographerId,
  address,
  startMs,
  endMs
}) {

  const candidateStart =
    new Date(
      startMs
    );


  const candidateEnd =
    new Date(
      endMs
    );


  const selectedDate =
    getAmsterdamDate(
      candidateStart
    );


  const photographer =
    await getContact(
      photographerId,
      [
        "firstname",
        "lastname",
        "portal_role",
        "thuislocatie",
        "max_reistijd_minuten"
      ]
    );


  if (
    photographer.properties
      ?.portal_role !==
    "fotograaf"
  ) {

    return {
      valid: false,
      error:
        "De geselecteerde contactpersoon is geen fotograaf."
    };

  }


  const home =
    parseHomeLocation(
      photographer.properties
        ?.thuislocatie
    );


  const maxTravel =
    Number(
      photographer.properties
        ?.max_reistijd_minuten
    ) || 30;


  const [
    availability,
    rawBlocks,
    bookingsResponse
  ] =
    await Promise.all([

      getAvailability(
        photographerId
      ),

      getBlocks(
        photographerId
      ),

      getBookings(
        photographerId
      )

    ]);


  const dayKey =
    getDayKey(
      selectedDate
    );


  const workingDay =
    availability
      ?.working_hours
      ?.[dayKey];


  if (
    !workingDay ||
    workingDay.enabled !== true
  ) {

    return {
      valid: false,
      error:
        "De fotograaf werkt niet op deze dag."
    };

  }


  if (
    !workingDay.start ||
    !workingDay.end
  ) {

    return {
      valid: false,
      error:
        "De werktijden van de fotograaf zijn niet volledig ingesteld."
    };

  }


  const workingStart =
    createAmsterdamDate(
      selectedDate,
      workingDay.start
    );


  const workingEnd =
    createAmsterdamDate(
      selectedDate,
      workingDay.end
    );


  if (
    candidateStart <
      workingStart ||
    candidateEnd >
      workingEnd
  ) {

    return {
      valid: false,
      error:
        `De aangepaste afspraak valt buiten de werktijden (${workingDay.start} - ${workingDay.end}).`
    };

  }


  const blocks =
    expandBlocksForDate(
      rawBlocks,
      selectedDate
    );


  for (
    const block of
      blocks
  ) {

    const blockStart =
      new Date(
        block.start_at
      );


    const blockEnd =
      new Date(
        block.end_at
      );


    if (
      hasOverlap(
        candidateStart,
        candidateEnd,
        blockStart,
        blockEnd
      )
    ) {

      return {
        valid: false,
        error:
          block.reason
            ? `De fotograaf heeft een blokkade: ${block.reason}`
            : "De fotograaf heeft op dit tijdstip een blokkade."
      };

    }

  }


  const bookings =
    (
      bookingsResponse.results ||
      []
    )

      .filter(
        ticket =>
          String(
            ticket.id
          ) !==
          String(
            ticketId
          )
      )

      .map(
        ticketToBooking
      )

      .filter(Boolean)

      .filter(
        booking =>
          getAmsterdamDate(
            booking.start
          ) ===
          selectedDate
      )

      .sort(
        (a, b) =>
          a.start.getTime() -
          b.start.getTime()
      );


  for (
    const booking of
      bookings
  ) {

    if (
      hasOverlap(
        candidateStart,
        candidateEnd,
        booking.start,
        booking.end
      )
    ) {

      return {
        valid: false,
        error:
          "De aangepaste tijd overlapt met een andere boeking."
      };

    }

  }


  let previousBooking =
    null;


  let nextBooking =
    null;


  for (
    const booking of
      bookings
  ) {

    if (
      booking.end <=
      candidateStart
    ) {

      if (
        !previousBooking ||
        booking.end >
          previousBooking.end
      ) {

        previousBooking =
          booking;

      }

    }


    if (
      booking.start >=
      candidateEnd
    ) {

      if (
        !nextBooking ||
        booking.start <
          nextBooking.start
      ) {

        nextBooking =
          booking;

      }

    }

  }


  if (!address) {

    return {
      valid: false,
      error:
        "De boeking heeft geen adres."
    };

  }


  const destination =
    await geocodeAddress(
      address
    );


  let incomingTravel =
    null;


  let travelFrom =
    "home";


  if (
    previousBooking
  ) {

    if (
      !previousBooking.adres
    ) {

      return {
        valid: false,
        error:
          "Het adres van de vorige afspraak ontbreekt."
      };

    }


    const previousLocation =
      await geocodeAddress(
        previousBooking.adres
      );


    incomingTravel =
      await getTravelInfo(
        previousLocation.latitude,
        previousLocation.longitude,
        destination.latitude,
        destination.longitude
      );


    travelFrom =
      "previous_booking";


    const earliestStart =
      new Date(
        previousBooking.end.getTime() +
        incomingTravel.travel_minutes *
          60000
      );


    if (
      candidateStart <
      earliestStart
    ) {

      return {
        valid: false,
        error:
          `Onvoldoende reistijd vanaf de vorige afspraak. Minimaal ${incomingTravel.travel_minutes} minuten reistijd nodig.`
      };

    }

  } else {

    if (
      home.latitude === null ||
      home.longitude === null
    ) {

      return {
        valid: false,
        error:
          "De thuislocatie van de fotograaf ontbreekt."
      };

    }


    incomingTravel =
      await getTravelInfo(
        home.latitude,
        home.longitude,
        destination.latitude,
        destination.longitude
      );

  }


  if (
    incomingTravel.travel_minutes >
    maxTravel
  ) {

    return {
      valid: false,
      error:
        `De reistijd naar deze afspraak is ${incomingTravel.travel_minutes} minuten. De fotograaf heeft maximaal ${maxTravel} minuten ingesteld.`
    };

  }


  let travelToNext =
    null;


  if (
    nextBooking
  ) {

    if (
      !nextBooking.adres
    ) {

      return {
        valid: false,
        error:
          "Het adres van de volgende afspraak ontbreekt."
      };

    }


    const nextLocation =
      await geocodeAddress(
        nextBooking.adres
      );


    travelToNext =
      await getTravelInfo(
        destination.latitude,
        destination.longitude,
        nextLocation.latitude,
        nextLocation.longitude
      );


    const earliestArrival =
      new Date(
        candidateEnd.getTime() +
        travelToNext.travel_minutes *
          60000
      );


    if (
      earliestArrival >
      nextBooking.start
    ) {

      return {
        valid: false,
        error:
          `Onvoldoende reistijd naar de volgende afspraak. Er is ${travelToNext.travel_minutes} minuten reistijd nodig.`
      };

    }

  }


  return {

    valid: true,

    travel: {

      from:
        travelFrom,

      incoming_minutes:
        incomingTravel
          ?.travel_minutes ??
        null,

      incoming_distance_km:
        incomingTravel
          ?.distance_km ??
        null,

      to_next_minutes:
        travelToNext
          ?.travel_minutes ??
        null,

      to_next_distance_km:
        travelToNext
          ?.distance_km ??
        null

    }

  };

}


// ============================================
// API HANDLER
// ============================================

export default async function handler(
  req,
  res
) {

  if (
    enableCors(
      req,
      res
    )
  ) {
    return;
  }


  try {

    // =========================================
    // GET
    // =========================================

    if (
      req.method ===
      "GET"
    ) {

      const {
        action,
        photographer_id,
        contact_id,
        ticket_id,
        email
      } =
        req.query;


      // =======================================
      // ASSOCIATION LABELS
      // =======================================

      if (
        action ===
        "association-labels"
      ) {

        const result =
          await hubspotRequest(
            "/crm/v4/associations/tickets/contacts/labels"
          );


        return res
          .status(200)
          .json({
            success: true,
            labels:
              result.results ||
              []
          });

      }


      // =======================================
      // SERVICES
      // =======================================

      if (
        action ===
        "services"
      ) {

        const services =
          await getServiceOptions();


        return res
          .status(200)
          .json({
            success: true,
            services
          });

      }


      // =======================================
      // STANDAARD DIENSTEN MAKELAAR
      // =======================================

      if (
        action ===
        "contact-services"
      ) {

        if (
          !email
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "email is verplicht"
            });

        }


        const foundContact =
          await findContactByEmail(
            email
          );


        if (
          !foundContact
        ) {

          return res
            .status(404)
            .json({
              success: false,
              error:
                "Contact niet gevonden"
            });

        }


        const contact =
          await getContact(
            foundContact.id,
            [
              "diensten",
              "portal_role"
            ]
          );


        if (
          contact.properties
            ?.portal_role !==
          "makelaar"
        ) {

          return res
            .status(403)
            .json({
              success: false,
              error:
                "Dit contact is geen makelaar"
            });

        }


        return res
          .status(200)
          .json({

            success:
              true,

            contact_id:
              contact.id,

            diensten:
              contact.properties
                ?.diensten ||
              ""

          });

      }


      // =======================================
      // INSTELLINGEN MAKELAAR
      // =======================================

      if (
        action ===
        "contact-settings"
      ) {

        if (
          !email
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "email is verplicht"
            });

        }


        const foundContact =
          await findContactByEmail(
            email
          );


        if (
          !foundContact
        ) {

          return res
            .status(404)
            .json({
              success: false,
              error:
                "Contact niet gevonden"
            });

        }


        const contact =
          await getContact(
            foundContact.id,
            [
              "firstname",
              "lastname",
              "phone",
              "email",
              "diensten",
              "portal_role"
            ]
          );


        if (
          contact.properties
            ?.portal_role !==
          "makelaar"
        ) {

          return res
            .status(403)
            .json({
              success: false,
              error:
                "Dit contact is geen makelaar"
            });

        }


        return res
          .status(200)
          .json({

            success:
              true,

            contact_id:
              contact.id,

            settings: {

              firstname:
                contact.properties
                  ?.firstname ||
                "",

              lastname:
                contact.properties
                  ?.lastname ||
                "",

              phone:
                contact.properties
                  ?.phone ||
                "",

              email:
                contact.properties
                  ?.email ||
                "",

              diensten:
                contact.properties
                  ?.diensten ||
                ""

            }

          });

      }


      // =======================================
      // FOTOGRAAF
      // =======================================

      if (
        action ===
        "my-jobs"
      ) {

        if (
          !photographer_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "photographer_id is verplicht"
            });

        }


        const jobs =
          await getMyJobs(
            photographer_id
          );


        return res
          .status(200)
          .json({
            success: true,
            jobs:
              jobs.results ||
              []
          });

      }


      // =======================================
      // MAKELAAR
      // =======================================

      if (
        action ===
        "my-orders"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "contact_id is verplicht"
            });

        }


        const orders =
          await getMyOrders(
            contact_id
          );


        return res
          .status(200)
          .json({
            success: true,
            orders
          });

      }


      // =======================================
      // PLANNER TICKET
      // =======================================

      if (
        action ===
        "planner-ticket"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        const ticket =
          await getTicket(
            ticket_id,
            [
              "adres",
              "diensten",
              "selected_photographer_id",
              "afspraak_start",
              "afspraak_einde",
              "opmerking_klant",

              "woning_oppervlakte_m2",
              "huiseigenaar_naam",
              "huiseigenaar_email",
              "huiseigenaar_telefoon",

              "planner_reason",
              "planner_note",
              "planner_approved_at",
              "hs_pipeline_stage"
            ]
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket
          });

      }


      return res
        .status(400)
        .json({
          success: false,
          error:
            "Onbekende actie"
        });

    }


    // =========================================
    // POST
    // =========================================

    if (
      req.method ===
      "POST"
    ) {

      const {
        action,
        ticket_id,
        contact_id,

        email,
        firstname,
        lastname,
        phone,

        address,
        diensten,
        opmerking_klant,

        woning_oppervlakte_m2,
        huiseigenaar_naam,
        huiseigenaar_email,
        huiseigenaar_telefoon,

        photographer_id,
        start,
        end,

        planner_reason,
        planner_note
      } =
        req.body ||
        {};


      // =======================================
      // INSTELLINGEN MAKELAAR OPSLAAN
      // =======================================

      if (
        action ===
        "update-contact-settings"
      ) {

        if (
          !email
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "email is verplicht"
            });

        }


        const foundContact =
          await findContactByEmail(
            email
          );


        if (
          !foundContact
        ) {

          return res
            .status(404)
            .json({
              success: false,
              error:
                "Contact niet gevonden"
            });

        }


        const currentContact =
          await getContact(
            foundContact.id,
            [
              "portal_role",
              "email"
            ]
          );


        if (
          currentContact.properties
            ?.portal_role !==
          "makelaar"
        ) {

          return res
            .status(403)
            .json({
              success: false,
              error:
                "Dit contact is geen makelaar"
            });

        }


        const properties = {

          firstname:
            firstname !== undefined
              ? String(
                  firstname ||
                  ""
                ).trim()
              : "",

          lastname:
            lastname !== undefined
              ? String(
                  lastname ||
                  ""
                ).trim()
              : "",

          phone:
            phone !== undefined
              ? String(
                  phone ||
                  ""
                ).trim()
              : "",

          diensten:
            Array.isArray(
              diensten
            )
              ? diensten.join(";")
              : diensten || ""

        };


        const updated =
          await updateContact(
            foundContact.id,
            properties
          );


        return res
          .status(200)
          .json({

            success:
              true,

            contact_id:
              updated.id,

            settings: {

              firstname:
                updated.properties
                  ?.firstname ||
                "",

              lastname:
                updated.properties
                  ?.lastname ||
                "",

              phone:
                updated.properties
                  ?.phone ||
                "",

              email:
                currentContact.properties
                  ?.email ||
                email,

              diensten:
                updated.properties
                  ?.diensten ||
                ""

            }

          });

      }


      // =======================================
      // PLANNER UPDATE
      // =======================================

      if (
        action ===
        "planner-update"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        const properties =
          {};


        if (
          address !== undefined
        ) {

          properties.adres =
            address || "";

        }


        if (
          diensten !== undefined
        ) {

          properties.diensten =
            Array.isArray(
              diensten
            )
              ? diensten.join(";")
              : diensten || "";

        }


        if (
          photographer_id !==
          undefined
        ) {

          properties.selected_photographer_id =
            String(
              photographer_id ||
              ""
            );

        }


        if (
          planner_reason !==
          undefined
        ) {

          properties.planner_reason =
            planner_reason ||
            "";

        }


        if (
          planner_note !==
          undefined
        ) {

          properties.planner_note =
            planner_note ||
            "";

        }


        if (
          start !== undefined ||
          end !== undefined
        ) {

          const currentTicket =
            await getTicket(
              ticket_id,
              [
                "afspraak_start",
                "afspraak_einde"
              ]
            );


          const finalStart =
            start !== undefined
              ? start
              : currentTicket
                  .properties
                  ?.afspraak_start;


          const finalEnd =
            end !== undefined
              ? end
              : currentTicket
                  .properties
                  ?.afspraak_einde;


          const validation =
            validatePlannerTimes(
              finalStart,
              finalEnd
            );


          if (
            !validation.valid
          ) {

            return res
              .status(400)
              .json({
                success: false,
                error:
                  validation.error
              });

          }


          properties.afspraak_start =
            String(
              validation.startMs
            );


          properties.afspraak_einde =
            String(
              validation.endMs
            );

        }


        properties.hs_pipeline_stage =
          STAGE_REVIEW;


        const updated =
          await updateTicket(
            ticket_id,
            properties
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket:
              updated
          });

      }


      // =======================================
      // PLANNER GOEDKEUREN
      // =======================================

      if (
        action ===
        "planner-approve"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        const currentTicket =
          await getTicket(
            ticket_id,
            [
              "adres",
              "diensten",
              "selected_photographer_id",
              "afspraak_start",
              "afspraak_einde",
              "hs_pipeline_stage"
            ]
          );


        const p =
          currentTicket.properties ||
          {};


        const finalAddress =
          address !== undefined
            ? address
            : p.adres;


        const finalPhotographerId =
          photographer_id !==
          undefined
            ? photographer_id
            : p.selected_photographer_id;


        const finalStart =
          start !== undefined
            ? start
            : p.afspraak_start;


        const finalEnd =
          end !== undefined
            ? end
            : p.afspraak_einde;


        if (
          !finalPhotographerId
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "Geen fotograaf geselecteerd."
            });

        }


        if (
          !finalAddress
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "Geen adres ingesteld."
            });

        }


        const timeValidation =
          validatePlannerTimes(
            finalStart,
            finalEnd
          );


        if (
          !timeValidation.valid
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                timeValidation.error
            });

        }


        const plannerValidation =
          await validatePlannerBooking({

            ticketId:
              ticket_id,

            photographerId:
              String(
                finalPhotographerId
              ),

            address:
              finalAddress,

            startMs:
              timeValidation.startMs,

            endMs:
              timeValidation.endMs

          });


        if (
          !plannerValidation.valid
        ) {

          return res
            .status(409)
            .json({

              success:
                false,

              validation_failed:
                true,

              error:
                plannerValidation.error

            });

        }


        const properties = {

          hs_pipeline_stage:
            STAGE_APPROVED,

          planner_reason:
            planner_reason ||
            "",

          planner_note:
            planner_note ||
            "",

          planner_approved_at:
            String(
              Date.now()
            ),

          adres:
            finalAddress,

          selected_photographer_id:
            String(
              finalPhotographerId
            ),

          afspraak_start:
            String(
              timeValidation.startMs
            ),

          afspraak_einde:
            String(
              timeValidation.endMs
            )

        };


        if (
          diensten !== undefined
        ) {

          properties.diensten =
            Array.isArray(
              diensten
            )
              ? diensten.join(";")
              : diensten ||
                "";

        }


        const updated =
          await updateTicket(
            ticket_id,
            properties
          );


        return res
          .status(200)
          .json({

            success:
              true,

            approved:
              true,

            validation:
              plannerValidation,

            ticket:
              updated

          });

      }


      // =======================================
      // PLANNER AFKEUREN
      // =======================================

      if (
        action ===
        "planner-reject"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        if (
          !planner_reason ||
          !String(
            planner_reason
          ).trim()
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "Een reden voor afkeuren is verplicht"
            });

        }


        const updated =
          await updateTicket(
            ticket_id,
            {

              hs_pipeline_stage:
                STAGE_REJECTED,

              planner_reason:
                String(
                  planner_reason
                ).trim(),

              planner_note:
                planner_note ||
                ""

            }
          );


        return res
          .status(200)
          .json({

            success:
              true,

            rejected:
              true,

            ticket:
              updated

          });

      }


      // =======================================
      // MAKELAAR TICKET-ACTIES
      // =======================================

      if (
        !ticket_id ||
        !contact_id
      ) {

        return res
          .status(400)
          .json({
            success: false,
            error:
              "ticket_id en contact_id zijn verplicht"
          });

      }


      const associations =
        await getTicketAssociations(
          ticket_id,
          "contacts"
        );


      const allowed =
        (
          associations.results ||
          []
        ).some(
          item =>
            String(
              item.toObjectId
            ) ===
            String(
              contact_id
            )
        );


      if (
        !allowed
      ) {

        return res
          .status(403)
          .json({
            success: false,
            error:
              "Geen toegang tot deze boeking"
          });

      }


      // =====================================
      // ANNULEREN
      // =====================================

      if (
        action ===
        "cancel-order"
      ) {

        const updated =
          await updateTicket(
            ticket_id,
            {
              hs_pipeline_stage:
                STAGE_CANCELLED
            }
          );


        return res
          .status(200)
          .json({
            success: true,
            cancelled: true,
            ticket:
              updated
          });

      }


      // =====================================
      // OPMERKING
      // =====================================

      if (
        action ===
        "update-note"
      ) {

        const updated =
          await updateTicket(
            ticket_id,
            {
              opmerking_klant:
                opmerking_klant ||
                ""
            }
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket:
              updated
          });

      }


      // =====================================
      // BOEKING WIJZIGEN MAKELAAR
      // =====================================

      if (
        action ===
        "update-order"
      ) {

        if (
          !address ||
          !photographer_id ||
          !start ||
          !end
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "Niet alle verplichte velden zijn ingevuld"
            });

        }


        const updated =
          await updateTicket(
            ticket_id,
            {

              hs_pipeline_stage:
                STAGE_REVIEW,

              planner_approved_at:
                "",

              adres:
                address,

              diensten:
                Array.isArray(
                  diensten
                )
                  ? diensten.join(";")
                  : diensten || "",

              opmerking_klant:
                opmerking_klant ||
                "",

              woning_oppervlakte_m2:
                woning_oppervlakte_m2 !== undefined &&
                woning_oppervlakte_m2 !== null &&
                woning_oppervlakte_m2 !== ""
                  ? String(
                      woning_oppervlakte_m2
                    )
                  : "",

              huiseigenaar_naam:
                huiseigenaar_naam ||
                "",

              huiseigenaar_email:
                huiseigenaar_email ||
                "",

              huiseigenaar_telefoon:
                huiseigenaar_telefoon ||
                "",

              selected_photographer_id:
                String(
                  photographer_id
                ),

              afspraak_start:
                String(
                  start
                ),

              afspraak_einde:
                String(
                  end
                )

            }
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket:
              updated
          });

      }


      return res
        .status(400)
        .json({
          success: false,
          error:
            "Onbekende actie"
        });

    }


    return res
      .status(405)
      .json({
        success: false,
        error:
          "Method not allowed"
      });


  } catch (
    error
  ) {

    console.error(
      "TICKETS API ERROR:",
      error
    );


    return res
      .status(500)
      .json({
        success: false,
        error:
          error.message
      });

  }

}
