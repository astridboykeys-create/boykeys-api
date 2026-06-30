import { searchObject } from "./hubspot.js";

export async function getMyJobs(photographerId) {

    const result = await searchObject(
        "tickets",
        [
            {
                propertyName: "selected_photographer_id",
                operator: "EQ",
                value: photographerId
            }
        ],
        [
            "Adres",
            "afspraak_start",
            "afspraak_einde",
            "Diensten",
            "hs_pipeline_stage"
        ]
    );

    return result.results;

}
