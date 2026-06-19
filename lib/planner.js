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
