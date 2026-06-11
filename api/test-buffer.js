export default async function handler(
  req,
  res
) {

  return res.json({

    buffer:
      process.env
        .DEFAULT_BUFFER_MINUTES

  });

}
