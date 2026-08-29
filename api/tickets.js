import { enableCors } from "../lib/cors.js";

import {
  getMyJobs,
  getMyOrders,
  updateTicket,
  getTicketAssociations,
  getServiceOptions
} from "../lib/hubspot.js";


export default async function handler(req, res) {

    if (enableCors(req, res)) return;


    try {

        // =========================================
        // GET
        // =========================================

        if (req.method === "GET") {

            const {
                action,
                photographer_id,
                contact_id
            } = req.query;


            if (action === "services") {

  const services =
    await getServiceOptions();

  return res.status(200).json({
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
