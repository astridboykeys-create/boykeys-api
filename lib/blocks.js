import {
  hubspotRequest
} from "./hubspot.js";


const PHOTOGRAPHER_BLOCKS_OBJECT =
  "2-252620731";


// ============================================
// HELPERS
// ============================================

function normalizeMultiValue(
  value
) {

  if (!value) {
    return [];
  }

  if (
    Array.isArray(value)
  ) {
    return value;
  }

  return String(value)
    .split(";")
    .map(
      item =>
        item.trim()
    )
    .filter(Boolean);

}


function toIsoOrNull(
  value
) {

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
// ASSOCIATIES OPHALEN
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
// ÉÉN BLOCK RECORD OPHALEN
// ============================================

async function getBlockRecord(
  blockId
) {

  const properties = [
    "id",
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
// ALLE BLOCKS VAN FOTOGRAAF OPHALEN
// ============================================

export async function getBlocks(
  photographer_id
) {

  const associations =
    await getBlockAssociations(
      photographer_id
    );

  if (
    !associations.length
  ) {
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


  const blocks =
    records.map(
      record => {

        const p =
          record.properties ||
          {};

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
            p.reason ||
            "",

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


  blocks.sort(
    (
      a,
      b
    ) => {

      const aTime =
        new Date(
          a.start_at
        ).getTime();

      const bTime =
        new Date(
          b.start_at
        ).getTime();

      return (
        aTime -
        bTime
      );

    }
  );


  return blocks;

}


// ============================================
// BLOCK OPSLAAN
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


  const startDate =
    new Date(
      start_at
    );


  const endDate =
    new Date(
      end_at
    );


  if (
    Number.isNaN(
      startDate.getTime()
    ) ||
    Number.isNaN(
      endDate.getTime()
    )
  ) {

    throw new Error(
      "Ongeldige begin- of einddatum."
    );

  }


  if (
    endDate <=
    startDate
  ) {

    throw new Error(
      "De eindtijd moet na de begintijd liggen."
    );

  }


  const normalizedRepeatType =
    repeat_type ||
    "none";


  const normalizedRepeatDays =
    Array.isArray(
      repeat_days
    )
      ? repeat_days
      : normalizeMultiValue(
          repeat_days
        );


  let repeatUntilValue =
    "";


  if (
    repeat_until
  ) {

    const repeatUntilDate =
      new Date(
        repeat_until
      );


    if (
      Number.isNaN(
        repeatUntilDate.getTime()
      )
    ) {

      throw new Error(
        "Ongeldige herhaal-einddatum."
      );

    }


    repeatUntilValue =
      repeatUntilDate.getTime();

  }


  // ==========================================
  // HUBSPOT PROPERTIES
  // ==========================================

  const properties = {

    /*
     * Dit custom object heeft 'id'
     * als verplichte property.
     */

    id:
      `block-${photographer_id}-${Date.now()}`,

    start_at:
      startDate.getTime(),

    end_at:
      endDate.getTime(),

    reason,

    repeat_type:
      normalizedRepeatType,

    repeat_days:
      normalizedRepeatDays
        .join(";"),

    repeat_until:
      repeatUntilValue

  };


  // ==========================================
  // RECORD AANMAKEN
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
  // KOPPELEN AAN FOTOGRAAF
  // ==========================================

  await hubspotRequest(
    `/crm/v4/objects/${PHOTOGRAPHER_BLOCKS_OBJECT}/${created.id}` +
    `/associations/default/contacts/${photographer_id}`,
    "PUT"
  );


  // ==========================================
  // RESPONSE
  // ==========================================

  return {

    id:
      created.id,

    photographer_id,

    start_at:
      startDate.toISOString(),

    end_at:
      endDate.toISOString(),

    reason,

    repeat_type:
      normalizedRepeatType,

    repeat_days:
      normalizedRepeatDays,

    repeat_until:
      repeat_until ||
      null

  };

}


// ============================================
// BLOCK VERWIJDEREN
// ============================================

export async function deleteBlock(
  id
) {

  if (!id) {

    throw new Error(
      "Block id ontbreekt."
    );

  }


  await hubspotRequest(
    `/crm/v3/objects/${PHOTOGRAPHER_BLOCKS_OBJECT}/${id}`,
    "DELETE"
  );


  return true;

}
