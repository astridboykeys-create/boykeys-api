import { enableCors } from "../lib/cors.js";
import { getBookings } from "../lib/hubspot.js";
import { getTravelInfo } from "../lib/googleRoutes.js";
import {
  findPreviousBooking,
  findNextBooking,
  calculateFirstPossibleStart
} from "../lib/planner.js";

function addMinutes(date, minutes) {

  return new Date(
    date.getTime() +
    minutes * 60 * 1000
  );

}

function subtractMinutes(date, minutes) {

  return new Date(
    date.getTime() -
    minutes * 60 * 1000
  );

}

function hasOverlap(
  start1,
  end1,
  start2,
  end2
) {

  return (
    start1 < end2 &&
    end1 > start2
  );

}




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

    let overlapFound =
      false;

    let overlapBooking =
      null;

    for (
      const ticket of
      searchData.results || []
    ) {

      const bestaandeStart =
        new Date(
          ticket.properties
            .afspraak_start
        );

      const bestaandeEinde =
        new Date(
          ticket.properties
            .afspraak_einde
        );

      const overlap =
  hasOverlap(

    nieuweStart,
    nieuweEinde,

    bestaandeStart,
    bestaandeEinde

  );

      if (overlap) {

        overlapFound =
          true;

        overlapBooking = {

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
              .afspraak_einde

        };

        break;

      }

    }

    console.log(
  "Previous booking:",
  previousBooking
);

console.log(
  "Next booking:",
  nextBooking
);

   return res.status(200).json({
     
  canBook:
    !overlapFound,

  overlap:
    overlapFound,

  conflict:
    overlapBooking,

  previousBooking,

  nextBooking,

  travelFromPrevious,

  firstPossibleStart

});

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      error:
        error.message

    });

  }

}
