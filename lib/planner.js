export function findPreviousBooking(
  bookings,
  startTime
) {

  return bookings
    .filter(
      booking =>
        new Date(
          booking.end
        ) <= new Date(startTime)
    )
    .sort(
      (a, b) =>
        new Date(b.end) -
        new Date(a.end)
    )[0] || null;

}
