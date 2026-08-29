// ============================================
// Boykeys Planner Engine
// ============================================


// ============================================
// Tijd helpers
// ============================================

function timeToMinutes(time) {

  const [hours, minutes] =
    time.split(":").map(Number);

  return (
    hours * 60 +
    minutes
  );

}


function minutesToTime(minutes) {

  const hours =
    Math.floor(
      minutes / 60
    );

  const mins =
    minutes % 60;


  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(mins).padStart(2, "0")}`
  );

}


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


  return days[
    new Date(date).getDay()
  ];

}


export function getWorkingHours(
  workingHours,
  date
) {

  const day =
    getWorkingDay(date);


  return (
    workingHours?.[day] ||
    null
  );

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


  return (
    day?.enabled === true
  );

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
  periods,
  selectedDate
) {

  if (!periods?.length) {

    return slots;

  }


  const selectedDateString =
    selectedDate
      .toISOString()
      .substring(
        0,
        10
      );


  return slots.filter(
    slot => {

      const slotStart =
        timeToMinutes(
          slot.start
        );


      const slotEnd =
        timeToMinutes(
          slot.end
        );


      return !periods.some(
        period => {

          const periodStartDate =
            new Date(
              period.start
            );


          const periodEndDate =
            new Date(
              period.end
            );


          if (
            Number.isNaN(
              periodStartDate.getTime()
            ) ||
            Number.isNaN(
              periodEndDate.getTime()
            )
          ) {

            return false;

          }


          const blockDate =
            new Intl.DateTimeFormat(
              "en-CA",
              {
                timeZone:
                  "Europe/Amsterdam"
              }
            )
              .format(
                periodStartDate
              );


          // Blokkade is van andere dag
          if (
            blockDate !==
            selectedDateString
          ) {

            return false;

          }


          const start =
            periodStartDate
              .toLocaleTimeString(
                "nl-NL",
                {
                  hour:
                    "2-digit",

                  minute:
                    "2-digit",

                  hour12:
                    false,

                  timeZone:
                    "Europe/Amsterdam"
                }
              );


          const end =
            periodEndDate
              .toLocaleTimeString(
                "nl-NL",
                {
                  hour:
                    "2-digit",

                  minute:
                    "2-digit",

                  hour12:
                    false,

                  timeZone:
                    "Europe/Amsterdam"
                }
              );


          const blockStart =
            timeToMinutes(
              start
            );


          const blockEnd =
            timeToMinutes(
              end
            );


          return (
            slotStart < blockEnd &&
            slotEnd > blockStart
          );

        }
      );

    }
  );

}


// ============================================
// Boekingen
// ============================================

export function findOverlapBooking(
  bookings,
  requestedStart,
  requestedEnd
) {

  for (
    const booking of bookings
  ) {

    const bookingStart =
      new Date(
        booking.start
      );


    const bookingEnd =
      new Date(
        booking.einde
      );


    if (
      hasOverlap(
        requestedStart,
        requestedEnd,
        bookingStart,
        bookingEnd
      )
    ) {

      return {

        overlap:
          true,

        conflict:
          booking

      };

    }

  }


  return {

    overlap:
      false,

    conflict:
      null

  };

}


// ============================================
// Vorige boeking
// ============================================

export function findPreviousBooking(
  bookings,
  startTime
) {

  let previousBooking =
    null;


  for (
    const booking of bookings
  ) {

    const bookingEnd =
      new Date(
        booking.einde
      );


    if (
      bookingEnd <=
      new Date(
        startTime
      )
    ) {

      previousBooking =
        booking;

    }

  }


  return previousBooking;

}


// ============================================
// Volgende boeking
// ============================================

export function findNextBooking(
  bookings,
  endTime
) {

  for (
    const booking of bookings
  ) {

    const bookingStart =
      new Date(
        booking.start
      );


    if (
      bookingStart >=
      new Date(
        endTime
      )
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
    new Date(
      previousBooking.einde
    );


  return new Date(

    previousEnd.getTime() +

    (
      bufferMinutes +

      travelFromPrevious
        .travel_minutes

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
    new Date(
      nextBooking.start
    );


  return new Date(

    nextStart.getTime() -

    (
      bufferMinutes +

      travelToNext
        .travel_minutes

    ) * 60000

  );

}


// ============================================
// Tijdsloten
// ============================================

export function getAvailableSlots(
  availability,
  unavailablePeriods,
  date,
  bookingDurationMinutes,
  slotIntervalMinutes
) {

  console.log(
    "================================"
  );

  console.log(
    "GET AVAILABLE SLOTS"
  );

  console.log(
    "Date:",
    date
  );

  console.log(
    "Booking duration:",
    bookingDurationMinutes
  );

  console.log(
    "Slot interval:",
    slotIntervalMinutes
  );


  // ----------------------------------------
  // Config controleren
  // ----------------------------------------

  const duration =
    Number(
      bookingDurationMinutes
    );


  const interval =
    Number(
      slotIntervalMinutes
    );


  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {

    throw new Error(
      "bookingDurationMinutes is ongeldig."
    );

  }


  if (
    !Number.isFinite(interval) ||
    interval <= 0
  ) {

    throw new Error(
      "slotIntervalMinutes is ongeldig."
    );

  }


  // ----------------------------------------
  // Availability controleren
  // ----------------------------------------

  if (
    !availability
      ?.working_hours
  ) {

    return [];

  }


  if (
    !isWorkingDay(
      availability
        .working_hours,
      date
    )
  ) {

    return [];

  }


  const workingDay =
    getWorkingHours(
      availability
        .working_hours,
      date
    );


  if (
    !workingDay?.start ||
    !workingDay?.end
  ) {

    return [];

  }


  console.log(
    "Working day:"
  );

  console.log(
    workingDay
  );


  // ----------------------------------------
  // Werktijden naar minuten
  // ----------------------------------------

  const workingStart =
    timeToMinutes(
      workingDay.start
    );


  const workingEnd =
    timeToMinutes(
      workingDay.end
    );


  if (
    workingEnd <=
    workingStart
  ) {

    return [];

  }


  // ----------------------------------------
  // Eerste mogelijke startmoment
  //
  // Voorbeeld:
  // werktijd 08:30
  // interval 60
  //
  // resultaat eerste slot = 09:00
  //
  // Daardoor krijgen we bij interval 60
  // uitsluitend hele uren.
  // ----------------------------------------

  const firstSlotStart =
    Math.ceil(
      workingStart /
      interval
    ) * interval;


  const slots =
    [];


  // ----------------------------------------
  // Slots genereren
  // ----------------------------------------

  for (
    let slotStart =
      firstSlotStart;

    slotStart +
      duration <=
      workingEnd;

    slotStart +=
      interval
  ) {

    const slotEnd =
      slotStart +
      duration;


    slots.push({

      start:
        minutesToTime(
          slotStart
        ),

      end:
        minutesToTime(
          slotEnd
        )

    });

  }


  console.log(
    "Slots vóór filter:"
  );

  console.log(
    slots
  );


  // ----------------------------------------
  // Boekingen / blocks eruit filteren
  // ----------------------------------------

  const availableSlots =
    removeUnavailableSlots(
      slots,
      unavailablePeriods,
      date
    );


  console.log(
    "Slots na filter:"
  );

  console.log(
    availableSlots
  );


  return availableSlots;

}


// ============================================
// Later
// ============================================

export async function canSchedule() {

  throw new Error(
    "Nog niet geïmplementeerd"
  );

}
