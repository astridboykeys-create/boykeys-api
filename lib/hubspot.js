export async function getBookings(
  photographerId
) {

  const response =
    await searchTickets({

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "selected_photographer_id",

              operator:
                "EQ",

              value:
                String(
                  photographerId
                )
            }
          ]
        }
      ],

      properties: [
        "afspraak_start",
        "afspraak_einde",
        "hs_pipeline_stage",
        "planner_status",
        "adres"
      ],

      limit: 100

    });


  const results =
    (
      response.results ||
      []
    ).filter(
      ticket => {

        const stage =
          String(
            ticket.properties
              ?.hs_pipeline_stage ||
            ""
          );


        const plannerStatus =
          String(
            ticket.properties
              ?.planner_status ||
            ""
          );


        /*
         * Deze boekingen blokkeren
         * GEEN tijd in de planner:
         *
         * - Afgerond
         * - Geannuleerd
         * - Afgekeurd door planner
         */

        if (
          stage ===
          CLOSED_STAGE_ID
        ) {
          return false;
        }


        if (
          stage ===
          CANCELLED_STAGE_ID
        ) {
          return false;
        }


        if (
          plannerStatus ===
          "rejected"
        ) {
          return false;
        }


        return true;

      }
    );


  return {
    ...response,
    results
  };

}
