import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import { BASE_URL } from "@/lib/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { text } = req.body;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing or invalid 'text'" });
  }

  try {
    const upstreamResponse = await fetch(`${BASE_URL}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!upstreamResponse.ok) {
      const errorJson = await upstreamResponse.json().catch(() => null);
      return res.status(upstreamResponse.status).json({
        error:
          errorJson?.error || `Upstream error: ${upstreamResponse.statusText}`,
      });
    }

    const webStream = upstreamResponse.body;

    if (!webStream) {
      return res.status(500).json({ error: "Upstream response had no body" });
    }

    // Node 18+ required
    if (typeof Readable.fromWeb !== "function") {
      return res
        .status(500)
        .json({ error: "Readable.fromWeb is not supported in this environment" });
    }

    const nodeStream = Readable.fromWeb(webStream as ReadableStream<Uint8Array>);
    res.setHeader("Content-Type", "audio/mpeg");
    nodeStream.pipe(res);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown internal error";
    res.status(500).json({ error: message });
  }
}
