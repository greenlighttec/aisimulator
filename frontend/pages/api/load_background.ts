import type { NextApiRequest, NextApiResponse } from "next";
import { BASE_URL } from "@/lib/config";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { scene_id, description } = req.query;

  if (!scene_id || !description || typeof scene_id !== "string" || typeof description !== "string") {
    return res.status(400).json({ error: "Missing scene_id or description" });
  }

  const result = await fetch(`${BASE_URL}/generate_background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene_id, description }),
  });

  const data = await result.json();

  if (!data.background_url) {
    return res.status(500).json({ error: "Failed to generate image", data: data });
  }

  return res.json({ url: data.background_url });
}

