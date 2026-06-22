import { enableCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  const {
    photographer_id
  } = req.query;

  if (!photographer_id) {

    return res.status(400).json({
      success: false,
      error: "photographer_id is verplicht"
    });

  }

  const { data, error } = await supabase

    .from("photographer_availability")

    .select("*")

    .eq(
      "photographer_id",
      photographer_id
    )

    .single();

  if (error) {

    return res.status(500).json({

      success: false,

      error: error.message

    });

  }

  return res.status(200).json({

    success: true,

    data

  });

}
