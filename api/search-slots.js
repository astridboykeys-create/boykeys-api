import { enableCors } from "../lib/cors.js";

import {
  getPhotographers,
  getBookings,
  getPlannerSettings
} from "../lib/hubspot.js";

import {
  getAvailability
} from "../lib/availability.js";

import {
  getBlocks
} from "../lib/blocks.js";

import {
  getAvailableSlots
} from "../lib/planner.js";

import {
  getTravelInfo,
  geocodeAddress
} from "../lib/googleRoutes.js";


// ============================================
// DAGEN
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


// ============================================
// DIENSTEN NORMALISEREN
// ============================================

function normalizeServices(value) {

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value)
    .split(";")
    .map(
      service =>
        service.trim()
    )
    .filter(Boolean);

}


// ============================================
// CHECK OF FOTOGRAAF ALLE DIENSTEN KAN
// ============================================

function photographerCanDoServices(
  photographer,
  requestedServices
) {

  const photographerServices =
    normalizeServices(
      photographer.diensten
    );

  return requestedServices.every(
    service =>
      photographerServices.includes(
        service
      )
  );

}


// ============================================
// AMSTERDAM DATUM YYYY-MM-DD
// ============================================

function getAmsterdamDate(
  value
) {

  if (!value) {
    return null;
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


  return new Intl.DateTimeFormat(
    "en-CA",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone:
        "Europe/Amsterdam"
    }
  ).format(date);

}


// ============================================
// AMSTERDAM TIJD HH:MM
// ============================================

function getAmsterdamTime(
  value
) {

  if (!value) {
    return null;
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


  const parts =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone:
          "Europe/Amsterdam"
      }
    ).formatToParts(
      date
    );


  const hour =
    parts.find(
      part =>
        part.type === "hour"
    )?.value;


  const minute =
    parts.find(
      part =>
        part.type === "minute"
    )?.value;


  if (
    hour === undefined ||
    minute === undefined
  ) {
    return null;
  }


  return `${hour}:${minute}`;

}


// ============================================
// WEEKDAG VAN YYYY-MM-DD
// ============================================

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


  /*
   * 12:00 UTC voorkomt dat een kale datum
   * per ongeluk op de vorige dag uitkomt.
   */

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


// ============================================
// TIJDZONE OFFSET
// ============================================

function getTimeZoneOffsetMs(
  date,
  timeZone
) {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone
      }
    ).formatToParts(
      date
    );


  const values = {};


  for (
    const part of parts
  ) {

    if (
      part.type !== "literal"
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


// ============================================
// AMSTERDAM DATUM + TIJD NAAR DATE
// ============================================

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


  /*
   * Tweede controle voor omschakeling
   * zomer-/wintertijd.
   */

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
// REPEAT DAYS NORMALISEREN
// ============================================

function normalizeRepeatDays(
  value
) {

  if (!value) {
    return [];
  }


  if (
    Array.isArray(value)
  ) {
    return value;
  }


  return String(value)
    .split(";")
    .map(
      value =>
        value.trim()
    )
    .filter(Boolean);

}


// ============================================
// BLOKKADES UITBREIDEN VOOR GEKOZEN DATUM
// ============================================

function expandBlocksForDate(
  blocks,
  selectedDate
) {

  const result = [];


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


    // ========================================
    // EENMALIGE BLOKKADE
    // ========================================

    if (
      repeatType === "none"
    ) {

      result.push(
        block
      );

      continue;

    }


    // ========================================
    // ALLEEN WEEKLY ONDERSTEUND
    // ========================================

    if (
      repeatType !== "weekly"
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


    // ========================================
    // HERHALING MAG NIET VÓÓR STARTDATUM BEGINNEN
    // ========================================

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


    // ========================================
    // HERHALEN TOT
    // ========================================

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


    // ========================================
    // TIJDEN VAN ORIGINELE BLOKKADE
    // ========================================

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


    const occurrenceStart =
      createAmsterdamDate(
        selectedDate,
        startTime
      );


    const occurrenceEnd =
      createAmsterdamDate(
        selectedDate,
        endTime
      );


    result.push({

      ...block,

      original_block_id:
        block.id,

      start_at:
        occurrenceStart.toISOString(),

      end_at:
        occurrenceEnd.toISOString(),

      is_recurring_occurrence:
        true

    });

  }


  return result;

}


// ============================================
// TICKET NAAR BOEKING
// ============================================

function ticketToBooking(
  ticket
) {

  const properties =
    ticket.properties || {};


  if (
    !properties.afspraak_start ||
    !properties.afspraak_einde
  ) {
    return null;
  }


  const start =
    new Date(
      Number(
        properties.afspraak_start
      ) ||
      properties.afspraak_start
    );


  const end =
    new Date(
      Number(
        properties.afspraak_einde
      ) ||
      properties.afspraak_einde
    );


  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return null;
  }


  return {

    id:
      ticket.id,

    start,

    end,

    adres:
      properties.adres ||
      ""

  };

}


// ============================================
// BOEKINGEN OP GEKOZEN DAG
// ============================================

function getBookingsForDate(
  tickets,
  selectedDate,
  excludeTicketId
) {

  return (
    tickets || []
  )

    .filter(
      ticket => {

        if (
          excludeTicketId &&
          String(
            ticket.id
          ) ===
            String(
              excludeTicketId
            )
        ) {
          return false;
        }


        return true;

      }
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
      (
        a,
        b
      ) =>
        a.start.getTime() -
        b.start.getTime()
    );

}


// ============================================
// VORIGE BOEKING
// ============================================

function findPreviousBooking(
  bookings,
  candidateStart
) {

  let previous =
    null;


  for (
    const booking of bookings
  ) {

    if (
      booking.end <=
        candidateStart
    ) {

      if (
        !previous ||
        booking.end >
          previous.end
      ) {

        previous =
          booking;

      }

    }

  }


  return previous;

}


// ============================================
// VOLGENDE BOEKING
// ============================================

function findNextBooking(
  bookings,
  candidateEnd
) {

  let next =
    null;


  for (
    const booking of bookings
  ) {

    if (
      booking.start >=
        candidateEnd
    ) {

      if (
        !next ||
        booking.start <
          next.start
      ) {

        next =
          booking;

      }

    }

  }


  return next;

}


// ============================================
// CHECK DIRECTE OVERLAP
// ============================================

function hasBookingOverlap(
  bookings,
  candidateStart,
  candidateEnd
) {

  return bookings.some(
    booking =>
      candidateStart <
        booking.end &&
      candidateEnd >
        booking.start
  );

}


// ============================================
// HANDLER
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


  if (
    req.method !== "POST"
  ) {

    return res
      .status(405)
      .json({

        success:
          false,

        error:
          "Method not allowed"

      });

  }


  try {

    // ========================================
    // REQUEST
    // ========================================

    const {
      date,

      address,
      adres,

      latitude,
      longitude,

      lat,
      lng,

      diensten,
      services,

      exclude_ticket_id
    } =
      req.body || {};


    const selectedDate =
      date;


    const destinationAddress =
      address ||
      adres ||
      "";


    let destinationLatitude =
      latitude ??
      lat;


    let destinationLongitude =
      longitude ??
      lng;


    const requestedServices =
      normalizeServices(
        diensten ||
        services
      );


    // ========================================
    // VALIDATIE
    // ========================================

    if (
      !selectedDate
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "date is verplicht"

        });

    }


    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        selectedDate
      )
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "date moet YYYY-MM-DD zijn"

        });

    }


    if (
      !destinationAddress &&
      (
        destinationLatitude ===
          undefined ||
        destinationLongitude ===
          undefined
      )
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "Adres of coördinaten zijn verplicht"

        });

    }


    // ========================================
    // BESTEMMING GEOCODEN INDIEN NODIG
    // ========================================

    if (
      destinationLatitude ===
        undefined ||
      destinationLongitude ===
        undefined ||
      destinationLatitude ===
        null ||
      destinationLongitude ===
        null ||
      destinationLatitude ===
        "" ||
      destinationLongitude ===
        ""
    ) {

      const geocoded =
        await geocodeAddress(
          destinationAddress
        );


      destinationLatitude =
        geocoded.latitude;


      destinationLongitude =
        geocoded.longitude;

    }


    destinationLatitude =
      Number(
        destinationLatitude
      );


    destinationLongitude =
      Number(
        destinationLongitude
      );


    if (
      !Number.isFinite(
        destinationLatitude
      ) ||
      !Number.isFinite(
        destinationLongitude
      )
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "Ongeldige coördinaten"

        });

    }


    // ========================================
    // PLANNER INSTELLINGEN
    // ========================================

    const plannerSettings =
      await getPlannerSettings();


    const {
      slotIntervalMinutes,
      bookingDurationMinutes
    } =
      plannerSettings;


    // ========================================
    // FOTOGRAFEN
    // ========================================

    const photographers =
      await getPhotographers();


    const eligiblePhotographers =
      requestedServices.length
        ? photographers.filter(
            photographer =>
              photographerCanDoServices(
                photographer,
                requestedServices
              )
          )
        : photographers;


    const results = [];


    // ========================================
    // PER FOTOGRAAF
    // ========================================

    for (
      const photographer of
        eligiblePhotographers
    ) {

      try {

        // ====================================
        // DATA OPHALEN
        // ====================================

        const [
          availability,
          rawBlocks,
          bookingsResponse
        ] =
          await Promise.all([

            getAvailability(
              photographer.id
            ),

            getBlocks(
              photographer.id
            ),

            getBookings(
              photographer.id
            )

          ]);


        // ====================================
        // BLOCKS VOOR DEZE DATUM
        // ====================================

        const effectiveBlocks =
          expandBlocksForDate(
            rawBlocks,
            selectedDate
          );


        // ====================================
        // BOEKINGEN
        // ====================================

        const allTickets =
          bookingsResponse.results ||
          [];


        const bookings =
          getBookingsForDate(
            allTickets,
            selectedDate,
            exclude_ticket_id
          );


        // ====================================
        // UNAVAILABLE PERIODS
        // ====================================

        const unavailablePeriods = [

          ...effectiveBlocks.map(
            block => ({
              start:
                block.start_at,

              end:
                block.end_at
            })
          ),

          ...bookings.map(
            booking => ({
              start:
                booking.start,

              end:
                booking.end
            })
          )

        ];


        // ====================================
        // BASIS SLOTS
        // ====================================

        const baseSlots =
          getAvailableSlots(
            availability,
            unavailablePeriods,
            new Date(
              `${selectedDate}T12:00:00`
            ),
            bookingDurationMinutes,
            slotIntervalMinutes
          );


        if (
          !baseSlots.length
        ) {
          continue;
        }


        // ====================================
        // SLOT-SPECIFIEKE REISTIJD
        // ====================================

        const availableSlots =
          [];


        for (
          const slot of
            baseSlots
        ) {

          const candidateStart =
            createAmsterdamDate(
              selectedDate,
              slot.start
            );


          const candidateEnd =
            createAmsterdamDate(
              selectedDate,
              slot.end
            );


          // ==================================
          // EXTRA OVERLAP CHECK
          // ==================================

          if (
            hasBookingOverlap(
              bookings,
              candidateStart,
              candidateEnd
            )
          ) {
            continue;
          }


          const previousBooking =
            findPreviousBooking(
              bookings,
              candidateStart
            );


          const nextBooking =
            findNextBooking(
              bookings,
              candidateEnd
            );


          // ==================================
          // INKOMENDE ROUTE
          // ==================================

          let incomingTravel =
            null;


          let travelFrom =
            "home";


          // ----------------------------------
          // Vorige afspraak -> nieuwe afspraak
          // ----------------------------------

          if (
            previousBooking
          ) {

            if (
              !previousBooking.adres
            ) {
              continue;
            }


            const previousLocation =
              await geocodeAddress(
                previousBooking.adres
              );


            incomingTravel =
              await getTravelInfo(
                previousLocation.latitude,
                previousLocation.longitude,
                destinationLatitude,
                destinationLongitude
              );


            travelFrom =
              "previous_booking";


            const earliestPossibleStart =
              new Date(
                previousBooking.end.getTime() +
                incomingTravel.travel_minutes *
                  60000
              );


            if (
              candidateStart <
                earliestPossibleStart
            ) {
              continue;
            }

          }

          // ----------------------------------
          // Thuis -> nieuwe afspraak
          // ----------------------------------

          else {

            if (
              photographer.latitude ===
                null ||
              photographer.longitude ===
                null ||
              photographer.latitude ===
                undefined ||
              photographer.longitude ===
                undefined
            ) {
              continue;
            }


            incomingTravel =
              await getTravelInfo(
                photographer.latitude,
                photographer.longitude,
                destinationLatitude,
                destinationLongitude
              );

          }


          // ==================================
          // MAX REISTIJD FOTOGRAAF
          // ==================================

          const maxTravel =
            Number(
              photographer.max_reistijd_minuten
            );


          if (
            Number.isFinite(
              maxTravel
            ) &&
            maxTravel > 0 &&
            incomingTravel.travel_minutes >
              maxTravel
          ) {
            continue;
          }


          // ==================================
          // ROUTE NAAR VOLGENDE AFSPRAAK
          // ==================================

          let travelToNext =
            null;


          if (
            nextBooking
          ) {

            if (
              !nextBooking.adres
            ) {
              continue;
            }


            const nextLocation =
              await geocodeAddress(
                nextBooking.adres
              );


            travelToNext =
              await getTravelInfo(
                destinationLatitude,
                destinationLongitude,
                nextLocation.latitude,
                nextLocation.longitude
              );


            const latestPossibleEnd =
              new Date(
                nextBooking.start.getTime() -
                travelToNext.travel_minutes *
                  60000
              );


            if (
              candidateEnd >
                latestPossibleEnd
            ) {
              continue;
            }

          }


          // ==================================
          // SLOT GELDIG
          // ==================================

          availableSlots.push({

            start:
              slot.start,

            end:
              slot.end,

            travel_minutes:
              incomingTravel
                .travel_minutes,

            travel_distance_km:
              incomingTravel
                .distance_km,

            travel_from:
              travelFrom,

            travel_to_next_minutes:
              travelToNext
                ? travelToNext
                    .travel_minutes
                : null,

            travel_to_next_distance_km:
              travelToNext
                ? travelToNext
                    .distance_km
                : null

          });

        }


        // ====================================
        // ALLEEN FOTOGRAAF TOEVOEGEN
        // ALS ER SLOTS ZIJN
        // ====================================

        if (
          availableSlots.length
        ) {

          results.push({

            id:
              photographer.id,

            firstname:
              photographer.firstname,

            lastname:
              photographer.lastname,

            name:
              [
                photographer.firstname,
                photographer.lastname
              ]
                .filter(Boolean)
                .join(" "),

            diensten:
              photographer.diensten,

            max_reistijd_minuten:
              photographer
                .max_reistijd_minuten,

            slots:
              availableSlots

          });

        }

      } catch (
        photographerError
      ) {

        console.error(
          `SEARCH SLOTS ERROR FOTOGRAAF ${photographer.id}:`,
          photographerError
        );

        /*
         * Eén fotograaf mag niet de hele
         * planner laten crashen.
         */

      }

    }


    // ========================================
    // RESPONSE
    // ========================================

    return res
      .status(200)
      .json({

        success:
          true,

        date:
          selectedDate,

        booking_duration_minutes:
          bookingDurationMinutes,

        slot_interval_minutes:
          slotIntervalMinutes,

        photographers:
          results

      });


  } catch (error) {

    console.error(
      "SEARCH SLOTS ERROR:",
      error
    );


    return res
      .status(500)
      .json({

        success:
          false,

        error:
          error.message

      });

  }

}
