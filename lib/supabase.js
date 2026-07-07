import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getAvailability(photographerId) {

  const { data, error } = await supabase
    .from("photographer_availability")
    .select("*")
    .eq("photographer_id", photographerId)
    .single();

  if (error) throw error;

  return data;

}

export async function getBlocks(photographerId) {

  const { data, error } = await supabase
    .from("photographer_blocks")
    .select("*")
    .eq("photographer_id", photographerId);

  if (error) throw error;

  return data;

}
