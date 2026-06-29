
import { enableCors } from "../lib/cors.js";
import { getBlocks } from "../lib/blocks.js";

export default async function handler(req, res) {

    if (enableCors(req, res)) return;

    try {

        const { photographer_id } = req.query;

        if (!photographer_id) {

            return res.status(400).json({
                success: false,
                error: "photographer_id is verplicht"
            });

        }

        const blocks = await getBlocks(photographer_id);

        return res.status(200).json({

            success: true,

            data: blocks

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            error: error.message

        });

    }

}
