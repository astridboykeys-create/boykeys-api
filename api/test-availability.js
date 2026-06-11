export default async function handler(
  req,
  res
) {

  const afspraakEinde =
    new Date(
      "2026-06-17T19:00:00Z"
    );

  const bufferMinutes =
    parseInt(
      process.env
        .DEFAULT_BUFFER_MINUTES || "15"
    );

  const beschikbaarVanaf =
    new Date(
      afspraakEinde.getTime() +
      bufferMinutes *
      60 *
      1000
    );

  return res.status(200).json({

    afspraak_einde:
      afspraakEinde,

    buffer_minutes:
      bufferMinutes,

    beschikbaar_vanaf:
      beschikbaarVanaf

  });

}
