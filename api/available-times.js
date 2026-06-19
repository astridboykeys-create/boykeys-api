import { enableCors } from "../lib/cors.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  const {
    photographer_id,
    date,
    latitude,
    longitude,
    duration = 60
  } = req.query;

  if (
    !photographer_id ||
    !date ||
    !latitude ||
    !longitude
  ) {

    return res.status(400).json({
      error:
        "photographer_id, date, latitude en longitude zijn verplicht"
    });

  }

  return res.status(200).json({

    photographer_id,

    date,

    latitude,

    longitude,

    duration

  });

}
