import { enableCors } from "../lib/cors.js";

import {
  getPhotographers,
  getBookings
} from "../lib/hubspot.js";

import { getTravelInfo } from "../lib/googleRoutes.js";

import {
  getAvailability,
  getBlocks
} from "../lib/supabase.js";

import {
  getAvailableSlots
} from "../lib/planner.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });

  }

  try {

    const {
      latitude,
      longitude,
      diensten = [],
      date
    } = req.body;

    if (!latitude || !longitude) {

      return res.status(400).json({
        success: false,
        error: "Latitude en longitude ontbreken."
      });

    }

    const searchDate =
      date
        ? new Date(date)
        : new Date();

    console.log("================================");
    console.log("SEARCH DATE");
    console.log(searchDate);
    console.log(searchDate.toISOString());
    console.log(searchDate.toString());

    // ==========================================
    // Fotografen ophalen
    // ==========================================

    const fotografen =
      await getPhotographers();

    console.log("=== ALLE FOTOGRAFEN ===");
    console.log(fotografen);

    // ==========================================
    // Diensten filteren
    // ==========================================

    const geschikteFotografen =
      fotografen.filter(fotograaf => {

        const beschikbareDiensten =
          (fotograaf.diensten || "")
            .split(";")
            .filter(Boolean);

        return diensten.every(
          dienst =>
            beschikbareDiensten.includes(dienst)
        );

      });

    console.log("=== NA DIENSTENFILTER ===");
    console.log(geschikteFotografen);

    // ==========================================
    // Matching
    // ==========================================

    const resultaten =
      await Promise.all(

        geschikteFotografen.map(async fotograaf => {

          try {

            console.log("================================");
            console.log("Fotograaf:", fotograaf.firstname, fotograaf.lastname);

            // ======================================
            // Stap 1 - Reistijd
            // ======================================

            console.log("Stap 1 - Reistijd");

            const travel =
              await getTravelInfo(

                fotograaf.latitude,

                fotograaf.longitude,

                latitude,

                longitude

              );

            console.log(travel);

            if (
              travel.travel_minutes >
              fotograaf.max_reistijd_minuten
            ) {

              console.log("Afgevallen wegens reistijd");

              return null;

            }

            // ======================================
            // Stap 2 - Availability
            // ======================================

            console.log("Stap 2 - Availability");

            const availability =
              await getAvailability(
                fotograaf.id
              );

            console.log(availability);

            // ======================================
            // Stap 3 - Blocks
            // ======================================

            console.log("Stap 3 - Blocks");

            const blocks =
              await getBlocks(
                fotograaf.id
              );

            console.log(blocks);

            // ======================================
            // Stap 4 - HubSpot boekingen
            // ======================================

            console.log("Stap 4 - Bookings");

            const bookings =
              await getBookings(
                fotograaf.id
              );

            console.log(bookings);

            // ======================================
            // Stap 5 - unavailablePeriods
            // ======================================

            console.log("Stap 5 - Unavailable");

            const unavailablePeriods = [

              ...blocks.map(block => ({

                start:
                  block.start_at,

                end:
                  block.end_at

              })),

              ...(bookings.results || [])

                .filter(ticket =>

                  ticket.properties.afspraak_start &&

                  ticket.properties.afspraak_einde

                )

                .map(ticket => ({

                  start:
                    ticket.properties.afspraak_start,

                  end:
                    ticket.properties.afspraak_einde

                }))

            ];

            console.log("================================");
            console.log("BLOCKS");
            console.log(JSON.stringify(blocks, null, 2));

            console.log("================================");
            console.log("UNAVAILABLE PERIODS");
            console.log(JSON.stringify(unavailablePeriods, null, 2));

            // ======================================
            // Stap 6 - Planner
            // ======================================

            console.log("Stap 6 - Planner");

            const slots =
    getAvailableSlots(

        availability,

        unavailablePeriods,

        searchDate

    );

if (slots.length === 0) {

    console.log("================================");
    console.log("FOTOGRAAF AFGEWEZEN");
    console.log("Naam:", fotograaf.firstname, fotograaf.lastname);
    console.log("ID:", fotograaf.id);
    console.log("Travel:", travel.travel_minutes);
    console.log("Availability:", availability);
    console.log("Blocks:", blocks.length);
    console.log("Bookings:", bookings.results.length);
    console.log("Slots:", slots);

    return null;

}

}

            console.log("================================");
            console.log("SLOTS");
            console.log(slots);

            // ======================================
            // Resultaat
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

              travel_minutes:
                travel.travel_minutes,

              distance_km:
                travel.distance_km,

              availability,

              blocks,

              bookings:
                bookings.results,

              slots

            };

          }

          catch (error) {

            console.error("================================");
            console.error("FOUT BIJ:", fotograaf.firstname, fotograaf.lastname);
            console.error(error);

            return null;

          }

        })

      );

    // ==========================================
    // Resultaten
    // ==========================================

    const matches =
      resultaten

        .filter(Boolean)

        .sort(

          (a, b) =>

            a.travel_minutes -

            b.travel_minutes

        );

    console.log("=== EINDRESULTAAT ===");
    console.log(matches);

    return res.status(200).json({

      success: true,

      photographers:
        matches

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

}
