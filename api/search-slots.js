import { getPhotographers } from "../lib/hubspot.js";
import { getTravelInfo } from "../lib/googleRoutes.js";

export default async function handler(req, res) {

  try {

    const {
      latitude,
      longitude,
      diensten = []
    } = req.body;

    if (!latitude || !longitude) {

      return res.status(400).json({
        success: false,
        error: "Latitude en longitude ontbreken."
      });

    }

    const fotografen =
      await getPhotographers();

    const matches = [];

for (const fotograaf of fotografen) {

  const beschikbareDiensten =
    (fotograaf.diensten || "")
      .split(";")
      .filter(Boolean);

  if (
    !diensten.every(d =>
      beschikbareDiensten.includes(d)
    )
  ) {
    continue;
  }

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
    continue;
  }

  matches.push({

    ...fotograaf,

    travel_minutes:
      travel.travel_minutes,

    distance_km:
      travel.distance_km,

    score:
      100 - travel.travel_minutes,

    slots: []

  });

}

    matches.sort(

  (a, b) =>

    a.travel_minutes -
    b.travel_minutes

);

    return res.status(200).json({

      success: true,

      photographers: matches

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error: error.message

    });

  }

}
