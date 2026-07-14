import { enableCors } from "../lib/cors.js";

import {
    getAvailability,
    saveAvailability
} from "../lib/availability.js";

import {
    getBlocks,
    saveBlock,
    deleteBlock
} from "../lib/blocks.js";

import {
    getMyJobs
} from "../lib/hubspot.js";

export default async function handler(req, res) {

    if (enableCors(req, res)) return;

    try {

        const action = req.query.action || req.body?.action;

        // ============================
        // GET
        // ============================

        if (req.method === "GET") {

            const {
    action,
    photographer_id
} = req.query;

if (!photographer_id) {

    return res.status(400).json({
        success: false,
        error: "photographer_id is verplicht"
    });

}

if (action === "jobs") {

    const jobs =
        await getMyJobs(
            photographer_id
        );

    return res.status(200).json({

        success: true,

        data: jobs.results

    });

}

            const { photographer_id } = req.query;

            if (!photographer_id) {

                return res.status(400).json({
                    success: false,
                    error: "photographer_id is verplicht"
                });

            }

            // ------------------------
            // Availability ophalen
            // ------------------------

            if (
                action === "availability" ||
                !action
            ) {

                const data =
                    await getAvailability(
                        photographer_id
                    );

                return res.status(200).json({
                    success: true,
                    data
                });

            }

            // ------------------------
            // Blokkades ophalen
            // ------------------------

            if (action === "blocks") {

                const data =
                    await getBlocks(
                        photographer_id
                    );

                return res.status(200).json({
                    success: true,
                    data
                });

            }

            return res.status(400).json({
                success: false,
                error: "Onbekende action"
            });

        }

        // ============================
        // POST
        // ============================

        if (req.method === "POST") {

            // ------------------------
            // Werkrooster opslaan
            // ------------------------

            if (
                action === "availability" ||
                !action
            ) {

                const {
                    photographer_id,
                    working_hours
                } = req.body;

                if (
                    !photographer_id ||
                    !working_hours
                ) {

                    return res.status(400).json({
                        success: false,
                        error: "photographer_id en working_hours zijn verplicht"
                    });

                }

                const data =
                    await saveAvailability(
                        photographer_id,
                        working_hours
                    );

                return res.status(200).json({
                    success: true,
                    data
                });

            }

            // ------------------------
            // Blokkade opslaan
            // ------------------------

            if (action === "block") {

                const {
                    photographer_id,
                    start_at,
                    end_at,
                    reason
                } = req.body;

                if (
                    !photographer_id ||
                    !start_at ||
                    !end_at
                ) {

                    return res.status(400).json({
                        success: false,
                        error: "photographer_id, start_at en end_at zijn verplicht"
                    });

                }

                const data =
                    await saveBlock({

                        photographer_id,

                        start_at,

                        end_at,

                        reason: reason || ""

                    });

                return res.status(200).json({
                    success: true,
                    data
                });

            }

            return res.status(400).json({
                success: false,
                error: "Onbekende action"
            });

        }

        // ============================
        // DELETE
        // ============================

        if (req.method === "DELETE") {

            if (action !== "block") {

                return res.status(400).json({
                    success: false,
                    error: "Onbekende action"
                });

            }

            const { id } = req.query;

            if (!id) {

                return res.status(400).json({
                    success: false,
                    error: "id is verplicht"
                });

            }

            await deleteBlock(id);

            return res.status(200).json({
                success: true
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
