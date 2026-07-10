import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getAvailability(photographerId) {

  console.log("Availability zoeken voor:", photographerId);

  const { data, error } = await supabase
    .from("photographer_availability")
    .select("*")
    .eq("photographer_id", photographerId);

  console.log("Availability resultaat:", data);
  console.log("Availability error:", error);

  if (error) throw error;

  if (!data.length) {
    throw new Error(
      `Geen availability gevonden voor ${photographerId}`
    );
  }

  if (data.length > 1) {
    throw new Error(
      `Meerdere availability records gevonden voor ${photographerId}`
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
