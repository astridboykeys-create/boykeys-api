import { getTravelInfo } from "../lib/googleRoutes.js";
import { enableCors } from "../lib/cors.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  const result =
    await getTravelInfo(...);

  return res.json(result);

}
