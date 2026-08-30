import {
  hubspotRequest
} from "./hubspot.js";


const PHOTOGRAPHER_BLOCKS_OBJECT =
  "2-252620731";


// ============================================
// Helpers
// ============================================

function normalizeMultiValue(value) {

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return String(value)
    .split(";")
    .filter(Boolean);

}


function toIsoOrNull(value) {

  if (!value) {
    return null;
  }

  const numeric =
    Number(value);

  const date =
    Number.isNaN(numeric)
      ? new Date(value)
      : new Date(numeric);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();

}


// ============================================
// Associaties ophalen
// ============================================

async function getBlockAssociations(
  photographerId
) {

  const response =
    await hubspotRequest(
      `/crm/v4/objects/contacts/${photographerId}/associations/${PHOTOGRAPHER_BLOCKS_OBJECT}`
    );

  return (
    response.results ||
    []
  );

}


// ============================================
// Eén block record ophalen
// ============================================

async function getBlockRecord(
  blockId
) {

  const properties = [
    "start_at",
    "end_at",
    "reason",
    "repeat_type",
    "repeat_days",
    "repeat_until"
  ];

  return hubspotRequest(
    `/crm/v3/objects/${PHOTOGRAPHER_BLOCKS_OBJECT}/${blockId}` +
    `?properties=${properties.join(",")}`
  );

}


// ============================================
// Alle blocks van fotograaf ophalen
// ============================================

export async function getBlocks(
  photographer_id
) {

  const associations =
    await getBlockAssociations(
      photographer_id
    );

  if (!associations.length) {
    return [];
  }

  const records =
    await Promise.all(
      associations.map(
        association =>
          getBlockRecord(
            association.toObjectId
          )
      )
    );


  return records.map(
    record => {

      const p =
        record.properties || {};

      return {

        id:
          record.id,

        photographer_id,

        start_at:
          toIsoOrNull(
            p.start_at
          ),

        end_at:
          toIsoOrNull(
            p.end_at
          ),

        reason:
          p.reason || "",

        repeat_type:
          p.repeat_type ||
          "none",

        repeat_days:
          normalizeMultiValue(
            p.repeat_days
          ),

        repeat_until:
          toIsoOrNull(
            p.repeat_until
          )

      };

    }
  );

}


// ============================================
// Block opslaan
// ============================================

export async function saveBlock(
  block
) {

  const {
    photographer_id,
    start_at,
    end_at,
    reason = "",
    repeat_type = "none",
    repeat_days = [],
    repeat_until = null
  } = block;


  if (
    !photographer_id ||
    !start_at ||
    !end_at
  ) {

    throw new Error(
      "photographer_id, start_at en end_at zijn verplicht."
    );

  }


  const properties = {

    start_at:
      new Date(
        start_at
      ).getTime(),

    end_at:
      new Date(
        end_at
      ).getTime(),

    reason,

    repeat_type,

    repeat_days:
      Array.isArray(
        repeat_days
      )
        ? repeat_days.join(";")
        : repeat_days || "",

    repeat_until:
      repeat_until
        ? new Date(
            repeat_until
          ).getTime()
        : ""

  };


  // ==========================================
  // Record aanmaken
  // ==========================================

  const created =
    await hubspotRequest(
      `/crm/v3/objects/${PHOTOGRAPHER_BLOCKS_OBJECT}`,
      "POST",
      {
        properties
      }
    );


  // ==========================================
  // Koppelen aan fotograaf-contact
  // ==========================================

  await hubspotRequest(
    `/crm/v4/objects/${PHOTOGRAPHER_BLOCKS_OBJECT}/${created.id}` +
    `/associations/default/contacts/${photographer_id}`,
    "PUT"
  );


  return {

    id:
      created.id,

    photographer_id,

    start_at,

    end_at,

    reason,

    repeat_type,

    repeat_days:
      Array.isArray(
        repeat_days
      )
        ? repeat_days
        : normalizeMultiValue(
            repeat_days
          ),

    repeat_until

  };

}


// ============================================
// Block verwijderen
// ============================================

export async function deleteBlock(
  id
) {

  await hubspotRequest(
    `/crm/v3/objects/${PHOTOGRAPHER_BLOCKS_OBJECT}/${id}`,
    "DELETE"
  );

  return true;

}
