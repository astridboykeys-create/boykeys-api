import { getPhotographers } from "../lib/hubspot.js";

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

    const matches =
      fotografen.filter(f => {

        const beschikbareDiensten =
          (f.diensten || "")
            .split(";")
            .filter(Boolean);

        return diensten.every(d =>
          beschikbareDiensten.includes(d)
        );

      });

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
