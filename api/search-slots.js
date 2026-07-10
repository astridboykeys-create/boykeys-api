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

            console.log(
              "Controle:",
              fotograaf.firstname,
              fotograaf.lastname
            );

            // ======================================
            // Reistijd
            // ======================================

            const travel =
              await getTravelInfo(

                fotograaf.latitude,

                fotograaf.longitude,

                latitude,

                longitude

              );

            console.log(
              "Reistijd:",
              travel.travel_minutes,
              "Max:",
              fotograaf.max_reistijd_minuten
            );

            if (
              travel.travel_minutes >
              fotograaf.max_reistijd_minuten
            ) {

              console.log(
                "Afgevallen wegens reistijd"
              );

              return null;

            }

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
            // Niet beschikbare periodes
            // ======================================

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

            // ======================================
            // Slots
            // ======================================

            const slots =
              getAvailableSlots(

                availability,

                unavailablePeriods,

                searchDate

              );

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

            console.error(
              "Fout bij fotograaf:",
              fotograaf.firstname,
              error
            );

            console.error(error);

return null;

          }

        })

      );

    // ==========================================
    // Resultaten sorteren
    // ==========================================

    const matches =
      resultaten

        .filter(Boolean)

        .sort(

          (a, b) =>

            (a.travel_minutes || 9999) -

            (b.travel_minutes || 9999)

        );

    // ==========================================
    // Response
    // ==========================================

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
