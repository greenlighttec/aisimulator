import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import { BASE_URL } from "@/lib/config";

function readableStreamToNodeStream(webStream: ReadableStream<Uint8Array>): Readable {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null); // Signal end of stream
        } else {
          this.push(Buffer.from(value)); // Push data to the Node.js stream
        }
      } catch (err) {
        this.destroy(err instanceof Error ? err : new Error(String(err))); // Ensure the error is of type Error
      }
    },
  });
}

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

    const webStream = upstreamResponse.body as ReadableStream<Uint8Array>;

    // Convert ReadableStream to Node.js Readable
    const nodeStream = readableStreamToNodeStream(webStream);
    res.setHeader("Content-Type", "audio/mpeg");
    nodeStream.pipe(res);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown internal error";
    res.status(500).json({ error: message });
  }
}
