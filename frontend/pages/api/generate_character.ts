import type { NextApiRequest, NextApiResponse } from "next";
import { BASE_URL } from "@/lib/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { character, description } = req.body;

  if (!character || !description) {
    return res.status(400).json({ error: "Missing character or description" });
  }

  try {
    const result = await fetch(`${BASE_URL}/api/generate_character`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character, description }),
    });

    const data = await result.json();

    if (!result.ok) {
      return res.status(result.status).json(data);
    }

    return res.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
