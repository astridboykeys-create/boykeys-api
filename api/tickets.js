import { enableCors } from "../lib/cors.js";

import {
    getMyJobs,
    getMyOrders,
    updateTicket,
    getTicketAssociations
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
                photographer_id,
                start,
                end
            } = req.body;


            if (action !== "update-order") {

                return res.status(400).json({
                    success: false,
                    error: "Onbekende actie"
                });

            }


            if (
                !ticket_id ||
                !contact_id ||
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


            // =====================================
            // Eigenaar controleren
            // =====================================

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


            // =====================================
            // Ticket wijzigen
            // =====================================

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
