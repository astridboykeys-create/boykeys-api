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
  getTravelInfo,
  getTravelMatrix
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
      valid:
        false,

      error:
        "Begin- en eindtijd zijn verplicht."
    };
  }


  if (
    endMs <=
    startMs
  ) {

    return {
      valid:
        false,

      error:
        "De eindtijd moet na de begintijd liggen."
    };
  }


  return {
    valid:
      true,

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
// HOME LOCATION
// ============================================

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
// PLANNER BESCHIKBAARHEID OVERLAY
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
        "portal_role",
        "thuislocatie",
        "max_reistijd_minuten"
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


  const home =
    parseHomeLocation(
      photographer.properties
        ?.thuislocatie
    );


  const maxTravelMinutes =
    Number(
      photographer.properties
        ?.max_reistijd_minuten
    ) ||
    30;


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

    max_travel_minutes:
      maxTravelMinutes,

    home: {
      latitude:
        home.latitude,

      longitude:
        home.longitude
    },

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


// ============================================
// VOLLEDIGE BACKEND VALIDATIE
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
    String(
      photographer.properties
        ?.portal_role ||
      ""
    )
      .trim()
      .toLowerCase() !==
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
// TRAVEL OVERLAY
//
// BELANGRIJK:
// gebruikt de AL GELADEN agenda-bookings.
// Dus GEEN tweede HubSpot ticket search.
// ============================================

async function getPlannerTravelOverlay(
  photographerId,
  agendaBookings,
  availabilityOverlay
) {

  if (
    !photographerId ||
    !availabilityOverlay
  ) {

    return null;
  }


  if (
    String(
      availabilityOverlay.photographer_id ||
      ""
    ) !==
    String(
      photographerId
    )
  ) {

    return null;
  }


  const home =
    availabilityOverlay.home ||
    {};


  const homeLatitude =
    Number(
      home.latitude
    );


  const homeLongitude =
    Number(
      home.longitude
    );


  if (
    !Number.isFinite(
      homeLatitude
    ) ||
    !Number.isFinite(
      homeLongitude
    )
  ) {

    return null;
  }


  const photographerBookings =
    (
      agendaBookings ||
      []
    )
      .filter(
        booking => {

          if (
            String(
              booking.fotograaf?.id ||
              ""
            ) !==
            String(
              photographerId
            )
          ) {

            return false;
          }


          if (
            booking.status?.key ===
            "completed"
          ) {

            return false;
          }


          return (
            Boolean(
              booking.adres
            ) &&
            Number.isFinite(
              Number(
                booking.afspraak_start
              )
            ) &&
            Number.isFinite(
              Number(
                booking.afspraak_einde
              )
            )
          );
        }
      );


  const uniqueAddressMap =
    new Map();


  for (
    const booking of
      photographerBookings
  ) {

    const address =
      String(
        booking.adres ||
        ""
      ).trim();


    if (
      !address
    ) {

      continue;
    }


    const normalized =
      address
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        )
        .trim();


    if (
      !uniqueAddressMap.has(
        normalized
      )
    ) {

      uniqueAddressMap.set(
        normalized,
        {
          address,
          location:
            null
        }
      );
    }
  }


  await Promise.all(
    [
      ...uniqueAddressMap.values()
    ].map(
      async item => {

        try {

          item.location =
            await geocodeAddress(
              item.address
            );

        } catch (
          error
        ) {

          console.error(
            "PLANNER TRAVEL GEOCODE ERROR",
            item.address,
            error
          );


          item.location =
            null;
        }
      }
    )
  );


  const nodes =
    [
      {
        key:
          "home",

        type:
          "home",

        latitude:
          homeLatitude,

        longitude:
          homeLongitude
      }
    ];


  for (
    const booking of
      photographerBookings
  ) {

    const address =
      String(
        booking.adres ||
        ""
      ).trim();


    const normalized =
      address
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        )
        .trim();


    const location =
      uniqueAddressMap.get(
        normalized
      )?.location ||
      null;


    if (
      !location ||
      !Number.isFinite(
        Number(
          location.latitude
        )
      ) ||
      !Number.isFinite(
        Number(
          location.longitude
        )
      )
    ) {

      continue;
    }


    nodes.push({
      key:
        `booking:${booking.id}`,

      type:
        "booking",

      booking_id:
        String(
          booking.id
        ),

      address,

      start:
        Number(
          booking.afspraak_start
        ),

      end:
        Number(
          booking.afspraak_einde
        ),

      latitude:
        Number(
          location.latitude
        ),

      longitude:
        Number(
          location.longitude
        )
    });
  }


  /*
   * Als er alleen home is, is er nog steeds
   * een geldige overlay maar geen matrix nodig.
   */

  let matrix =
    {};


  if (
    nodes.length >
    1
  ) {

    matrix =
      await getTravelMatrix(
        nodes
      );
  }


  return {
    photographer_id:
      String(
        photographerId
      ),

    max_travel_minutes:
      Number(
        availabilityOverlay.max_travel_minutes
      ) ||
      30,

    nodes,

    matrix
  };
}


// ============================================
// PLANNER BOEKINGENOVERZICHT
// ============================================

const ASSOCIATION_TYPE_FOTOGRAAF = 79;
const ASSOCIATION_TYPE_MAKELAAR = 81;


// ============================================
// STAGES
// ============================================

function getPlannerStatus(
  stageId
) {

  const stage =
    String(
      stageId ||
      ""
    );


  const statuses = {

    "1": {
      key:
        "new",

      label:
        "Nieuw"
    },

    "2": {
      key:
        "review",

      label:
        "Review"
    },

    "3": {
      key:
        "approved",

      label:
        "Approved"
    },

    "5960815822": {
      key:
        "rejected",

      label:
        "Afgewezen"
    },

    "4": {
      key:
        "completed",

      label:
        "Afgerond"
    },

    "5960765665": {
      key:
        "cancelled",

      label:
        "Geannuleerd"
    },

    "5980739821": {
      key:
        "shoot_day",

      label:
        "Opnamedag"
    },

    "5980739822": {
      key:
        "processing",

      label:
        "Pakket in behandeling"
    }
  };


  return (
    statuses[
      stage
    ] ||
    {
      key:
        "unknown",

      label:
        "Onbekend"
    }
  );
}


// ============================================
// CONTACT DISPLAY NAME
// ============================================

function getContactDisplayName(
  contact
) {

  const properties =
    contact?.properties ||
    {};


  const firstname =
    String(
      properties.firstname ||
      ""
    ).trim();


  const lastname =
    String(
      properties.lastname ||
      ""
    ).trim();


  const company =
    String(
      properties.company ||
      ""
    ).trim();


  const email =
    String(
      properties.email ||
      ""
    ).trim();


  const fullName =
    [
      firstname,
      lastname
    ]
      .filter(
        Boolean
      )
      .join(" ")
      .trim();


  return (
    fullName ||
    company ||
    email ||
    "Onbekend"
  );
}


// ============================================
// ASSOCIATION HELPERS
// ============================================

function getAssociationItems(
  associations
) {

  if (
    !associations
  ) {

    return [];
  }


  if (
    Array.isArray(
      associations
    )
  ) {

    return associations;
  }


  if (
    Array.isArray(
      associations.results
    )
  ) {

    return associations.results;
  }


  if (
    Array.isArray(
      associations.to
    )
  ) {

    return associations.to;
  }


  return [];
}


function getAssociationTypes(
  association
) {

  if (
    Array.isArray(
      association?.associationTypes
    )
  ) {

    return association.associationTypes;
  }


  if (
    Array.isArray(
      association?.types
    )
  ) {

    return association.types;
  }


  return [];
}


function getAssociationTargetId(
  association
) {

  return String(
    association?.toObjectId ||
    association?.id ||
    association?.to?.id ||
    ""
  ).trim();
}


function getAssociatedContactIdByType(
  associations,
  typeId
) {

  for (
    const association of
      getAssociationItems(
        associations
      )
  ) {

    const types =
      getAssociationTypes(
        association
      );


    const hasType =
      types.some(
        type =>
          Number(
            type?.typeId
          ) ===
          Number(
            typeId
          )
      );


    if (
      !hasType
    ) {

      continue;
    }


    const contactId =
      getAssociationTargetId(
        association
      );


    if (
      contactId
    ) {

      return contactId;
    }
  }


  return null;
}


// ============================================
// CHUNK HELPER
// ============================================

function chunkArray(
  items,
  size = 1000
) {

  const chunks =
    [];


  for (
    let index = 0;
    index < items.length;
    index += size
  ) {

    chunks.push(
      items.slice(
        index,
        index + size
      )
    );
  }


  return chunks;
}


// ============================================
// BATCH ASSOCIATIONS
//
// 1 HubSpot call per maximaal 1000 boekingen.
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


  /*
   * Zorg dat iedere boeking altijd
   * een entry heeft.
   */

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
          results: []
        }
      );
    }
  }


  return associationsByTicket;
}


// ============================================
// NORMALISEER CONTACT
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
// BATCH CONTACTS
//
// HubSpot contact batch/read = max 100.
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
// AGENDA RECORDS ENRICHEN
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
      ) ||
      {
        results: []
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


    /*
     * selected_photographer_id heeft voorrang.
     *
     * Imported boekingen hebben hem normaal
     * gelijk aan de association, maar dit maakt
     * bestaande oudere boekingen ook robuust.
     */

    const photographerId =
      String(
        properties.selected_photographer_id ||
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
// DIENSTEN
// ============================================

function normalizeBookingServices(
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
            item ||
            ""
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


// ============================================
// BOOKING NORMALIZATION
// ============================================

function normalizePlannerBooking(
  record,
  associationsByTicket,
  contactsById
) {

  const properties =
    record.properties ||
    {};


  const associations =
    associationsByTicket.get(
      String(
        record.id
      )
    ) ||
    {
      results: []
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
      properties.selected_photographer_id ||
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
          String(
            photographerId
          )
        ) ||
        null
      : null;


  const start =
    normalizeEpoch(
      properties.afspraak_start
    );


  const end =
    normalizeEpoch(
      properties.afspraak_einde
    );


  return {
    id:
      String(
        record.id
      ),

    adres:
      properties.adres ||
      "",

    diensten:
      normalizeBookingServices(
        properties.diensten
      ),

    afspraak_start:
      start,

    afspraak_einde:
      end,

    boekingscode:
      properties.boekingscode ||
      "",

    woning_oppervlakte_m2:
      properties.woning_oppervlakte_m2 ||
      "",

    opmerking_klant:
      properties.opmerking_klant ||
      "",

    extra_opdracht:
      String(
        properties.extra_opdracht ||
        ""
      )
        .trim()
        .toLowerCase() ===
      "true",

    extra_opdracht_facturatie:
      properties.extra_opdracht_facturatie ||
      "",

    download_link:
      properties.download_link ||
      "",

    status:
      getPlannerStatus(
        properties.hs_pipeline_stage
      ),

    makelaar,

    fotograaf,

    huiseigenaar: {
      naam:
        properties.huiseigenaar_naam ||
        "",

      email:
        properties.huiseigenaar_email ||
        "",

      telefoon:
        properties.huiseigenaar_telefoon ||
        ""
    }
  };
}


// ============================================
// AGENDA RANGE
// ============================================

function normalizeAgendaRange(
  rangeStart,
  rangeEnd
) {

  const start =
    normalizeEpoch(
      rangeStart
    );


  const end =
    normalizeEpoch(
      rangeEnd
    );


  if (
    !start ||
    !end ||
    end <=
      start
  ) {

    return {
      start:
        null,

      end:
        null
    };
  }


  return {
    start,
    end
  };
}


// ============================================
// AGENDA SEARCH
// ============================================

async function searchPlannerAgendaRecords(
  rangeStart = null,
  rangeEnd = null
) {

  const range =
    normalizeAgendaRange(
      rangeStart,
      rangeEnd
    );


  const filters = [
    {
      propertyName:
        "hs_pipeline",

      operator:
        "EQ",

      value:
        "0"
    },

    /*
     * Cancelled hoeft niet als actieve
     * agenda-boeking te worden getoond.
     */
    {
      propertyName:
        "hs_pipeline_stage",

      operator:
        "NEQ",

      value:
        String(
          STAGE_CANCELLED
        )
    }
  ];


  if (
    range.start !==
    null
  ) {

    filters.push({
      propertyName:
        "afspraak_start",

      operator:
        "GTE",

      value:
        String(
          range.start
        )
    });
  }


  if (
    range.end !==
    null
  ) {

    filters.push({
      propertyName:
        "afspraak_start",

      operator:
        "LT",

      value:
        String(
          range.end
        )
    });
  }


  const properties = [
    "adres",
    "diensten",
    "selected_photographer_id",
    "afspraak_start",
    "afspraak_einde",
    "hs_pipeline",
    "hs_pipeline_stage",
    "boekingscode",
    "woning_oppervlakte_m2",
    "opmerking_klant",
    "huiseigenaar_naam",
    "huiseigenaar_email",
    "huiseigenaar_telefoon",
    "download_link",
    "extra_opdracht",
    "extra_opdracht_facturatie"
  ];


  let after =
    0;


  const records =
    [];


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
        200
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


    records.push(
      ...(
        response.results ||
        []
      )
    );


    after =
      Number(
        response.paging
          ?.next
          ?.after ||
        0
      );

  } while (
    after
  );


  return records;
}


// ============================================
// AGENDA BOOKINGS
// ============================================

async function getPlannerAgendaBookings(
  rangeStart = null,
  rangeEnd = null
) {

  const records =
    await searchPlannerAgendaRecords(
      rangeStart,
      rangeEnd
    );


  if (
    !records.length
  ) {

    return {
      bookings: [],
      photographers: [],
      makelaars: []
    };
  }


  const {
    associationsByTicket,
    contactsById
  } =
    await enrichPlannerRecords(
      records
    );


  const bookings =
    records
      .map(
        record =>
          normalizePlannerBooking(
            record,
            associationsByTicket,
            contactsById
          )
      )
      .filter(
        booking =>
          Number.isFinite(
            Number(
              booking.afspraak_start
            )
          ) &&
          Number.isFinite(
            Number(
              booking.afspraak_einde
            )
          )
      );


  // =========================================
  // FOTOGRAFEN UIT DE ZICHTBARE BOEKINGEN
  // =========================================

  const photographerMap =
    new Map();


  const makelaarMap =
    new Map();


  for (
    const booking of
      bookings
  ) {

    if (
      booking.fotograaf?.id
    ) {

      photographerMap.set(
        String(
          booking.fotograaf.id
        ),
        {
          id:
            String(
              booking.fotograaf.id
            ),

          name:
            booking.fotograaf.name ||
            "Onbekend"
        }
      );
    }


    if (
      booking.makelaar?.id
    ) {

      makelaarMap.set(
        String(
          booking.makelaar.id
        ),
        {
          id:
            String(
              booking.makelaar.id
            ),

          name:
            booking.makelaar.name ||
            "Onbekend"
        }
      );
    }
  }


  const photographers =
    [
      ...photographerMap.values()
    ]
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


  const makelaars =
    [
      ...makelaarMap.values()
    ]
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


  return {
    bookings,
    photographers,
    makelaars
  };
}


// ============================================
// PLANNER ROLE CHECK
// ============================================

async function validatePlannerContact(
  contactId
) {

  if (
    !contactId
  ) {

    return {
      valid:
        false,

      error:
        "Planner ontbreekt."
    };
  }


  const contact =
    await getContact(
      contactId,
      [
        "firstname",
        "lastname",
        "email",
        "portal_role"
      ]
    );


  const role =
    String(
      contact.properties
        ?.portal_role ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    role !==
    "planner"
  ) {

    return {
      valid:
        false,

      error:
        "Geen toegang tot de planner."
    };
  }


  return {
    valid:
      true,

    contact
  };
}


// ============================================
// PLANNER AGENDA RESPONSE
//
// Wordt vanuit de GET-handler in deel 3
// aangeroepen.
// ============================================

async function buildPlannerAgendaResponse({
  contactId,
  rangeStart,
  rangeEnd,
  photographerId
}) {

  const plannerValidation =
    await validatePlannerContact(
      contactId
    );


  if (
    !plannerValidation.valid
  ) {

    return {
      status:
        403,

      body: {
        success:
          false,

        error:
          plannerValidation.error
      }
    };
  }


  /*
   * Eerst 1x de zichtbare agenda ophalen.
   *
   * Dit bevat al alle associations/contacten.
   */

  const agenda =
    await getPlannerAgendaBookings(
      rangeStart,
      rangeEnd
    );


  let availabilityOverlay =
    null;


  let travelOverlay =
    null;


  const selectedPhotographerId =
    String(
      photographerId ||
      ""
    ).trim();


  /*
   * Alleen als de frontend om één specifieke
   * fotograaf vraagt, berekenen we availability
   * en travel.
   *
   * Bij "Alle fotografen" gebeurt dit dus NIET.
   */

  if (
    selectedPhotographerId
  ) {

    availabilityOverlay =
      await getPlannerAvailabilityOverlay(
        selectedPhotographerId,
        rangeStart,
        rangeEnd
      );


    /*
     * BELANGRIJK:
     *
     * agenda.bookings wordt hergebruikt.
     *
     * Er wordt hier dus NIET nogmaals
     * getBookings() / ticket search gedaan.
     */

    travelOverlay =
      await getPlannerTravelOverlay(
        selectedPhotographerId,
        agenda.bookings,
        availabilityOverlay
      );
  }


  return {
    status:
      200,

    body: {
      success:
        true,

      bookings:
        agenda.bookings,

      photographers:
        agenda.photographers,

      makelaars:
        agenda.makelaars,

      availability_overlay:
        availabilityOverlay,

      travel_overlay:
        travelOverlay
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
          .status(200)
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
          .status(200)
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
            .status(400)
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
            .status(404)
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
          String(
            contact.properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase() !==
          "makelaar"
        ) {

          return res
            .status(403)
            .json({
              success:
                false,

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
            .status(404)
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
          String(
            contact.properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase() !==
          "makelaar"
        ) {

          return res
            .status(403)
            .json({
              success:
                false,

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
          .status(200)
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
            .status(400)
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
          .status(200)
          .json({
            success:
              true,

            orders
          });
      }


      // =======================================
      // PLANNER DASHBOARD
      // =======================================

      if (
        action ===
        "planner-dashboard"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(400)
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
            .status(403)
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
          .status(200)
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
            .status(400)
            .json({
              success:
                false,

              error:
                "contact_id is verplicht"
            });
        }


        const result =
          await buildPlannerAgendaResponse({

            contactId:
              contact_id,

            rangeStart:
              range_start ||
              null,

            rangeEnd:
              range_end ||
              null,

            photographerId:
              photographer_id ||
              null

          });


        return res
          .status(
            result.status
          )
          .json(
            result.body
          );
      }


      // =======================================
      // PLANNER BOEKING - DEBUG
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
          .status(200)
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
        .status(400)
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

        mode,

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
            .status(400)
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
            .status(403)
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
            .status(400)
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
            .status(400)
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
          .status(200)
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
            .status(400)
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
            .status(403)
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
            .status(400)
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
            .status(400)
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
          .status(200)
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
            .status(400)
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
            .status(404)
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
          String(
            contact.properties
              ?.portal_role ||
            ""
          )
            .trim()
            .toLowerCase() !==
          "makelaar"
        ) {

          return res
            .status(403)
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
          .status(200)
          .json({
            success:
              true,

            contact:
              updated
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
              success:
                false,

              error:
                "ticket_id is verplicht"
            });
        }


        const properties =
          {};


        if (
          address !==
          undefined
        ) {

          properties.adres =
            address ||
            "";
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
          woning_oppervlakte_m2 !==
          undefined
        ) {

          properties.woning_oppervlakte_m2 =
            woning_oppervlakte_m2 !==
              null &&
            woning_oppervlakte_m2 !==
              ""
              ? String(
                  woning_oppervlakte_m2
                )
              : "";
        }


        if (
          huiseigenaar_naam !==
          undefined
        ) {

          properties.huiseigenaar_naam =
            huiseigenaar_naam ||
            "";
        }


        if (
          huiseigenaar_email !==
          undefined
        ) {

          properties.huiseigenaar_email =
            huiseigenaar_email ||
            "";
        }


        if (
          huiseigenaar_telefoon !==
          undefined
        ) {

          properties.huiseigenaar_telefoon =
            huiseigenaar_telefoon ||
            "";
        }


        if (
          start !==
            undefined ||
          end !==
            undefined
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
            start !==
            undefined
              ? start
              : currentTicket
                  .properties
                  ?.afspraak_start;


          const finalEnd =
            end !==
            undefined
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
                success:
                  false,

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
            success:
              true,

            ticket:
              updated
          });
      }


      // =======================================
      // PLANNER RESCHEDULE
      //
      // move:
      // duur blijft gelijk
      //
      // resize:
      // start blijft gelijk
      // eindtijd verandert
      // =======================================

      if (
        action ===
        "planner-reschedule"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(400)
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
            .status(400)
            .json({
              success:
                false,

              error:
                "ticket_id is verplicht"
            });
        }


        // =====================================
        // PLANNER CONTROLEREN
        // =====================================

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
            .status(403)
            .json({
              success:
                false,

              error:
                "Geen toegang tot Planner"
            });
        }


        // =====================================
        // BOEKING + ASSOCIATIES
        // =====================================

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
            .status(400)
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
            .status(400)
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
            .status(400)
            .json({
              success:
                false,

              error:
                timeValidation.error
            });
        }


        const requestedMode =
          String(
            mode ||
            "move"
          )
            .trim()
            .toLowerCase();


        const rescheduleMode =
          requestedMode ===
          "resize"
            ? "resize"
            : "move";


        const currentDuration =
          currentEnd -
          currentStart;


        const newDuration =
          timeValidation.endMs -
          timeValidation.startMs;


        // =====================================
        // MOVE
        // =====================================

        if (
          rescheduleMode ===
          "move" &&
          currentDuration !==
          newDuration
        ) {

          return res
            .status(400)
            .json({
              success:
                false,

              error:
                "Bij verslepen moet de duur van de boeking gelijk blijven."
            });
        }


        // =====================================
        // RESIZE
        // =====================================

        if (
          rescheduleMode ===
          "resize"
        ) {

          if (
            currentStart !==
            timeValidation.startMs
          ) {

            return res
              .status(400)
              .json({
                success:
                  false,

                error:
                  "Bij het aanpassen van de duur mag de begintijd niet veranderen."
              });
          }


          const minimumDuration =
            15 *
            60 *
            1000;


          if (
            newDuration <
            minimumDuration
          ) {

            return res
              .status(400)
              .json({
                success:
                  false,

                error:
                  "Een boeking moet minimaal 15 minuten duren."
              });
          }
        }


        // =====================================
        // NIETS GEWIJZIGD
        // =====================================

        if (
          currentStart ===
            timeValidation.startMs &&
          currentEnd ===
            timeValidation.endMs
        ) {

          return res
            .status(200)
            .json({

              success:
                true,

              rescheduled:
                false,

              unchanged:
                true,

              mode:
                rescheduleMode,

              new_start:
                currentStart,

              new_end:
                currentEnd

            });
        }


        const bookingAddress =
          String(
            currentProperties
              .adres ||
            ""
          ).trim();


        if (
          !bookingAddress
        ) {

          return res
            .status(400)
            .json({
              success:
                false,

              error:
                "De boeking heeft geen adres."
            });
        }


        // =====================================
        // DEFINITIEVE BACKEND VALIDATIE
        // =====================================

        const plannerValidation =
          await validatePlannerBooking({

            ticketId:
              ticket_id,

            photographerId:
              currentPhotographerId,

            address:
              bookingAddress,

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

              mode:
                rescheduleMode,

              error:
                plannerValidation.error

            });
        }


        // =====================================
        // OPSLAAN
        // =====================================

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
          .status(200)
          .json({

            success:
              true,

            rescheduled:
              true,

            mode:
              rescheduleMode,

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
            .status(400)
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
            .status(400)
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
            .status(400)
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
            .status(400)
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
      // MAKELAAR BOEKING-ACTIES
      // =======================================

      if (
        !ticket_id ||
        !contact_id
      ) {

        return res
          .status(400)
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
          .status(403)
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
          .status(200)
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
          .status(200)
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
            .status(400)
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
          .status(200)
          .json({
            success:
              true,

            ticket:
              updated
          });
      }


      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Onbekende actie"
        });
    }


    // =========================================
    // METHOD NIET TOEGESTAAN
    // =========================================

    return res
      .status(405)
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
      .status(500)
      .json({
        success:
          false,

        error:
          error.message ||
          "Interne serverfout"
      });
  }
}
