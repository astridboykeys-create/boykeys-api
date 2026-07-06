import {
  getTicket,
  getPhotographers
} from "../lib/hubspot.js";

export default async function handler(req, res) {

  try {

    const { ticketId } = req.query;

    if (!ticketId) {

      return res.status(400).json({
        success: false,
        error: "ticketId ontbreekt"
      });

    }

    // ==========================
    // Ticket ophalen
    // ==========================

    const ticketData = await getTicket(
      ticketId,
      [
        "adres",
        "diensten"
      ]
    );

    const adres =
      ticketData.properties.adres;

    const gevraagdeDiensten =
      (ticketData.properties.diensten || "")
        .split(";")
        .filter(Boolean);

    // ==========================
    // Fotografen ophalen
    // ==========================

    const contactsData =
      await getPhotographers();

    const fotografen =
      contactsData.results

        // Alleen fotografen met een thuislocatie
        .filter(c =>
          c.properties.thuislocatie
        )

        // Diensten filteren
        .filter(c => {

          const diensten =
            (c.properties.diensten || "")
              .split(";")
              .filter(Boolean);

          return gevraagdeDiensten.every(
            dienst =>
              diensten.includes(dienst)
          );

        })

        // Basisgegevens teruggeven
        .map(c => ({

          id: c.id,

          firstname:
            c.properties.firstname,

          lastname:
            c.properties.lastname,

          diensten:
            c.properties.diensten,

          thuislocatie:
            c.properties.thuislocatie,

          max_reistijd_minuten:
            c.properties.max_reistijd_minuten

        }));

    // ==========================
    // Response
    // ==========================

    return res.status(200).json({

      success: true,

      adres,

      photographers: fotografen

    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      error: error.message

    });

  }

}
