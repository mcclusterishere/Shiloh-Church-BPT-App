/* Shiloh — the Gemini assistant brain (Supabase Edge Function).
 *
 * Speaks the EXACT same contract as the on-premises appliance gateway
 * (scripts/appliance/gateway.js): POST { prompt } with a Bearer token,
 * returns { response }. That means data/config.json's applianceUrl can point
 * at EITHER brain — the Mac mini in the building or this function calling
 * Gemini — and the admin Assistant tab neither knows nor cares which.
 *
 * Why this exists: a Google Workspace / Gemini subscription gives the staff
 * Gemini inside Gmail and Docs, but NO API access for the app — and an API
 * key can never ship inside a static site (anyone could read it). So the key
 * lives here, server-side, and the site holds only the shared-secret token.
 *
 * Deploy (see docs/GO-LIVE.md):
 *   supabase functions deploy assistant-gemini --no-verify-jwt
 *   supabase secrets set GEMINI_API_KEY=... ASSISTANT_TOKEN=...
 * Then in data/config.json:
 *   "applianceUrl":   "https://<project>.supabase.co/functions/v1/assistant-gemini",
 *   "applianceToken": "<the same ASSISTANT_TOKEN>"
 *
 * Same non-negotiables as every assistant surface in this app: it answers a
 * question for a signed-in admin. It never sees member, giving, or prayer
 * data, never sends anything to anyone, and never moves money.
 */

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ASSISTANT_TOKEN = Deno.env.get("ASSISTANT_TOKEN") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
const MAX_PROMPT_CHARS = 4000;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return json(200, { ok: true, model: MODEL, brain: "gemini" });
  }

  if (req.method !== "POST") {
    return json(404, { error: "This assistant serves GET …/health and POST …/ (or …/ask)." });
  }

  // Fail closed, exactly like the appliance gateway.
  if (!GEMINI_API_KEY || !ASSISTANT_TOKEN) {
    return json(503, { error: "Assistant not configured: GEMINI_API_KEY and ASSISTANT_TOKEN secrets must be set." });
  }
  if (req.headers.get("authorization") !== `Bearer ${ASSISTANT_TOKEN}`) {
    return json(401, { error: "Unauthorized" });
  }

  let prompt = "";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    /* fall through to the 400 below */
  }
  if (!prompt) return json(400, { error: 'Expected JSON body: { "prompt": "..." }' });
  prompt = prompt.slice(0, MAX_PROMPT_CHARS);

  const system =
    "You are the office assistant for Shiloh Baptist Church in Bridgeport, Connecticut " +
    "(477 Broad Street; worship Sundays 9:00 AM). You help church staff draft notes, letters, " +
    "announcements, and answer general questions, in a warm, plain-spoken voice. You do not " +
    "have access to member records, giving records, or prayer requests, and you never claim to. " +
    "Anything member-facing you draft will be reviewed and sent by a human.";

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("gemini error", r.status, detail.slice(0, 300));
    return json(502, { error: "The Gemini API didn't respond. Check the API key and model name." });
  }

  const data = await r.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) return json(502, { error: "Gemini returned an empty answer. Try again." });

  return json(200, { response: text });
});
