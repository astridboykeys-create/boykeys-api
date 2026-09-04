(() => {

  const API_URL =
    "https://boykeys-api.vercel.app/api/tickets";


  const SERVICE_LABELS = {
    "360": "360°",
    photography: "Fotografie",
    video: "Video",
    measuring: "Inmeten",
    floorplan: "Plattegrond",
    drone_photography: "Drone fotografie",
    drone_video: "Drone video",
    matterport: "Matterport",
    aerial_photography: "Hoogtefotografie",
    night_photography: "Avondfotografie",
    reel: "Reel"
  };


  const SERVICE_RULES = [
    {
      value: "drone_photography",
      patterns: [
        "drone fotografie",
        "dronefotografie"
      ]
    },
    {
      value: "drone_video",
      patterns: [
        "drone video",
        "dronevideo"
      ]
    },
    {
      value: "night_photography",
      patterns: [
        "avondfotografie",
        "avond fotografie"
      ]
    },
    {
      value: "aerial_photography",
      patterns: [
        "hoogtefotografie",
        "hoogte fotografie",
        "luchtfotografie",
        "lucht fotografie"
      ]
    },
    {
      value: "matterport",
      patterns: [
        "matterport"
      ]
    },
    {
      value: "360",
      patterns: [
        "360 graden fotografie",
        "360 fotografie",
        "360° fotografie",
        "360 graden",
        "360°"
      ]
    },
    {
      value: "measuring",
      patterns: [
        "inmeten + meetrapport",
        "inmeten en meetrapport",
        "inmeten",
        "meetrapport"
      ]
    },
    {
      value: "floorplan",
      patterns: [
        "opmaak plattegrond",
        "plattegrond"
      ]
    },
    {
      value: "reel",
      patterns: [
        "reel"
      ]
    },
    {
      value: "video",
      patterns: [
        "fly through video",
        "fly-through video",
        "flythrough video",
        "woningvideo",
        "video"
      ]
    },
    {
      value: "photography",
      patterns: [
        "woningfotografie",
        "fotografie"
      ]
    }
  ];


  const HEADER_ALIASES = {

    date: [
      "datum",
      "date",
      "boekingsdatum"
    ],

    time: [
      "tijd",
      "time",
      "tijdstip"
    ],

    startTime: [
      "starttijd",
      "start tijd",
      "begintijd",
      "begin tijd"
    ],

    endTime: [
      "eindtijd",
      "eind tijd"
    ],

    bookingCode: [
      "boekingscode",
      "booking code",
      "bookingcode",
      "code"
    ],

    status: [
      "status",
      "booking status"
    ],

    photographer: [
      "dienstverlener",
      "service provider",
      "provider",
      "fotograaf"
    ],

    makelaarName: [
      "naam klant",
      "klantnaam",
      "customer name",
      "client name",
      "makelaar"
    ],

    makelaarEmail: [
      "e-mail klant",
      "email klant",
      "klant e-mail",
      "klant email",
      "customer email",
      "email"
    ],

    makelaarPhone: [
      "telefoon klant",
      "telefoonnummer klant",
      "klant telefoon",
      "customer phone",
      "phone"
    ],

    address: [
      "shootadres",
      "shoot adres",
      "adres",
      "address",
      "locatie"
    ],

    postalCode: [
      "postcode",
      "postal code",
      "zip",
      "zipcode"
    ],

    services: [
      "dienst-add-ons",
      "dienst add-ons",
      "dienst add ons",
      "add-ons",
      "addons",
      "diensten",
      "services"
    ],

    event: [
      "evenement",
      "event",
      "service"
    ],

    ownerName: [
      "volledige naam huiseigenaar",
      "naam huiseigenaar",
      "huiseigenaar naam",
      "homeowner name"
    ],

    ownerEmail: [
      "e-mail huiseigenaar",
      "email huiseigenaar",
      "huiseigenaar e-mail",
      "huiseigenaar email",
      "homeowner email"
    ],

    ownerPhone: [
      "telefoon huiseigenaar",
      "telefoonnummer huiseigenaar",
      "huiseigenaar telefoon",
      "homeowner phone"
    ],

    size: [
      "m²",
      "m2",
      "woningoppervlakte",
      "woning oppervlakte",
      "oppervlakte",
      "oppervlakte woning"
    ],

    note: [
      "opmerkingen",
      "opmerking",
      "comment",
      "comments",
      "notitie",
      "notes"
    ]

  };


  let selectedFile =
    null;


  function byId(
    id
  ) {

    return document.getElementById(
      id
    );

  }


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


  function normalizeHeader(
    value
  ) {

    return normalizeText(
      value
    )
      .replace(/[._/\\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function getMappedValue(
    row,
    aliasKey
  ) {

    const aliases =
      HEADER_ALIASES[
        aliasKey
      ] || [];


    const normalizedAliases =
      aliases.map(
        normalizeHeader
      );


    for (
      const [
        key,
        value
      ] of Object.entries(
        row || {}
      )
    ) {

      const normalizedKey =
        normalizeHeader(
          key
        );


      if (
        normalizedAliases.includes(
          normalizedKey
        )
      ) {

        return value;

      }

    }


    return "";

  }


  function cleanCell(
    value
  ) {

    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }


    return String(
      value
    )
      .replace(/\u00a0/g, " ")
      .trim();

  }


  function normalizeDate(
    value
  ) {

    const text =
      cleanCell(
        value
      );


    if (
      !text
    ) {
      return "";
    }


    let match =
      text.match(
        /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/
      );


    if (
      match
    ) {

      const day =
        String(
          Number(
            match[1]
          )
        ).padStart(
          2,
          "0"
        );


      const month =
        String(
          Number(
            match[2]
          )
        ).padStart(
          2,
          "0"
        );


      return `${match[3]}-${month}-${day}`;

    }


    match =
      text.match(
        /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
      );


    if (
      match
    ) {

      const month =
        String(
          Number(
            match[2]
          )
        ).padStart(
          2,
          "0"
        );


      const day =
        String(
          Number(
            match[3]
          )
        ).padStart(
          2,
          "0"
        );


      return `${match[1]}-${month}-${day}`;

    }


    const parsed =
      new Date(
        text
      );


    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {

      const year =
        parsed.getFullYear();

      const month =
        String(
          parsed.getMonth() + 1
        ).padStart(
          2,
          "0"
        );

      const day =
        String(
          parsed.getDate()
        ).padStart(
          2,
          "0"
        );


      return `${year}-${month}-${day}`;

    }


    return "";

  }


  function normalizeTime(
    value
  ) {

    const text =
      cleanCell(
        value
      );


    if (
      !text
    ) {
      return "";
    }


    const match =
      text.match(
        /(\d{1,2})[:.](\d{2})/
      );


    if (
      !match
    ) {
      return "";
    }


    const hour =
      Number(
        match[1]
      );

    const minute =
      Number(
        match[2]
      );


    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return "";
    }


    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  }


  function getStartAndEndTime(
    row
  ) {

    const directStart =
      normalizeTime(
        getMappedValue(
          row,
          "startTime"
        )
      );


    const directEnd =
      normalizeTime(
        getMappedValue(
          row,
          "endTime"
        )
      );


    if (
      directStart &&
      directEnd
    ) {

      return {
        start_time: directStart,
        end_time: directEnd
      };

    }


    const combined =
      cleanCell(
        getMappedValue(
          row,
          "time"
        )
      );


    const matches =
      combined.match(
        /(\d{1,2}[:.]\d{2}).*?(\d{1,2}[:.]\d{2})/
      );


    if (
      matches
    ) {

      return {
        start_time:
          normalizeTime(
            matches[1]
          ),
        end_time:
          normalizeTime(
            matches[2]
          )
      };

    }


    return {
      start_time:
        directStart,
      end_time:
        directEnd
    };

  }


  function normalizePhotographerName(
    value
  ) {

    const text =
      cleanCell(
        value
      );


    if (
      !text
    ) {
      return "";
    }


    return text
      .split("|")[0]
      .trim();

  }


  function cleanServicePart(
    value
  ) {

    return cleanCell(
      value
    )
      .replace(/\s+-\s+[-+]?€?\s*\d+[.,]\d{2}\s*(?:EUR|€)?\s*$/i, "")
      .replace(/\s+[-+]?€?\s*\d+[.,]\d{2}\s*(?:EUR|€)\s*$/i, "")
      .replace(/^\d+\s*[x×]\s*/i, "")
      .trim();

  }


  function mapServicePart(
    value
  ) {

    const clean =
      cleanServicePart(
        value
      );


    const normalized =
      normalizeText(
        clean
      );


    if (
      !normalized
    ) {
      return null;
    }


    for (
      const rule of
        SERVICE_RULES
    ) {

      const matches =
        rule.patterns.some(
          pattern =>
            normalized.includes(
              normalizeText(
                pattern
              )
            )
        );


      if (
        matches
      ) {

        return {
          value: rule.value,
          original: clean
        };

      }

    }


    return {
      value: null,
      original: clean
    };

  }


  function parseServices(
    row
  ) {

    const addons =
      cleanCell(
        getMappedValue(
          row,
          "services"
        )
      );


    const event =
      cleanCell(
        getMappedValue(
          row,
          "event"
        )
      );


    const source =
      [
        addons,
        event
      ]
        .filter(Boolean)
        .join("\n");


    const parts =
      source
        .split(/[\n;]+/)
        .map(
          cleanServicePart
        )
        .filter(Boolean);


    const services =
      [];


    const unknown =
      [];


    for (
      const part of
        parts
    ) {

      const mapped =
        mapServicePart(
          part
        );


      if (
        !mapped
      ) {
        continue;
      }


      if (
        mapped.value
      ) {

        if (
          !services.includes(
            mapped.value
          )
        ) {

          services.push(
            mapped.value
          );

        }

      } else if (
        !unknown.includes(
          mapped.original
        )
      ) {

        unknown.push(
          mapped.original
        );

      }

    }


    return {
      services,
      unknown_services:
        unknown
    };

  }


  function normalizeStatus(
    value
  ) {

    const original =
      cleanCell(
        value
      );


    const normalized =
      normalizeText(
        original
      );


    if (
      normalized.includes(
        "cancel"
      ) ||
      normalized.includes(
        "annul"
      )
    ) {

      return {
        key: "cancelled",
        original
      };

    }


    if (
      normalized === "confirmed" ||
      normalized === "bevestigd"
    ) {

      return {
        key: "confirmed",
        original
      };

    }


    return {
      key: normalized || "unknown",
      original
    };

  }


  function combineAddress(
    address,
    postalCode
  ) {

    const cleanAddress =
      cleanCell(
        address
      );


    const cleanPostalCode =
      cleanCell(
        postalCode
      );


    if (
      !cleanAddress
    ) {
      return cleanPostalCode;
    }


    if (
      !cleanPostalCode
    ) {
      return cleanAddress;
    }


    const compactAddress =
      normalizeText(
        cleanAddress
      ).replace(/\s/g, "");


    const compactPostcode =
      normalizeText(
        cleanPostalCode
      ).replace(/\s/g, "");


    if (
      compactAddress.includes(
        compactPostcode
      )
    ) {
      return cleanAddress;
    }


    return `${cleanAddress}, ${cleanPostalCode}`;

  }


  function normalizeImportRow(
    row,
    index
  ) {

    const times =
      getStartAndEndTime(
        row
      );


    const serviceData =
      parseServices(
        row
      );


    const status =
      normalizeStatus(
        getMappedValue(
          row,
          "status"
        )
      );


    return {

      source_row:
        index + 2,

      boekingscode:
        cleanCell(
          getMappedValue(
            row,
            "bookingCode"
          )
        ),

      date:
        normalizeDate(
          getMappedValue(
            row,
            "date"
          )
        ),

      start_time:
        times.start_time,

      end_time:
        times.end_time,

      source_status:
        status.key,

      source_status_original:
        status.original,

      photographer_name:
        normalizePhotographerName(
          getMappedValue(
            row,
            "photographer"
          )
        ),

      makelaar_name:
        cleanCell(
          getMappedValue(
            row,
            "makelaarName"
          )
        ),

      makelaar_email:
        cleanCell(
          getMappedValue(
            row,
            "makelaarEmail"
          )
        ).toLowerCase(),

      makelaar_phone:
        cleanCell(
          getMappedValue(
            row,
            "makelaarPhone"
          )
        ),

      address:
        combineAddress(
          getMappedValue(
            row,
            "address"
          ),
          getMappedValue(
            row,
            "postalCode"
          )
        ),

      postal_code:
        cleanCell(
          getMappedValue(
            row,
            "postalCode"
          )
        ),

      services:
        serviceData.services,

      unknown_services:
        serviceData.unknown_services,

      woning_oppervlakte_m2:
        cleanCell(
          getMappedValue(
            row,
            "size"
          )
        ).replace(/[^0-9.,]/g, ""),

      huiseigenaar_naam:
        cleanCell(
          getMappedValue(
            row,
            "ownerName"
          )
        ),

      huiseigenaar_email:
        cleanCell(
          getMappedValue(
            row,
            "ownerEmail"
          )
        ).toLowerCase(),

      huiseigenaar_telefoon:
        cleanCell(
          getMappedValue(
            row,
            "ownerPhone"
          )
        ),

      opmerking_klant:
        cleanCell(
          getMappedValue(
            row,
            "note"
          )
        )

    };

  }


  function setMessage(
    text,
    type = "info"
  ) {

    const element =
      byId(
        "planner-import-message"
      );


    if (
      !element
    ) {
      return;
    }


    if (
      !text
    ) {

      element.hidden =
        true;

      element.textContent =
        "";

      element.className =
        "planner-import-message";

      return;

    }


    element.hidden =
      false;

    element.textContent =
      text;

    element.className =
      `planner-import-message is-${type}`;

  }


  function formatBytes(
    bytes
  ) {

    if (
      !Number.isFinite(
        bytes
      )
    ) {
      return "";
    }


    if (
      bytes < 1024
    ) {
      return `${bytes} B`;
    }


    if (
      bytes < 1024 * 1024
    ) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }


    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  }


  async function ensureXlsxLoaded() {

    if (
      window.XLSX
    ) {
      return;
    }


    await new Promise(
      (
        resolve,
        reject
      ) => {

        const script =
          document.createElement(
            "script"
          );


        script.src =
          "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

        script.async =
          true;

        script.onload =
          resolve;

        script.onerror =
          () => reject(
            new Error(
              "Excel-lezer kon niet worden geladen."
            )
          );


        document.head.appendChild(
          script
        );

      }
    );

  }


  function getKnownNormalizedHeaders() {

    return new Set(
      Object.values(
        HEADER_ALIASES
      )
        .flat()
        .map(
          normalizeHeader
        )
        .filter(Boolean)
    );

  }


  function findHeaderRowIndex(
    matrix
  ) {

    const knownHeaders =
      getKnownNormalizedHeaders();


    let bestIndex =
      -1;


    let bestScore =
      0;


    const maxRows =
      Math.min(
        matrix.length,
        40
      );


    for (
      let rowIndex = 0;
      rowIndex < maxRows;
      rowIndex += 1
    ) {

      const row =
        Array.isArray(
          matrix[rowIndex]
        )
          ? matrix[rowIndex]
          : [];


      let score =
        0;


      const found =
        new Set();


      for (
        const cell of row
      ) {

        const normalized =
          normalizeHeader(
            cell
          );


        if (
          normalized &&
          knownHeaders.has(
            normalized
          )
        ) {

          found.add(
            normalized
          );

        }

      }


      score =
        found.size;


      if (
        score > bestScore
      ) {

        bestScore =
          score;

        bestIndex =
          rowIndex;

      }

    }


    if (
      bestScore < 3
    ) {

      return -1;

    }


    return bestIndex;

  }


  function matrixToObjects(
    matrix,
    headerRowIndex
  ) {

    const headerRow =
      matrix[
        headerRowIndex
      ] || [];


    const headers =
      headerRow.map(
        (
          value,
          index
        ) => {

          const clean =
            cleanCell(
              value
            );


          return clean ||
            `Kolom ${index + 1}`;

        }
      );


    const rows =
      [];


    for (
      let rowIndex =
        headerRowIndex + 1;

      rowIndex <
      matrix.length;

      rowIndex += 1
    ) {

      const rawRow =
        Array.isArray(
          matrix[rowIndex]
        )
          ? matrix[rowIndex]
          : [];


      const hasContent =
        rawRow.some(
          value =>
            cleanCell(
              value
            ) !== ""
        );


      if (
        !hasContent
      ) {

        continue;

      }


      const row =
        {};


      for (
        let columnIndex = 0;
        columnIndex < headers.length;
        columnIndex += 1
      ) {

        row[
          headers[columnIndex]
        ] =
          rawRow[
            columnIndex
          ] ?? "";

      }


      rows.push(
        row
      );

    }


    return rows;

  }


  async function readWorkbookRows(
    file
  ) {

    await ensureXlsxLoaded();


    const buffer =
      await file.arrayBuffer();


    const workbook =
      window.XLSX.read(
        buffer,
        {
          type: "array",
          cellDates: false,
          raw: false
        }
      );


    if (
      !Array.isArray(
        workbook.SheetNames
      ) ||
      !workbook.SheetNames.length
    ) {

      throw new Error(
        "Het bestand bevat geen werkblad."
      );

    }


    let bestSheetName =
      null;


    let bestHeaderRowIndex =
      -1;


    let bestHeaderScore =
      -1;


    let bestMatrix =
      null;


    for (
      const sheetName of
        workbook.SheetNames
    ) {

      const worksheet =
        workbook.Sheets[
          sheetName
        ];


      if (
        !worksheet
      ) {

        continue;

      }


      const matrix =
        window.XLSX.utils.sheet_to_json(
          worksheet,
          {
            header: 1,
            defval: "",
            raw: false,
            blankrows: false
          }
        );


      if (
        !matrix.length
      ) {

        continue;

      }


      const headerRowIndex =
        findHeaderRowIndex(
          matrix
        );


      if (
        headerRowIndex === -1
      ) {

        continue;

      }


      const header =
        matrix[
          headerRowIndex
        ] || [];


      const knownHeaders =
        getKnownNormalizedHeaders();


      const score =
        new Set(
          header
            .map(
              normalizeHeader
            )
            .filter(
              value =>
                knownHeaders.has(
                  value
                )
            )
        ).size;


      if (
        score >
        bestHeaderScore
      ) {

        bestHeaderScore =
          score;

        bestSheetName =
          sheetName;

        bestHeaderRowIndex =
          headerRowIndex;

        bestMatrix =
          matrix;

      }

    }


    if (
      !bestSheetName ||
      !bestMatrix ||
      bestHeaderRowIndex === -1
    ) {

      throw new Error(
        "De kolomkoppen van de SimplyBook-export konden niet worden gevonden."
      );

    }


    const rows =
      matrixToObjects(
        bestMatrix,
        bestHeaderRowIndex
      );


    if (
      !rows.length
    ) {

      throw new Error(
        "Er zijn geen boekingen onder de gevonden kolomkoppen gevonden."
      );

    }


    console.log(
      "SIMPLYBOOK IMPORT:",
      {
        sheet:
          bestSheetName,

        headerRow:
          bestHeaderRowIndex + 1,

        headerScore:
          bestHeaderScore,

        headers:
          Object.keys(
            rows[0] || {}
          ),

        numberOfRows:
          rows.length
      }
    );


    return rows;

  }


  function setSelectedFile(
    file
  ) {

    if (
      !file
    ) {
      return;
    }


    const name =
      String(
        file.name || ""
      ).toLowerCase();


    if (
      !name.endsWith(".xls") &&
      !name.endsWith(".xlsx") &&
      !name.endsWith(".csv")
    ) {

      setMessage(
        "Kies een .xls, .xlsx of .csv bestand.",
        "error"
      );

      return;

    }


    selectedFile =
      file;


    byId(
      "planner-import-dropzone"
    ).hidden =
      true;


    byId(
      "planner-import-filebar"
    ).hidden =
      false;


    byId(
      "planner-import-filename"
    ).textContent =
      file.name;


    byId(
      "planner-import-filemeta"
    ).textContent =
      formatBytes(
        file.size
      );


    byId(
      "planner-import-preview"
    ).hidden =
      true;


    setMessage(
      ""
    );

  }


  function clearSelectedFile() {

    selectedFile =
      null;


    const input =
      byId(
        "planner-import-file"
      );


    if (
      input
    ) {
      input.value = "";
    }


    byId(
      "planner-import-dropzone"
    ).hidden =
      false;


    byId(
      "planner-import-filebar"
    ).hidden =
      true;


    byId(
      "planner-import-preview"
    ).hidden =
      true;


    setMessage(
      ""
    );

  }


  function getStateLabel(
    state
  ) {

    if (
      state === "ready"
    ) {
      return "Klaar";
    }


    if (
      state === "exists"
    ) {
      return "Bestaat al";
    }


    return "Controleren";

  }


  function getContactStateLabel(
    state
  ) {

    if (
      state === "existing"
    ) {
      return "Bestaand contact";
    }


    if (
      state === "new"
    ) {
      return "Wordt nieuw aangemaakt";
    }


    return "Gegevens ontbreken";

  }


  function formatDate(
    value
  ) {

    if (
      !value
    ) {
      return "—";
    }


    const parts =
      String(
        value
      ).split("-");


    if (
      parts.length !== 3
    ) {
      return value;
    }


    return `${parts[2]}-${parts[1]}-${parts[0]}`;

  }


  function renderPreview(
    result
  ) {

    const counts =
      result.counts ||
      {};


    byId(
      "planner-import-count-total"
    ).textContent =
      counts.total || 0;


    byId(
      "planner-import-count-ready"
    ).textContent =
      counts.ready || 0;


    byId(
      "planner-import-count-existing"
    ).textContent =
      counts.existing || 0;


    byId(
      "planner-import-count-warnings"
    ).textContent =
      counts.warnings || 0;


    byId(
      "planner-import-count-makelaars"
    ).textContent =
      counts.new_makelaars || 0;


    byId(
      "planner-import-count-photographers"
    ).textContent =
      counts.new_photographers || 0;


    const tbody =
      byId(
        "planner-import-rows"
      );


    tbody.innerHTML =
      "";


    for (
      const item of
        result.rows || []
    ) {

      const row =
        item.row ||
        {};


      const tr =
        document.createElement(
          "tr"
        );


      const serviceHtml =
        Array.isArray(
          row.services
        ) &&
        row.services.length
          ? row.services.map(
              service =>
                `<span class="planner-import-service">${escapeHtml(SERVICE_LABELS[service] || service)}</span>`
            ).join("")
          : "—";


      const warningsHtml =
        Array.isArray(
          item.warnings
        ) &&
        item.warnings.length
          ? `<ul class="planner-import-warning-list">${item.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
          : "";


      const makelaar =
        item.makelaar ||
        {};


      const fotograaf =
        item.fotograaf ||
        {};


      tr.innerHTML = `
        <td>
          <span class="planner-import-badge planner-import-badge--${escapeHtml(item.state)}">
            ${escapeHtml(getStateLabel(item.state))}
          </span>
          ${warningsHtml}
        </td>
        <td class="planner-import-table__primary">
          ${escapeHtml(formatDate(row.date))}
        </td>
        <td>
          ${escapeHtml(row.start_time || "—")}
          ${row.end_time ? ` – ${escapeHtml(row.end_time)}` : ""}
        </td>
        <td>
          <span class="planner-import-table__primary">${escapeHtml(row.address || "—")}</span>
          ${row.postal_code ? `<span class="planner-import-table__secondary">${escapeHtml(row.postal_code)}</span>` : ""}
        </td>
        <td>
          <span class="planner-import-table__primary">${escapeHtml(makelaar.name || row.makelaar_name || "—")}</span>
          ${makelaar.email ? `<span class="planner-import-table__secondary">${escapeHtml(makelaar.email)}</span>` : ""}
          <span class="planner-import-contact-state is-${escapeHtml(makelaar.state || "missing")}">
            ${escapeHtml(getContactStateLabel(makelaar.state))}
          </span>
        </td>
        <td>
          <span class="planner-import-table__primary">${escapeHtml(fotograaf.name || row.photographer_name || "—")}</span>
          <span class="planner-import-contact-state is-${escapeHtml(fotograaf.state || "missing")}">
            ${escapeHtml(getContactStateLabel(fotograaf.state))}
          </span>
        </td>
        <td>
          <div class="planner-import-services">${serviceHtml}</div>
        </td>
        <td class="planner-import-table__primary">
          ${escapeHtml(row.boekingscode || "—")}
        </td>
      `;


      tbody.appendChild(
        tr
      );

    }


    byId(
      "planner-import-preview"
    ).hidden =
      false;


    byId(
      "planner-import-preview"
    ).scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }


  async function checkFile() {

    if (
      !selectedFile
    ) {

      setMessage(
        "Kies eerst een bestand.",
        "error"
      );

      return;

    }


    const planner =
      window.BOYKEYS_PLANNER;


    if (
      !planner?.id
    ) {

      setMessage(
        "Plannergegevens konden niet worden geladen.",
        "error"
      );

      return;

    }


    const button =
      byId(
        "planner-import-check"
      );


    const oldText =
      button.textContent;


    button.disabled =
      true;

    button.textContent =
      "Controleren...";


    setMessage(
      "Excel wordt lokaal gelezen en daarna tegen HubSpot gecontroleerd.",
      "info"
    );


    try {

      const rawRows =
        await readWorkbookRows(
          selectedFile
        );


      const rows =
        rawRows
          .map(
            normalizeImportRow
          )
          .filter(
            row =>
              row.boekingscode ||
              row.address ||
              row.makelaar_name ||
              row.photographer_name
          );


      if (
        !rows.length
      ) {

        throw new Error(
          "Geen herkenbare boekingsregels gevonden. De kolomkoppen zijn wel gevonden, maar de boekingsvelden konden niet worden gekoppeld."
        );

      }


      const response =
        await fetch(
          API_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action: "planner-import-preview",
              contact_id: planner.id,
              rows
            })
          }
        );


      let result =
        null;


      try {

        result =
          await response.json();

      } catch (
        error
      ) {

        throw new Error(
          `De API gaf geen geldige JSON terug. HTTP ${response.status}.`
        );

      }


      if (
        !response.ok ||
        !result.success
      ) {

        throw new Error(
          result.error ||
          "De importcontrole is mislukt."
        );

      }


      renderPreview(
        result
      );


      setMessage(
        `${result.counts?.total || rows.length} regels gecontroleerd. Er is nog niets geïmporteerd.`,
        "info"
      );

    } catch (
      error
    ) {

      console.error(
        "SIMPLYBOOK IMPORT PREVIEW ERROR:",
        error
      );


      setMessage(
        error.message ||
        "Het bestand kon niet worden gecontroleerd.",
        "error"
      );

    } finally {

      button.disabled =
        false;

      button.textContent =
        oldText;

    }

  }


  function init() {

    const planner =
      window.BOYKEYS_PLANNER;


    const account =
      byId(
        "planner-import-account"
      );


    if (
      account &&
      planner
    ) {

      account.textContent =
        [
          planner.firstname,
          planner.lastname
        ]
          .filter(Boolean)
          .join(" ") ||
        planner.email ||
        "Planner";

    }


    const input =
      byId(
        "planner-import-file"
      );


    const choose =
      byId(
        "planner-import-choose"
      );


    const remove =
      byId(
        "planner-import-remove"
      );


    const check =
      byId(
        "planner-import-check"
      );


    const dropzone =
      byId(
        "planner-import-dropzone"
      );


    choose?.addEventListener(
      "click",
      () => input?.click()
    );


    input?.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        if (
          file
        ) {
          setSelectedFile(
            file
          );
        }

      }
    );


    remove?.addEventListener(
      "click",
      clearSelectedFile
    );


    check?.addEventListener(
      "click",
      checkFile
    );


    for (
      const eventName of [
        "dragenter",
        "dragover"
      ]
    ) {

      dropzone?.addEventListener(
        eventName,
        event => {
          event.preventDefault();
          dropzone.classList.add(
            "is-dragging"
          );
        }
      );

    }


    for (
      const eventName of [
        "dragleave",
        "drop"
      ]
    ) {

      dropzone?.addEventListener(
        eventName,
        event => {
          event.preventDefault();
          dropzone.classList.remove(
            "is-dragging"
          );
        }
      );

    }


    dropzone?.addEventListener(
      "drop",
      event => {

        const file =
          event.dataTransfer
            ?.files?.[0];


        if (
          file
        ) {
          setSelectedFile(
            file
          );
        }

      }
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }

})();
