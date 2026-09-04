import {
  hubspotRequest
} from "./hubspot.js";


// ============================================
// NORMALISATIE
// ============================================

function normalizeText(
  value
) {

  return String(
    value || ""
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

}


function normalizeEmail(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase();

}


// ============================================
// CONTACT HELPERS
// ============================================

function getContactName(
  contact
) {

  const properties =
    contact.properties ||
    {};


  return [
    properties.firstname,
    properties.lastname
  ]
    .filter(Boolean)
    .join(" ")
    .trim() ||
    properties.company ||
    properties.email ||
    "";

}


// ============================================
// CONTACTEN ZOEKEN
// ============================================

async function searchPortalContacts() {

  const results =
    [];


  let after =
    null;


  do {

    const body = {

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "portal_role",

              operator:
                "IN",

              values: [
                "makelaar",
                "fotograaf"
              ]
            }
          ]
        }
      ],

      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "company",
        "portal_role"
      ],

      limit:
        100

    };


    if (
      after
    ) {

      body.after =
        after;

    }


    const response =
      await hubspotRequest(
        "/crm/v3/objects/contacts/search",
        "POST",
        body
      );


    results.push(
      ...(
        response.results ||
        []
      )
    );


    after =
      response.paging
        ?.next
        ?.after ||
      null;

  } while (
    after
  );


  return results;

}


// ============================================
// BESTAANDE BOEKINGEN ZOEKEN
// ============================================

async function searchExistingBookingCodes() {

  const results =
    [];


  let after =
    null;


  do {

    const body = {

      filterGroups: [
        {
          filters: [
            {
              propertyName:
                "boekingscode",

              operator:
                "HAS_PROPERTY"
            }
          ]
        }
      ],

      properties: [
        "boekingscode",
        "adres",
        "afspraak_start",
        "afspraak_einde",
        "hs_pipeline_stage"
      ],

      limit:
        100

    };


    if (
      after
    ) {

      body.after =
        after;

    }


    const response =
      await hubspotRequest(
        "/crm/v3/objects/tickets/search",
        "POST",
        body
      );


    results.push(
      ...(
        response.results ||
        []
      )
    );


    after =
      response.paging
        ?.next
        ?.after ||
      null;

  } while (
    after
  );


  return results;

}


// ============================================
// CONTACT MAPPINGS
// ============================================

function buildContactMaps(
  contacts
) {

  const makelaarsByEmail =
    new Map();


  const fotografen =
    [];


  for (
    const contact of
      contacts
  ) {

    const properties =
      contact.properties ||
      {};


    const role =
      normalizeText(
        properties.portal_role
      );


    if (
      role ===
      "makelaar"
    ) {

      const email =
        normalizeEmail(
          properties.email
        );


      if (
        email
      ) {

        makelaarsByEmail.set(
          email,
          contact
        );

      }

    }


    if (
      role ===
      "fotograaf"
    ) {

      fotografen.push(
        contact
      );

    }

  }


  return {
    makelaarsByEmail,
    fotografen
  };

}


// ============================================
// FOTOGRAAF MATCHEN
// ============================================

function findPhotographer(
  fotografen,
  requestedName
) {

  const requested =
    normalizeText(
      requestedName
    );


  if (
    !requested
  ) {

    return null;

  }


  const exact =
    fotografen.find(
      contact =>
        normalizeText(
          getContactName(
            contact
          )
        ) ===
        requested
    );


  if (
    exact
  ) {

    return exact;

  }


  const firstNameExact =
    fotografen.find(
      contact =>
        normalizeText(
          contact.properties
            ?.firstname
        ) ===
        requested
    );


  if (
    firstNameExact
  ) {

    return firstNameExact;

  }


  return null;

}


// ============================================
// BOEKINGSCODE MAP
// ============================================

function getBookingCodeMap(
  bookings
) {

  const map =
    new Map();


  for (
    const booking of
      bookings
  ) {

    const code =
      normalizeText(
        booking.properties
          ?.boekingscode
      );


    if (
      code
    ) {

      map.set(
        code,
        booking
      );

    }

  }


  return map;

}


// ============================================
// WAARSCHUWINGEN PER RIJ
// ============================================

function getRowWarnings(
  row
) {

  const warnings =
    [];


  if (
    !String(
      row.boekingscode ||
      ""
    ).trim()
  ) {

    warnings.push(
      "Boekingscode ontbreekt"
    );

  }


  if (
    !String(
      row.date ||
      ""
    ).trim()
  ) {

    warnings.push(
      "Datum ontbreekt of is niet herkend"
    );

  }


  if (
    !String(
      row.start_time ||
      ""
    ).trim() ||
    !String(
      row.end_time ||
      ""
    ).trim()
  ) {

    warnings.push(
      "Begin- of eindtijd ontbreekt"
    );

  }


  if (
    !String(
      row.address ||
      ""
    ).trim()
  ) {

    warnings.push(
      "Adres ontbreekt"
    );

  }


  if (
    !String(
      row.makelaar_name ||
      ""
    ).trim()
  ) {

    warnings.push(
      "Naam makelaar ontbreekt"
    );

  }


  if (
    !normalizeEmail(
      row.makelaar_email
    )
  ) {

    warnings.push(
      "E-mailadres makelaar ontbreekt"
    );

  }


  if (
    !String(
      row.photographer_name ||
      ""
    ).trim()
  ) {

    warnings.push(
      "Fotograaf ontbreekt"
    );

  }


  if (
    !Array.isArray(
      row.services
    ) ||
    !row.services.length
  ) {

    warnings.push(
      "Geen herkenbare diensten gevonden"
    );

  }


  if (
    Array.isArray(
      row.unknown_services
    ) &&
    row.unknown_services.length
  ) {

    warnings.push(
      `Onbekende dienst(en): ${row.unknown_services.join(", ")}`
    );

  }


  return warnings;

}


// ============================================
// PREVIEW SIMPLYBOOK IMPORT
// ============================================

export async function previewSimplyBookImport(
  rows
) {

  const [
    contacts,
    existingBookings
  ] =
    await Promise.all([
      searchPortalContacts(),
      searchExistingBookingCodes()
    ]);


  const {
    makelaarsByEmail,
    fotografen
  } =
    buildContactMaps(
      contacts
    );


  const bookingCodeMap =
    getBookingCodeMap(
      existingBookings
    );


  const previewRows =
    [];


  const newMakelaarEmails =
    new Set();


  const newPhotographerNames =
    new Set();


  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {

    const row =
      rows[index] ||
      {};


    const bookingCode =
      normalizeText(
        row.boekingscode
      );


    const existingBooking =
      bookingCode
        ? bookingCodeMap.get(
            bookingCode
          ) || null
        : null;


    const makelaarEmail =
      normalizeEmail(
        row.makelaar_email
      );


    const existingMakelaar =
      makelaarEmail
        ? makelaarsByEmail.get(
            makelaarEmail
          ) || null
        : null;


    const existingPhotographer =
      findPhotographer(
        fotografen,
        row.photographer_name
      );


    const warnings =
      getRowWarnings(
        row
      );


    if (
      !existingMakelaar &&
      makelaarEmail
    ) {

      newMakelaarEmails.add(
        makelaarEmail
      );

    }


    const photographerKey =
      normalizeText(
        row.photographer_name
      );


    if (
      !existingPhotographer &&
      photographerKey
    ) {

      newPhotographerNames.add(
        photographerKey
      );

    }


    let state =
      "ready";


    if (
      existingBooking
    ) {

      state =
        "exists";

    } else if (
      warnings.length
    ) {

      state =
        "warning";

    }


    previewRows.push({

      index,

      state,

      importable:
        state ===
        "ready",

      booking_exists:
        Boolean(
          existingBooking
        ),

      existing_booking_id:
        existingBooking
          ? String(
              existingBooking.id
            )
          : null,

      makelaar: {

        state:
          existingMakelaar
            ? "existing"
            : makelaarEmail
              ? "new"
              : "missing",

        id:
          existingMakelaar
            ? String(
                existingMakelaar.id
              )
            : null,

        name:
          existingMakelaar
            ? getContactName(
                existingMakelaar
              )
            : String(
                row.makelaar_name ||
                ""
              ).trim(),

        email:
          makelaarEmail

      },

      fotograaf: {

        state:
          existingPhotographer
            ? "existing"
            : photographerKey
              ? "new"
              : "missing",

        id:
          existingPhotographer
            ? String(
                existingPhotographer.id
              )
            : null,

        name:
          existingPhotographer
            ? getContactName(
                existingPhotographer
              )
            : String(
                row.photographer_name ||
                ""
              ).trim()

      },

      warnings,

      row

    });

  }


  const counts = {

    total:
      previewRows.length,

    ready:
      previewRows.filter(
        item =>
          item.state ===
          "ready"
      ).length,

    existing:
      previewRows.filter(
        item =>
          item.state ===
          "exists"
      ).length,

    warnings:
      previewRows.filter(
        item =>
          item.state ===
          "warning"
      ).length,

    new_makelaars:
      newMakelaarEmails.size,

    new_photographers:
      newPhotographerNames.size

  };


  return {
    counts,
    rows:
      previewRows
  };

}
