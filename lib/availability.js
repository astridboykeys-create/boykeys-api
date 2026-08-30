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

  return {

    enabled:
      toBoolean(
        properties[
          `${day}_enabled`
        ]
      ),

    start:
      properties[
        `${day}_start`
      ] || "",

    end:
      properties[
        `${day}_end`
      ] || ""

  };

}


function buildHubSpotProperties(
  working_hours
) {

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ];


  const properties = {};


  for (
    const day of days
  ) {

    const settings =
      working_hours?.[day] ||
      {};


    properties[
      `${day}_enabled`
    ] =
      settings.enabled
        ? "true"
        : "false";


    properties[
      `${day}_start`
    ] =
      settings.start ||
      "";


    properties[
      `${day}_end`
    ] =
      settings.end ||
      "";

  }


  return properties;

}


// ============================================
// Gekoppeld settings-record ophalen
// ============================================

async function getSettingsRecord(
  photographerId
) {

  const associations =
    await hubspotRequest(
      `/crm/v4/objects/contacts/${photographerId}/associations/${PHOTOGRAPHER_SETTINGS_OBJECT}`
    );


  const association =
    associations.results?.[0];


  if (!association) {
    return null;
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


  const record =
    await hubspotRequest(
      `/crm/v3/objects/${PHOTOGRAPHER_SETTINGS_OBJECT}/${settingsId}` +
      `?properties=${properties.join(",")}`
    );


  return record;

}


// ============================================
// Availability ophalen
// ============================================

export async function getAvailability(
  photographer_id
) {

  const record =
    await getSettingsRecord(
      photographer_id
    );


  if (!record) {

    return {

      photographer_id,

      working_hours: {}

    };

  }


  const p =
    record.properties ||
    {};


  return {

    photographer_id,

    settings_id:
      record.id,

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


// ============================================
// Availability opslaan
// ============================================

export async function saveAvailability(
  photographer_id,
  working_hours
) {

  const record =
    await getSettingsRecord(
      photographer_id
    );


  if (!record) {

    throw new Error(
      "Geen gekoppeld Fotograaf instellingen-record gevonden."
    );

  }


  const properties =
    buildHubSpotProperties(
      working_hours
    );


  const updated =
    await hubspotRequest(
      `/crm/v3/objects/${PHOTOGRAPHER_SETTINGS_OBJECT}/${record.id}`,
      "PATCH",
      {
        properties
      }
    );


  return {

    photographer_id,

    settings_id:
      updated.id,

    working_hours

  };

}
