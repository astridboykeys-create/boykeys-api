
export function getWorkingHours(date) {

  const day =
    new Date(date)
      .toLocaleDateString(
        "en-US",
        {
          weekday: "long"
        }
      )
      .toLowerCase();

  const workingHours = {

    monday: {
      start: "09:00",
      end: "17:00"
    },

    tuesday: {
      start: "09:00",
      end: "17:00"
    },

    wednesday: null,

    thursday: {
      start: "09:00",
      end: "21:00"
    },

    friday: {
      start: "09:00",
      end: "17:00"
    },

    saturday: {
      start: "10:00",
      end: "15:00"
    },

    sunday: null

  };

  return workingHours[day] || null;

}
