import type { NextApiRequest, NextApiResponse } from "next";
import { BASE_URL } from "@/lib/config";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "Missing text" });

  try {
    const response = await fetch(`${BASE_URL}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorJson.error || `Upstream error: ${response.statusText}`,
      });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    response.body?.pipe(res);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown internal error",
    });
  }
}
