import { enableCors } from "../lib/cors.js";

import {
  findContactByEmail,
  createTicket,
  associateTicketWithContact
} from "../lib/hubspot.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  }

  try {

    const {

      firstname,
      lastname,
      email,
      phone,

      address,
      diensten,
      opmerkingen,

      latitude,
      longitude,

      photographer_id,

      start,
      end

    } = req.body;

    console.log("=== Nieuwe boeking ===");
    console.log(req.body);

    if (
  !email ||
  !photographer_id ||
  !start ||
  !end
)
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });

    }

    // =====================================
    // Contact zoeken
    // =====================================

  const contact = await findContactByEmail(email);

if (!contact) {

  return res.status(404).json({
    success: false,
    message: "Ingelogde makelaar niet gevonden."
  });

} else {

      console.log("Bestaand contact gevonden");

    }

    // =====================================
    // Ticket aanmaken
    // =====================================

    console.log("Ticket aanmaken");

    const ticket =
      await createTicket({

        hs_ticket_name:
          address,

        adres:
          address,

        diensten,

        opmerkingen,

        latitude,
        longitude,

        selected_photographer_id:
          photographer_id,

        afspraak_start:
          start,

        afspraak_einde:
          end

      });

    // =====================================
    // Ticket koppelen aan contact
    // =====================================

    console.log("Ticket koppelen");

    await associateTicketWithContact(

      ticket.id,

      contact.id

    );

    // =====================================
    // Klaar
    // =====================================

    console.log("Boeking succesvol");

    return res.status(200).json({

      success: true,

      ticketId:
        ticket.id,

      contactId:
        contact.id

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

}
