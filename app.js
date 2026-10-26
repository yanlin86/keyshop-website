// Shared KeyShop site code: session, header/panel, login, helpers.
// Each page sets PAGE_PREFIX before loading this file ("" on home,
// "../" on subpages). Page-specific code lives in the page's own script
// and hooks into window.onMeLoaded / window.onLoggedOut.
var API = "https://api.ksh-info.tech";
var session = null;
var meData = null;
try {
  var saved = JSON.parse(localStorage.getItem("ksh_session") || "null");
  if (saved && saved.expiresAt && new Date(saved.expiresAt).getTime() > Date.now()) session = saved;
  else localStorage.removeItem("ksh_session");
} catch (e) { session = null; }

function fmtKyat(n) { return n.toLocaleString("en-US") + " ကျပ်"; }
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
}
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function maskId(id) {
  var s = String(id);
  if (s.length <= 5) return s;
  return s.slice(0, 2) + "••••" + s.slice(-3);
}
function reasonLabel(r) {
  if (r === "topup") return "ငွေသွင်း";
  if (r === "purchase") return "ဝယ်ယူမှု";
  if (r === "referral") return "ရည်ညွှန်းဆု";
  return "အခြား";
}
function showLogin() {
  var card = document.getElementById("loginCard");
  if (!card) return;
  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  var inp = document.getElementById("codeInput");
  if (inp) inp.focus();
}
function hidePanel() { var p = document.getElementById("panel"); if (p) p.style.display = "none"; }
function togglePanel() {
  var p = document.getElementById("panel");
  if (!p) return;
  p.style.display = (p.style.display === "none" || !p.style.display) ? "block" : "none";
}
function renderHeader() {
  var wrap = document.getElementById("loginBtnWrap");
  var chip = document.getElementById("userChip");
  var panel = document.getElementById("panel");
  if (!wrap || !chip || !panel) return;
  var P = (typeof PAGE_PREFIX !== "undefined") ? PAGE_PREFIX : "";
  if (session && session.user) {
    wrap.style.display = "none";
    var u = session.user;
    var initial = (u.first_name || "K").charAt(0).toUpperCase();
    var bal = meData ? fmtKyat(meData.user.kyat) : "";
    chip.innerHTML = '<div class="avatar">' + esc(initial) + "</div><div><b>" + esc(u.first_name || "Telegram User") + "</b>" +
      (bal ? '<div class="small" style="color:var(--green)">' + bal + "</div>" : "") + "</div>";
    chip.style.display = "flex";
    panel.innerHTML = '<div class="phead"><div class="avatar">' + esc(initial) + "</div><div><b>" + esc(u.first_name || "Telegram User") + "</b>" +
      (u.username ? '<div class="muted small">@' + esc(u.username) + "</div>" : "") +
      '<div class="muted small">ID ' + esc(maskId(u.id)) + '</div>' +
      '<div class="live"><i></i>Telegram connected • LIVE</div></div></div>' +
      '<div class="pmenu">' +
      (meData ? '<div style="font-size:15px">လက်ကျန်: <b style="color:var(--green)">' + fmtKyat(meData.user.kyat) + "</b> (" + meData.user.points + " points)</div>" : "") +
      '<a href="' + P + 'account/#topupCard">💳 Top Up</a>' +
      '<a href="' + P + 'mykey/">🧾 Order History</a>' +
      '<a href="' + P + 'account/#walletBlock">💰 Wallet history</a>' +
      '<a href="' + P + 'account/">👤 My Profile</a>' +
      '<a href="https://t.me/KeyShopMmBot" target="_blank" rel="noopener">📱 Open Telegram bot</a>' +
      '<button onclick="logout()">🚪 Log out</button></div>';
  } else {
    chip.style.display = "none";
    panel.style.display = "none";
    wrap.style.display = "block";
  }
}
function openBot() { window.open("https://t.me/KeyShopMmBot", "_blank", "noopener"); }
function logout() {
  session = null; meData = null;
  try { localStorage.removeItem("ksh_session"); } catch (e) {}
  var kp = document.getElementById("keysPreview");
  if (kp) kp.style.display = "none";
  renderHeader();
  if (typeof window.onLoggedOut === "function") window.onLoggedOut();
}
async function submitCode() {
  var inp = document.getElementById("codeInput");
  var btn = document.getElementById("linkBtn");
  var msg = document.getElementById("loginMsg");
  if (!inp || !btn || !msg) return;
  var code = (inp.value || "").trim();
  if (!/^\d{6}$/.test(code)) {
    msg.innerHTML = '<span class="err">6-digit code အပြည့်အစုံ ရိုက်ထည့်ပါ။</span>';
    return;
  }
  btn.disabled = true; msg.textContent = "ချိတ်ဆက်နေတယ်…";
  try {
    var res = await fetch(API + "/api/auth/link", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code })
    });
    var data = await res.json();
    if (!res.ok || !data.ok) {
      msg.innerHTML = '<span class="err">' + (data.error === "code expired" ? "Code သက်တမ်းကုန်သွားပြီ — bot မှာ အသစ်ပြန်တောင်းပါ။" : "Code မမှန်ပါ — bot က ရတဲ့ code ကို ပြန်စစ်ပါ။") + "</span>";
      return;
    }
    session = { token: data.session, expiresAt: data.expiresAt, user: data.user };
    try { localStorage.setItem("ksh_session", JSON.stringify(session)); } catch (e) {}
    inp.value = "";
    var card = document.getElementById("loginCard");
    if (card) card.style.display = "none";
    msg.textContent = "";
    renderHeader();
    await loadMe();
  } catch (e) {
    msg.innerHTML = '<span class="err">ချိတ်ဆက်မရပါ — အင်တာနက်စစ်ပြီး ပြန်နှိပ်ပါ။</span>';
  } finally {
    btn.disabled = false;
  }
}
async function loadMe() {
  if (!session || !session.token) return null;
  try {
    var res = await fetch(API + "/api/me", { headers: { Authorization: "Bearer " + session.token } });
    var data = await res.json();
    if (!res.ok || !data.ok) { logout(); return null; }
    meData = data;
    renderHeader();
    if (typeof window.onMeLoaded === "function") window.onMeLoaded(data);
    return data;
  } catch (e) { return null; }
}
function gatedBuy() {
  if (!session) { showLogin(); return; }
  openBot();
}
function goCreate(planKey) {
  if (!session) { showLogin(); return; }
  var P = (typeof PAGE_PREFIX !== "undefined") ? PAGE_PREFIX : "";
  location.href = P + "create_vpn_key/" + (planKey ? "?plan=" + encodeURIComponent(planKey) : "");
}
function copyText(btn, text) {
  var done = function () { if (btn) btn.textContent = "Copy ပြီးပြီ!"; };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done);
  } else {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta); done();
  }
}
// Bottom nav (phone only; hidden on desktop via CSS) + page marker
// used by the phone-only home rules in style.css.
(function () {
  var path = location.pathname.replace(/\/+$/, "");
  var page = "home";
  if (path.indexOf("/mykey") !== -1) page = "mykey";
  else if (path.indexOf("/create_vpn_key") !== -1) page = "create";
  else if (path.indexOf("/account") !== -1) page = "account";
  document.body.setAttribute("data-page", page);
  var P = (typeof PAGE_PREFIX !== "undefined") ? PAGE_PREFIX : "";
  var items = [
    { key: "home", href: P || "./", label: "🏠 Home" },
    { key: "mykey", href: P + "mykey/", label: "🔑 My Key" },
    { key: "create", href: P + "create_vpn_key/", label: "✨ Create Key" },
    { key: "account", href: P + "account/", label: "👤 Account" }
  ];
  var nav = document.createElement("nav");
  nav.id = "bottomNav";
  nav.innerHTML = items.map(function (it) {
    return '<a href="' + it.href + '"' + (it.key === page ? ' class="active"' : "") + ">" + it.label + "</a>";
  }).join("");
  document.body.appendChild(nav);
})();
renderHeader();
if (session) loadMe();
