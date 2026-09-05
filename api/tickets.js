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
  STAGE_OPNAMEDAG,
  STAGE_PAKKET_IN_BEHANDELING,
  STAGE_CLOSED,
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

import {
  previewSimplyBookImport,
  runSimplyBookImport
} from "../lib/simplybookImport.js";


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
    Number(
      value
    );


  if (
    Number.isFinite(
      numeric
    ) &&
    numeric > 0
  ) {

    return numeric;

  }


  const date =
    new Date(
      value
    );


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
    endMs <=
    startMs
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
// AMSTERDAM DATUM / TIJD
// ============================================

function getAmsterdamDate(
  value
) {

  const date =
    new Date(
      value
    );


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
  ).format(
    date
  );
}


function getAmsterdamTime(
  value
) {

  const date =
    new Date(
      value
    );


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
      .map(
        Number
      );


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


function addDateStringDays(
  dateString,
  amount
) {

  const [
    year,
    month,
    day
  ] =
    String(
      dateString
    )
      .split("-")
      .map(
        Number
      );


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + amount,
        12,
        0,
        0
      )
    );


  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    )
  ].join("-");
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
    const part of
      parts
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
      .map(
        Number
      );


  const [
    hour,
    minute
  ] =
    timeString
      .split(":")
      .map(
        Number
      );


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

  if (
    !value
  ) {
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
    .filter(
      Boolean
    );
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
      blocks ||
      []
  ) {

    const repeatType =
      block.repeat_type ||
      "none";


    if (
      repeatType ===
      "none"
    ) {

      const blockDate =
        getAmsterdamDate(
          block.start_at
        );


      if (
        blockDate ===
        selectedDate
      ) {

        result.push(
          block
        );
      }


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
// PLANNER BESCHIKBAARHEID OVERLAY
//
// Wordt ALLEEN gebruikt wanneer in de agenda
// één specifieke fotograaf geselecteerd is.
//
// Geen geselecteerde fotograaf:
// geen extra availability / blocks calls.
//
// Per datum sturen we terug:
// - werkt fotograaf die dag?
// - werktijden
// - concrete blokkades van die datum
// ============================================

async function getPlannerAvailabilityOverlay(
  photographerId,
  rangeStart,
  rangeEnd
) {

  if (
    !photographerId
  ) {

    return null;
  }


  const startMs =
    normalizeEpoch(
      rangeStart
    );


  const endMs =
    normalizeEpoch(
      rangeEnd
    );


  if (
    !startMs ||
    !endMs ||
    endMs <=
      startMs
  ) {

    return null;
  }


  const photographer =
    await getContact(
      photographerId,
      [
        "firstname",
        "lastname",
        "portal_role"
      ]
    );


  const role =
    String(
      photographer.properties
        ?.portal_role ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    role !==
    "fotograaf"
  ) {

    throw new Error(
      "De geselecteerde contactpersoon is geen fotograaf."
    );
  }


  const [
    availability,
    rawBlocks
  ] =
    await Promise.all([

      getAvailability(
        photographerId
      ),

      getBlocks(
        photographerId
      )

    ]);


  const startDate =
    getAmsterdamDate(
      startMs
    );


  const endDate =
    getAmsterdamDate(
      endMs
    );


  if (
    !startDate ||
    !endDate
  ) {

    return null;
  }


  const days =
    [];


  let dateString =
    startDate;


  while (
    dateString <
    endDate
  ) {

    const dayKey =
      getDayKey(
        dateString
      );


    const workingDay =
      availability
        ?.working_hours
        ?.[dayKey] ||
      null;


    const enabled =
      workingDay
        ?.enabled ===
      true;


    const expandedBlocks =
      expandBlocksForDate(
        rawBlocks,
        dateString
      );


    const blocks =
      expandedBlocks
        .map(
          block => {

            const start =
              normalizeEpoch(
                block.start_at
              );


            const end =
              normalizeEpoch(
                block.end_at
              );


            if (
              !start ||
              !end
            ) {

              return null;
            }


            return {

              id:
                block.id
                  ? String(
                      block.id
                    )
                  : null,

              start,

              end,

              reason:
                String(
                  block.reason ||
                  ""
                ).trim()

            };
          }
        )
        .filter(
          Boolean
        );


    days.push({

      date:
        dateString,

      day_key:
        dayKey,

      working: {

        enabled,

        start:
          enabled
            ? workingDay.start ||
              null
            : null,

        end:
          enabled
            ? workingDay.end ||
              null
            : null

      },

      blocks

    });


    dateString =
      addDateStringDays(
        dateString,
        1
      );
  }


  return {

    photographer_id:
      String(
        photographerId
      ),

    photographer_name:
      [
        photographer.properties
          ?.firstname,

        photographer.properties
          ?.lastname
      ]
        .filter(
          Boolean
        )
        .join(" ")
        .trim(),

    days

  };
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
      p.adres ||
      ""

  };
}


function hasOverlap(
  start1,
  end1,
  start2,
  end2
) {

  return (
    start1 <
      end2 &&
    end1 >
      start2
  );
}


function parseHomeLocation(
  value
) {

  if (
    !value
  ) {

    return {
      latitude:
        null,

      longitude:
        null
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
      .map(
        Number
      );


  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {

    return {
      latitude:
        null,

      longitude:
        null
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
      valid:
        false,

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
    ) ||
    30;


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
    workingDay.enabled !==
      true
  ) {

    return {
      valid:
        false,

      error:
        "De fotograaf werkt niet op deze dag."
    };
  }


  if (
    !workingDay.start ||
    !workingDay.end
  ) {

    return {
      valid:
        false,

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
      valid:
        false,

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
        valid:
          false,

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
      .filter(
        Boolean
      )
      .filter(
        booking =>
          getAmsterdamDate(
            booking.start
          ) ===
          selectedDate
      )
      .sort(
        (
          a,
          b
        ) =>
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
        valid:
          false,

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


  if (
    !address
  ) {

    return {
      valid:
        false,

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
        valid:
          false,

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
        valid:
          false,

        error:
          `Onvoldoende reistijd vanaf de vorige afspraak. Minimaal ${incomingTravel.travel_minutes} minuten reistijd nodig.`
      };
    }

  } else {

    if (
      home.latitude ===
        null ||
      home.longitude ===
        null
    ) {

      return {
        valid:
          false,

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
      valid:
        false,

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
        valid:
          false,

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
        valid:
          false,

        error:
          `Onvoldoende reistijd naar de volgende afspraak. Er is ${travelToNext.travel_minutes} minuten reistijd nodig.`
      };
    }
  }


  return {

    valid:
      true,

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
// PLANNER BOEKINGENOVERZICHT
// ============================================

const ASSOCIATION_TYPE_FOTOGRAAF =
  79;


const ASSOCIATION_TYPE_MAKELAAR =
  81;


function normalizePlannerServices(
  value
) {

  if (
    !value
  ) {
    return [];
  }


  if (
    Array.isArray(
      value
    )
  ) {

    return value
      .map(
        item =>
          String(
            item
          ).trim()
      )
      .filter(
        Boolean
      );
  }


  return String(
    value
  )
    .split(";")
    .map(
      item =>
        item.trim()
    )
    .filter(
      Boolean
    );
}


function getPlannerStatus(
  stage
) {

  const value =
    String(
      stage ||
      ""
    );


  if (
    value ===
    String(
      STAGE_REVIEW
    )
  ) {

    return {

      key:
        "review",

      label:
        "In beoordeling"

    };
  }


  if (
    value ===
    String(
      STAGE_APPROVED
    )
  ) {

    return {

      key:
        "approved",

      label:
        "Goedgekeurd"

    };
  }


  if (
    value ===
    String(
      STAGE_REJECTED
    )
  ) {

    return {

      key:
        "rejected",

      label:
        "Afgekeurd"

    };
  }


  return null;
}


function getAssociatedContactIdByType(
  associations,
  associationTypeId
) {

  const results =
    associations?.results ||
    associations?.to ||
    [];


  for (
    const association of
      results
  ) {

    const types =
      association.associationTypes ||
      association.types ||
      [];


    const matches =
      types.some(
        type =>
          Number(
            type.typeId
          ) ===
          Number(
            associationTypeId
          )
      );


    if (
      !matches
    ) {
      continue;
    }


    const contactId =
      association.toObjectId ||
      association.id ||
      association.to?.id ||
      null;


    if (
      contactId
    ) {

      return String(
        contactId
      );
    }
  }


  return null;
}


function getContactDisplayName(
  contact
) {

  if (
    !contact
  ) {
    return "";
  }


  const properties =
    contact.properties ||
    {};


  const fullName =
    [
      properties.firstname,
      properties.lastname
    ]
      .filter(
        Boolean
      )
      .join(" ")
      .trim();


  return (
    fullName ||
    properties.company ||
    properties.email ||
    ""
  );
}


async function getPlannerContact(
  contactId
) {

  if (
    !contactId
  ) {
    return null;
  }


  try {

    const contact =
      await getContact(
        contactId,
        [
          "firstname",
          "lastname",
          "email",
          "company",
          "portal_role"
        ]
      );


    return {

      id:
        String(
          contact.id
        ),

      name:
        getContactDisplayName(
          contact
        ),

      firstname:
        contact.properties
          ?.firstname ||
        "",

      lastname:
        contact.properties
          ?.lastname ||
        "",

      email:
        contact.properties
          ?.email ||
        "",

      company:
        contact.properties
          ?.company ||
        "",

      role:
        contact.properties
          ?.portal_role ||
        ""

    };

  } catch (
    error
  ) {

    console.error(
      `Planner contact ${contactId} kon niet worden geladen:`,
      error
    );


    return null;
  }
}


// ============================================
// PLANNER BATCH HELPERS
// ============================================

function chunkArray(
  items,
  size =
    1000
) {

  const chunks =
    [];


  for (
    let index = 0;
    index <
      items.length;
    index +=
      size
  ) {

    chunks.push(
      items.slice(
        index,
        index +
          size
      )
    );
  }


  return chunks;
}


// ============================================
// BATCH ASSOCIATIONS
// ============================================

async function loadPlannerAssociations(
  records
) {

  const associationsByTicket =
    new Map();


  const ticketIds =
    [
      ...new Set(
        (
          records ||
          []
        )
          .map(
            record =>
              String(
                record?.id ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      )
    ];


  if (
    !ticketIds.length
  ) {

    return associationsByTicket;
  }


  const chunks =
    chunkArray(
      ticketIds,
      1000
    );


  for (
    const ticketIdChunk of
      chunks
  ) {

    const response =
      await hubspotRequest(
        "/crm/v4/associations/tickets/contacts/batch/read",
        "POST",
        {
          inputs:
            ticketIdChunk.map(
              id => ({
                id
              })
            )
        }
      );


    for (
      const result of
        response.results ||
        []
    ) {

      const ticketId =
        String(
          result.from?.id ||
          result.fromObjectId ||
          result.id ||
          ""
        ).trim();


      if (
        !ticketId
      ) {

        continue;
      }


      const associations =
        result.to ||
        result.results ||
        [];


      associationsByTicket.set(
        ticketId,
        {
          results:
            associations
        }
      );
    }
  }


  for (
    const ticketId of
      ticketIds
  ) {

    if (
      !associationsByTicket.has(
        ticketId
      )
    ) {

      associationsByTicket.set(
        ticketId,
        {
          results:
            []
        }
      );
    }
  }


  return associationsByTicket;
}


// ============================================
// CONTACT RECORD NORMALISEREN
// ============================================

function plannerContactFromRecord(
  contact
) {

  if (
    !contact ||
    !contact.id
  ) {

    return null;
  }


  return {

    id:
      String(
        contact.id
      ),

    name:
      getContactDisplayName(
        contact
      ),

    firstname:
      contact.properties
        ?.firstname ||
      "",

    lastname:
      contact.properties
        ?.lastname ||
      "",

    email:
      contact.properties
        ?.email ||
      "",

    company:
      contact.properties
        ?.company ||
      "",

    role:
      contact.properties
        ?.portal_role ||
      ""

  };
}


// ============================================
// BATCH CONTACTEN
// ============================================

async function loadPlannerContacts(
  contactIds
) {

  const contactsById =
    new Map();


  const uniqueIds =
    [
      ...new Set(
        (
          contactIds ||
          []
        )
          .map(
            id =>
              String(
                id ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      )
    ];


  if (
    !uniqueIds.length
  ) {

    return contactsById;
  }


  const chunks =
    chunkArray(
      uniqueIds,
      100
    );


  for (
    const contactIdChunk of
      chunks
  ) {

    const response =
      await hubspotRequest(
        "/crm/v3/objects/contacts/batch/read",
        "POST",
        {

          properties: [
            "firstname",
            "lastname",
            "email",
            "company",
            "portal_role"
          ],

          inputs:
            contactIdChunk.map(
              id => ({
                id
              })
            )

        }
      );


    for (
      const contact of
        response.results ||
        []
    ) {

      const normalizedContact =
        plannerContactFromRecord(
          contact
        );


      if (
        !normalizedContact
      ) {

        continue;
      }


      contactsById.set(
        String(
          normalizedContact.id
        ),
        normalizedContact
      );
    }
  }


  return contactsById;
}


// ============================================
// RECORDS VERRIJKEN
// ============================================

async function enrichPlannerRecords(
  records
) {

  if (
    !records ||
    !records.length
  ) {

    return {

      associationsByTicket:
        new Map(),

      contactsById:
        new Map()

    };
  }


  const associationsByTicket =
    await loadPlannerAssociations(
      records
    );


  const contactIds =
    new Set();


  for (
    const record of
      records
  ) {

    const properties =
      record.properties ||
      {};


    const associations =
      associationsByTicket.get(
        String(
          record.id
        )
      ) || {
        results:
          []
      };


    const makelaarId =
      getAssociatedContactIdByType(
        associations,
        ASSOCIATION_TYPE_MAKELAAR
      );


    const associatedPhotographerId =
      getAssociatedContactIdByType(
        associations,
        ASSOCIATION_TYPE_FOTOGRAAF
      );


    const photographerId =
      String(
        properties
          .selected_photographer_id ||
        associatedPhotographerId ||
        ""
      ).trim();


    if (
      makelaarId
    ) {

      contactIds.add(
        String(
          makelaarId
        )
      );
    }


    if (
      photographerId
    ) {

      contactIds.add(
        photographerId
      );
    }
  }


  const contactsById =
    await loadPlannerContacts(
      [
        ...contactIds
      ]
    );


  return {
    associationsByTicket,
    contactsById
  };
}

// ============================================
// PLANNER DASHBOARD RECORDS
// ============================================

async function searchPlannerBookingRecords() {

  const properties = [

    "boekingscode",
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

    "hs_pipeline_stage",

    "createdate"

  ];


  const results =
    [];


  let after =
    null;


  do {

    const body = {

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "hs_pipeline_stage",

              operator:
                "IN",

              values: [
                String(
                  STAGE_REVIEW
                ),
                String(
                  STAGE_APPROVED
                ),
                String(
                  STAGE_REJECTED
                )
              ]
            }
          ]
        }
      ],

      properties,

      limit:
        100

    };


    if (
      after
    ) {

      body.after =
        after;

    }


    const response =
      await hubspotRequest(
        "/crm/v3/objects/tickets/search",
        "POST",
        body
      );


    results.push(
      ...(
        response.results ||
        []
      )
    );


    after =
      response.paging
        ?.next
        ?.after ||
      null;

  } while (
    after
  );


  return results;
}


// ============================================
// PLANNER DASHBOARD BOEKINGEN
// ============================================

async function getPlannerBookings() {

  const records =
    await searchPlannerBookingRecords();


  const {
    associationsByTicket,
    contactsById
  } =
    await enrichPlannerRecords(
      records
    );


  const bookings =
    records.map(
      record => {

        const properties =
          record.properties ||
          {};


        const status =
          getPlannerStatus(
            properties
              .hs_pipeline_stage
          );


        if (
          !status
        ) {

          return null;

        }


        const associations =
          associationsByTicket.get(
            String(
              record.id
            )
          ) || {
            results:
              []
          };


        const makelaarId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_MAKELAAR
          );


        const associatedPhotographerId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_FOTOGRAAF
          );


        const photographerId =
          String(
            properties
              .selected_photographer_id ||
            associatedPhotographerId ||
            ""
          ).trim();


        const makelaar =
          makelaarId
            ? contactsById.get(
                String(
                  makelaarId
                )
              ) ||
              null
            : null;


        const fotograaf =
          photographerId
            ? contactsById.get(
                photographerId
              ) ||
              null
            : null;


        return {

          id:
            String(
              record.id
            ),

          boekingscode:
            properties
              .boekingscode ||
            "",

          adres:
            properties
              .adres ||
            "",

          diensten:
            normalizePlannerServices(
              properties
                .diensten
            ),

          status,

          afspraak_start:
            normalizeEpoch(
              properties
                .afspraak_start
            ),

          afspraak_einde:
            normalizeEpoch(
              properties
                .afspraak_einde
            ),

          makelaar,

          fotograaf,

          opmerking_klant:
            properties
              .opmerking_klant ||
            "",

          woning_oppervlakte_m2:
            properties
              .woning_oppervlakte_m2 ||
            "",

          huiseigenaar: {

            naam:
              properties
                .huiseigenaar_naam ||
              "",

            email:
              properties
                .huiseigenaar_email ||
              "",

            telefoon:
              properties
                .huiseigenaar_telefoon ||
              ""

          },

          planner: {

            reason:
              properties
                .planner_reason ||
              "",

            note:
              properties
                .planner_note ||
              "",

            approved_at:
              normalizeEpoch(
                properties
                  .planner_approved_at
              )

          },

          created_at:
            properties
              .createdate ||
            record.createdAt ||
            ""

        };

      }
    );


  return bookings
    .filter(
      Boolean
    )
    .sort(
      (
        a,
        b
      ) => {

        const aStart =
          a.afspraak_start ||
          Number.MAX_SAFE_INTEGER;


        const bStart =
          b.afspraak_start ||
          Number.MAX_SAFE_INTEGER;


        return (
          aStart -
          bStart
        );

      }
    );
}


// ============================================
// PLANNER AGENDA STATUS
// ============================================

function getPlannerAgendaStatus(
  stage
) {

  const value =
    String(
      stage ||
      ""
    );


  if (
    value ===
    String(
      STAGE_REVIEW
    )
  ) {

    return {
      key:
        "review",

      label:
        "In beoordeling"
    };
  }


  if (
    value ===
    String(
      STAGE_APPROVED
    )
  ) {

    return {
      key:
        "approved",

      label:
        "Goedgekeurd"
    };
  }


  if (
    value ===
    String(
      STAGE_OPNAMEDAG
    )
  ) {

    return {
      key:
        "shootday",

      label:
        "Opnamedag"
    };
  }


  if (
    value ===
    String(
      STAGE_PAKKET_IN_BEHANDELING
    )
  ) {

    return {
      key:
        "processing",

      label:
        "Pakket in behandeling"
    };
  }


  if (
    value ===
    String(
      STAGE_CLOSED
    )
  ) {

    return {
      key:
        "completed",

      label:
        "Afgerond"
    };
  }


  return null;
}


// ============================================
// AGENDA DATUMBEREIK
// ============================================

function normalizeAgendaRange(
  rangeStart,
  rangeEnd
) {

  const startMs =
    normalizeEpoch(
      rangeStart
    );


  const endMs =
    normalizeEpoch(
      rangeEnd
    );


  if (
    !startMs &&
    !endMs
  ) {

    return {
      startMs:
        null,

      endMs:
        null
    };
  }


  if (
    !startMs ||
    !endMs
  ) {

    throw new Error(
      "Voor de agenda zijn zowel range_start als range_end verplicht."
    );
  }


  if (
    endMs <=
    startMs
  ) {

    throw new Error(
      "Agenda range_end moet na range_start liggen."
    );
  }


  return {
    startMs,
    endMs
  };
}


// ============================================
// PLANNER AGENDA RECORDS
// ============================================

async function searchPlannerAgendaRecords(
  rangeStart =
    null,
  rangeEnd =
    null
) {

  const {
    startMs,
    endMs
  } =
    normalizeAgendaRange(
      rangeStart,
      rangeEnd
    );


  const properties = [

    "boekingscode",
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

    "hs_pipeline_stage",

    "createdate"

  ];


  const filters = [

    {
      propertyName:
        "hs_pipeline_stage",

      operator:
        "IN",

      values: [
        String(
          STAGE_REVIEW
        ),
        String(
          STAGE_APPROVED
        ),
        String(
          STAGE_OPNAMEDAG
        ),
        String(
          STAGE_PAKKET_IN_BEHANDELING
        ),
        String(
          STAGE_CLOSED
        )
      ]
    }

  ];


  if (
    startMs
  ) {

    filters.push(
      {
        propertyName:
          "afspraak_start",

        operator:
          "GTE",

        value:
          String(
            startMs
          )
      }
    );
  }


  if (
    endMs
  ) {

    filters.push(
      {
        propertyName:
          "afspraak_start",

        operator:
          "LT",

        value:
          String(
            endMs
          )
      }
    );
  }


  const results =
    [];


  let after =
    null;


  do {

    const body = {

      filterGroups: [
        {
          filters
        }
      ],

      properties,

      sorts: [
        "afspraak_start"
      ],

      limit:
        100

    };


    if (
      after
    ) {

      body.after =
        after;

    }


    const response =
      await hubspotRequest(
        "/crm/v3/objects/tickets/search",
        "POST",
        body
      );


    results.push(
      ...(
        response.results ||
        []
      )
    );


    after =
      response.paging
        ?.next
        ?.after ||
      null;

  } while (
    after
  );


  return results;
}


// ============================================
// PLANNER AGENDA BOEKINGEN
// ============================================

async function getPlannerAgendaBookings(
  rangeStart =
    null,
  rangeEnd =
    null
) {

  const records =
    await searchPlannerAgendaRecords(
      rangeStart,
      rangeEnd
    );


  const validRecords =
    records.filter(
      record => {

        const properties =
          record.properties ||
          {};


        const status =
          getPlannerAgendaStatus(
            properties
              .hs_pipeline_stage
          );


        if (
          !status
        ) {

          return false;

        }


        const appointmentStart =
          normalizeEpoch(
            properties
              .afspraak_start
          );


        const appointmentEnd =
          normalizeEpoch(
            properties
              .afspraak_einde
          );


        return Boolean(
          appointmentStart &&
          appointmentEnd
        );

      }
    );


  const {
    associationsByTicket,
    contactsById
  } =
    await enrichPlannerRecords(
      validRecords
    );


  const bookings =
    validRecords.map(
      record => {

        const properties =
          record.properties ||
          {};


        const status =
          getPlannerAgendaStatus(
            properties
              .hs_pipeline_stage
          );


        const appointmentStart =
          normalizeEpoch(
            properties
              .afspraak_start
          );


        const appointmentEnd =
          normalizeEpoch(
            properties
              .afspraak_einde
          );


        const associations =
          associationsByTicket.get(
            String(
              record.id
            )
          ) || {
            results:
              []
          };


        const makelaarId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_MAKELAAR
          );


        const associatedPhotographerId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_FOTOGRAAF
          );


        const photographerId =
          String(
            properties
              .selected_photographer_id ||
            associatedPhotographerId ||
            ""
          ).trim();


        const makelaar =
          makelaarId
            ? contactsById.get(
                String(
                  makelaarId
                )
              ) ||
              null
            : null;


        const fotograaf =
          photographerId
            ? contactsById.get(
                photographerId
              ) ||
              null
            : null;


        return {

          id:
            String(
              record.id
            ),

          boekingscode:
            properties
              .boekingscode ||
            "",

          adres:
            properties
              .adres ||
            "",

          diensten:
            normalizePlannerServices(
              properties
                .diensten
            ),

          status,

          afspraak_start:
            appointmentStart,

          afspraak_einde:
            appointmentEnd,

          makelaar,

          fotograaf,

          opmerking_klant:
            properties
              .opmerking_klant ||
            "",

          woning_oppervlakte_m2:
            properties
              .woning_oppervlakte_m2 ||
            "",

          huiseigenaar: {

            naam:
              properties
                .huiseigenaar_naam ||
              "",

            email:
              properties
                .huiseigenaar_email ||
              "",

            telefoon:
              properties
                .huiseigenaar_telefoon ||
              ""

          },

          planner: {

            reason:
              properties
                .planner_reason ||
              "",

            note:
              properties
                .planner_note ||
              "",

            approved_at:
              normalizeEpoch(
                properties
                  .planner_approved_at
              )

          },

          created_at:
            properties
              .createdate ||
            record.createdAt ||
            ""

        };

      }
    );


  return bookings
    .sort(
      (
        a,
        b
      ) =>
        a.afspraak_start -
        b.afspraak_start
    );
}


// ============================================
// UNIEKE CONTACTEN VOOR AGENDA
// ============================================

function getUniquePlannerAgendaContacts(
  bookings,
  propertyName
) {

  const map =
    new Map();


  for (
    const booking of
      bookings
  ) {

    const contact =
      booking[
        propertyName
      ];


    if (
      !contact ||
      !contact.id
    ) {

      continue;
    }


    if (
      !map.has(
        String(
          contact.id
        )
      )
    ) {

      map.set(
        String(
          contact.id
        ),
        {
          id:
            String(
              contact.id
            ),

          name:
            contact.name ||
            "",

          firstname:
            contact.firstname ||
            "",

          lastname:
            contact.lastname ||
            "",

          email:
            contact.email ||
            ""
        }
      );
    }
  }


  return Array
    .from(
      map.values()
    )
    .sort(
      (
        a,
        b
      ) =>
        String(
          a.name
        ).localeCompare(
          String(
            b.name
          ),
          "nl"
        )
    );
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
        email,
        range_start,
        range_end
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
          .status(
            200
          )
          .json({
            success:
              true,

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
          .status(
            200
          )
          .json({
            success:
              true,

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
            .status(
              400
            )
            .json({
              success:
                false,

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
            .status(
              404
            )
            .json({
              success:
                false,

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
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Dit contact is geen makelaar"
            });

        }


        return res
          .status(
            200
          )
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
            .status(
              400
            )
            .json({
              success:
                false,

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
            .status(
              404
            )
            .json({
              success:
                false,

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
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Dit contact is geen makelaar"
            });

        }


        return res
          .status(
            200
          )
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
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "photographer_id is verplicht"
            });

        }


        const jobs =
          await getMyJobs(
            photographer_id
          );


        return res
          .status(
            200
          )
          .json({
            success:
              true,

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
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });

        }


        const orders =
          await getMyOrders(
            contact_id
          );


        return res
          .status(
            200
          )
          .json({
            success:
              true,

            orders
          });

      }


      // =======================================
      // PLANNER BOEKINGEN
      // =======================================

      if (
        action ===
        "planner-bookings"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });

        }


        const plannerContact =
          await getContact(
            contact_id,
            [
              "firstname",
              "lastname",
              "email",
              "portal_role"
            ]
          );


        const plannerRole =
          String(
            plannerContact
              .properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          plannerRole !==
          "planner"
        ) {

          return res
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Geen toegang tot Planner"
            });

        }


        const bookings =
          await getPlannerBookings();


        const counts = {

          review:
            bookings.filter(
              booking =>
                booking.status
                  ?.key ===
                "review"
            ).length,

          approved:
            bookings.filter(
              booking =>
                booking.status
                  ?.key ===
                "approved"
            ).length,

          rejected:
            bookings.filter(
              booking =>
                booking.status
                  ?.key ===
                "rejected"
            ).length

        };


        return res
          .status(
            200
          )
          .json({

            success:
              true,

            planner: {

              id:
                String(
                  plannerContact.id
                ),

              firstname:
                plannerContact
                  .properties
                  ?.firstname ||
                "",

              lastname:
                plannerContact
                  .properties
                  ?.lastname ||
                "",

              email:
                plannerContact
                  .properties
                  ?.email ||
                ""

            },

            counts,

            bookings

          });

      }


      // =======================================
      // PLANNER AGENDA
      // =======================================

      if (
        action ===
        "planner-agenda"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });

        }


        const plannerContact =
          await getContact(
            contact_id,
            [
              "firstname",
              "lastname",
              "email",
              "portal_role"
            ]
          );


        const plannerRole =
          String(
            plannerContact
              .properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          plannerRole !==
          "planner"
        ) {

          return res
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Geen toegang tot Planner"
            });

        }


        // =====================================
        // BOEKINGEN + EVENTUELE AVAILABILITY
        //
        // Zonder photographer_id:
        // alleen boekingen laden.
        //
        // Met photographer_id:
        // parallel ook werktijden / blocks laden.
        // =====================================

        const [
          bookings,
          availabilityOverlay
        ] =
          await Promise.all([

            getPlannerAgendaBookings(
              range_start ||
                null,
              range_end ||
                null
            ),

            photographer_id
              ? getPlannerAvailabilityOverlay(
                  photographer_id,
                  range_start ||
                    null,
                  range_end ||
                    null
                )
              : Promise.resolve(
                  null
                )

          ]);


        const photographers =
          getUniquePlannerAgendaContacts(
            bookings,
            "fotograaf"
          );


        const makelaars =
          getUniquePlannerAgendaContacts(
            bookings,
            "makelaar"
          );


        return res
          .status(
            200
          )
          .json({

            success:
              true,

            planner: {

              id:
                String(
                  plannerContact.id
                ),

              firstname:
                plannerContact
                  .properties
                  ?.firstname ||
                "",

              lastname:
                plannerContact
                  .properties
                  ?.lastname ||
                "",

              email:
                plannerContact
                  .properties
                  ?.email ||
                ""

            },

            range: {

              start:
                range_start ||
                null,

              end:
                range_end ||
                null

            },

            selected_photographer_id:
              photographer_id
                ? String(
                    photographer_id
                  )
                : null,

            availability_overlay:
              availabilityOverlay,

            bookings,

            photographers,

            makelaars

          });

      }


      // =======================================
      // PLANNER BOEKING - TIJDELIJKE DEBUG
      // =======================================

      if (
        action ===
        "planner-ticket"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "ticket_id is verplicht"
            });

        }


        const [
          ticket,
          associations
        ] =
          await Promise.all([

            getTicket(
              ticket_id,
              [
                "boekingscode",
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

                "hs_pipeline_stage",

                "extra_opdracht",
                "extra_opdracht_facturatie"
              ]
            ),

            getTicketAssociations(
              ticket_id,
              "contacts"
            )

          ]);


        const makelaarId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_MAKELAAR
          );


        const associatedPhotographerId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_FOTOGRAAF
          );


        const photographerId =
          String(
            ticket.properties
              ?.selected_photographer_id ||
            associatedPhotographerId ||
            ""
          ).trim();


        const [
          makelaar,
          fotograaf
        ] =
          await Promise.all([

            getPlannerContact(
              makelaarId
            ),

            getPlannerContact(
              photographerId
            )

          ]);


        return res
          .status(
            200
          )
          .json({

            success:
              true,

            ticket,

            association_debug: {

              raw:
                associations,

              ids: {

                makelaar:
                  makelaarId,

                fotograaf_association:
                  associatedPhotographerId,

                fotograaf_selected:
                  ticket.properties
                    ?.selected_photographer_id ||
                  null,

                fotograaf_used:
                  photographerId ||
                  null

              },

              contacts: {

                makelaar,

                fotograaf

              }

            }

          });

      }


      return res
        .status(
          400
        )
        .json({
          success:
            false,

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
      // SIMPLYBOOK IMPORT PREVIEW
      // =======================================

      if (
        action ===
        "planner-import-preview"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });
        }


        const plannerContact =
          await getContact(
            contact_id,
            [
              "firstname",
              "lastname",
              "email",
              "portal_role"
            ]
          );


        const plannerRole =
          String(
            plannerContact
              .properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          plannerRole !==
          "planner"
        ) {

          return res
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Geen toegang tot Planner"
            });
        }


        const rows =
          Array.isArray(
            req.body?.rows
          )
            ? req.body.rows
            : [];


        if (
          !rows.length
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Geen importregels ontvangen"
            });
        }


        if (
          rows.length >
          1000
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Maximaal 1000 boekingen per import"
            });
        }


        const preview =
          await previewSimplyBookImport(
            rows
          );


        return res
          .status(
            200
          )
          .json({

            success:
              true,

            planner: {

              id:
                String(
                  plannerContact.id
                ),

              firstname:
                plannerContact
                  .properties
                  ?.firstname ||
                "",

              lastname:
                plannerContact
                  .properties
                  ?.lastname ||
                "",

              email:
                plannerContact
                  .properties
                  ?.email ||
                ""

            },

            ...preview

          });
      }


      // =======================================
      // SIMPLYBOOK ECHTE IMPORT
      // =======================================

      if (
        action ===
        "planner-import-run"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });
        }


        const plannerContact =
          await getContact(
            contact_id,
            [
              "firstname",
              "lastname",
              "email",
              "portal_role"
            ]
          );


        const plannerRole =
          String(
            plannerContact
              .properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          plannerRole !==
          "planner"
        ) {

          return res
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Geen toegang tot Planner"
            });
        }


        const rows =
          Array.isArray(
            req.body?.rows
          )
            ? req.body.rows
            : [];


        if (
          !rows.length
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Geen importregels ontvangen"
            });
        }


        if (
          rows.length >
          1000
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Maximaal 1000 boekingen per import"
            });
        }


        const result =
          await runSimplyBookImport(
            rows
          );


        return res
          .status(
            200
          )
          .json({

            success:
              true,

            planner: {

              id:
                String(
                  plannerContact.id
                ),

              firstname:
                plannerContact
                  .properties
                  ?.firstname ||
                "",

              lastname:
                plannerContact
                  .properties
                  ?.lastname ||
                "",

              email:
                plannerContact
                  .properties
                  ?.email ||
                ""

            },

            ...result

          });
      }


      // =======================================
      // CONTACT INSTELLINGEN OPSLAAN
      // =======================================

      if (
        action ===
        "save-contact-settings"
      ) {

        if (
          !email
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

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
            .status(
              404
            )
            .json({
              success:
                false,

              error:
                "Contact niet gevonden"
            });
        }


        const contact =
          await getContact(
            foundContact.id,
            [
              "portal_role"
            ]
          );


        if (
          contact.properties
            ?.portal_role !==
          "makelaar"
        ) {

          return res
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Dit contact is geen makelaar"
            });
        }


        const properties =
          {};


        if (
          firstname !==
          undefined
        ) {

          properties.firstname =
            String(
              firstname ||
              ""
            ).trim();
        }


        if (
          lastname !==
          undefined
        ) {

          properties.lastname =
            String(
              lastname ||
              ""
            ).trim();
        }


        if (
          phone !==
          undefined
        ) {

          properties.phone =
            String(
              phone ||
              ""
            ).trim();
        }


        if (
          diensten !==
          undefined
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
          await updateContact(
            foundContact.id,
            properties
          );


        return res
          .status(
            200
          )
          .json({
            success:
              true,

            contact:
              updated
          });
      }


      // =======================================
      // PLANNER BOEKING VERSLEPEN
      //
      // V1:
      // - zelfde fotograaf
      // - zelfde duur
      // - andere dag/tijd toegestaan
      // - volledige planner-validatie
      // =======================================

      if (
        action ===
        "planner-reschedule"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });
        }


        if (
          !ticket_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "ticket_id is verplicht"
            });
        }


        const plannerContact =
          await getContact(
            contact_id,
            [
              "firstname",
              "lastname",
              "email",
              "portal_role"
            ]
          );


        const plannerRole =
          String(
            plannerContact
              .properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          plannerRole !==
          "planner"
        ) {

          return res
            .status(
              403
            )
            .json({
              success:
                false,

              error:
                "Geen toegang tot Planner"
            });
        }


        const [
          currentTicket,
          associations
        ] =
          await Promise.all([

            getTicket(
              ticket_id,
              [
                "adres",
                "selected_photographer_id",
                "afspraak_start",
                "afspraak_einde",
                "hs_pipeline_stage"
              ]
            ),

            getTicketAssociations(
              ticket_id,
              "contacts"
            )

          ]);


        const currentProperties =
          currentTicket.properties ||
          {};


        const associatedPhotographerId =
          getAssociatedContactIdByType(
            associations,
            ASSOCIATION_TYPE_FOTOGRAAF
          );


        const currentPhotographerId =
          String(
            currentProperties
              .selected_photographer_id ||
            associatedPhotographerId ||
            ""
          ).trim();


        if (
          !currentPhotographerId
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Deze boeking heeft geen fotograaf."
            });
        }


        const currentStart =
          normalizeEpoch(
            currentProperties
              .afspraak_start
          );


        const currentEnd =
          normalizeEpoch(
            currentProperties
              .afspraak_einde
          );


        if (
          !currentStart ||
          !currentEnd
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "De huidige afspraak heeft geen geldige begin- en eindtijd."
            });
        }


        const timeValidation =
          validatePlannerTimes(
            start,
            end
          );


        if (
          !timeValidation.valid
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                timeValidation.error
            });
        }


        const currentDuration =
          currentEnd -
          currentStart;


        const newDuration =
          timeValidation.endMs -
          timeValidation.startMs;


        if (
          currentDuration !==
          newDuration
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Bij verslepen moet de duur van de boeking gelijk blijven."
            });
        }


        if (
          currentStart ===
            timeValidation.startMs &&
          currentEnd ===
            timeValidation.endMs
        ) {

          return res
            .status(
              200
            )
            .json({

              success:
                true,

              rescheduled:
                false,

              unchanged:
                true

            });
        }


        const address =
          String(
            currentProperties
              .adres ||
            ""
          ).trim();


        if (
          !address
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "De boeking heeft geen adres."
            });
        }


        const plannerValidation =
          await validatePlannerBooking({

            ticketId:
              ticket_id,

            photographerId:
              currentPhotographerId,

            address,

            startMs:
              timeValidation.startMs,

            endMs:
              timeValidation.endMs

          });


        if (
          !plannerValidation.valid
        ) {

          return res
            .status(
              409
            )
            .json({

              success:
                false,

              validation_failed:
                true,

              error:
                plannerValidation.error

            });
        }


        const updated =
          await updateTicket(
            ticket_id,
            {

              afspraak_start:
                String(
                  timeValidation.startMs
                ),

              afspraak_einde:
                String(
                  timeValidation.endMs
                )

            }
          );


        return res
          .status(
            200
          )
          .json({

            success:
              true,

            rescheduled:
              true,

            old_start:
              currentStart,

            old_end:
              currentEnd,

            new_start:
              timeValidation.startMs,

            new_end:
              timeValidation.endMs,

            validation:
              plannerValidation,

            ticket:
              updated

          });
      }


      // =======================================
      // PLANNER BOEKING GOEDKEUREN
      // =======================================

      if (
        action ===
        "planner-approve"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

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
          address !==
          undefined
            ? address
            : p.adres;


        const finalPhotographerId =
          photographer_id !==
          undefined
            ? photographer_id
            : p.selected_photographer_id;


        const finalStart =
          start !==
          undefined
            ? start
            : p.afspraak_start;


        const finalEnd =
          end !==
          undefined
            ? end
            : p.afspraak_einde;


        if (
          !finalPhotographerId
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

              error:
                "Geen fotograaf geselecteerd."
            });
        }


        if (
          !finalAddress
        ) {

          return res
            .status(
              400
            )
            .json({
              success:
                false,

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
            .status(
              400
            )
            .json({
              success:
                false,

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
            .status(
              409
            )
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
          diensten !==
          undefined
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
          .status(
            200
          )
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
            .status(
              400
            )
            .json({
              success:
                false,

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
            .status(
              400
            )
            .json({
              success:
                false,

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
          .status(
            200
          )
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
      // MAKELAAR BOEKING-ACTIES
      // =======================================

      if (
        !ticket_id ||
        !contact_id
      ) {

        return res
          .status(
            400
          )
          .json({
            success:
              false,

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
          .status(
            403
          )
          .json({
            success:
              false,

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
          .status(
            200
          )
          .json({
            success:
              true,

            cancelled:
              true,

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
          .status(
            200
          )
          .json({
            success:
              true,

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
            .status(
              400
            )
            .json({
              success:
                false,

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
                  : diensten ||
                    "",

              opmerking_klant:
                opmerking_klant ||
                "",

              woning_oppervlakte_m2:
                woning_oppervlakte_m2 !==
                  undefined &&
                woning_oppervlakte_m2 !==
                  null &&
                woning_oppervlakte_m2 !==
                  ""
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
          .status(
            200
          )
          .json({
            success:
              true,

            ticket:
              updated
          });
      }


      return res
        .status(
          400
        )
        .json({
          success:
            false,

          error:
            "Onbekende actie"
        });
    }


    return res
      .status(
        405
      )
      .json({
        success:
          false,

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
      .status(
        500
      )
      .json({
        success:
          false,

        error:
          error.message
      });
  }
}
