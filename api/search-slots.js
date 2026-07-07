import { enableCors } from "../lib/cors.js";

import { getPhotographers } from "../lib/hubspot.js";

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

        error:
          "Latitude en longitude ontbreken."

      });

    }

    const searchDate =
      date
        ? new Date(date)
        : new Date();

    // ==========================
    // Fotografen ophalen
    // ==========================

    const fotografen =
      await getPhotographers();

    // ==========================
    // Diensten filteren
    // ==========================

    const geschikteFotografen =
      fotografen.filter(fotograaf => {

        const beschikbareDiensten =

          (fotograaf.diensten || "")

            .split(";")

            .filter(Boolean);

        return diensten.every(

          dienst =>

            beschikbareDiensten.includes(
              dienst
            )

        );

      });

    // ==========================
    // Matching
    // ==========================

    const resultaten =
      await Promise.all(

        geschikteFotografen.map(

          async (fotograaf) => {

            try {

              const travel =
                await getTravelInfo(

                  fotograaf.latitude,

                  fotograaf.longitude,

                  latitude,

                  longitude

                );

              if (

                travel.travel_minutes >

                fotograaf.max_reistijd_minuten

              ) {

                return null;

              }

              const availability =
                await getAvailability(
                  fotograaf.id
                );

              const blocks =
                await getBlocks(
                  fotograaf.id
                );

              const slots =
                getAvailableSlots(

                  availability,

                  blocks,

                  searchDate

                );

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

                slots

              };

            }

            catch (error) {

              console.error(

                `Fout bij fotograaf ${fotograaf.id}:`,

                error.message

              );

              return null;

            }

          }

        )

      );

    // ==========================
    // Resultaten sorteren
    // ==========================

    const matches =
      resultaten

        .filter(Boolean)

        .sort(

          (a, b) =>

            a.travel_minutes -

            b.travel_minutes

        );

    // ==========================
    // Response
    // ==========================

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
