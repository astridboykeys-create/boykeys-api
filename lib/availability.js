import {
  hubspotRequest
} from "./hubspot.js";

const PHOTOGRAPHER_SETTINGS_OBJECT =
  "2-252618477";


// ============================================
// Helpers
// ============================================

function toBoolean(value) {

  return (
    value === true ||
    value === "true"
  );

}


function buildDay(
  properties,
  day
) {

  const enabled =
    toBoolean(
      properties[
        `${day}_enabled`
      ]
    );

  const start =
    properties[
      `${day}_start`
    ] || "";

  const end =
    properties[
      `${day}_end`
    ] || "";


  return {
    enabled,
    start,
    end
  };

}


// ============================================
// Photographer Settings association ophalen
// ============================================

async function getPhotographerSettingsAssociation(
  photographerId
) {

  const response =
    await hubspotRequest(
      `/crm/v4/objects/contacts/${photographerId}/associations/${PHOTOGRAPHER_SETTINGS_OBJECT}`
    );


  return (
    response.results?.[0] ||
    null
  );

}


// ============================================
// Availability ophalen
// ============================================

export async function getAvailability(
  photographer_id
) {

  const association =
    await getPhotographerSettingsAssociation(
      photographer_id
    );


  // Geen instellingen-record gekoppeld
  if (!association) {

    return {
      photographer_id,
      working_hours: {}
    };

  }


  const settingsId =
    association.toObjectId;


  const properties = [
    "monday_enabled",
    "monday_start",
    "monday_end",

    "tuesday_enabled",
    "tuesday_start",
    "tuesday_end",

    "wednesday_enabled",
    "wednesday_start",
    "wednesday_end",

    "thursday_enabled",
    "thursday_start",
    "thursday_end",

    "friday_enabled",
    "friday_start",
    "friday_end",

    "saturday_enabled",
    "saturday_start",
    "saturday_end",

    "sunday_enabled",
    "sunday_start",
    "sunday_end"
  ];


  const response =
    await hubspotRequest(
      `/crm/v3/objects/${PHOTOGRAPHER_SETTINGS_OBJECT}/${settingsId}` +
      `?properties=${properties.join(",")}`
    );


  const p =
    response.properties || {};


  return {

    photographer_id,

    settings_id:
      settingsId,

    working_hours: {

      monday:
        buildDay(
          p,
          "monday"
        ),

      tuesday:
        buildDay(
          p,
          "tuesday"
        ),

      wednesday:
        buildDay(
          p,
          "wednesday"
        ),

      thursday:
        buildDay(
          p,
          "thursday"
        ),

      friday:
        buildDay(
          p,
          "friday"
        ),

      saturday:
        buildDay(
          p,
          "saturday"
        ),

      sunday:
        buildDay(
          p,
          "sunday"
        )

    }

  };

}
