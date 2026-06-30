import { enableCors } from "../lib/cors.js";

import {
    getMyJobs
} from "../lib/hubspot.js";

export default async function handler(req, res) {

    if (enableCors(req, res)) return;

    try {

        if (req.method !== "GET") {

            return res.status(405).json({
                success: false
            });

        }

        const {
            action,
            photographer_id
        } = req.query;

        if (action === "my-jobs") {

            const jobs =
                await getMyJobs(
                    photographer_id
                );

            return res.status(200).json({

                success: true,

                jobs: jobs.results

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
