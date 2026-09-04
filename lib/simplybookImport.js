import {
  hubspotRequest,
  createContact,
  createTicket,
  updateContact,
  getContact,
  STAGE_REVIEW,
  STAGE_APPROVED,
  STAGE_CANCELLED
} from "./hubspot.js";


// ============================================
// CONSTANTEN
// ============================================

const ASSOCIATION_TYPE_FOTOGRAAF = 79;
const ASSOCIATION_TYPE_MAKELAAR = 81;
const TICKET_PIPELINE_ID = "0";


// ============================================
// NORMALISATIE
// ============================================

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function normalizeServices(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(";");

  return [...new Set(
    values
      .map(item => String(item || "").trim())
      .filter(Boolean)
  )];
}


function mergeServices(currentValue, addedValue) {
  return [...new Set([
    ...normalizeServices(currentValue),
    ...normalizeServices(addedValue)
  ])];
}


function cleanString(value) {
  return String(value ?? "").trim();
}


// ============================================
// CONTACT HELPERS
// ============================================

function getContactName(contact) {
  const properties = contact?.properties || {};

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


function getContactRole(contact) {
  return normalizeText(
    contact?.properties?.portal_role
  );
}


// ============================================
// HUBSPOT CONTACTEN ZOEKEN
// ============================================

async function searchPortalContacts() {
  const results = [];
  let after = null;

  do {
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "portal_role",
              operator: "IN",
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
        "portal_role",
        "diensten"
      ],

      limit: 100
    };

    if (after) {
      body.after = after;
    }

    const response = await hubspotRequest(
      "/crm/v3/objects/contacts/search",
      "POST",
      body
    );

    results.push(
      ...(response.results || [])
    );

    after =
      response.paging?.next?.after ||
      null;

  } while (after);

  return results;
}


async function findAnyContactByEmail(email) {
  const cleanEmail =
    normalizeEmail(email);

  if (!cleanEmail) {
    return null;
  }

  const response =
    await hubspotRequest(
      "/crm/v3/objects/contacts/search",
      "POST",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: cleanEmail
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
          "portal_role",
          "diensten"
        ],

        limit: 1
      }
    );

  return response.results?.[0] || null;
}


// ============================================
// BESTAANDE BOEKINGEN ZOEKEN
// ============================================

async function searchExistingBookingCodes() {
  const results = [];
  let after = null;

  do {
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "boekingscode",
              operator: "HAS_PROPERTY"
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

      limit: 100
    };

    if (after) {
      body.after = after;
    }

    const response =
      await hubspotRequest(
        "/crm/v3/objects/tickets/search",
        "POST",
        body
      );

    results.push(
      ...(response.results || [])
    );

    after =
      response.paging?.next?.after ||
      null;

  } while (after);

  return results;
}


async function findBookingByCode(
  bookingCode
) {
  const cleanCode =
    cleanString(bookingCode);

  if (!cleanCode) {
    return null;
  }

  const response =
    await hubspotRequest(
      "/crm/v3/objects/tickets/search",
      "POST",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName:
                  "boekingscode",

                operator:
                  "EQ",

                value:
                  cleanCode
              }
            ]
          }
        ],

        properties: [
          "boekingscode",
          "adres",
          "hs_pipeline_stage"
        ],

        limit: 1
      }
    );

  return response.results?.[0] || null;
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
      contacts || []
  ) {
    const properties =
      contact.properties || {};

    const role =
      normalizeText(
        properties.portal_role
      );

    if (
      role === "makelaar"
    ) {
      const email =
        normalizeEmail(
          properties.email
        );

      if (email) {
        makelaarsByEmail.set(
          email,
          contact
        );
      }
    }

    if (
      role === "fotograaf"
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

  if (!requested) {
    return null;
  }

  const exact =
    fotografen.find(
      contact =>
        normalizeText(
          getContactName(
            contact
          )
        ) === requested
    );

  if (exact) {
    return exact;
  }

  const firstNameExact =
    fotografen.find(
      contact =>
        normalizeText(
          contact.properties
            ?.firstname
        ) === requested
    );

  if (firstNameExact) {
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
      bookings || []
  ) {
    const code =
      normalizeText(
        booking.properties
          ?.boekingscode
      );

    if (code) {
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
    !cleanString(
      row.boekingscode
    )
  ) {
    warnings.push(
      "Boekingscode ontbreekt"
    );
  }

  if (
    !cleanString(
      row.date
    )
  ) {
    warnings.push(
      "Datum ontbreekt of is niet herkend"
    );
  }

  if (
    !cleanString(
      row.start_time
    ) ||
    !cleanString(
      row.end_time
    )
  ) {
    warnings.push(
      "Begin- of eindtijd ontbreekt"
    );
  }

  if (
    !cleanString(
      row.address
    )
  ) {
    warnings.push(
      "Adres ontbreekt"
    );
  }

  if (
    !cleanString(
      row.makelaar_name
    )
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
    !cleanString(
      row.photographer_name
    )
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

  if (
    row.extra_opdracht === true &&
    ![
      "gratis",
      "factureren"
    ].includes(
      cleanString(
        row.extra_opdracht_facturatie
      )
    )
  ) {
    warnings.push(
      "Facturatie van extra opdracht is niet herkend"
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
      rows[index] || {};

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
        state === "ready",

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
            : cleanString(
                row.makelaar_name
              ),

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
            : cleanString(
                row.photographer_name
              )
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
          item.state === "ready"
      ).length,

    existing:
      previewRows.filter(
        item =>
          item.state === "exists"
      ).length,

    warnings:
      previewRows.filter(
        item =>
          item.state === "warning"
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


// ============================================
// AMSTERDAM DATUM/TIJD
// ============================================

function getTimeZoneOffsetMs(
  date,
  timeZone
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",

        timeZone
      }
    ).formatToParts(
      date
    );

  const values =
    {};

  for (
    const part of
      parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] =
        Number(
          part.value
        );
    }
  }

  const asUtc =
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );

  return (
    asUtc -
    date.getTime()
  );
}


function createAmsterdamDate(
  dateString,
  timeString
) {
  const [
    year,
    month,
    day
  ] =
    String(
      dateString || ""
    )
      .split("-")
      .map(Number);

  const [
    hour,
    minute
  ] =
    String(
      timeString || ""
    )
      .split(":")
      .map(Number);

  if (
    !Number.isFinite(
      year
    ) ||
    !Number.isFinite(
      month
    ) ||
    !Number.isFinite(
      day
    ) ||
    !Number.isFinite(
      hour
    ) ||
    !Number.isFinite(
      minute
    )
  ) {
    return null;
  }

  const naiveUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0
    );

  let candidate =
    new Date(
      naiveUtc
    );

  let offset =
    getTimeZoneOffsetMs(
      candidate,
      "Europe/Amsterdam"
    );

  candidate =
    new Date(
      naiveUtc -
      offset
    );

  const correctedOffset =
    getTimeZoneOffsetMs(
      candidate,
      "Europe/Amsterdam"
    );

  if (
    correctedOffset !==
    offset
  ) {
    candidate =
      new Date(
        naiveUtc -
        correctedOffset
      );
  }

  return candidate;
}


// ============================================
// IMPORT VALIDATIE
// ============================================

function validateImportRow(
  row
) {
  const warnings =
    getRowWarnings(
      row
    );

  if (
    warnings.length
  ) {
    return {
      valid:
        false,

      error:
        warnings.join("; ")
    };
  }

  const start =
    createAmsterdamDate(
      row.date,
      row.start_time
    );

  const end =
    createAmsterdamDate(
      row.date,
      row.end_time
    );

  if (
    !start ||
    Number.isNaN(
      start.getTime()
    ) ||
    !end ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return {
      valid:
        false,

      error:
        "Datum of tijd kon niet worden omgezet."
    };
  }

  if (
    end <= start
  ) {
    return {
      valid:
        false,

      error:
        "De eindtijd moet na de begintijd liggen."
    };
  }

  return {
    valid:
      true,

    startMs:
      start.getTime(),

    endMs:
      end.getTime()
  };
}


// ============================================
// MAKELAAR OPHALEN / AANMAKEN
// ============================================

async function getOrCreateMakelaar(
  row,
  makelaarCache
) {
  const email =
    normalizeEmail(
      row.makelaar_email
    );

  if (
    !email
  ) {
    throw new Error(
      "Makelaar heeft geen e-mailadres."
    );
  }

  if (
    makelaarCache.has(
      email
    )
  ) {
    return makelaarCache.get(
      email
    );
  }

  const existing =
    await findAnyContactByEmail(
      email
    );

  if (
    existing
  ) {
    const role =
      getContactRole(
        existing
      );

    if (
      role !==
      "makelaar"
    ) {
      throw new Error(
        `Contact ${email} bestaat al, maar heeft portal_role '${existing.properties?.portal_role || "leeg"}' in plaats van makelaar.`
      );
    }

    makelaarCache.set(
      email,
      existing
    );

    return existing;
  }

  const name =
    cleanString(
      row.makelaar_name
    );

  const properties = {
    firstname:
      name,

    company:
      name,

    email,

    portal_role:
      "makelaar"
  };

  const phone =
    cleanString(
      row.makelaar_phone
    );

  if (
    phone
  ) {
    properties.phone =
      phone;
  }

  const created =
    await createContact(
      properties
    );

  makelaarCache.set(
    email,
    created
  );

  return created;
}


// ============================================
// FOTOGRAAF OPHALEN / AANMAKEN
// ============================================

async function getOrCreatePhotographer(
  row,
  photographerCache
) {
  const requestedName =
    cleanString(
      row.photographer_name
    );

  const key =
    normalizeText(
      requestedName
    );

  if (
    !key
  ) {
    throw new Error(
      "Fotograaf ontbreekt."
    );
  }

  if (
    photographerCache.has(
      key
    )
  ) {
    return photographerCache.get(
      key
    );
  }

  const contacts =
    await searchPortalContacts();

  const existing =
    findPhotographer(
      contacts.filter(
        contact =>
          getContactRole(
            contact
          ) ===
          "fotograaf"
      ),
      requestedName
    );

  if (
    existing
  ) {
    photographerCache.set(
      key,
      existing
    );

    return existing;
  }

  const created =
    await createContact({
      firstname:
        requestedName,

      portal_role:
        "fotograaf",

      diensten:
        normalizeServices(
          row.services
        ).join(";")
    });

  photographerCache.set(
    key,
    created
  );

  return created;
}


// ============================================
// FOTOGRAAF DIENSTEN BIJWERKEN
// ============================================

async function mergePhotographerServices(
  photographer,
  services,
  photographerCache
) {
  const contactId =
    String(
      photographer.id
    );

  const fresh =
    await getContact(
      contactId,
      [
        "firstname",
        "lastname",
        "email",
        "company",
        "portal_role",
        "diensten"
      ]
    );

  const currentServices =
    normalizeServices(
      fresh.properties?.diensten
    );

  const mergedServices =
    mergeServices(
      currentServices,
      services
    );

  const currentJoined =
    currentServices.join(";");

  const mergedJoined =
    mergedServices.join(";");

  let finalContact =
    fresh;

  if (
    currentJoined !==
    mergedJoined
  ) {
    finalContact =
      await updateContact(
        contactId,
        {
          diensten:
            mergedJoined
        }
      );
  }

  const key =
    normalizeText(
      getContactName(
        finalContact
      ) ||
      photographer.properties
        ?.firstname
    );

  if (
    key
  ) {
    photographerCache.set(
      key,
      finalContact
    );
  }

  return finalContact;
}


// ============================================
// STATUS MAPPING
// ============================================

function getImportStage(
  row
) {
  const sourceStatus =
    normalizeText(
      row.source_status
    );

  if (
    sourceStatus ===
    "cancelled"
  ) {
    return STAGE_CANCELLED;
  }

  if (
    sourceStatus ===
    "confirmed"
  ) {
    return STAGE_APPROVED;
  }

  return STAGE_REVIEW;
}


// ============================================
// BOEKING ASSOCIATIE MET CONTACT
// ============================================

async function associateBookingWithContactType(
  ticketId,
  contactId,
  associationTypeId
) {
  return hubspotRequest(
    `/crm/v4/objects/tickets/${encodeURIComponent(
      ticketId
    )}/associations/contacts/${encodeURIComponent(
      contactId
    )}`,
    "PUT",
    [
      {
        associationCategory:
          "USER_DEFINED",

        associationTypeId:
          Number(
            associationTypeId
          )
      }
    ]
  );
}


// ============================================
// BOEKING AANMAKEN
// ============================================

async function createImportedBooking({
  row,
  makelaar,
  photographer,
  startMs,
  endMs
}) {
  const services =
    normalizeServices(
      row.services
    );

  const stage =
    getImportStage(
      row
    );

  const properties = {
    subject:
      cleanString(
        row.address
      ) ||
      `Boeking ${cleanString(
        row.boekingscode
      )}`,

    hs_pipeline:
      TICKET_PIPELINE_ID,

    hs_pipeline_stage:
      String(
        stage
      ),

    boekingscode:
      cleanString(
        row.boekingscode
      ),

    adres:
      cleanString(
        row.address
      ),

    diensten:
      services.join(";"),

    selected_photographer_id:
      String(
        photographer.id
      ),

    afspraak_start:
      String(
        startMs
      ),

    afspraak_einde:
      String(
        endMs
      ),

    opmerking_klant:
      cleanString(
        row.opmerking_klant
      ),

    woning_oppervlakte_m2:
      cleanString(
        row.woning_oppervlakte_m2
      ),

    huiseigenaar_naam:
      cleanString(
        row.huiseigenaar_naam
      ),

    huiseigenaar_email:
      normalizeEmail(
        row.huiseigenaar_email
      ),

    huiseigenaar_telefoon:
      cleanString(
        row.huiseigenaar_telefoon
      ),

    // ========================================
    // EXTRA OPDRACHT
    // ========================================

    extra_opdracht:
      row.extra_opdracht === true
        ? "true"
        : "false"
  };


  if (
    row.extra_opdracht === true
  ) {
    properties.extra_opdracht_facturatie =
      cleanString(
        row.extra_opdracht_facturatie
      );
  }


  const booking =
    await createTicket(
      properties
    );


  try {
    await associateBookingWithContactType(
      booking.id,
      makelaar.id,
      ASSOCIATION_TYPE_MAKELAAR
    );

    await associateBookingWithContactType(
      booking.id,
      photographer.id,
      ASSOCIATION_TYPE_FOTOGRAAF
    );

  } catch (
    error
  ) {
    console.error(
      `Associatie bij geïmporteerde boeking ${booking.id} mislukt:`,
      error
    );

    throw new Error(
      `Boeking ${row.boekingscode} is aangemaakt, maar de contactkoppeling is mislukt. Controleer boeking ${booking.id} handmatig. ${error.message}`
    );
  }


  return booking;
}


// ============================================
// ECHTE SIMPLYBOOK IMPORT
// ============================================

export async function runSimplyBookImport(
  rows
) {
  const cleanRows =
    Array.isArray(
      rows
    )
      ? rows
      : [];

  const results =
    [];

  const makelaarCache =
    new Map();

  const photographerCache =
    new Map();


  // ============================================
  // BESTAANDE PORTALCONTACTEN VOORAF CACHEN
  // ============================================

  const portalContacts =
    await searchPortalContacts();


  for (
    const contact of
      portalContacts
  ) {
    const role =
      getContactRole(
        contact
      );


    if (
      role === "makelaar"
    ) {
      const email =
        normalizeEmail(
          contact.properties?.email
        );

      if (
        email
      ) {
        makelaarCache.set(
          email,
          contact
        );
      }
    }


    if (
      role === "fotograaf"
    ) {
      const name =
        normalizeText(
          getContactName(
            contact
          )
        );

      const firstname =
        normalizeText(
          contact.properties
            ?.firstname
        );

      if (
        name
      ) {
        photographerCache.set(
          name,
          contact
        );
      }

      if (
        firstname
      ) {
        photographerCache.set(
          firstname,
          contact
        );
      }
    }
  }


  // ============================================
  // RIJEN IMPORTEREN
  // ============================================

  for (
    let index = 0;
    index < cleanRows.length;
    index += 1
  ) {
    const row =
      cleanRows[index] || {};

    const bookingCode =
      cleanString(
        row.boekingscode
      );

    try {
      const validation =
        validateImportRow(
          row
        );


      if (
        !validation.valid
      ) {
        results.push({
          index,

          boekingscode:
            bookingCode,

          status:
            "error",

          imported:
            false,

          skipped:
            false,

          error:
            validation.error
        });

        continue;
      }


      // ========================================
      // DUBBELE BOEKING OPNIEUW CONTROLEREN
      // ========================================

      const existingBooking =
        await findBookingByCode(
          bookingCode
        );


      if (
        existingBooking
      ) {
        results.push({
          index,

          boekingscode:
            bookingCode,

          status:
            "exists",

          imported:
            false,

          skipped:
            true,

          ticket_id:
            String(
              existingBooking.id
            ),

          error:
            null
        });

        continue;
      }


      // ========================================
      // MAKELAAR
      // ========================================

      const makelaar =
        await getOrCreateMakelaar(
          row,
          makelaarCache
        );


      // ========================================
      // FOTOGRAAF
      // ========================================

      let photographer =
        await getOrCreatePhotographer(
          row,
          photographerCache
        );


      // Diensten uit de boeking tevens
      // aan de fotograaf toevoegen.
      photographer =
        await mergePhotographerServices(
          photographer,
          row.services,
          photographerCache
        );


      // ========================================
      // BOEKING
      // ========================================

      const booking =
        await createImportedBooking({
          row,
          makelaar,
          photographer,

          startMs:
            validation.startMs,

          endMs:
            validation.endMs
        });


      results.push({
        index,

        boekingscode:
          bookingCode,

        status:
          "imported",

        imported:
          true,

        skipped:
          false,

        ticket_id:
          String(
            booking.id
          ),

        makelaar_id:
          String(
            makelaar.id
          ),

        fotograaf_id:
          String(
            photographer.id
          ),

        extra_opdracht:
          row.extra_opdracht === true,

        extra_opdracht_facturatie:
          row.extra_opdracht === true
            ? cleanString(
                row.extra_opdracht_facturatie
              )
            : null,

        error:
          null
      });

    } catch (
      error
    ) {
      console.error(
        `SIMPLYBOOK IMPORT RIJ ${index + 1} FOUT:`,
        error
      );

      results.push({
        index,

        boekingscode:
          bookingCode,

        status:
          "error",

        imported:
          false,

        skipped:
          false,

        error:
          error?.message ||
          "Onbekende importfout"
      });
    }
  }


  // ============================================
  // RESULTAAT
  // ============================================

  const counts = {
    total:
      results.length,

    imported:
      results.filter(
        item =>
          item.status ===
          "imported"
      ).length,

    existing:
      results.filter(
        item =>
          item.status ===
          "exists"
      ).length,

    errors:
      results.filter(
        item =>
          item.status ===
          "error"
      ).length
  };


  return {
    counts,
    results
  };
}
