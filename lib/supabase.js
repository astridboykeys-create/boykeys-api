import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getAvailability(photographerId) {

  console.log("Zoeken naar:", photographerId);

  const { data, error } = await supabase
    .from("photographer_availability")
    .select("*")
    .eq("photographer_id", photographerId);

  console.log("Resultaat:", data);

  if (error) {
    throw error;
  }

  if (!data.length) {
    throw new Error(
      `Geen availability gevonden voor ${photographerId}`
    );
  }

  return data[0];

}
export async function getBlocks(photographerId) {

  const { data, error } = await supabase
    .from("photographer_blocks")
    .select("*")
    .eq("photographer_id", photographerId);

  if (error) throw error;

  return data;

}
