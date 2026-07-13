import { enableCors } from "../lib/cors.js";
import { hubspotRequest } from "../lib/hubspot.js";

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

      email,

      address,

      diensten,

      opmerkingen,

      photographer_id,

      start,

      end

    } = req.body;

    console.log("========== NIEUWE BOEKING ==========");
    console.log(req.body);

    if (

      !email ||

      !photographer_id ||

      !start ||

      !end

    ) {

      return res.status(400).json({

        success: false,

        message: "Missing required fields"

      });

    }

    // ================================
    // Contact zoeken
    // ================================

    const contact =

      await findContactByEmail(email);

    if (!contact) {

      return res.status(404).json({

        success: false,

        message: "Contact niet gevonden."

      });

    }

    console.log("Contact gevonden:", contact.id);

    const pipelines = await hubspotRequest("/crm/v3/pipelines/tickets");

console.log(JSON.stringify(pipelines, null, 2));

return res.status(200).json(pipelines);

    // ================================
    // Ticket aanmaken
    // ================================

    const ticket = await createTicket({

      hs_ticket_name: address,

      adres: address,

      diensten,

      opmerkingen,

      selected_photographer_id: photographer_id,

      afspraak_start: start,

      afspraak_einde: end

    });

    console.log("Ticket aangemaakt:", ticket.id);

    // ================================
    // Ticket koppelen
    // ================================

    await associateTicketWithContact(

      ticket.id,

      contact.id

    );

    console.log("Ticket gekoppeld");

    return res.status(200).json({

      success: true,

      ticketId: ticket.id,

      contactId: contact.id

    });

  }

  catch (error) {

    console.error("================================");
    console.error("SELECT PHOTOGRAPHER ERROR");
    console.error(error);
    console.error("================================");

    return res.status(500).json({

      success: false,

      message: error.message,

      stack: error.stack

    });

  }

}
