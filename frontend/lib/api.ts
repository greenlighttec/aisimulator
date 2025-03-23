const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function startSession({ name, prompt }: {
  name: string;
  prompt: string;
}) {
  const res = await fetch(`${BASE_URL}/setup_game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, prompt })
  });

  if (!res.ok) throw new Error("Failed to start game session.");
  return await res.json();
}

export async function runStep({
  assistant_id,
  thread_id,
  message
}: {
  assistant_id: string;
  thread_id: string;
  message: string;
}) {
  const res = await fetch(`${BASE_URL}/run_step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assistant_id, thread_id, message })
  });

  if (!res.ok) throw new Error("Failed to run step.");
  return await res.json(); // ✅ parse JSON like startSession
}

