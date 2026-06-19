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
