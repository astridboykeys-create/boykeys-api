import { enableCors } from "../lib/cors.js";

import {
  getMyJobs,
  getMyOrders,
  updateTicket,
  getTicketAssociations,
  getServiceOptions,
  getTicket
} from "../lib/hubspot.js";


// ============================================
// HELPERS
// ============================================

function normalizeEpoch(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const numeric =
    Number(value);

  if (
    Number.isFinite(numeric) &&
    numeric > 0
  ) {
    return numeric;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.getTime();

}


function validatePlannerTimes(
  start,
  end
) {

  const startMs =
    normalizeEpoch(start);

  const endMs =
    normalizeEpoch(end);


  if (
    !startMs ||
    !endMs
  ) {

    return {
      valid: false,
      error:
        "Begin- en eindtijd zijn verplicht."
    };

  }


  if (
    endMs <=
    startMs
  ) {

    return {
      valid: false,
      error:
        "De eindtijd moet na de begintijd liggen."
    };

  }


  return {
    valid: true,
    startMs,
    endMs
  };

}


// ============================================
// HANDLER
// ============================================

export default async function handler(
  req,
  res
) {

  if (
    enableCors(
      req,
      res
    )
  ) {
    return;
  }


  try {

    // =========================================
    // GET
    // =========================================

    if (
      req.method === "GET"
    ) {

      const {
        action,
        photographer_id,
        contact_id,
        ticket_id
      } = req.query;


      // =======================================
      // SERVICES
      // =======================================

      if (
        action === "services"
      ) {

        const services =
          await getServiceOptions();

        return res
          .status(200)
          .json({
            success: true,
            services
          });

      }


      // =======================================
      // FOTOGRAAF
      // =======================================

      if (
        action === "my-jobs"
      ) {

        if (
          !photographer_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "photographer_id is verplicht"
            });

        }


        const jobs =
          await getMyJobs(
            photographer_id
          );


        return res
          .status(200)
          .json({
            success: true,
            jobs:
              jobs.results || []
          });

      }


      // =======================================
      // MAKELAAR
      // =======================================

      if (
        action === "my-orders"
      ) {

        if (
          !contact_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "contact_id is verplicht"
            });

        }


        const orders =
          await getMyOrders(
            contact_id
          );


        return res
          .status(200)
          .json({
            success: true,
            orders
          });

      }


      // =======================================
      // PLANNER - ÉÉN BOEKING OPHALEN
      // =======================================

      if (
        action === "planner-ticket"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        const ticket =
          await getTicket(
            ticket_id,
            [
              "adres",
              "diensten",
              "selected_photographer_id",
              "afspraak_start",
              "afspraak_einde",
              "opmerking_klant",
              "planner_status",
              "planner_reason",
              "planner_note",
              "planner_approved_at",
              "hs_pipeline_stage"
            ]
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket
          });

      }


      return res
        .status(400)
        .json({
          success: false,
          error:
            "Onbekende actie"
        });

    }


    // =========================================
    // POST
    // =========================================

    if (
      req.method === "POST"
    ) {

      const {
        action,
        ticket_id,
        contact_id,

        address,
        diensten,
        opmerking_klant,
        photographer_id,
        start,
        end,

        planner_reason,
        planner_note
      } = req.body || {};


      // =======================================
      // PLANNER ACTIES
      // =======================================

      if (
        action === "planner-update"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        const properties = {};


        if (
          address !== undefined
        ) {

          properties.adres =
            address || "";

        }


        if (
          diensten !== undefined
        ) {

          properties.diensten =
            Array.isArray(
              diensten
            )
              ? diensten.join(";")
              : diensten || "";

        }


        if (
          photographer_id !== undefined
        ) {

          properties.selected_photographer_id =
            String(
              photographer_id || ""
            );

        }


        if (
          planner_reason !== undefined
        ) {

          properties.planner_reason =
            planner_reason || "";

        }


        if (
          planner_note !== undefined
        ) {

          properties.planner_note =
            planner_note || "";

        }


        if (
          start !== undefined ||
          end !== undefined
        ) {

          const currentTicket =
            await getTicket(
              ticket_id,
              [
                "afspraak_start",
                "afspraak_einde"
              ]
            );


          const currentStart =
            currentTicket.properties
              ?.afspraak_start;


          const currentEnd =
            currentTicket.properties
              ?.afspraak_einde;


          const finalStart =
            start !== undefined
              ? start
              : currentStart;


          const finalEnd =
            end !== undefined
              ? end
              : currentEnd;


          const validation =
            validatePlannerTimes(
              finalStart,
              finalEnd
            );


          if (
            !validation.valid
          ) {

            return res
              .status(400)
              .json({
                success: false,
                error:
                  validation.error
              });

          }


          properties.afspraak_start =
            String(
              validation.startMs
            );


          properties.afspraak_einde =
            String(
              validation.endMs
            );

        }


        const updated =
          await updateTicket(
            ticket_id,
            properties
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket:
              updated
          });

      }


      // =======================================
      // PLANNER GOEDKEUREN
      // =======================================

      if (
        action === "planner-approve"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        const ticket =
          await getTicket(
            ticket_id,
            [
              "afspraak_start",
              "afspraak_einde"
            ]
          );


        const validation =
          validatePlannerTimes(
            start !== undefined
              ? start
              : ticket.properties
                  ?.afspraak_start,

            end !== undefined
              ? end
              : ticket.properties
                  ?.afspraak_einde
          );


        if (
          !validation.valid
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                validation.error
            });

        }


        const properties = {

          planner_status:
            "approved",

          planner_reason:
            planner_reason || "",

          planner_note:
            planner_note || "",

          planner_approved_at:
            String(
              Date.now()
            ),

          afspraak_start:
            String(
              validation.startMs
            ),

          afspraak_einde:
            String(
              validation.endMs
            )

        };


        if (
          photographer_id
        ) {

          properties.selected_photographer_id =
            String(
              photographer_id
            );

        }


        if (
          address !== undefined
        ) {

          properties.adres =
            address || "";

        }


        if (
          diensten !== undefined
        ) {

          properties.diensten =
            Array.isArray(
              diensten
            )
              ? diensten.join(";")
              : diensten || "";

        }


        const updated =
          await updateTicket(
            ticket_id,
            properties
          );


        return res
          .status(200)
          .json({
            success: true,
            approved: true,
            ticket:
              updated
          });

      }


      // =======================================
      // PLANNER AFKEUREN
      // =======================================

      if (
        action === "planner-reject"
      ) {

        if (
          !ticket_id
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "ticket_id is verplicht"
            });

        }


        if (
          !planner_reason ||
          !String(
            planner_reason
          ).trim()
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "Een reden voor afkeuren is verplicht"
            });

        }


        const updated =
          await updateTicket(
            ticket_id,
            {

              planner_status:
                "rejected",

              planner_reason:
                String(
                  planner_reason
                ).trim(),

              planner_note:
                planner_note || ""

            }
          );


        return res
          .status(200)
          .json({
            success: true,
            rejected: true,
            ticket:
              updated
          });

      }


      // =======================================
      // VANAF HIER: MAKELAAR ACTIES
      // =======================================

      if (
        !ticket_id ||
        !contact_id
      ) {

        return res
          .status(400)
          .json({
            success: false,
            error:
              "ticket_id en contact_id zijn verplicht"
          });

      }


      /*
       * Controleren of deze boeking
       * echt bij deze makelaar hoort.
       */

      const associations =
        await getTicketAssociations(
          ticket_id,
          "contacts"
        );


      const allowed =
        (
          associations.results ||
          []
        ).some(
          item =>
            String(
              item.toObjectId
            ) ===
            String(
              contact_id
            )
        );


      if (
        !allowed
      ) {

        return res
          .status(403)
          .json({
            success: false,
            error:
              "Geen toegang tot deze boeking"
          });

      }


      // =====================================
      // BOEKING ANNULEREN
      // =====================================

      if (
        action === "cancel-order"
      ) {

        const updated =
          await updateTicket(
            ticket_id,
            {
              hs_pipeline_stage:
                "5960765665"
            }
          );


        return res
          .status(200)
          .json({
            success: true,
            cancelled: true,
            ticket:
              updated
          });

      }


      // =====================================
      // NOTE UPDATEN
      // =====================================

      if (
        action === "update-note"
      ) {

        const updated =
          await updateTicket(
            ticket_id,
            {
              opmerking_klant:
                opmerking_klant || ""
            }
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket:
              updated
          });

      }


      // =====================================
      // BOEKING WIJZIGEN
      // =====================================

      if (
        action === "update-order"
      ) {

        if (
          !address ||
          !photographer_id ||
          !start ||
          !end
        ) {

          return res
            .status(400)
            .json({
              success: false,
              error:
                "Niet alle verplichte velden zijn ingevuld"
            });

        }


        const updated =
          await updateTicket(
            ticket_id,
            {

              adres:
                address,

              diensten:
                Array.isArray(
                  diensten
                )
                  ? diensten.join(";")
                  : diensten,

              opmerking_klant:
                opmerking_klant || "",

              selected_photographer_id:
                String(
                  photographer_id
                ),

              afspraak_start:
                String(
                  start
                ),

              afspraak_einde:
                String(
                  end
                )

            }
          );


        return res
          .status(200)
          .json({
            success: true,
            ticket:
              updated
          });

      }


      return res
        .status(400)
        .json({
          success: false,
          error:
            "Onbekende actie"
        });

    }


    return res
      .status(405)
      .json({
        success: false,
        error:
          "Method not allowed"
      });


  } catch (
    error
  ) {

    console.error(
      "TICKETS API ERROR:",
      error
    );


    return res
      .status(500)
      .json({
        success: false,
        error:
          error.message
      });

  }

}  return res.status(200).json({
    success: true,
    services
  });

}

            // FOTOGRAAF
            if (action === "my-jobs") {

                if (!photographer_id) {

                    return res.status(400).json({
                        success: false,
                        error: "photographer_id is verplicht"
                    });

                }

                const jobs =
                    await getMyJobs(
                        photographer_id
                    );

                return res.status(200).json({

                    success: true,

                    jobs:
                        jobs.results || []

                });

            }


            // MAKELAAR
            if (action === "my-orders") {

                if (!contact_id) {

                    return res.status(400).json({
                        success: false,
                        error: "contact_id is verplicht"
                    });

                }

                const orders =
                    await getMyOrders(
                        contact_id
                    );

                return res.status(200).json({

                    success: true,

                    orders

                });

            }


            return res.status(400).json({

                success: false,

                error: "Onbekende actie"

            });

        }


        // =========================================
        // POST
        // =========================================

       if (req.method === "POST") {

   const {
  action,
  ticket_id,
  contact_id,
  address,
  diensten,
  opmerking_klant,
  photographer_id,
  start,
  end
} = req.body;


    if (!ticket_id || !contact_id) {

        return res.status(400).json({
            success: false,
            error:
                "ticket_id en contact_id zijn verplicht"
        });

    }


    /*
     * Controleren of deze boeking
     * echt bij deze makelaar hoort.
     */

    const associations =
        await getTicketAssociations(
            ticket_id,
            "contacts"
        );


    const allowed =
        (associations.results || [])
            .some(item =>
                String(item.toObjectId) ===
                String(contact_id)
            );


    if (!allowed) {

        return res.status(403).json({
            success: false,
            error:
                "Geen toegang tot deze boeking"
        });

    }


    /*
     * =====================================
     * BOEKING ANNULEREN
     * =====================================
     */

    if (action === "cancel-order") {

        const updated =
            await updateTicket(
                ticket_id,
                {
                    hs_pipeline_stage: "5960765665"
                }
            );


        return res.status(200).json({
            success: true,
            cancelled: true,
            ticket: updated
        });

    }

// Update notes
         if (action === "update-note") {

  if (
    !ticket_id ||
    !contact_id
  ) {

    return res.status(400).json({
      success: false,
      error: "ticket_id en contact_id zijn verplicht"
    });

  }


  const associations =
    await getTicketAssociations(
      ticket_id,
      "contacts"
    );


  const allowed =
    (associations.results || [])
      .some(
        item =>
          String(item.toObjectId) ===
          String(contact_id)
      );


  if (!allowed) {

    return res.status(403).json({
      success: false,
      error: "Geen toegang tot deze boeking"
    });

  }


  const updated =
    await updateTicket(
      ticket_id,
      {
        opmerking_klant:
          opmerking_klant || ""
      }
    );


  return res.status(200).json({
    success: true,
    ticket: updated
  });

}

    /*
     * =====================================
     * BOEKING WIJZIGEN
     * =====================================
     */

    if (action === "update-order") {

        if (
            !address ||
            !photographer_id ||
            !start ||
            !end
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Niet alle verplichte velden zijn ingevuld"
            });

        }


        const updated =
  await updateTicket(
    ticket_id,
    {
      adres:
        address,

      diensten:
        Array.isArray(diensten)
          ? diensten.join(";")
          : diensten,

      opmerking_klant:
        opmerking_klant || "",

      selected_photographer_id:
        String(photographer_id),

      afspraak_start:
        String(start),

      afspraak_einde:
        String(end)
    }
  );


        return res.status(200).json({
            success: true,
            ticket: updated
        });

    }




         


    return res.status(400).json({
        success: false,
        error:
            "Onbekende actie"
    });

}


        return res.status(405).json({

            success: false,

            error: "Method not allowed"

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            error: error.message

        });

    }

}
