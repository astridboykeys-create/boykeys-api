import { enableCors } from "../lib/cors.js";

import {
  findContactByEmail,
  createContact,
  createTicket,
  associateTicketWithContact
} from "../lib/hubspot";

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

      photographer_id,

      start,
      end

    } = req.body;

    if (
      !firstname ||
      !lastname ||
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

    // Contact zoeken
    let contact =
      await findContactByEmail(email);

    // Anders aanmaken
    if (!contact) {

      contact =
        await createContact({

          firstname,

          lastname,

          email,

          phone

        });

    }

    // Ticket aanmaken
    const ticket =
  await createTicket({

    hs_ticket_name:
      address,

    adres:
      address,

    diensten,

    opmerkingen,

    selected_photographer_id:
      photographer_id,

    afspraak_start:
      start,

    afspraak_einde:
      end

  });

    // Contact koppelen
    await associateTicketWithContact(
      ticket.id,
      contact.id
    );

    return res.json({

      success: true,

      ticketId:
        ticket.id,

      contactId:
        contact.id

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message:
        err.message

    });

  }

}
