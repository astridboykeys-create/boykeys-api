export default async function handler(req, res) {

  try {

    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/tickets?limit=1",
      {
        headers: {
          Authorization:
            `Bearer ${process.env.HUBSPOT_TOKEN}`
        }
      }
    );

    const data =
      await response.json();

    res.status(200).json(data);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

}
