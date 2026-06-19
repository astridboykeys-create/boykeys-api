import { enableCors } from "../lib/cors.js";
import { getBookings } from "../lib/hubspot.js";
import { getTravelInfo } from "../lib/googleRoutes.js";
import {
  findPreviousBooking,
  findNextBooking,
  calculateFirstPossibleStart,
  calculateLatestPossibleEnd,
  findOverlapBooking
} from "../lib/planner.js";







export default async function handler(
  req,
  res
) {

  if (enableCors(req, res)) return;

  try {

    const {
      photographer_id,
      start,
      einde
    } = req.query;

const {
  latitude,
  longitude
} = req.query;
    

    if (
  !photographer_id ||
  !start ||
  !einde ||
  !latitude ||
  !longitude
) {

      return res.status(400).json({
        error:
          "photographer_id, start, einde, latitude en longitude zijn verplicht"
      });

    }

    const nieuweStart =
      new Date(start);

    const nieuweEinde =
      new Date(einde);

    // Alle ingeplande tickets ophalen
  const searchData =
  await getBookings(
    photographer_id
  );

    const bookings =
  (searchData.results || [])

    .map(ticket => ({

      ticketId:
        ticket.id,

      adres:
        ticket.properties
          .volledig_adres_google,

      start:
        ticket.properties
          .afspraak_start,

      einde:
        ticket.properties
          .afspraak_einde,

      latitude:
        ticket.properties
          .latitude,

      longitude:
        ticket.properties
          .longitude

    }))

    .sort(
      (a, b) =>
        new Date(a.start) -
        new Date(b.start)
    );

    

const previousBooking =
  findPreviousBooking(
    bookings,
    nieuweStart
  );

const nextBooking =
  findNextBooking(
    bookings,
    nieuweEinde
  );
    let travelFromPrevious = null;

if (previousBooking) {

  travelFromPrevious =
    await getTravelInfo(

      previousBooking.latitude,
      previousBooking.longitude,

      latitude,
      longitude

    );

}

    let travelToNext = null;

if (nextBooking) {

  travelToNext =
    await getTravelInfo(

      latitude,
      longitude,

      nextBooking.latitude,
      nextBooking.longitude

    );

}

    const bufferMinutes =
  parseInt(
    process.env.DEFAULT_BUFFER_MINUTES || "15"
  );

const firstPossibleStart =
  calculateFirstPossibleStart(
    nieuweStart,
    previousBooking,
    travelFromPrevious,
    bufferMinutes
  );

    const latestPossibleEnd =
  calculateLatestPossibleEnd(
    nieuweEinde,
    nextBooking,
    travelToNext,
    bufferMinutes
  );

    

    const {
  overlap,
  conflict
} = findOverlapBooking(
  bookings,
  nieuweStart,
  nieuweEinde
);

    const canBook =

  !overlap &&

  nieuweStart >= firstPossibleStart &&

  nieuweEinde <= latestPossibleEnd;

    console.log(
  "Previous booking:",
  previousBooking
);

console.log(
  "Next booking:",
  nextBooking
);

   return res.status(200).json({
     
canBook,

overlap,

conflict,

  previousBooking,

  nextBooking,

  travelFromPrevious,

  firstPossibleStart,

     latestPossibleEnd,

     travelToNext

});

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      error:
        error.message

    });

  }

}
