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
      new_longitude
    } = req.query;

    if (
      !photographer_id ||
      !new_latitude ||
      !new_longitude
    ) {

      return res.status(400).json({
        error:
          "photographer_id, new_latitude en new_longitude zijn verplicht"
      });

    }

    // Boekingen ophalen

    const bookingsResponse =
      await fetch(
        `${req.headers.origin || "https://boykeys-api.vercel.app"}/api/photographer-availability?photographer_id=${photographer_id}`
      );

    const bookingsData =
      await bookingsResponse.json();

    if (
      !bookingsData.hasBookings
    ) {

      return res.status(200).json({

        hasBookings: false

      });

    }

    const laatsteBoeking =
      bookingsData.laatste_boeking;

    // Routes berekenen

    const travelResponse =
      await fetch(

        `${req.headers.origin || "https://boykeys-api.vercel.app"}/api/travel-time?fromLat=${laatsteBoeking.latitude}&fromLng=${laatsteBoeking.longitude}&toLat=${new_latitude}&toLng=${new_longitude}`

      );

    const travelData =
      await travelResponse.json();

    const beschikbaarVanaf =
      new Date(
        bookingsData
          .beschikbaar_vanaf
      );

    const eersteMogelijkeStart =
      new Date(

        beschikbaarVanaf.getTime() +

        travelData.travel_minutes *
        60 *
        1000

      );

    return res.status(200).json({

      laatste_boeking:
        laatsteBoeking,

      travel_minutes:
        travelData.travel_minutes,

      distance_km:
        travelData.distance_km,

      beschikbaar_vanaf:
        beschikbaarVanaf,

      eerste_mogelijke_start:
        eersteMogelijkeStart

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error:
        error.message
    });

  }

}
