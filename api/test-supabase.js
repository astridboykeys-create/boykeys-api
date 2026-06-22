import { enableCors } from "../lib/cors.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  const { data, error } = await supabase
    .from("photographer_availability")
    .select("*");

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
