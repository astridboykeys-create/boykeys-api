// ============================================
// Boykeys Planner Engine
// ============================================

// ============================================
// Werkdagen
// ============================================

export function getWorkingDay(date) {

  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];

  return days[new Date(date).getDay());

}

export function getWorkingHours(
  workingHours,
  date
) {

  const day =
    getWorkingDay(date);

  return workingHours?.[day] || null;

}

export function isWorkingDay(
  workingHours,
  date
) {

  const day =
    getWorkingHours(
      workingHours,
      date
    );

  return day?.enabled === true;

}

// ============================================
// Overlap
// ============================================

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

// ============================================
// Algemene unavailable periods
// ============================================

export function removeUnavailableSlots(
  slots,
  periods
) {

  if (!periods?.length) {
    return slots;
  }

  return slots.filter(slot => {

    const slotStart =
      new Date(
        `2000-01-01T${slot.start}:00`
      );

    const slotEnd =
      new Date(
        `2000-01-01T${slot.end}:00`
      );

    return !periods.some(period => {

      const periodStart =
        new Date(period.start);

      const periodEnd =
        new Date(period.end);

      const start =
        new Date(
          `2000-01-01T${String(periodStart.getHours()).padStart(2,"0")}:${String(periodStart.getMinutes()).padStart(2,"0")}:00`
        );

      const end =
        new Date(
          `2000-01-01T${String(periodEnd.getHours()).padStart(2,"0")}:${String(periodEnd.getMinutes()).padStart(2,"0")}:00`
        );

      return hasOverlap(
        slotStart,
        slotEnd,
        start,
        end
      );

    });

  });

}

// ============================================
// Boekingen
// ============================================

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

export function findPreviousBooking(
  bookings,
  startTime
) {

  let previousBooking = null;

  for (const booking of bookings) {

    const bookingEnd =
      new Date(booking.einde);

    if (
      bookingEnd <= new Date(startTime)
    ) {

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

    if (
      bookingStart >= new Date(endTime)
    ) {

      return booking;

    }

  }

  return null;

}

// ============================================
// Reistijd
// ============================================

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
    new Date(previousBooking.einde);

  return new Date(

    previousEnd.getTime() +

    (
      bufferMinutes +

      travelFromPrevious.travel_minutes

    ) * 60000

  );

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

// ============================================
// Tijdsloten
// ============================================

export function getAvailableSlots(
  availability,
  blocks,
  date,
  slotDuration = 60,
  slotInterval = 30
) {

  if (!availability?.working_hours) {
    return [];
  }

  if (
    !isWorkingDay(
      availability.working_hours,
      date
    )
  ) {
    return [];
  }

  const workingDay =
    getWorkingHours(
      availability.working_hours,
      date
    );

  const slots = [];

  const [startHour, startMinute] =
    workingDay.start
      .split(":")
      .map(Number);

  const [endHour, endMinute] =
    workingDay.end
      .split(":")
      .map(Number);

  const current =
    new Date(date);

  current.setHours(
    startHour,
    startMinute,
    0,
    0
  );

  const end =
    new Date(date);

  end.setHours(
    endHour,
    endMinute,
    0,
    0
  );

  while (true) {

    const slotStart =
      new Date(current);

    const slotEnd =
      new Date(
        slotStart.getTime() +
        slotDuration * 60000
      );

    if (slotEnd > end) {
      break;
    }

    slots.push({

      start:
        slotStart.toLocaleTimeString(
          "nl-NL",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        ),

      end:
        slotEnd.toLocaleTimeString(
          "nl-NL",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )

    });

    current.setMinutes(
      current.getMinutes() +
      slotInterval
    );

  }

  const blockedPeriods =
    blocks.map(block => ({

      start: block.start_at,

      end: block.end_at

    }));

  return removeUnavailableSlots(
    slots,
    blockedPeriods
  );

}

// ============================================
// Later
// ============================================

export async function canSchedule() {

  throw new Error(
    "Nog niet geïmplementeerd"
  );

}
