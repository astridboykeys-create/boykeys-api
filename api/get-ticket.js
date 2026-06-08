export default async function handler(req, res) {

  res.status(200).json({
    hasToken: !!process.env.HUBSPOT_TOKEN,
    tokenLength:
      process.env.HUBSPOT_TOKEN
        ? process.env.HUBSPOT_TOKEN.length
        : 0
  });

}
