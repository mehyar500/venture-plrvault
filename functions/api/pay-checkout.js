// POST /api/pay-checkout — same-origin proxy for the centralized
// https://mehyar.us/api/pay/checkout endpoint, which does not send CORS
// headers. The buy modal posts HERE instead, so the browser never makes a
// cross-origin fetch. The request body is forwarded verbatim; price and
// product validation still happen on the centralized endpoint.
const UPSTREAM = "https://mehyar.us/api/pay/checkout";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  if (!body || typeof body !== "object") return json({ ok: false, error: "invalid_body" }, 400);
  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "plrvault-pay-proxy/1.0" },
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({}));
    return json(data, upstream.status);
  } catch (e) {
    return json({ ok: false, error: "upstream_unavailable" }, 502);
  }
}
