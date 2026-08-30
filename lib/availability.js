import { supabase } from "./supabase.js";

export async function getAvailability(photographer_id) {

    const { data, error } = await supabase
    .from("photographer_availability")
    .select("*")
    .eq("photographer_id", photographer_id)
    .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {

    return {
        photographer_id,
        working_hours: {}
    };

}

return data;

}

export async function saveAvailability(
    photographer_id,
    working_hours
) {

    const { data, error } = await supabase

        .from("photographer_availability")

        .upsert(
            {
                photographer_id,
                working_hours,
                updated_at: new Date().toISOString()
            },
            {
                onConflict: "photographer_id"
            }
        )

        .select()

        .single();

    if (error) {
        throw error;
    }

    return data;

}
