// ============================================
// CORS
// ============================================

export function enableCors(
  req,
  res
) {

  // Alle Boykeys API-calls mogen
  // vanuit de browser worden aangeroepen.
  //
  // We gebruiken geen cookies/credentials
  // voor deze API-calls, dus "*" is hier
  // geschikt en sluit aan op de bestaande
  // Boykeys API-opzet.

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );


  // GET:
  // gegevens ophalen
  //
  // POST:
  // planner/import/boekingen
  //
  // PUT/PATCH:
  // updates
  //
  // DELETE:
  // verwijderen
  //
  // OPTIONS:
  // browser preflight

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );


  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );


  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );


  // ========================================
  // PREFLIGHT
  // ========================================

  if (
    req.method ===
    "OPTIONS"
  ) {

    res
      .status(204)
      .end();


    return true;

  }


  return false;

}
