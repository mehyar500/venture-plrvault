// GET /api/free-sample — IP-gated free sampler (1 claim per IP per 24h, no account).
// Records the claim in D1 free_claims (LEADS_DB), then 302s to the sampler ZIP.
const BRAND = "plrvault";
const SAMPLER_PATH = "/free/plr-vault-sampler-e972fe5123db62a954d636eb60f79e1f.zip";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestGet({ request, env }) {
  const db = env.LEADS_DB;
  if (!db) return json({ ok: false, error: "unavailable" }, 503);
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  try {
    const prior = await db
      .prepare(
        "SELECT id FROM free_claims WHERE brand = ? AND ip = ? AND claimed_at > datetime('now','-1 day') LIMIT 1"
      )
      .bind(BRAND, ip)
      .first();
    if (prior) {
      return json(
        {
          ok: false,
          error: "already_claimed",
          message: "You've already grabbed the free sampler today — come back tomorrow, or unlock the full vault below.",
        },
        429
      );
    }
    await db
      .prepare("INSERT INTO free_claims (brand, ip) VALUES (?, ?)")
      .bind(BRAND, ip)
      .run();
  } catch (e) {
    return json({ ok: false, error: "unavailable" }, 503);
  }
  const url = new URL(request.url);
  return Response.redirect(url.origin + SAMPLER_PATH, 302);
}
