export default async function handler(
  req,
  res
) {

  try {

    console.log(
      "BOOKING COMPLETE"
    );

    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );

    return res.status(200).json({
      success: true
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });

  }

}
