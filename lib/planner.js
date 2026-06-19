export function findPreviousBooking(
  bookings,
  startTime
) {

  let previousBooking = null;

  for (const booking of bookings) {

    const bookingEnd =
      new Date(booking.einde);

    if (bookingEnd <= new Date(startTime)) {
      previousBooking = booking;
    }

  }

  return previousBooking;

}

export function findNextBooking(
  bookings,
  endTime
) {

  for (const booking of bookings) {

    const bookingStart =
      new Date(booking.start);

    if (bookingStart >= new Date(endTime)) {
      return booking;
    }

  }

  return null;

}

export function calculateFirstPossibleStart(
  requestedStart,
  previousBooking,
  travelFromPrevious,
  bufferMinutes
) {

  if (
    !previousBooking ||
    !travelFromPrevious
  ) {
    return requestedStart;
  }

  const previousEnd =
    new Date(
      previousBooking.einde
    );

  return new Date(
    previousEnd.getTime() +
    (
      bufferMinutes +
      travelFromPrevious.travel_minutes
    ) * 60000
  );

}


export async function canSchedule() {
  throw new Error(
    "Nog niet geïmplementeerd"
  );
}
export function hasOverlap(
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

export function findOverlapBooking(
  bookings,
  requestedStart,
  requestedEnd
) {

  for (const booking of bookings) {

    const bookingStart =
      new Date(booking.start);

    const bookingEnd =
      new Date(booking.einde);

    if (
      hasOverlap(
        requestedStart,
        requestedEnd,
        bookingStart,
        bookingEnd
      )
    ) {

      return {

        overlap: true,

        conflict: booking

      };

    }

  }

  return {

    overlap: false,

    conflict: null

  };

}

export function calculateLatestPossibleEnd(
  requestedEnd,
  nextBooking,
  travelToNext,
  bufferMinutes
) {

  if (
    !nextBooking ||
    !travelToNext
  ) {
    return requestedEnd;
  }

  const nextStart =
    new Date(nextBooking.start);

  return new Date(
    nextStart.getTime() -
    (
      bufferMinutes +
      travelToNext.travel_minutes
    ) * 60000
  );

}
