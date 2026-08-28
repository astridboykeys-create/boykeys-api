import { enableCors } from "../lib/cors.js";

import {
  getTicket,
  getTicketAssociations,
  getContact
} from "../lib/hubspot.js";


export default async function handler(req, res) {

  if (enableCors(req, res)) return;


  if (req.method !== "GET") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });

  }


  try {

    const {
      ticket_id,
      contact_id
    } = req.query;


    if (!ticket_id) {

      return res.status(400).json({
        success: false,
        error: "ticket_id ontbreekt"
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
          "hs_pipeline_stage"
        ]
      );


    // =====================================
    // Controleren of ticket bij makelaar hoort
    // =====================================

    if (contact_id) {

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
          error: "Geen toegang tot deze boeking"
        });

      }

    }


    // =====================================
    // Fotograaf ophalen
    // =====================================

    let fotograaf = null;

    const photographerId =
      ticket.properties
        ?.selected_photographer_id;


    if (photographerId) {

      try {

        const contact =
          await getContact(
            photographerId,
            [
              "firstname",
              "lastname",
              "email"
            ]
          );


        fotograaf = {

          id: contact.id,

          firstname:
            contact.properties?.firstname || "",

          lastname:
            contact.properties?.lastname || "",

          email:
            contact.properties?.email || ""

        };

      } catch (error) {

        console.error(
          "Fotograaf kon niet worden geladen",
          error
        );

      }

    }


    return res.status(200).json({

      success: true,

      ticket,

      fotograaf

    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error: error.message

    });

  }

}
