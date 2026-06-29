import { supabase } from "./supabase.js";

export async function getBlocks(photographer_id) {

    const { data, error } = await supabase
        .from("photographer_blocks")
        .select("*")
        .eq("photographer_id", photographer_id)
        .order("start_at", { ascending: true });

    if (error) {
        throw error;
    }

    return data;

}

export async function saveBlock(block) {

    const { data, error } = await supabase
        .from("photographer_blocks")
        .insert(block)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;

}

export async function deleteBlock(id) {

    const { error } = await supabase
        .from("photographer_blocks")
        .delete()
        .eq("id", id);

    if (error) {
        throw error;
    }

    return true;

}
