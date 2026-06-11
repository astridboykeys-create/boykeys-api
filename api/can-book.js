export default async function handler(
  req,
  res
) {

  const bestaandeStart =
    new Date(
      "2026-06-17T17:00:00Z"
    );

  const bestaandeEinde =
    new Date(
      "2026-06-17T19:00:00Z"
    );

  const nieuweStart =
    new Date(
      "2026-06-17T18:00:00Z"
    );

  const nieuweEinde =
    new Date(
      "2026-06-17T20:00:00Z"
    );

  const overlap =
    nieuweStart < bestaandeEinde &&
    nieuweEinde > bestaandeStart;

  return res.status(200).json({

    bestaandeStart,
    bestaandeEinde,

    nieuweStart,
    nieuweEinde,

    overlap

  });

}
