import type { NextApiRequest, NextApiResponse } from "next";
const cache: Record<string, string> = {};
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { scene_id, description } = req.query;

  if (!scene_id || !description || typeof scene_id !== "string" || typeof description !== "string") {
    return res.status(400).json({ error: "Missing scene_id or description" });
  }

  if (cache[scene_id]) {
    return res.json({ url: cache[scene_id] });
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

  cache[scene_id] = data.background_url;

  return res.json({ url: data.background_url });
}

