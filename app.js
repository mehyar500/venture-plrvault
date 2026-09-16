/* PLR Vault — checkout + teaser rendering + success polling.
 * Checkout goes to the centralized endpoint: https://mehyar.us/api/pay/checkout
 */
"use strict";

/* Checkout + status go through same-origin proxies (functions/api/pay-*.js),
 * which forward to the centralized mehyar.us billing endpoints server-side.
 * Direct browser fetch to mehyar.us would hit CORS (those endpoints send no
 * ACAO headers), so the page never calls them cross-origin. */
const CHECKOUT_URL = "/api/pay-checkout";
const STATUS_URL = "/api/pay-status";
const DOWNLOAD_URL = "https://mehyar.us/api/pay/download";
const PRODUCT_ID = "plrvault-bundle";
const SITE_URL = "https://plrvault.mehyar.us";

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

/* ---------- buy modal ---------- */
function openBuyModal() {
  $("#buy-modal").classList.add("open");
  const err = $("#buy-err"); if (err) err.textContent = "";
  const input = $("#buy-email"); if (input) setTimeout(() => input.focus(), 50);
}
function closeBuyModal() { $("#buy-modal").classList.remove("open"); }

async function submitBuy() {
  const input = $("#buy-email");
  const err = $("#buy-err");
  const btn = $("#buy-submit");
  const email = (input.value || "").trim();
  if (!validEmail(email)) { err.textContent = "Enter a valid email — your download link goes there."; return; }
  err.textContent = "";
  btn.disabled = true; btn.textContent = "Opening secure checkout…";
  try {
    const resp = await fetch(CHECKOUT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product_id: PRODUCT_ID,
        email: email,
        params: {}
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok || !data.checkout_url) {
      throw new Error((data && data.error) || ("checkout_failed_" + resp.status));
    }
    window.location.href = data.checkout_url;
  } catch (e) {
    err.textContent = "Checkout hiccup — please try again. (" + esc(String((e && e.message) || e)).slice(0, 60) + ")";
    btn.disabled = false; btn.textContent = "Continue to secure checkout →";
  }
}

/* ---------- teaser: calendar + swipes ---------- */
function renderCalendar() {
  const host = $("#cal-grid");
  if (!host || !window.PLV_TEASER) return;
  host.innerHTML = window.PLV_TEASER.calendar.map(function (d) {
    return '<div class="cal-day" data-day="' + d.day + '">' +
      '<div class="d">Day ' + d.day + '</div>' +
      '<div class="t">' + esc(d.theme) + '</div>' +
      '<div class="h">' + esc(d.hook) + '</div>' +
      '<div class="full">' +
        '<div class="lbl">Format</div><p>' + esc(d.format) + '</p>' +
        '<div class="lbl">Hook</div><p>' + esc(d.hook) + '</p>' +
        '<div class="lbl">Caption</div><p>' + esc(d.caption) + '</p>' +
        '<div class="cta-line">CTA → ' + esc(d.cta) + '</div>' +
      '</div>' +
    '</div>';
  }).join("");
  $all(".cal-day", host).forEach(function (el) {
    el.addEventListener("click", function () { el.classList.toggle("open"); });
  });
}

function renderSwipes() {
  const host = $("#swipe-list");
  if (!host || !window.PLV_TEASER) return;
  host.innerHTML = window.PLV_TEASER.swipes.map(function (s) {
    return '<div class="swipe">' +
      '<div class="purpose">' + esc(s.purpose) + ' · free sample ' + s.n + ' of 50</div>' +
      '<div class="subj"><b>Subject lines:</b><br>' +
        s.subjects.map(function (x) { return "• " + esc(x); }).join("<br>") + '</div>' +
      '<div class="body">' + esc(s.body) + '</div>' +
    '</div>';
  }).join("");
}

/* ---------- success page polling ---------- */
async function pollSuccess() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const stateEl = $("#pay-state");
  const setState = function (html) { if (stateEl) stateEl.innerHTML = html; };
  if (!token || token.length < 16) {
    setState('<p style="color:var(--err)">That link looks incomplete — no valid token found. ' +
      'Check the email receipt for your personal download link.</p>');
    return;
  }
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(STATUS_URL + "?token=" + encodeURIComponent(token), { cache: "no-store" });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data && data.paid) {
        setState(
          '<p style="font-size:20px">🔓</p>' +
          '<h2>The vault is yours.</h2>' +
          '<p class="lede" style="margin:0 auto">Payment confirmed' +
          (data.email ? ' for <b>' + esc(data.email) + '</b>' : '') +
          '. Your full PLR Vault bundle is ready — planner pack, 30-day calendar, all 50 swipes, course outlines, and the license.</p>' +
          '<a class="btn dl-btn" href="' + DOWNLOAD_URL + '?token=' + encodeURIComponent(token) + '">Download the vault (.zip) →</a>' +
          '<p class="token-note">This link is personal to you — keep it somewhere safe. ' +
          'If it ever stops working, reply to your receipt email and we\'ll sort it out.</p>'
        );
        return;
      }
    } catch (e) { /* keep polling */ }
    await new Promise(function (r) { setTimeout(r, 3000); });
  }
  setState('<p style="color:var(--err)">Still waiting on payment confirmation — ' +
    'if you just paid, give it a minute and refresh. Your receipt email also carries the download link.</p>');
}

/* ---------- wire up ---------- */
document.addEventListener("DOMContentLoaded", function () {
  renderCalendar();
  renderSwipes();
  $all("[data-buy]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openBuyModal(); });
  });
  var back = $("#buy-modal");
  if (back) back.addEventListener("click", function (e) { if (e.target === back) closeBuyModal(); });
  var cancel = $("#buy-cancel");
  if (cancel) cancel.addEventListener("click", closeBuyModal);
  var submit = $("#buy-submit");
  if (submit) submit.addEventListener("click", submitBuy);
  var email = $("#buy-email");
  if (email) email.addEventListener("keydown", function (e) { if (e.key === "Enter") submitBuy(); });
  if (document.body.hasAttribute("data-success-page")) pollSuccess();
});
