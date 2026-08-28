import { enableCors } from "../lib/cors.js";

import {
    getMyJobs,
    getMyOrders
} from "../lib/hubspot.js";

export default async function handler(req, res) {

    if (enableCors(req, res)) return;

    try {

        if (req.method !== "GET") {

            return res.status(405).json({
                success: false,
                error: "Method not allowed"
            });

        }

        const {
            action,
            photographer_id,
            contact_id
        } = req.query;


        // =========================
        // FOTOGRAAF - MIJN OPDRACHTEN
        // =========================

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

                jobs: jobs.results || []

            });

        }


        // =========================
        // MAKELAAR - MIJN OPDRACHTEN
        // =========================

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

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            error: error.message

        });

    }

}
