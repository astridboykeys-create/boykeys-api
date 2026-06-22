import { enableCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

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

  const { data, error } = await supabase

    .from("photographer_availability")

    .upsert({

      photographer_id,

      working_hours,

      updated_at: new Date().toISOString()

    })

    .select();

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
