export default async function handler(
  req,
  res
) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  try {

    const {
      photographer_id,
      new_latitude,
      new_longitude,
      requested_start
    } = req.query;

    if (
      !photographer_id ||
      !new_latitude ||
      !new_longitude ||
      !requested_start
    ) {

      return res.status(400).json({
        error:
          "photographer_id, new_latitude, new_longitude en requested_start zijn verplicht"
      });

    }

    const availabilityResponse =
      await fetch(

        `${req.headers.origin || "https://boykeys-api.vercel.app"}/api/photographer-first-available?photographer_id=${photographer_id}&new_latitude=${new_latitude}&new_longitude=${new_longitude}`

      );

    const availabilityData =
      await availabilityResponse.json();

    const requestedStart =
      new Date(
        requested_start
      );

    const firstPossibleStart =
      new Date(
        availabilityData
          .eerste_mogelijke_start
      );

    const canBook =
      requestedStart >=
      firstPossibleStart;

    return res.status(200).json({

      canBook,

      requested_start:
        requestedStart,

      first_possible_start:
        firstPossibleStart,

      travel_minutes:
        availabilityData
          .travel_minutes,

      distance_km:
        availabilityData
          .distance_km

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error.message
    });

  }

}
