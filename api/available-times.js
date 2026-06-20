import { enableCors } from "../lib/cors.js";
import { getWorkingHours } from "../lib/availability.js";

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

  const workingHours =
  getWorkingHours(date);

if (!workingHours) {

  return res.status(200).json({

    photographer_id,

    date,

    duration,

    times: []

  });

}

const times = [];

const startHour =
  parseInt(
    workingHours.start.split(":")[0]
  );

const endHour =
  parseInt(
    workingHours.end.split(":")[0]
  );

for (
  let hour = startHour;
  hour < endHour;
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
