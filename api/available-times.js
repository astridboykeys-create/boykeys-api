import { enableCors } from "../lib/cors.js";

export default async function handler(req, res) {

  if (enableCors(req, res)) return;

  return res.status(200).json({
    success: true
  });

}
