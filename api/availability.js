import { enableCors } from "../lib/cors.js";
import {
    getAvailability,
    saveAvailability
} from "../lib/availability.js";

export default async function handler(req, res) {

    if (enableCors(req, res)) return;

    try {

        if (req.method === "GET") {

            return handleGet(req, res);

        }

        if (req.method === "POST") {

            return handlePost(req, res);

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
