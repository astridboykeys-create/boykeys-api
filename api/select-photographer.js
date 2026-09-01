import { enableCors } from "../lib/cors.js";

import {
  hubspotRequest,
  findContactByEmail,
  createTicket
} from "../lib/hubspot.js";


// ==========================================
// HUBSPOT ASSOCIATION TYPES
// Ticket -> Contact
// ==========================================

const ASSOCIATION_FOTOGRAAF = 79;
const ASSOCIATION_MAKELAAR = 81;


// ==========================================
// BOEKINGSCODE GENEREREN
// Zelfde soort formaat als SimplyBook.me:
// 10 tekens, lowercase alfanumeriek
// ==========================================

function generateBookingCode() {

  const chars =
    "abcdefghijklmnopqrstuvwxyz0123456789";

  let code = "";

  for (
    let i = 0;
    i < 10;
    i++
  ) {

    const randomIndex =
      Math.floor(
        Math.random() *
        chars.length
      );

    code +=
      chars[
        randomIndex
      ];

  }

  return code;

}


// ==========================================
// GELABELDE TICKET -> CONTACT ASSOCIATIE
// ==========================================

async function associateTicketWithLabeledContact(
  ticketId,
  contactId,
  associationTypeId
) {

  await hubspotRequest(
    `/crm/v4/objects/tickets/${ticketId}/associations/contacts/${contactId}`,
    "PUT",
    [
      {
        associationCategory:
          "USER_DEFINED",

        associationTypeId:
          associationTypeId
      }
    ]
  );

}


// ==========================================
// API HANDLER
// ==========================================

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


  if (
    req.method !==
    "POST"
  ) {

    return res
      .status(405)
      .json({
        success: false,
        message:
          "Method not allowed"
      });

  }


  try {

    const {
      email,
      address,
      diensten,
      opmerking_klant,
      photographer_id,
      start,
      end,

      woning_oppervlakte_m2,
      huiseigenaar_naam,
      huiseigenaar_email,
      huiseigenaar_telefoon
    } =
      req.body ||
      {};


    console.log(
      "========== NIEUWE BOEKING =========="
    );

    console.log(
      req.body
    );


    // ======================================
    // VALIDATIE
    // ======================================

    if (
      !email ||
      !address ||
      !photographer_id ||
      !start ||
      !end
    ) {

      return res
        .status(400)
        .json({
          success: false,
          message:
            "Missing required fields"
        });

    }


    // ======================================
    // MAKELAAR CONTACT ZOEKEN
    // ======================================

    const contact =
      await findContactByEmail(
        email
      );


    if (!contact) {

      return res
        .status(404)
        .json({
          success: false,
          message:
            "Contact niet gevonden."
        });

    }


    console.log(
      "Makelaar gevonden:",
      contact.id
    );


    // ======================================
    // BOEKINGSCODE GENEREREN
    // ======================================

    const boekingscode =
      generateBookingCode();


    console.log(
      "Boekingscode:",
      boekingscode
    );


    // ======================================
    // TICKET AANMAKEN
    // ======================================

    const ticket =
      await createTicket({

        // Ticketnaam
        subject:
          address,

        // Pipeline
        hs_pipeline:
          "0",

        // Wachten op beoordeling
        hs_pipeline_stage:
          "2",

        // ==================================
        // BOEKINGSCODE
        // ==================================

        boekingscode:
          boekingscode,

        // Adres
        adres:
          address,

        // Diensten
        diensten:
          Array.isArray(
            diensten
          )
            ? diensten.join(";")
            : diensten || "",

        // Opmerking makelaar
        opmerking_klant:
          opmerking_klant ||
          "",

        // ==================================
        // WONING / HUISEIGENAAR
        // ==================================

        woning_oppervlakte_m2:
          woning_oppervlakte_m2 !== undefined &&
          woning_oppervlakte_m2 !== null &&
          woning_oppervlakte_m2 !== ""
            ? String(
                woning_oppervlakte_m2
              )
            : "",

        huiseigenaar_naam:
          huiseigenaar_naam ||
          "",

        huiseigenaar_email:
          huiseigenaar_email ||
          "",

        huiseigenaar_telefoon:
          huiseigenaar_telefoon ||
          "",

        // ==================================
        // FOTOGRAAF
        // ==================================

        selected_photographer_id:
          String(
            photographer_id
          ),

        // ==================================
        // AFSPRAAK
        // ==================================

        afspraak_start:
          String(
            start
          ),

        afspraak_einde:
          String(
            end
          )

      });


    console.log(
      "Ticket aangemaakt:",
      ticket.id
    );


    // ======================================
    // MAKELAAR KOPPELEN
    // ======================================

    await associateTicketWithLabeledContact(
      ticket.id,
      contact.id,
      ASSOCIATION_MAKELAAR
    );


    console.log(
      "Makelaar gekoppeld:",
      contact.id
    );


    // ======================================
    // FOTOGRAAF KOPPELEN
    // ======================================

    await associateTicketWithLabeledContact(
      ticket.id,
      photographer_id,
      ASSOCIATION_FOTOGRAAF
    );


    console.log(
      "Fotograaf gekoppeld:",
      photographer_id
    );


    // ======================================
    // RESPONSE
    // ======================================

    return res
      .status(200)
      .json({

        success:
          true,

        ticketId:
          ticket.id,

        boekingscode:
          boekingscode,

        contactId:
          contact.id,

        photographerId:
          String(
            photographer_id
          )

      });

  }


  catch (
    error
  ) {

    console.error(
      "================================"
    );

    console.error(
      "SELECT PHOTOGRAPHER ERROR"
    );

    console.error(
      error
    );

    console.error(
      "================================"
    );


    return res
      .status(500)
      .json({

        success:
          false,

        message:
          error.message,

        stack:
          error.stack

      });

  }

}
