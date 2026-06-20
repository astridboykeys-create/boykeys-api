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

  const times = [];

for (
  let hour = 9;
  hour < 17;
  hour++
) {

  times.push(
    `${String(hour).padStart(2, "0")}:00`
  );

  times.push(
    `${String(hour).padStart(2, "0")}:30`
  );

}

return res.status(200).json({

  photographer_id,

  date,

  duration,

  times

});
}
