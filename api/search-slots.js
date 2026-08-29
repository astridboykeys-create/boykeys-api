import { enableCors } from "../lib/cors.js";

import {
  getPhotographers,
  getBookings,
  getPlannerSettings
} from "../lib/hubspot.js";

import {
  getTravelInfo,
  geocodeAddress
} from "../lib/googleRoutes.js";

import {
  getAvailability,
  getBlocks
} from "../lib/supabase.js";

import {
  getAvailableSlots
} from "../lib/planner.js";


// ============================================
// Tijd helpers
// ============================================

function timeToMinutes(time) {

  if (!time) {
    return null;
  }

  const [hours, minutes] =
    time
      .split(":")
      .map(Number);

  return (
    hours * 60 +
    minutes
  );

}


// ============================================
// HubSpot datetime -> datum Europe/Amsterdam
// ============================================

function getAmsterdamDateString(value) {

  if (!value) {
    return null;
  }

  const numeric =
    Number(value);

  const date =
    Number.isNaN(numeric)
      ? new Date(value)
      : new Date(numeric);

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
      timeZone: "Europe/Amsterdam"
    }
  ).format(date);

}


// ============================================
// HubSpot datetime -> minuten sinds 00:00
// ============================================

function getAmsterdamMinutes(value) {

  if (!value) {
    return null;
  }

  const numeric =
    Number(value);

  const date =
    Number.isNaN(numeric)
      ? new Date(value)
      : new Date(numeric);

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
        timeZone: "Europe/Amsterdam"
      }
    ).formatToParts(date);

  const hour =
    Number(
      parts.find(
        part =>
          part.type === "hour"
      )?.value
    );

  const minute =
    Number(
      parts.find(
        part =>
          part.type === "minute"
      )?.value
    );

  return (
    hour * 60 +
    minute
  );

}


// ============================================
// Boekingen van geselecteerde dag voorbereiden
// ============================================

function prepareBookingsForDate(
  bookings,
  selectedDate,
  excludeTicketId
) {

  return (
    bookings.results ||
    []
  )

    .filter(ticket => {

      if (
        excludeTicketId &&
        String(ticket.id) ===
        String(excludeTicketId)
      ) {
        return false;
      }

      const properties =
        ticket.properties || {};

      if (
        !properties.afspraak_start ||
        !properties.afspraak_einde
      ) {
        return false;
      }

      const bookingDate =
        getAmsterdamDateString(
          properties.afspraak_start
        );

      return (
        bookingDate ===
        selectedDate
      );

    })

    .map(ticket => {

      const properties =
        ticket.properties || {};

      return {

        id:
          ticket.id,

        address:
          properties.adres ||
          "",

        startMinutes:
          getAmsterdamMinutes(
            properties.afspraak_start
          ),

        endMinutes:
          getAmsterdamMinutes(
            properties.afspraak_einde
          ),

        raw:
          ticket

      };

    })

    .filter(
      booking =>
        booking.startMinutes !== null &&
        booking.endMinutes !== null
    )

    .sort(
      (a, b) =>
        a.startMinutes -
        b.startMinutes
    );

}


// ============================================
// Laatste boeking vóór slot zoeken
// ============================================

function findPreviousBooking(
  bookings,
  slotStart
) {

  let previous =
    null;

  for (
    const booking of bookings
  ) {

    if (
      booking.endMinutes <=
      slotStart
    ) {

      if (
        !previous ||
        booking.endMinutes >
        previous.endMinutes
      ) {

        previous =
          booking;

      }

    }

  }

  return previous;

}


// ============================================
// Eerste boeking ná slot zoeken
// ============================================

function findNextBooking(
  bookings,
  slotEnd
) {

  let next =
    null;

  for (
    const booking of bookings
  ) {

    if (
      booking.startMinutes >=
      slotEnd
    ) {

      if (
        !next ||
        booking.startMinutes <
        next.startMinutes
      ) {

        next =
          booking;

      }

    }

  }

  return next;

}


// ============================================
// Handler
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
    req.method !==
    "POST"
  ) {

    return res
      .status(405)
      .json({
        success: false,
        error: "Method not allowed"
      });

  }

  try {

    const {
      latitude,
      longitude,
      diensten = [],
      date,
      exclude_ticket_id
    } = req.body;


    // ==========================================
    // Validatie
    // ==========================================

    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {

      return res
        .status(400)
        .json({
          success: false,
          error:
            "Latitude en longitude ontbreken."
        });

    }


    const selectedDate =
      date ||
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Europe/Amsterdam"
        }
      ).format(
        new Date()
      );


    const searchDate =
      new Date(
        `${selectedDate}T12:00:00`
      );


    // ==========================================
    // Planner instellingen
    // ==========================================

    const plannerSettings =
      await getPlannerSettings();


    const {
      slotIntervalMinutes,
      bookingDurationMinutes
    } = plannerSettings;


    console.log(
      "================================"
    );

    console.log(
      "PLANNER SETTINGS"
    );

    console.log(
      "Slot interval:",
      slotIntervalMinutes
    );

    console.log(
      "Booking duration:",
      bookingDurationMinutes
    );


    // ==========================================
    // Fotografen ophalen
    // ==========================================

    const fotografen =
      await getPhotographers();


    // ==========================================
    // Diensten filteren
    // ==========================================

    const geschikteFotografen =
      fotografen.filter(
        fotograaf => {

          const beschikbareDiensten =
            (
              fotograaf.diensten ||
              ""
            )
              .split(";")
              .filter(Boolean);

          return diensten.every(
            dienst =>
              beschikbareDiensten.includes(
                dienst
              )
          );

        }
      );


    // ==========================================
    // Geocode cache
    // ==========================================

    const geocodeCache =
      new Map();


    async function getCoordinates(
      address
    ) {

      if (!address) {
        return null;
      }

      const key =
        address
          .trim()
          .toLowerCase();

      if (
        geocodeCache.has(
          key
        )
      ) {

        return geocodeCache.get(
          key
        );

      }

      try {

        const coordinates =
          await geocodeAddress(
            address
          );

        geocodeCache.set(
          key,
          coordinates
        );

        return coordinates;

      } catch (error) {

        console.error(
          "Geocoding fout:",
          address,
          error
        );

        geocodeCache.set(
          key,
          null
        );

        return null;

      }

    }


    // ==========================================
    // Travel cache
    // ==========================================

    const travelCache =
      new Map();


    async function getCachedTravel(
      fromLat,
      fromLng,
      toLat,
      toLng
    ) {

      const key = [
        Number(fromLat).toFixed(5),
        Number(fromLng).toFixed(5),
        Number(toLat).toFixed(5),
        Number(toLng).toFixed(5)
      ].join("|");


      if (
        travelCache.has(
          key
        )
      ) {

        return travelCache.get(
          key
        );

      }


      const travel =
        await getTravelInfo(
          fromLat,
          fromLng,
          toLat,
          toLng
        );


      travelCache.set(
        key,
        travel
      );


      return travel;

    }


    // ==========================================
    // Fotografen verwerken
    // ==========================================

    const resultaten =
      await Promise.all(

        geschikteFotografen.map(
          async fotograaf => {

            try {

              console.log(
                "================================"
              );

              console.log(
                "Fotograaf:",
                fotograaf.firstname,
                fotograaf.lastname
              );


              // ======================================
              // Availability
              // ======================================

              const availability =
                await getAvailability(
                  fotograaf.id
                );


              // ======================================
              // Blocks
              // ======================================

              const blocks =
                await getBlocks(
                  fotograaf.id
                );


              // ======================================
              // HubSpot boekingen
              // ======================================

              const bookings =
                await getBookings(
                  fotograaf.id
                );


              // ======================================
              // Unavailable periods
              // ======================================

              const unavailablePeriods = [

                ...blocks.map(
                  block => ({
                    start:
                      block.start_at,
                    end:
                      block.end_at
                  })
                ),

                ...(
                  bookings.results ||
                  []
                )

                  .filter(ticket => {

                    if (
                      exclude_ticket_id &&
                      String(ticket.id) ===
                      String(exclude_ticket_id)
                    ) {
                      return false;
                    }

                    return (
                      ticket.properties
                        .afspraak_start &&
                      ticket.properties
                        .afspraak_einde
                    );

                  })

                  .map(
                    ticket => ({
                      start:
                        ticket.properties
                          .afspraak_start,
                      end:
                        ticket.properties
                          .afspraak_einde
                    })
                  )

              ];


              // ======================================
              // Basis slots
              // ======================================

              const baseSlots =
                getAvailableSlots(
                  availability,
                  unavailablePeriods,
                  searchDate,
                  bookingDurationMinutes,
                  slotIntervalMinutes
                );


              if (
                !baseSlots.length
              ) {
                return null;
              }


              // ======================================
              // Boekingen van deze dag
              // ======================================

              const dayBookings =
                prepareBookingsForDate(
                  bookings,
                  selectedDate,
                  exclude_ticket_id
                );


              // ======================================
              // Slots + travel berekenen
              // ======================================

              const slotsWithTravel =
                [];


              for (
                const slot of baseSlots
              ) {

                const slotStart =
                  timeToMinutes(
                    slot.start
                  );


                const slotEnd =
                  timeToMinutes(
                    slot.end
                  );


                const previousBooking =
                  findPreviousBooking(
                    dayBookings,
                    slotStart
                  );


                const nextBooking =
                  findNextBooking(
                    dayBookings,
                    slotEnd
                  );


                // ==================================
                // INKOMENDE REISTIJD
                //
                // Als vorige boeking bestaat:
                // vorige locatie -> nieuwe locatie
                //
                // Anders:
                // thuis -> nieuwe locatie
                // ==================================

                let incomingTravel =
                  null;

                let travelFrom =
                  "home";


                if (
                  previousBooking
                ) {

                  if (
                    !previousBooking.address
                  ) {

                    console.warn(
                      "Vorige boeking heeft geen adres:",
                      previousBooking.id
                    );

                    continue;

                  }


                  const previousCoordinates =
                    await getCoordinates(
                      previousBooking.address
                    );


                  if (
                    !previousCoordinates
                  ) {
                    continue;
                  }


                  incomingTravel =
                    await getCachedTravel(

                      previousCoordinates.latitude,

                      previousCoordinates.longitude,

                      latitude,

                      longitude

                    );


                  travelFrom =
                    "previous_booking";


                  // ==================================
                  // Kan fotograaf op tijd aankomen?
                  // ==================================

                  const firstPossibleStart =
                    previousBooking.endMinutes +
                    incomingTravel.travel_minutes;


                  if (
                    slotStart <
                    firstPossibleStart
                  ) {

                    console.log(
                      `Slot ${slot.start} afgewezen: vorige boeking eindigt ${previousBooking.endMinutes}, reistijd ${incomingTravel.travel_minutes} min`
                    );

                    continue;

                  }

                } else {

                  // ==================================
                  // Geen vorige boeking:
                  // vanuit huis
                  // ==================================

                  incomingTravel =
                    await getCachedTravel(

                      fotograaf.latitude,

                      fotograaf.longitude,

                      latitude,

                      longitude

                    );


                  travelFrom =
                    "home";

                }


                // ==================================
                // Max reistijd controleren
                // op DEZE daadwerkelijke route
                // ==================================

                if (
                  incomingTravel.travel_minutes >
                  fotograaf.max_reistijd_minuten
                ) {

                  console.log(
                    `Slot ${slot.start} afgewezen wegens max reistijd: ${incomingTravel.travel_minutes} > ${fotograaf.max_reistijd_minuten}`
                  );

                  continue;

                }


                // ==================================
                // NIEUWE BOEKING -> VOLGENDE BOEKING
                // ==================================

                let outgoingTravel =
                  null;


                if (
                  nextBooking
                ) {

                  if (
                    !nextBooking.address
                  ) {

                    console.warn(
                      "Volgende boeking heeft geen adres:",
                      nextBooking.id
                    );

                    continue;

                  }


                  const nextCoordinates =
                    await getCoordinates(
                      nextBooking.address
                    );


                  if (
                    !nextCoordinates
                  ) {
                    continue;
                  }


                  outgoingTravel =
                    await getCachedTravel(

                      latitude,

                      longitude,

                      nextCoordinates.latitude,

                      nextCoordinates.longitude

                    );


                  const arrivalAtNext =
                    slotEnd +
                    outgoingTravel.travel_minutes;


                  if (
                    arrivalAtNext >
                    nextBooking.startMinutes
                  ) {

                    console.log(
                      `Slot ${slot.start} afgewezen: einde ${slotEnd}, reistijd naar volgende ${outgoingTravel.travel_minutes}, volgende begint ${nextBooking.startMinutes}`
                    );

                    continue;

                  }

                }


                // ==================================
                // SLOT GOEDGEKEURD
                // ==================================

                slotsWithTravel.push({

                  start:
                    slot.start,

                  end:
                    slot.end,

                  travel_minutes:
                    incomingTravel.travel_minutes,

                  travel_from:
                    travelFrom,

                  travel_distance_km:
                    incomingTravel.distance_km,

                  travel_to_next_minutes:
                    outgoingTravel
                      ?.travel_minutes ||
                    null

                });

              }


              if (
                !slotsWithTravel.length
              ) {

                return null;

              }


              // ======================================
              // Fotograaf resultaat
              // ======================================

              return {

                id:
                  fotograaf.id,

                firstname:
                  fotograaf.firstname,

                lastname:
                  fotograaf.lastname,

                diensten:
                  fotograaf.diensten,

                /*
                 * Geen algemene travel_minutes meer.
                 * Reistijd zit nu PER SLOT.
                 */

                availability,

                blocks,

                bookings:
                  bookings.results,

                slots:
                  slotsWithTravel

              };

            } catch (error) {

              console.error(
                "================================"
              );

              console.error(
                "FOUT BIJ:",
                fotograaf.firstname,
                fotograaf.lastname
              );

              console.error(
                error
              );

              return null;

            }

          }
        )

      );


    // ==========================================
    // Resultaten
    // ==========================================

    const matches =
      resultaten
        .filter(Boolean);


    return res
      .status(200)
      .json({

        success:
          true,

        planner_settings: {

          slot_interval_minutes:
            slotIntervalMinutes,

          booking_duration_minutes:
            bookingDurationMinutes

        },

        photographers:
          matches

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
