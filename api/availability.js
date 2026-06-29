import { enableCors } from "../lib/cors.js";
import {
    getAvailability,
    saveAvailability
} from "../lib/availability.js";

export default async function handler(req, res) {

    if (enableCors(req, res)) return;

    try {

        if (req.method === "GET") {

            const { photographer_id } = req.query;

            if (!photographer_id) {

                return res.status(400).json({
                    success: false,
                    error: "photographer_id is verplicht"
                });

            }

            const data = await getAvailability(photographer_id);

            return res.status(200).json({
                success: true,
                data
            });

        }

        if (req.method === "POST") {

            const {
                photographer_id,
                working_hours
            } = req.body;

            if (!photographer_id || !working_hours) {

                return res.status(400).json({
                    success: false,
                    error: "photographer_id en working_hours zijn verplicht"
                });

            }

            const data = await saveAvailability(
                photographer_id,
                working_hours
            );

            return res.status(200).json({
                success: true,
                data
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
