import { getTravelInfo } from "../lib/googleRoutes.js";
import { enableCors } from "../lib/cors.js";

export default async function handler(
  req,
  res
) {

  if (enableCors(req, res)) return;

  try {

    const {
      fromLat,
      fromLng,
      toLat,
      toLng
    } = req.query;

    if (
      !fromLat ||
      !fromLng ||
      !toLat ||
      !toLng
    ) {
      return res.status(400).json({
        error:
          "fromLat, fromLng, toLat en toLng zijn verplicht"
      });
    }

    const result =
      await getTravelInfo(
        fromLat,
        fromLng,
        toLat,
        toLng
      );

    return res.status(200).json(result);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }

}
