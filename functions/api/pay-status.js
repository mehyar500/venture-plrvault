// GET /api/pay-status?token=... — same-origin proxy for the centralized
// https://mehyar.us/api/pay/status endpoint, which does not send CORS headers
// (it was built for server-to-server use). The success page polls THIS
// endpoint instead, so the browser never makes a cross-origin fetch.
const UPSTREAM = "https://mehyar.us/api/pay/status";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token || token.length < 16) return json({ ok: false, error: "invalid_token" }, 403);
  try {
    const upstream = await fetch(UPSTREAM + "?token=" + encodeURIComponent(token), {
      headers: { "user-agent": "plrvault-pay-proxy/1.0" },
    });
    const data = await upstream.json().catch(() => ({}));
    return json(data, upstream.status);
  } catch (e) {
    return json({ ok: false, error: "upstream_unavailable" }, 502);
  }
}
