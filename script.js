// みんなの動画 — frontend (Switch 2 home + liquid glass)

const TOKEN_LIFETIME_DAYS = 7;
const WARN_DAYS = 3;
const FORCE_DAYS = 1;

// Reaction codes accepted by the Worker. The unified UI (avatar stamp + button)
// always submits "spark" — the others remain valid so older data still renders.
const REACTION_CODES = ["fire", "lol", "eyes", "spark", "tear", "music"];

// "Resurface" — today's hidden gem
const RESURFACE_MIN_AGE_DAYS = 14;
const SEEN_KEY = "fls_seen_v1";
const RESURFACE_KEY = "fls_resurface_v1";

// Push notification opt-in (UX nudge)
const PUSH_ASKED_KEY = "fls_push_asked_v1";

// Passcode gate
const PASS_KEY = "fls_pass_v1";
const PASSCODES = ["duffy", "ezolympic", "2411"];

// ---------- Avatar library ----------
// Each avatar is a 64x64 SVG body string. Wrapped on render.
const AVATAR_DEFS = {
  p1: { kind: "person", bg: "#FFB8B8", body: `
    <path d="M16 30 Q16 18 32 18 Q48 18 48 30 V38 L42 38 Q42 30 32 30 Q22 30 22 38 L16 38 Z" fill="#5C3D2E"/>
    <ellipse cx="32" cy="36" rx="10" ry="11" fill="#F4C7A0"/>
    <path d="M22 30 Q26 25 32 27 Q38 25 42 30" stroke="#5C3D2E" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="37" r="1.4" fill="#222"/>
    <circle cx="36" cy="37" r="1.4" fill="#222"/>
    <path d="M29 42 Q32 44 35 42" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
  p2: { kind: "person", bg: "#C9D8F8", body: `
    <path d="M14 32 Q14 18 32 18 Q50 18 50 32 V52 L42 52 V36 Q42 30 32 30 Q22 30 22 36 V52 L14 52 Z" fill="#FFD580"/>
    <ellipse cx="32" cy="36" rx="10" ry="11" fill="#FCE4C4"/>
    <path d="M22 30 Q26 25 32 27 Q38 25 42 30" stroke="#FFD580" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="37" r="1.4" fill="#222"/>
    <circle cx="36" cy="37" r="1.4" fill="#222"/>
    <path d="M30 42 Q32 43.5 34 42" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
  p3: { kind: "person", bg: "#FBE5C8", body: `
    <path d="M16 32 Q16 16 32 16 Q48 16 48 32 V40 L42 40 V36 Q42 30 32 30 Q22 30 22 36 V40 L16 40 Z" fill="#1f1f1f"/>
    <ellipse cx="32" cy="36" rx="10" ry="11" fill="#F4C7A0"/>
    <circle cx="28" cy="37" r="3.6" fill="none" stroke="#222" stroke-width="1.4"/>
    <circle cx="36" cy="37" r="3.6" fill="none" stroke="#222" stroke-width="1.4"/>
    <path d="M31.6 37 H32.4" stroke="#222" stroke-width="1.4"/>
    <circle cx="28" cy="37" r="1.1" fill="#222"/>
    <circle cx="36" cy="37" r="1.1" fill="#222"/>
    <path d="M30 43 Q32 44.5 34 43" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
  p4: { kind: "cyborg", bg: "#1a2438", body: `
    <line x1="32" y1="14" x2="32" y2="20" stroke="#9aa5bd" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="32" cy="13" r="2" fill="#FF003C"/>
    <ellipse cx="32" cy="36" rx="13" ry="14" fill="#9aa5bd"/>
    <path d="M14 30 Q14 18 32 18 Q50 18 50 30 V32 H14 Z" fill="#3d4760"/>
    <rect x="14" y="29.5" width="36" height="2" fill="#FF003C"/>
    <rect x="20" y="32" width="24" height="4.5" rx="0.5" fill="#0a0c14"/>
    <rect x="22.5" y="34" width="6" height="0.8" fill="#FF003C"/>
    <rect x="35.5" y="34" width="6" height="0.8" fill="#FF003C"/>
    <rect x="26" y="42" width="12" height="2" rx="0.6" fill="#3d4760"/>
    <line x1="40" y1="40" x2="46" y2="40" stroke="#FF003C" stroke-width="0.6"/>
    <line x1="18" y1="40" x2="24" y2="40" stroke="#5fffaa" stroke-width="0.6"/>` },
  p5: { kind: "person", bg: "#E8D8FF", body: `
    <ellipse cx="32" cy="14" rx="6" ry="5" fill="#6B4423"/>
    <path d="M16 30 Q16 19 32 19 Q48 19 48 30 V37 L42 37 Q42 30 32 30 Q22 30 22 37 L16 37 Z" fill="#6B4423"/>
    <ellipse cx="32" cy="36" rx="10" ry="11" fill="#F4C7A0"/>
    <circle cx="28" cy="37" r="1.4" fill="#222"/>
    <circle cx="36" cy="37" r="1.4" fill="#222"/>
    <path d="M29 42 Q32 44 35 42" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
  p6: { kind: "punk", bg: "#FFB000", body: `
    <path d="M22 22 L24 8 L26 22 M28 22 L30 4 L32 22 M34 22 L36 4 L38 22 M40 22 L42 8 L44 22"
      stroke="#0a0a0a" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse cx="32" cy="38" rx="11" ry="13" fill="#FFE0B5"/>
    <rect x="20" y="33" width="24" height="6" rx="2" fill="#0a0a0a"/>
    <rect x="20" y="35.5" width="24" height="0.8" fill="#FF003C" opacity="0.8"/>
    <line x1="22" y1="33" x2="22" y2="39" stroke="#3a3a3a" stroke-width="0.4"/>
    <line x1="42" y1="33" x2="42" y2="39" stroke="#3a3a3a" stroke-width="0.4"/>
    <path d="M28 46 L37 46" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="42" cy="34" r="1.2" fill="#FF003C"/>
    <circle cx="22" cy="32" r="0.8" fill="#0a0a0a"/>
    <circle cx="35" cy="46" r="0.6" fill="#FF003C"/>` },
  p7: { kind: "alien", bg: "#1c0e3e", body: `
    <line x1="22" y1="20" x2="20" y2="10" stroke="#5fffaa" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="42" y1="20" x2="44" y2="10" stroke="#5fffaa" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="20" cy="10" r="2" fill="#5fffaa"/>
    <circle cx="44" cy="10" r="2" fill="#5fffaa"/>
    <ellipse cx="32" cy="36" rx="14" ry="16" fill="#9be8a8"/>
    <path d="M18 32 Q32 28 46 32" stroke="#7bc88d" stroke-width="0.6" fill="none"/>
    <ellipse cx="26" cy="34" rx="3" ry="5" fill="#0a1a3a"/>
    <ellipse cx="38" cy="34" rx="3" ry="5" fill="#0a1a3a"/>
    <circle cx="26.6" cy="32" r="1" fill="#fff"/>
    <circle cx="38.6" cy="32" r="1" fill="#fff"/>
    <path d="M28 44 Q32 47 36 44" stroke="#0a1a3a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="14" cy="20" r="0.8" fill="#fff" opacity="0.6"/>
    <circle cx="50" cy="48" r="0.6" fill="#5fffaa" opacity="0.5"/>` },
  p8: { kind: "person", bg: "#FFD3E1", body: `
    <ellipse cx="14" cy="30" rx="6" ry="9" fill="#4A3829"/>
    <ellipse cx="50" cy="30" rx="6" ry="9" fill="#4A3829"/>
    <path d="M16 30 Q16 18 32 18 Q48 18 48 30 V36 L42 36 Q42 30 32 30 Q22 30 22 36 L16 36 Z" fill="#4A3829"/>
    <ellipse cx="32" cy="36" rx="10" ry="11" fill="#F4C7A0"/>
    <path d="M22 28 Q26 24 32 26 Q38 24 42 28" stroke="#4A3829" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="37" r="1.4" fill="#222"/>
    <circle cx="36" cy="37" r="1.4" fill="#222"/>
    <path d="M30 42 Q32 43.5 34 42" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
  p9: { kind: "gekiga", bg: "#1a1418", body: `
    <path d="M14 30 L18 14 L24 22 L30 12 L36 24 L42 14 L50 30 V36 L42 33 Q32 38 22 33 L14 36 Z" fill="#0a0608"/>
    <ellipse cx="32" cy="38" rx="13" ry="14" fill="#e8c8a4"/>
    <path d="M22 33 L28 32" stroke="#0a0608" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M36 32 L42 33" stroke="#0a0608" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M22 36 L28 35 L26 41 Z" fill="#3a1810" opacity="0.7"/>
    <path d="M42 36 L36 35 L38 41 Z" fill="#3a1810" opacity="0.7"/>
    <circle cx="25" cy="38" r="1.5" fill="#0a0608"/>
    <circle cx="39" cy="38" r="1.5" fill="#0a0608"/>
    <line x1="25" y1="36.6" x2="25" y2="35.5" stroke="#fff" stroke-width="1"/>
    <line x1="39" y1="36.6" x2="39" y2="35.5" stroke="#fff" stroke-width="1"/>
    <path d="M27 47 L37 47" stroke="#3a1810" stroke-width="2" stroke-linecap="round"/>
    <path d="M44 44 L46 49" stroke="#a02020" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="14" y1="46" x2="20" y2="44" stroke="#fff" stroke-width="0.6" opacity="0.4"/>
    <line x1="50" y1="46" x2="44" y2="44" stroke="#fff" stroke-width="0.6" opacity="0.4"/>` },
  p10: { kind: "person", bg: "#FFE2E2", body: `
    <path d="M14 30 Q14 18 32 18 Q50 18 50 30 V42 L42 42 V36 Q42 30 32 30 Q22 30 22 36 V42 L14 42 Z" fill="#EC4899"/>
    <ellipse cx="32" cy="36" rx="10" ry="11" fill="#F4C7A0"/>
    <path d="M22 30 Q26 25 32 27 Q38 25 42 30" stroke="#EC4899" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="37" r="1.4" fill="#222"/>
    <circle cx="36" cy="37" r="1.4" fill="#222"/>
    <path d="M29 42 Q32 44 35 42" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
  r1: { kind: "robot", bg: "#C0CCDA", body: `
    <line x1="32" y1="14" x2="32" y2="20" stroke="#444" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="13" r="2.4" fill="#FF3B3B"/>
    <rect x="18" y="20" width="28" height="24" rx="5" fill="#DEDEDE"/>
    <rect x="18" y="20" width="28" height="6" fill="#B7C0CC"/>
    <rect x="22" y="29" width="8" height="6" rx="1.5" fill="#0FE3FF"/>
    <rect x="34" y="29" width="8" height="6" rx="1.5" fill="#0FE3FF"/>
    <circle cx="26" cy="32" r="1.5" fill="#0a3a4a"/>
    <circle cx="38" cy="32" r="1.5" fill="#0a3a4a"/>
    <rect x="26" y="39" width="12" height="2.5" rx="1.2" fill="#666"/>` },
  a1: { kind: "cat", bg: "#FFE3C8", body: `
    <path d="M16 22 L20 14 L26 24 Z" fill="#FF9F40"/>
    <path d="M48 22 L44 14 L38 24 Z" fill="#FF9F40"/>
    <path d="M19 18 L21 14 L24 22 Z" fill="#FFD0B8"/>
    <path d="M45 18 L43 14 L40 22 Z" fill="#FFD0B8"/>
    <ellipse cx="32" cy="34" rx="13" ry="12" fill="#FF9F40"/>
    <ellipse cx="28" cy="34" r="1.6" fill="#222"/>
    <ellipse cx="36" cy="34" r="1.6" fill="#222"/>
    <path d="M32 38 L30 40 M32 38 L34 40" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M32 38 L32 40" stroke="#FF6090" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 36 L24 36 M19 38 L24 37 M40 36 L45 36 M40 37 L45 38" stroke="#222" stroke-width="0.8" stroke-linecap="round"/>` },
  a2: { kind: "dog", bg: "#FFEDD5", body: `
    <ellipse cx="18" cy="32" rx="6" ry="11" fill="#7A4F32"/>
    <ellipse cx="46" cy="32" rx="6" ry="11" fill="#7A4F32"/>
    <ellipse cx="32" cy="34" rx="13" ry="12" fill="#B8754E"/>
    <ellipse cx="32" cy="36" rx="9" ry="7" fill="#E0C0A0"/>
    <circle cx="27" cy="32" r="1.6" fill="#222"/>
    <circle cx="37" cy="32" r="1.6" fill="#222"/>
    <ellipse cx="32" cy="37" rx="2.5" ry="1.6" fill="#222"/>
    <path d="M30 39 Q32 41 34 39" stroke="#222" stroke-width="1.2" fill="none" stroke-linecap="round"/>` },
  a3: { kind: "abstract", bg: "#FFD43B", body: `
    <path d="M14 52 L32 12 L50 52 Z" fill="#0a0a0a"/>
    <rect x="22" y="34" width="6" height="6" fill="#fff"/>
    <rect x="36" y="34" width="6" height="6" fill="#fff"/>
    <circle cx="25" cy="37" r="1.6" fill="#FF003C"/>
    <circle cx="39" cy="37" r="1.6" fill="#FF003C"/>
    <rect x="29" y="44" width="6" height="2" fill="#fff"/>
    <rect x="13" y="14" width="3" height="3" fill="#FF003C"/>
    <rect x="48" y="14" width="3" height="3" fill="#fff"/>
    <rect x="44" y="22" width="2" height="2" fill="#FF003C"/>
    <rect x="18" y="22" width="2" height="2" fill="#fff"/>
    <line x1="32" y1="12" x2="32" y2="20" stroke="#FFD43B" stroke-width="0.6"/>` },
  f1: { kind: "fish", bg: "#C9F4F4", body: `
    <ellipse cx="28" cy="32" rx="16" ry="11" fill="#4ECDC4"/>
    <path d="M44 32 L54 24 L52 32 L54 40 Z" fill="#4ECDC4"/>
    <circle cx="20" cy="29" r="2.2" fill="#FFFFFF"/>
    <circle cx="20" cy="29" r="1.2" fill="#222"/>
    <path d="M28 36 Q32 39 36 36" stroke="#226662" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="14" cy="20" r="1.6" fill="#FFFFFF" opacity="0.85"/>
    <circle cx="10" cy="14" r="1.1" fill="#FFFFFF" opacity="0.85"/>` },
};

const AVATAR_IDS = Object.keys(AVATAR_DEFS);

function avatarSvg(id) {
  const def = AVATAR_DEFS[id] || AVATAR_DEFS.p1;
  // Crop in to the central character so the face fills the rounded frame.
  // The parent container already applies border-radius:50% so we use a
  // square fill rect instead of a circle.
  return `<svg viewBox="10 14 44 44" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">` +
    `<rect x="0" y="0" width="64" height="64" fill="${def.bg}"/>` +
    def.body + `</svg>`;
}

// ---------- DOM ----------

const els = {
  body: document.body,
  app: document.getElementById("app"),
  banners: document.getElementById("banners"),
  navFilters: document.getElementById("navFilters"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  updated: document.getElementById("updated"),
  themeBtn: document.getElementById("themeBtn"),
  diceBtn: document.getElementById("diceBtn"),
  sortBtn: document.getElementById("sortBtn"),
  sortLabel: document.getElementById("sortLabel"),
  accountBtn: document.getElementById("accountBtn"),
  accountAvatar: document.getElementById("accountAvatar"),
  accountLabel: document.getElementById("accountLabel"),
  accountDot: document.getElementById("accountDot"),
  clock: document.getElementById("clock"),
  statusText: document.getElementById("statusText"),

  // Passcode gate
  gate: document.getElementById("gate"),
  gateInput: document.getElementById("gateInput"),
  gateBtn: document.getElementById("gateBtn"),

  // Brand
  brandMark: document.getElementById("brandMark"),

  // Search
  searchInput: document.getElementById("searchInput"),
  searchClearBtn: document.getElementById("searchClearBtn"),
  searchCount: document.getElementById("searchCount"),

  // Mobile bottom nav
  mobileNav: document.getElementById("mobileNav"),
  mobTimelineBtn: document.getElementById("mobTimelineBtn"),
  mobFilterBtn: document.getElementById("mobFilterBtn"),
  mobDiceBtn: document.getElementById("mobDiceBtn"),
  mobMoreBtn: document.getElementById("mobMoreBtn"),

  // Filter sheet
  filterSheetRoot: document.getElementById("filterSheetRoot"),
  filterSheetBackdrop: document.getElementById("filterSheetBackdrop"),
  filterSheetOptions: document.getElementById("filterSheetOptions"),

  // More sheet
  moreSheetRoot: document.getElementById("moreSheetRoot"),
  moreSheetBackdrop: document.getElementById("moreSheetBackdrop"),
  moreSortBtn: document.getElementById("moreSortBtn"),
  moreSortAux: document.getElementById("moreSortAux"),
  moreThemeBtn: document.getElementById("moreThemeBtn"),
  moreThemeAux: document.getElementById("moreThemeAux"),
  morePushBtn: document.getElementById("morePushBtn"),
  morePushAux: document.getElementById("morePushAux"),

  modalRoot: document.getElementById("modalRoot"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modal: document.getElementById("modal"),
  modalIcon: document.getElementById("modalIcon"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalActions: document.getElementById("modalActions"),
  modalAction: document.getElementById("modalAction"),
  modalActionLabel: document.getElementById("modalActionLabel"),
  modalSkip: document.getElementById("modalSkip"),
  modalFoot: document.getElementById("modalFoot"),
  choices: document.getElementById("choices"),
  avatarPicker: document.getElementById("avatarPicker"),
  nameEdit: document.getElementById("nameEdit"),
  nameInput: document.getElementById("nameInput"),
  nameSaveBtn: document.getElementById("nameSaveBtn"),
  nameError: document.getElementById("nameError"),
  toggleRow: document.getElementById("toggleRow"),
  discloseToggle: document.getElementById("discloseToggle"),
  toggleHint: document.getElementById("toggleHint"),
  changeAvatarBtn: document.getElementById("changeAvatarBtn"),
  currentAvatarPreview: document.getElementById("currentAvatarPreview"),

  resurface: document.getElementById("resurface"),
  pushBtn: document.getElementById("pushBtn"),
  pushLabel: document.getElementById("pushLabel"),

  rmRoot: document.getElementById("rmRoot"),
  rmBackdrop: document.getElementById("rmBackdrop"),
  rmCloseBtn: document.getElementById("rmCloseBtn"),
  rmContent: document.getElementById("rmContent"),
  rmPlayer: document.getElementById("rmPlayer"),
  rmTitle: document.getElementById("rmTitle"),
  rmChannel: document.getElementById("rmChannel"),
  rmLikedby: document.getElementById("rmLikedby"),
  rmEyebrow: document.getElementById("rmEyebrow"),
  rmDice: document.getElementById("rmDice"),
  rmOpen: document.getElementById("rmOpen"),
  rmSpeed: document.getElementById("rmSpeed"),
  rmCcBtn: document.getElementById("rmCcBtn"),

  inlinePlayer: document.getElementById("inlinePlayer"),
  ipPlayer: document.getElementById("ipPlayer"),
  ipMeta: document.getElementById("ipMeta"),
  ipSpeed: document.getElementById("ipSpeed"),
  ipFsBtn: document.getElementById("ipFsBtn"),
  ipYtBtn: document.getElementById("ipYtBtn"),
  ipCloseBtn: document.getElementById("ipCloseBtn"),

  toast: document.getElementById("toast"),
  toastText: document.getElementById("toastText"),
};

const state = {
  config: null,
  users: [],
  videos: [],
  status: { users: {} },
  reactions: {},           // { videoId: { code: [userId, ...] } }
  me: null,
  filter: "all",       // "all" | "<userId>" | "channel:<name>"
  minorOnly: false,
  sort: "latest",      // newest likedAt first by default
  search: "",
  selectedIndex: -1,
  randomOrder: null,
  newLikesSeen: {},    // userId -> ts
  recentClicks: {},    // videoId -> ts
  dismissedSelfWarn: false,
  dismissedOthers: new Set(),
  rmPickedAvatar: null,
  seen: new Set(),         // videoIds the current viewer has seen
  todayResurface: null,    // selected video to feature today
  pushSubscribed: false,
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
function isLocalDev() { return LOCAL_HOSTS.has(location.hostname); }

// ---------- bootstrap ----------

async function init() {
  initTheme();
  loadSeen();
  bindStaticHandlers();
  startClock();

  // Passcode gate — block app entirely until passed
  if (!isPassed()) {
    showGate();
    return;
  }
  await bootApp();
}

async function bootApp() {
  loadRecentClicks();
  loadSeenNewLikes();

  const [config, users] = await Promise.all([
    loadJson("data/config.json").catch(() => ({})),
    loadJson("data/users.json").catch(() => []),
  ]);
  state.config = config;
  state.users = users;

  if (!isLocalDev() && !state.config?.workerOrigin) {
    showFatal("config が読み込めません。data/config.json の workerOrigin を確認してください。");
    return;
  }

  const [videos, status, reactions, me] = await Promise.all([
    loadJson("data/videos.json").catch(() => []),
    loadJson("data/status.json").catch(() => ({ users: {} })),
    loadJson("data/reactions.json").catch(() => ({})),
    fetchMe(),
  ]);
  state.videos = (isLocalDev() && (!videos || videos.length === 0)) ? DEMO_VIDEOS : videos;
  state.status = status || { users: {} };
  state.reactions = reactions || {};
  state.me = me;

  shuffleVideos();
  pickTodayResurface();

  const url = new URL(location.href);
  const renewed = url.searchParams.get("renewed");
  if (renewed) {
    url.searchParams.delete("renewed");
    history.replaceState({}, "", url.toString());
    state.me = await fetchMe();
    afterRenewal(renewed);
  }

  // PWA shortcut deep link
  const action = url.searchParams.get("action");
  if (action === "random") {
    url.searchParams.delete("action");
    history.replaceState({}, "", url.toString());
    setTimeout(() => openRandomModal(), 800);
  }

  renderAccount();
  renderNav();
  renderBanners();
  renderResurface();
  renderGrid();
  renderStatus();
  renderUpdated();
  updateSortIcon();
  showApp();
  applyGate();

  window.addEventListener("message", onMessage);
  window.addEventListener("resize", debounce(() => { /* responsive recalcs handled by CSS */ }, 100));

  // Register service worker + check push subscription state
  registerServiceWorker().then(() => updatePushButton());
}

function showApp() {
  els.app.removeAttribute("aria-hidden");
  els.body.dataset.state = "ready";
}

function showFatal(msg) {
  openModal({
    icon: "err", title: "読み込みエラー", body: msg,
    actionLabel: "再試行", onAction: () => location.reload(),
    skip: false, blocking: true,
  });
  showApp();
}

// ---------- theme ----------

function initTheme() {
  let t = "light";
  try { t = localStorage.getItem("theme") || "light"; } catch {}
  document.documentElement.dataset.theme = t;
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
}

// ---------- clock ----------

function tickClock() {
  const d = new Date();
  els.clock.textContent =
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0");
}
function startClock() {
  tickClock();
  const ms = 60000 - (Date.now() % 60000);
  setTimeout(() => { tickClock(); setInterval(tickClock, 60000); }, ms);
}

// ---------- gating ----------

function applyGate() {
  if (!state.me?.signedIn) { openSignInModal(); return; }
  const myUser = state.users.find((u) => u.id === state.me.userId);
  if (myUser && (myUser.disclose === undefined || myUser.disclose === null)) {
    openPrivacyChoiceModal(myUser);
    return;
  }
  // Only show avatar picker for fresh users (no avatarId AND no privacy yet would be odd —
  // but if privacy was just chosen this session, savePrivacyChoice triggers picker explicitly)
  const days = daysUntilExpiry(state.me.tokenIssuedAt);
  if (days !== null && days <= FORCE_DAYS) {
    openModal({
      icon: "err",
      title: days <= 0 ? "アクセスが切れました" : "アクセスが間もなく切れます",
      body: days <= 0
        ? "毎日の取得が止まっています。Google でもう一度サインインしてください。"
        : `残り 約 ${formatDuration(days)}。今のうちに更新しておきましょう。`,
      actionLabel: "今すぐ更新",
      onAction: startSignIn,
      skip: days > 0,
      blocking: days <= 0,
    });
  }
}

function openSignInModal() {
  openModal({
    icon: "welcome",
    title: "みんなの動画へ",
    body: "閲覧には Google サインインが必要です。",
    actionLabel: "Continue with Google",
    onAction: startSignIn,
    skip: false, blocking: true,
  });
}

function openPrivacyChoiceModal(user) {
  openModal({
    icon: "welcome",
    title: `ようこそ、${escape(user.name)}!`,
    body:
      "あなたが YouTube で押した <strong>「高評価」</strong> が、" +
      "毎日自動でみんなのフィードに集まります。<br><br>" +
      "ひとつだけ、参加のしかたを選んでください。<br>" +
      "<strong>この設定は原則として変更できません</strong>。",
    skip: false, blocking: true, hideAction: true,
    choices: [
      {
        title: "オープンモード",
        badge: "おすすめ",
        desc: "あなたがいいねしたことが共有される代わりに、" +
              "誰がいいねした動画かを知ることができます。",
        onPick: () => savePrivacyChoice(true),
      },
      {
        title: "匿名モード",
        desc: "あなたがいいねしたことは共有されませんが、" +
              "誰がいいねした動画かは知ることができません。",
        onPick: () => savePrivacyChoice(false),
      },
    ],
    foot: "変更したい場合は管理人にご連絡ください。",
  });
}

async function savePrivacyChoice(disclose) {
  els.choices.querySelectorAll(".choice").forEach((c) => (c.style.pointerEvents = "none"));
  if (isLocalDev()) {
    const u = state.users.find((u) => u.id === state.me.userId);
    if (u) u.disclose = disclose;
    afterPrivacyChosen();
    return;
  }
  try {
    const r = await fetch(`${state.config.workerOrigin}/me/disclose`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disclose }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
    state.users = await loadJson("data/users.json").catch(() => state.users);
    afterPrivacyChosen();
  } catch (e) {
    els.choices.querySelectorAll(".choice").forEach((c) => (c.style.pointerEvents = ""));
    showToast("保存に失敗: " + e.message);
  }
}

function afterPrivacyChosen() {
  // Show avatar picker if not yet chosen
  const u = state.users.find((u) => u.id === state.me.userId);
  if (u && !u.avatarId) {
    openAvatarPickerModal({ blocking: true });
    return;
  }
  closeModal();
  renderAccount(); renderNav(); renderGrid(); renderStatus();
  showToast("これで準備完了!");
}

// ---------- /me ----------

async function fetchMe() {
  if (isLocalDev()) {
    const u = state.users[0];
    if (!u) return { signedIn: false };
    return { signedIn: true, userId: u.id, name: u.name + " (dev)",
      tokenIssuedAt: new Date().toISOString() };
  }
  try {
    const r = await fetch(`${state.config.workerOrigin}/me`, {
      credentials: "include", cache: "no-store",
    });
    if (!r.ok) return { signedIn: false };
    return await r.json();
  } catch (e) { console.warn("fetch /me failed:", e); return { signedIn: false }; }
}

// ---------- sign-in popup ----------

let popupRef = null;
let popupTimer = null;

function startSignIn() {
  if (isLocalDev()) {
    showToast("dev mode — Worker をデプロイすると本番フローを試せます");
    return;
  }
  setActionLoading(true);
  const url = new URL(`${state.config.workerOrigin}/start`);
  url.searchParams.set("return_to", location.origin + location.pathname);
  url.searchParams.set("popup", "1");
  const w = 480, h = 640;
  const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
  popupRef = window.open(url.toString(), "fls_oauth", `width=${w},height=${h},left=${left},top=${top}`);
  if (!popupRef) { location.href = url.toString(); return; }
  popupRef.focus?.();
  clearInterval(popupTimer);
  popupTimer = setInterval(() => {
    if (popupRef && popupRef.closed) {
      clearInterval(popupTimer); popupRef = null; setActionLoading(false);
    }
  }, 400);
}

function setActionLoading(loading) {
  els.modalAction.disabled = loading;
  if (loading) {
    els.modalActionLabel.innerHTML = '<span class="spinner" style="margin-right:6px"></span>サインイン中…';
  }
}

function onMessage(event) {
  if (event.origin !== state.config.workerOrigin) return;
  if (!event.data || event.data.type !== "fls:renewed") return;
  if (popupRef && !popupRef.closed) try { popupRef.close(); } catch {}
  popupRef = null; clearInterval(popupTimer);
  afterRenewal(event.data.userId);
}

async function afterRenewal(userId) {
  state.me = await fetchMe();
  state.users = await loadJson("data/users.json").catch(() => state.users);
  state.dismissedSelfWarn = false;
  state.dismissedOthers.delete(userId);
  state.status = await loadJson("data/status.json").catch(() => state.status);
  closeModal();
  renderAccount(); renderNav(); renderGrid(); renderBanners(); renderStatus();
  const myUser = state.users.find((u) => u.id === state.me.userId);
  if (myUser && (myUser.disclose === undefined || myUser.disclose === null)) {
    openPrivacyChoiceModal(myUser); return;
  }
  if (myUser && !myUser.avatarId) {
    openAvatarPickerModal({ blocking: true });
    return;
  }
  showToast(`${displayName(userId)} のアクセスを更新したよ`);
}

// ---------- avatar picker ----------

function openAvatarPickerModal({ blocking = false } = {}) {
  const u = state.users.find((u) => u.id === state.me.userId);
  state.rmPickedAvatar = u?.avatarId || null;

  openModal({
    icon: "welcome",
    title: "アイコンを選んでね",
    body: "リストやカードに表示されます。あとで変えられます。",
    showAvatarPicker: true,
    actionLabel: "決定",
    onAction: () => saveAvatar(state.rmPickedAvatar, blocking),
    skip: !blocking,
    blocking,
  });
}

function renderAvatarPicker() {
  const grid = els.avatarPicker;
  grid.innerHTML = "";
  AVATAR_IDS.forEach((id, i) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "avatar-cell" + (state.rmPickedAvatar === id ? " selected" : "");
    cell.dataset.id = id;
    cell.style.setProperty("--i", i);
    cell.innerHTML = avatarSvg(id);
    cell.addEventListener("click", () => {
      state.rmPickedAvatar = id;
      grid.querySelectorAll(".avatar-cell").forEach((c) =>
        c.classList.toggle("selected", c.dataset.id === id));
    });
    grid.appendChild(cell);
  });
  els.modalAction.disabled = !state.rmPickedAvatar;
}

async function saveAvatar(avatarId, fromOnboarding = false) {
  if (!avatarId) {
    showToast("アイコンを選んでください");
    return;
  }
  els.modalAction.disabled = true;
  if (isLocalDev()) {
    const u = state.users.find((u) => u.id === state.me.userId);
    if (u) u.avatarId = avatarId;
    closeModal();
    renderAccount(); renderNav(); renderGrid();
    showToast(fromOnboarding ? "ようこそ！" : "アイコンを更新したよ");
    return;
  }
  try {
    const r = await fetch(`${state.config.workerOrigin}/me/avatar`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarId }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
    state.users = await loadJson("data/users.json").catch(() => state.users);
    closeModal();
    renderAccount(); renderNav(); renderGrid();
    showToast(fromOnboarding ? "ようこそ！" : "アイコンを更新したよ");
  } catch (e) {
    els.modalAction.disabled = false;
    showToast("保存に失敗: " + e.message);
  }
}

// ---------- modal ----------

let modalCfg = null;

function openModal(cfg) {
  modalCfg = cfg;
  els.modalIcon.className = "modal-icon " + (cfg.icon || "welcome");
  els.modalIcon.textContent = iconChar(cfg.icon);
  els.modalTitle.textContent = cfg.title || "";
  els.modalBody.innerHTML = cfg.body || "";

  // Choices (privacy) — staggered fade-in via --i
  els.choices.innerHTML = "";
  if (cfg.choices && cfg.choices.length) {
    els.choices.classList.remove("hidden");
    cfg.choices.forEach((c, i) => {
      const el = document.createElement("button");
      el.className = "choice";
      el.type = "button";
      el.style.setProperty("--i", i);
      el.innerHTML =
        `<div class="choice-title">${escape(c.title)}` +
        (c.badge ? `<span class="pill-mini">${escape(c.badge)}</span>` : "") +
        `</div><div class="choice-desc">${escape(c.desc)}</div>`;
      el.addEventListener("click", c.onPick);
      els.choices.appendChild(el);
    });
  } else {
    els.choices.classList.add("hidden");
  }

  // Avatar picker
  if (cfg.showAvatarPicker) {
    els.avatarPicker.classList.remove("hidden");
    renderAvatarPicker();
  } else {
    els.avatarPicker.classList.add("hidden");
  }

  // Action button
  els.modalActions.classList.toggle("hidden", !!cfg.hideAction);
  els.modalActionLabel.textContent = cfg.actionLabel || "Continue with Google";
  if (cfg.actionLabel) {
    // Hide the Google G logo when not the sign-in flow
    const svg = els.modalAction.querySelector("svg");
    if (svg) svg.style.display = (cfg.actionLabel === "Continue with Google") ? "" : "none";
  }
  els.modalAction.disabled = false;
  els.modalSkip.classList.toggle("hidden", !cfg.skip);

  els.modalFoot.classList.toggle("hidden", !cfg.foot);
  els.modalFoot.textContent = cfg.foot || "";

  els.nameEdit.classList.toggle("hidden", !cfg.showNameEdit);
  els.nameError.classList.add("hidden");
  if (cfg.showNameEdit) {
    els.nameInput.value = state.me?.name || "";
    const me = state.users.find((u) => u.id === state.me?.userId);
    const on = !!(me && me.disclose !== false);
    setDiscloseToggle(on);
    const lbl = document.getElementById("discloseModeLabel");
    if (lbl) lbl.textContent = on ? "オープンモード" : "匿名モード";
    els.currentAvatarPreview.innerHTML = avatarSvg(me?.avatarId || "p1");
    setTimeout(() => els.nameInput.focus(), 80);
  }

  els.modalRoot.classList.remove("hidden");
  setTimeout(() => els.modal.focus(), 40);
}

function closeModal() {
  modalCfg = null;
  els.modalRoot.classList.add("hidden");
  els.nameEdit.classList.add("hidden");
  els.choices.classList.add("hidden");
  els.avatarPicker.classList.add("hidden");
  els.modalFoot.classList.add("hidden");
  els.modalActions.classList.remove("hidden");
  setActionLoading(false);
}

function iconChar(kind) {
  if (kind === "warn" || kind === "err") return "!";
  return "▶";
}

// ---------- account ----------

function renderAccount() {
  if (!state.me?.signedIn) {
    els.accountLabel.textContent = "サインイン";
    els.accountAvatar.innerHTML = "";
    els.accountBtn.className = "account glass-panel";
    els.accountDot.style.display = "none";
    return;
  }
  const u = state.users.find((u) => u.id === state.me.userId);
  els.accountLabel.textContent = state.me.name || state.me.userId;
  els.accountAvatar.innerHTML = avatarSvg(u?.avatarId || "p1");
  els.accountDot.style.display = "";
  const days = daysUntilExpiry(state.me.tokenIssuedAt);
  let cls = "ok";
  if (days !== null && days <= FORCE_DAYS) cls = "err";
  else if (days !== null && days <= WARN_DAYS) cls = "warn";
  els.accountBtn.className = "account glass-panel " + cls;
}

function openAccountModal() {
  if (!state.me?.signedIn) { openSignInModal(); return; }
  const days = daysUntilExpiry(state.me.tokenIssuedAt);
  let body = "";
  if (days !== null) {
    if (days <= 0) body = "アクセスが切れています。今すぐ更新してください。";
    else if (days <= WARN_DAYS) body = `アクセスはあと 約 ${formatDuration(days)} で切れます。`;
    else body = "Google で再認証してアクセスを更新できます。";
  }
  openModal({
    icon: days !== null && days <= FORCE_DAYS ? "err" : "welcome",
    title: `${state.me.name || state.me.userId} のアカウント`,
    body, actionLabel: "アクセスを更新", onAction: startSignIn,
    skip: true, showNameEdit: true, blocking: false,
  });
}

// ---------- name + disclose + avatar ----------

function setDiscloseToggle(on) {
  els.discloseToggle.setAttribute("aria-checked", on ? "true" : "false");
  els.toggleHint.textContent = on
    ? "あなたがいいねしたことが共有される代わりに、誰がいいねした動画かを知ることができます。"
    : "あなたがいいねしたことは共有されませんが、誰がいいねした動画かは知ることができません。";
}

// Disclose mode is permanent once chosen — clicking the toggle just informs.
function toggleDisclose() {
  showToast("変更したい場合は管理人にご連絡ください");
}

async function saveName() {
  const raw = els.nameInput.value.trim();
  const len = [...raw].length;
  if (len < 1 || len > 4) {
    els.nameError.textContent = "1〜4文字で入力してください。";
    els.nameError.classList.remove("hidden");
    return;
  }
  els.nameError.classList.add("hidden");
  if (isLocalDev()) {
    const u = state.users.find((u) => u.id === state.me.userId);
    if (u) u.name = raw;
    state.me.name = raw;
    renderAccount(); renderNav(); renderGrid(); renderStatus();
    closeModal();
    showToast(`表示名を「${raw}」に更新したよ`);
    return;
  }
  els.nameSaveBtn.disabled = true;
  els.nameSaveBtn.textContent = "…";
  try {
    const r = await fetch(`${state.config.workerOrigin}/me/name`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: raw }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
    const data = await r.json();
    state.me.name = data.name;
    state.users = await loadJson("data/users.json").catch(() => state.users);
    renderAccount(); renderNav(); renderGrid(); renderStatus();
    closeModal();
    showToast(`表示名を「${data.name}」に更新したよ`);
  } catch (e) {
    els.nameError.textContent = "更新に失敗しました: " + e.message;
    els.nameError.classList.remove("hidden");
  } finally {
    els.nameSaveBtn.disabled = false;
    els.nameSaveBtn.textContent = "保存";
  }
}

// ---------- banners ----------

function renderBanners() {
  els.banners.innerHTML = "";
  const meId = state.me?.userId || null;
  const myDays = daysUntilExpiry(state.me?.tokenIssuedAt);

  if (state.me?.signedIn && myDays !== null && myDays > FORCE_DAYS && myDays <= WARN_DAYS && !state.dismissedSelfWarn) {
    addBanner({
      kind: "warn",
      text: `あなたのアクセスは約 ${formatDuration(myDays)} で切れます`,
      action: { label: "今すぐ更新", onClick: startSignIn },
      dismiss: () => { state.dismissedSelfWarn = true; renderBanners(); },
    });
  }

  for (const u of state.users) {
    if (u.id === meId) continue;
    if (state.dismissedOthers.has(u.id)) continue;
    if (u.disclose === false) continue;
    const issuedAt = state.status?.users?.[u.id]?.tokenIssuedAt;
    const days = daysUntilExpiry(issuedAt);
    if (days === null) continue;
    if (days > WARN_DAYS) continue;
    addBanner({
      kind: days <= 0 ? "err" : "warn",
      text: days <= 0
        ? `<strong>${escape(u.name)}</strong> のアクセスが切れています <span class="muted">— 本人がサイトを開いて更新する必要があるよ</span>`
        : `<strong>${escape(u.name)}</strong> のアクセスが約 ${formatDuration(days)} で切れます`,
      dismiss: () => { state.dismissedOthers.add(u.id); renderBanners(); },
    });
  }
}

function addBanner({ kind, text, action, dismiss }) {
  const div = document.createElement("div");
  div.className = "banner " + (kind || "");
  const icon = document.createElement("span");
  icon.className = "banner-icon";
  const txt = document.createElement("div");
  txt.className = "banner-text";
  txt.innerHTML = text;
  div.appendChild(icon); div.appendChild(txt);
  if (action) {
    const btn = document.createElement("button");
    btn.className = "banner-action"; btn.type = "button"; btn.textContent = action.label;
    btn.addEventListener("click", action.onClick);
    div.appendChild(btn);
  }
  if (dismiss) {
    const x = document.createElement("button");
    x.className = "banner-dismiss"; x.type = "button"; x.setAttribute("aria-label", "Dismiss");
    x.innerHTML = "×"; x.addEventListener("click", dismiss);
    div.appendChild(x);
  }
  els.banners.appendChild(div);
}

// ---------- visibility (symmetric privacy) ----------

function viewerCanSeeNames() {
  // Only viewers who themselves disclose see attributions of others.
  // Symmetric privacy: opt-in to show your name = opt-in to see others' names.
  const me = state.users.find((u) => u.id === state.me?.userId);
  return me?.disclose === true;
}
function disclosedUsers() {
  if (!viewerCanSeeNames()) return [];
  return state.users.filter((u) => u.disclose === true);
}
function isDisclosed(uid) {
  if (!viewerCanSeeNames()) return false;
  return state.users.find((u) => u.id === uid)?.disclose === true;
}
function userAvatarId(uid) { return state.users.find((u) => u.id === uid)?.avatarId || "p1"; }

// ---------- side nav ----------

function svgClock() {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';
}

function renderNav() {
  els.navFilters.innerHTML = "";

  const timelineBtn = document.createElement("button");
  timelineBtn.className = "nav-item" + (state.filter === "all" ? " active" : "");
  timelineBtn.type = "button";
  timelineBtn.innerHTML =
    '<span class="nav-icon">' + svgClock() + "</span>" +
    '<span class="nav-label">タイムライン</span>';
  timelineBtn.addEventListener("click", () => setFilter("all"));
  els.navFilters.appendChild(timelineBtn);

  for (const u of disclosedUsers()) {
    const btn = document.createElement("button");
    btn.className = "nav-item" + (state.filter === u.id ? " active" : "");
    btn.type = "button";
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    const av = document.createElement("span");
    av.className = "avatar-img";
    av.innerHTML = avatarSvg(u.avatarId || "p1");
    icon.appendChild(av);
    btn.appendChild(icon);
    const lbl = document.createElement("span");
    lbl.className = "nav-label";
    lbl.textContent = u.name;
    btn.appendChild(lbl);

    if (userHasNewLikes(u.id)) {
      const hat = document.createElement("span");
      hat.className = "new-hat";
      hat.setAttribute("aria-label", "新着あり");
      hat.innerHTML = birthdayHatSvg();
      btn.appendChild(hat);
    }

    btn.addEventListener("click", () => {
      markSeenNewLikes(u.id);
      setFilter(u.id);
    });
    els.navFilters.appendChild(btn);
  }
}

function birthdayHatSvg() {
  return (
    '<svg viewBox="0 0 24 24" fill="none">' +
    // hat triangle
    '<path d="M12 3 L19 19 L5 19 Z" fill="#FFD43B" stroke="#F59E0B" stroke-width="0.8" stroke-linejoin="round"/>' +
    // band
    '<path d="M5 19 L19 19" stroke="#F87171" stroke-width="2.2" stroke-linecap="round"/>' +
    // top pom
    '<circle cx="12" cy="3" r="1.6" fill="#F87171" stroke="#fff" stroke-width="0.4"/>' +
    // small dots
    '<circle cx="9" cy="13" r="0.7" fill="#fff"/>' +
    '<circle cx="14" cy="10" r="0.7" fill="#fff"/>' +
    '</svg>'
  );
}

function setFilter(id) {
  state.filter = id;
  state.selectedIndex = -1;
  const cb = document.getElementById("channelsBtn");
  if (cb) cb.classList.toggle("active", typeof id === "string" && id.startsWith("channel:"));
  renderNav();
  renderResurface();
  renderGrid();
  renderStatus();
  updateMobileActiveTab();
}

// ---------- sort ----------

// Cycle order: popular → latest → recent → popular ...
const SORT_MODES = ["popular", "latest", "recent"];
const SORT_LABELS = {
  recent: "最近見た",
  latest: "新着順",
  popular: "人気順",
};
const SORT_ICONS = {
  recent:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 12a9 9 0 1 0 3-6.7"/>' +
    '<path d="M3 4v5h5"/>' +
    '<path d="M12 8v4l3 2"/></svg>',
  latest:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v18"/><path d="M5 10l7-7 7 7"/></svg>',
  popular:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.07a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.79 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
};

function shuffleVideos() {
  const ids = state.videos.map((v) => v.videoId);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.randomOrder = ids;
}

function toggleSort() {
  const idx = Math.max(0, SORT_MODES.indexOf(state.sort));
  state.sort = SORT_MODES[(idx + 1) % SORT_MODES.length];
  els.sortLabel.textContent = SORT_LABELS[state.sort];
  state.selectedIndex = -1;
  renderGrid();
  renderStatus();
  updateSortIcon();
  if (els.moreSortAux) els.moreSortAux.textContent = SORT_LABELS[state.sort];
}

function updateSortIcon() {
  const wrap = els.sortBtn?.querySelector(".nav-icon");
  if (wrap) wrap.innerHTML = SORT_ICONS[state.sort] || SORT_ICONS.latest;
  if (els.sortLabel) els.sortLabel.textContent = SORT_LABELS[state.sort];
}

// ---------- Recent click tracking (for "最近見た" sort) ----------

const RECENT_CLICKS_KEY = "fls_clicks_v1";
function loadRecentClicks() {
  try { state.recentClicks = JSON.parse(localStorage.getItem(RECENT_CLICKS_KEY) || "{}"); }
  catch { state.recentClicks = {}; }
}
function recordClick(videoId) {
  if (!videoId) return;
  state.recentClicks[videoId] = Date.now();
  try { localStorage.setItem(RECENT_CLICKS_KEY, JSON.stringify(state.recentClicks)); } catch {}
}

// ---------- New like badge tracking ----------

const SEEN_NEW_LIKES_KEY = "fls_seen_new_v1";
function loadSeenNewLikes() {
  try { state.newLikesSeen = JSON.parse(localStorage.getItem(SEEN_NEW_LIKES_KEY) || "{}"); }
  catch { state.newLikesSeen = {}; }
}
function markSeenNewLikes(userId) {
  state.newLikesSeen[userId] = Date.now();
  try { localStorage.setItem(SEEN_NEW_LIKES_KEY, JSON.stringify(state.newLikesSeen)); } catch {}
}
function userHasNewLikes(userId) {
  const lastSeen = state.newLikesSeen[userId] || 0;
  // Anything liked in the last 36h that user hasn't acknowledged
  const cutoff = Date.now() - 36 * 3600 * 1000;
  for (const v of state.videos) {
    if (!(v.likedBy || []).includes(userId)) continue;
    const t = new Date(v.likedAt || 0).getTime();
    if (Number.isNaN(t)) continue;
    if (t > Math.max(lastSeen, cutoff)) return true;
  }
  return false;
}

// ---------- grid ----------

function filtered() {
  let list = state.videos;
  if (state.filter === "all") {
    // no-op
  } else if (state.filter.startsWith("channel:")) {
    const ch = state.filter.slice("channel:".length);
    list = list.filter((v) => (v.channel || "") === ch);
  } else {
    list = list.filter((v) => (v.likedBy || []).includes(state.filter));
  }
  if (state.minorOnly) {
    list = list.filter((v) => {
      const c = +v.viewCount;
      return Number.isFinite(c) && c < 100000;
    });
  }
  if (state.search) {
    list = list.filter((v) => searchMatch(state.search, v));
  }
  return list;
}

/** Substring + character-order fuzzy match across title and channel. */
function searchMatch(query, video) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = (
    (video.title || "") + " " +
    (video.channel || "")
  ).toLowerCase();
  if (hay.includes(q)) return true;
  // Fuzzy: each char of query appears in order in haystack
  let i = 0;
  for (const ch of q) {
    const f = hay.indexOf(ch, i);
    if (f < 0) return false;
    i = f + 1;
  }
  return true;
}

function sorted(list) {
  const arr = list.slice();
  if (state.sort === "popular") {
    arr.sort((a, b) => {
      const d = (b.likedBy || []).length - (a.likedBy || []).length;
      if (d !== 0) return d;
      return (b.likedAt || "").localeCompare(a.likedAt || "");
    });
  } else if (state.sort === "recent") {
    // Sort by click recency. When tied (e.g. both never clicked), fall back
    // to the per-session random order so the initial view feels fresh.
    if (!state.randomOrder || state.randomOrder.length !== state.videos.length) {
      shuffleVideos();
    }
    const randIdx = new Map(state.randomOrder.map((id, i) => [id, i]));
    arr.sort((a, b) => {
      const ca = state.recentClicks[a.videoId] || 0;
      const cb = state.recentClicks[b.videoId] || 0;
      if (ca !== cb) return cb - ca;
      return (randIdx.get(a.videoId) ?? 1e9) - (randIdx.get(b.videoId) ?? 1e9);
    });
  } else {
    arr.sort((a, b) => (b.likedAt || "").localeCompare(a.likedAt || ""));
  }
  return arr;
}

function currentList() { return sorted(filtered()); }

function renderGrid() {
  const list = currentList();
  els.grid.innerHTML = "";
  els.empty.classList.toggle("hidden", list.length > 0);
  if (list.length === 0) {
    els.empty.textContent = state.search
      ? `「${state.search}」に一致する動画はありません`
      : (state.filter !== "all"
          ? `${displayName(state.filter)} さんはまだ動画をいいねしていません`
          : "まだ動画がありません — 明日また覗いてみて。");
    return;
  }

  list.forEach((v, i) => {
    const card = document.createElement("a");
    card.className = "app-card";
    card.href = v.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.dataset.idx = String(i);
    card.dataset.title = v.title || "";
    card.style.setProperty("--card-i", Math.min(i, 16));

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (v.thumbnail) {
      const img = document.createElement("img");
      img.src = v.thumbnail; img.loading = "lazy"; img.alt = "";
      thumb.appendChild(img);
    }
    const dur = parseDuration(v.duration);
    if (dur) {
      const badge = document.createElement("span");
      badge.className = "duration-badge";
      badge.textContent = dur;
      thumb.appendChild(badge);
    }

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = v.title || "(untitled)";

    const info = document.createElement("div");
    info.className = "card-info";
    if (v.channel) {
      const ch = document.createElement("span");
      ch.className = "channel";
      ch.textContent = v.channel;
      info.appendChild(ch);
    }
    const views = formatViews(v.viewCount);
    if (views) {
      if (info.children.length > 0) info.appendChild(makeDot());
      const vw = document.createElement("span");
      vw.textContent = views;
      info.appendChild(vw);
    }
    const ago = videoAgo(v.publishedAt);
    if (ago) {
      if (info.children.length > 0) info.appendChild(makeDot());
      const ag = document.createElement("span");
      ag.textContent = ago;
      info.appendChild(ag);
    }

    const visibleLikers = (v.likedBy || []).filter(isDisclosed);
    const liked = document.createElement("div");
    liked.className = "likedby";
    for (const uid of visibleLikers.slice(0, 3)) {
      const pill = document.createElement("span");
      pill.className = "user-pill";
      pill.style.setProperty("--c", userColor(uid));
      const av = document.createElement("span");
      av.className = "user-pill-avatar";
      av.innerHTML = avatarSvg(userAvatarId(uid));
      pill.appendChild(av);
      const txt = document.createElement("span");
      txt.textContent = displayName(uid);
      pill.appendChild(txt);
      pill.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        setFilter(uid);
      });
      liked.appendChild(pill);
    }
    if (visibleLikers.length > 3) {
      const more = document.createElement("span");
      more.className = "user-pill";
      more.style.setProperty("--c", "#888");
      more.textContent = `+${visibleLikers.length - 3}`;
      liked.appendChild(more);
    }

    // Unified reactions row — single + button + avatar stamps on every viewport
    const reactionsRow = renderReactionsMobile(v.videoId);

    card.appendChild(thumb);
    card.appendChild(title);
    if (info.children.length > 0) card.appendChild(info);
    if (visibleLikers.length > 0) card.appendChild(liked);
    card.appendChild(reactionsRow);

    card.addEventListener("focus", () => { selectCard(i, false); markSeen(v.videoId); });
    card.addEventListener("click", (e) => {
      e.preventDefault();
      openPlayer(v);
    });
    card.addEventListener("mouseenter", () => {
      // Mouse takes over: drop the keyboard-selected card so only one ring shows
      clearSelection();
      updateStatus(v.title || "");
    });
    card.addEventListener("mouseleave", () => renderStatus());

    els.grid.appendChild(card);
  });

  // Don't auto-select on render — only show selection when user uses keyboard.
  // If user previously had a selection (e.g. after sort change), keep it.
  if (state.selectedIndex >= 0 && state.selectedIndex < list.length) {
    selectCard(state.selectedIndex, false);
  } else {
    state.selectedIndex = -1;
  }

  // Update count display in search bar
  if (els.searchCount) {
    els.searchCount.textContent = list.length > 0 ? `${list.length}本` : "";
  }
}

function clearSelection() {
  if (state.selectedIndex < 0) return;
  els.grid.querySelectorAll(".is-selected").forEach((c) => c.classList.remove("is-selected"));
  state.selectedIndex = -1;
}

function selectCard(idx, scroll = true) {
  const cards = els.grid.querySelectorAll(".app-card");
  if (cards.length === 0) return;
  idx = Math.max(0, Math.min(idx, cards.length - 1));
  state.selectedIndex = idx;
  cards.forEach((c, i) => c.classList.toggle("is-selected", i === idx));
  const target = cards[idx];
  if (scroll && target) {
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
  if (target) updateStatus(target.dataset.title || "");
}

function computeColumnCount() {
  const cards = els.grid.querySelectorAll(".app-card");
  if (cards.length < 2) return 1;
  const firstTop = cards[0].offsetTop;
  let count = 0;
  for (const c of cards) {
    if (c.offsetTop !== firstTop) break;
    count++;
  }
  return Math.max(1, count);
}

function moveSelection(dx, dy) {
  const list = currentList();
  if (list.length === 0) return;
  const cards = els.grid.querySelectorAll(".app-card");
  // First arrow press: start at index 0 if nothing is currently selected
  const start = state.selectedIndex < 0 ? 0 : state.selectedIndex;
  let next = start;
  if (state.selectedIndex < 0) {
    next = 0;
  } else if (dx !== 0) {
    next = start + dx;
  } else if (dy !== 0) {
    const cols = computeColumnCount();
    next = start + dy * cols;
  }
  next = Math.max(0, Math.min(next, list.length - 1));
  selectCard(next, true);
  cards[next]?.focus({ preventScroll: true });
}

// ---------- status widget ----------

function defaultStatusText() {
  let filterName;
  if (state.filter === "all") filterName = "タイムライン";
  else if (state.filter.startsWith("channel:")) filterName = state.filter.slice("channel:".length);
  else filterName = displayName(state.filter);
  const sortName = SORT_LABELS[state.sort] || "新着順";
  const count = currentList().length;
  if (state.search) return `「${state.search}」 · ${count}件`;
  if (state.minorOnly) return `${filterName} · マイナー · ${count}本`;
  return `${filterName} · ${sortName} · ${count}本`;
}

function renderStatus() { updateStatus(defaultStatusText()); }
function updateStatus(text) { els.statusText.textContent = text; }

function renderUpdated() {
  if (state.videos.length > 0) {
    const newest = state.videos.map((v) => v.likedAt).filter(Boolean).sort().pop();
    if (newest) {
      const d = new Date(newest);
      els.updated.textContent = "最終更新 " + d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
}

// ---------- Video player (PC modal + mobile inline) ----------

let ytApiPromise = null;
function loadYouTubeApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") try { prev(); } catch {}
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

const playerState = {
  yt: null,
  kind: null,        // "modal" | "inline"
  video: null,
  randomMode: false,
  ccOn: false,
  rate: 1,
};

function pickRandomVideo() {
  const list = currentList();
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  let attempts = 0;
  let v;
  do {
    v = list[Math.floor(Math.random() * list.length)];
    attempts++;
  } while (playerState.video && v.videoId === playerState.video.videoId && attempts < 6);
  return v;
}

function openRandomModal() {
  const v = pickRandomVideo();
  if (!v) { showToast("動画がないよ"); return; }
  openPlayer(v, { random: true });
}

function closeRandomModal() { destroyPlayer(); }

function isMobileViewport() {
  return window.matchMedia("(max-width: 720px)").matches;
}

async function openPlayer(video, opts = {}) {
  if (!video) return;
  recordClick(video.videoId);
  markSeen(video.videoId);

  playerState.video = video;
  playerState.randomMode = !!opts.random;
  playerState.rate = 1;
  playerState.ccOn = false;

  const useInline = isMobileViewport();
  if (useInline) {
    await openInlinePlayer(video, opts);
  } else {
    await openModalPlayer(video, opts);
  }
}

async function openModalPlayer(video, opts) {
  els.rmRoot.classList.remove("hidden");
  document.documentElement.style.overflow = "hidden";

  // Meta
  els.rmTitle.textContent = video.title || "";
  els.rmChannel.textContent = video.channel || "";
  els.rmEyebrow.classList.toggle("hidden", !opts.random);
  els.rmEyebrow.textContent = opts.random ? "きょうの一本" : "";
  els.rmDice.classList.toggle("hidden", !opts.random);
  els.rmOpen.href = video.url;

  els.rmLikedby.innerHTML = "";
  const likers = (video.likedBy || []).filter(isDisclosed);
  for (const uid of likers) {
    const pill = document.createElement("span");
    pill.className = "user-pill";
    pill.style.setProperty("--c", userColor(uid));
    const av = document.createElement("span");
    av.className = "user-pill-avatar";
    av.innerHTML = avatarSvg(userAvatarId(uid));
    pill.appendChild(av);
    const t = document.createElement("span");
    t.textContent = displayName(uid);
    pill.appendChild(t);
    els.rmLikedby.appendChild(pill);
  }

  resetSpeedUI(els.rmSpeed, 1);
  els.rmCcBtn.setAttribute("aria-pressed", "false");

  await mountPlayer("modal", "rmPlayer", video.videoId);
}

async function openInlinePlayer(video, opts) {
  els.inlinePlayer.classList.remove("hidden");
  els.inlinePlayer.removeAttribute("aria-hidden");
  els.ipMeta.textContent = video.title || "";
  if (els.ipYtBtn) els.ipYtBtn.href = video.url;
  resetSpeedUI(els.ipSpeed, 1);

  await mountPlayer("inline", "ipPlayer", video.videoId);
}

async function mountPlayer(kind, divId, videoId) {
  const YT = await loadYouTubeApi();
  destroyYtInstance();
  hidePlayerError();

  const wrap = document.getElementById(divId);
  if (!wrap) return;
  wrap.innerHTML = "";
  const inner = document.createElement("div");
  inner.id = divId + "_inner";
  wrap.appendChild(inner);

  playerState.kind = kind;
  playerState.yt = new YT.Player(inner.id, {
    videoId,
    host: "https://www.youtube-nocookie.com",
    playerVars: {
      autoplay: 1,
      controls: 0,         // hide native controls (pause icon, scrubber, title bar)
      rel: 0,
      modestbranding: 1,
      cc_load_policy: 0,
      playsinline: 1,
      iv_load_policy: 3,
      fs: 1,
      disablekb: 0,
      showinfo: 0,
      origin: location.origin,
    },
    events: {
      onReady: () => {
        try { playerState.yt.setPlaybackRate(1); } catch {}
        hidePlayerError();
      },
      onError: (e) => {
        // 2: invalid id  5: HTML5 player error
        // 100: video not found  101/150: embedding disabled
        console.warn("YT player error:", e?.data);
        showPlayerError(playerState.video);
      },
    },
  });
}

function showPlayerError(video) {
  if (!video) return;
  const host =
    playerState.kind === "inline"
      ? els.inlinePlayer.querySelector(".ip-frame")
      : els.rmRoot.querySelector(".rm-frame");
  if (!host) return;
  let ov = host.querySelector(".player-error");
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "player-error";
    host.appendChild(ov);
  }
  ov.innerHTML = "";
  const msg = document.createElement("p");
  msg.className = "player-error-msg";
  msg.textContent = "この動画はサイト内では再生できません";
  const sub = document.createElement("p");
  sub.className = "player-error-sub";
  sub.textContent = "投稿者の設定で埋め込みが許可されていない動画です。";
  const btn = document.createElement("a");
  btn.className = "player-error-btn";
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.href = video.url;
  btn.textContent = "YouTubeで開く →";
  btn.addEventListener("click", (e) => {
    if (isMobileUA) {
      e.preventDefault();
      openVideoSmart(video.videoId, video.url);
    }
  });
  ov.appendChild(msg);
  ov.appendChild(sub);
  ov.appendChild(btn);
  ov.classList.remove("hidden");
}

function hidePlayerError() {
  document.querySelectorAll(".player-error").forEach((el) => el.classList.add("hidden"));
}

function destroyYtInstance() {
  if (playerState.yt) {
    try { playerState.yt.destroy(); } catch {}
    playerState.yt = null;
  }
}

function destroyPlayer() {
  destroyYtInstance();
  els.rmRoot.classList.add("hidden");
  els.inlinePlayer.classList.add("hidden");
  els.inlinePlayer.setAttribute("aria-hidden", "true");
  document.documentElement.style.overflow = "";
  playerState.video = null;
  playerState.kind = null;
}

async function changePlayerVideo(video) {
  if (!playerState.yt || !playerState.kind) return openPlayer(video, { random: playerState.randomMode });
  playerState.video = video;
  // Update meta
  if (playerState.kind === "modal") {
    els.rmTitle.textContent = video.title || "";
    els.rmChannel.textContent = video.channel || "";
    els.rmOpen.href = video.url;
    els.rmLikedby.innerHTML = "";
    const likers = (video.likedBy || []).filter(isDisclosed);
    for (const uid of likers) {
      const pill = document.createElement("span");
      pill.className = "user-pill";
      pill.style.setProperty("--c", userColor(uid));
      const av = document.createElement("span");
      av.className = "user-pill-avatar";
      av.innerHTML = avatarSvg(userAvatarId(uid));
      pill.appendChild(av);
      const t = document.createElement("span");
      t.textContent = displayName(uid);
      pill.appendChild(t);
      els.rmLikedby.appendChild(pill);
    }
  } else {
    els.ipMeta.textContent = video.title || "";
    if (els.ipYtBtn) els.ipYtBtn.href = video.url;
  }
  recordClick(video.videoId);
  try { playerState.yt.loadVideoById(video.videoId); } catch {}
}

function rerollRandom() {
  if (currentList().length === 0) return;
  const v = pickRandomVideo();
  if (!v) return;
  els.rmDice.classList.add("rolling");
  setTimeout(() => els.rmDice.classList.remove("rolling"), 600);
  els.rmContent.classList.add("swapping");
  setTimeout(() => {
    changePlayerVideo(v);
    els.rmContent.classList.remove("swapping");
  }, 180);
}

function resetSpeedUI(container, rate) {
  if (!container) return;
  container.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", parseFloat(b.dataset.rate) === rate);
  });
}

function setPlaybackRate(rate) {
  if (!playerState.yt) return;
  try { playerState.yt.setPlaybackRate(rate); } catch {}
  playerState.rate = rate;
  resetSpeedUI(els.rmSpeed, rate);
  resetSpeedUI(els.ipSpeed, rate);
}

function toggleCaptions() {
  if (!playerState.yt) return;
  try {
    if (playerState.ccOn) {
      playerState.yt.unloadModule("captions");
      playerState.ccOn = false;
    } else {
      playerState.yt.loadModule("captions");
      playerState.ccOn = true;
    }
    els.rmCcBtn.setAttribute("aria-pressed", playerState.ccOn ? "true" : "false");
  } catch (e) { console.warn("captions:", e); }
}

async function inlineFullscreen() {
  const target = els.inlinePlayer.querySelector(".ip-frame iframe") || els.inlinePlayer;
  try {
    if (target.requestFullscreen) await target.requestFullscreen();
    else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
  } catch (e) { console.warn("fullscreen:", e); }
}

// ---------- Player seek + transport controls ----------

function playerIsOpen() {
  return playerState.yt &&
    (!els.rmRoot.classList.contains("hidden") ||
     !els.inlinePlayer.classList.contains("hidden"));
}

async function seekRel(deltaSeconds) {
  if (!playerState.yt) return;
  try {
    const t = await Promise.resolve(playerState.yt.getCurrentTime());
    const target = Math.max(0, t + deltaSeconds);
    playerState.yt.seekTo(target, true);
    showSeekPulse(deltaSeconds);
  } catch (e) { console.warn("seek:", e); }
}

function togglePlayPause() {
  if (!playerState.yt) return;
  try {
    const s = playerState.yt.getPlayerState();
    // 1=playing, 2=paused, 0=ended, others=buffering/cued
    if (s === 1) playerState.yt.pauseVideo();
    else playerState.yt.playVideo();
  } catch (e) { console.warn("toggle play/pause:", e); }
}

function showSeekPulse(deltaSeconds) {
  const isInline = playerState.kind === "inline";
  const root = isInline
    ? els.inlinePlayer.querySelector(".ip-frame")
    : els.rmRoot.querySelector(".rm-frame");
  if (!root) return;
  const side = deltaSeconds < 0 ? "left" : "right";
  const pulse = root.querySelector(`.seek-pulse-${side}`);
  if (!pulse) return;
  pulse.querySelector("span").textContent =
    (deltaSeconds < 0 ? "−" : "+") + Math.abs(deltaSeconds) + "秒";
  pulse.classList.remove("hidden", "show");
  // Re-trigger animation
  void pulse.offsetWidth;
  pulse.classList.add("show");
  setTimeout(() => pulse.classList.remove("show"), 700);
}

// ---------- Touch zones (mobile double-tap seek) ----------

function bindSeekZones() {
  document.querySelectorAll(".seek-zone").forEach((zone) => {
    let lastTapTime = 0;
    let pendingTap = null;
    zone.addEventListener("click", (e) => {
      if (!playerState.yt) return;
      const now = Date.now();
      const side = zone.dataset.side;
      if (now - lastTapTime < 300) {
        // Double tap → seek
        if (pendingTap) { clearTimeout(pendingTap); pendingTap = null; }
        e.preventDefault();
        seekRel(side === "left" ? -10 : +10);
        lastTapTime = 0;
      } else {
        lastTapTime = now;
        // Single tap with delay → toggle play/pause
        if (pendingTap) clearTimeout(pendingTap);
        pendingTap = setTimeout(() => {
          togglePlayPause();
          pendingTap = null;
        }, 300);
      }
    });
  });
}

// ---------- toast ----------

let toastTimer = null;
function showToast(text) {
  els.toastText.textContent = text;
  els.toast.classList.remove("hidden");
  requestAnimationFrame(() => els.toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
    setTimeout(() => els.toast.classList.add("hidden"), 280);
  }, 3200);
}

// ---------- handlers ----------

function bindStaticHandlers() {
  // Modal
  els.modalAction.addEventListener("click", () => modalCfg?.onAction?.());
  els.modalSkip.addEventListener("click", () => { if (modalCfg?.skip) closeModal(); });
  els.modalBackdrop.addEventListener("click", () => { if (modalCfg && modalCfg.skip) closeModal(); });
  els.changeAvatarBtn.addEventListener("click", () => openAvatarPickerModal({ blocking: false }));

  // Passcode gate
  if (els.gateBtn) els.gateBtn.addEventListener("click", tryPassword);
  if (els.gateInput) els.gateInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); tryPassword(); }
  });

  // Video player modal (PC) — speed / captions / random reroll / close
  els.rmCloseBtn.addEventListener("click", destroyPlayer);
  els.rmBackdrop.addEventListener("click", destroyPlayer);
  els.rmDice.addEventListener("click", rerollRandom);
  if (els.rmSpeed) {
    els.rmSpeed.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-rate]");
      if (!btn) return;
      setPlaybackRate(parseFloat(btn.dataset.rate));
    });
  }
  if (els.rmCcBtn) els.rmCcBtn.addEventListener("click", toggleCaptions);
  if (els.rmOpen) els.rmOpen.addEventListener("click", (e) => {
    if (isMobileUA && playerState.video) {
      e.preventDefault();
      openVideoSmart(playerState.video.videoId, playerState.video.url);
    }
  });

  // Inline player (mobile) — speed / fullscreen / close
  if (els.ipSpeed) {
    els.ipSpeed.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-rate]");
      if (!btn) return;
      setPlaybackRate(parseFloat(btn.dataset.rate));
    });
  }
  if (els.ipFsBtn) els.ipFsBtn.addEventListener("click", inlineFullscreen);
  if (els.ipYtBtn) els.ipYtBtn.addEventListener("click", (e) => {
    if (isMobileUA && playerState.video) {
      e.preventDefault();
      openVideoSmart(playerState.video.videoId, playerState.video.url);
    }
  });
  if (els.ipCloseBtn) els.ipCloseBtn.addEventListener("click", destroyPlayer);

  // Mobile double-tap seek + single-tap play/pause overlays
  bindSeekZones();

  // Mobile bottom nav
  if (els.mobTimelineBtn) els.mobTimelineBtn.addEventListener("click", () => {
    setFilter("all");
    els.grid?.scrollTo({ top: 0, behavior: "smooth" });
  });
  if (els.mobFilterBtn) els.mobFilterBtn.addEventListener("click", openFilterSheet);
  if (els.mobDiceBtn)   els.mobDiceBtn.addEventListener("click", openRandomModal);
  if (els.mobMoreBtn)   els.mobMoreBtn.addEventListener("click", openMoreSheet);

  // Search
  if (els.searchInput) {
    const onSearch = debounce(() => {
      state.search = els.searchInput.value || "";
      state.selectedIndex = -1;
      els.searchClearBtn?.classList.toggle("hidden", !state.search);
      renderGrid();
      renderStatus();
    }, 120);
    els.searchInput.addEventListener("input", onSearch);
    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        els.searchInput.value = "";
        state.search = "";
        els.searchClearBtn?.classList.add("hidden");
        renderGrid();
        renderStatus();
        els.searchInput.blur();
      }
    });
  }
  if (els.searchClearBtn) els.searchClearBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    state.search = "";
    els.searchClearBtn.classList.add("hidden");
    renderGrid();
    renderStatus();
    els.searchInput.focus();
  });

  // Filter sheet
  if (els.filterSheetBackdrop) els.filterSheetBackdrop.addEventListener("click", closeFilterSheet);

  // More sheet
  if (els.moreSheetBackdrop) els.moreSheetBackdrop.addEventListener("click", closeMoreSheet);
  if (els.moreSortBtn) els.moreSortBtn.addEventListener("click", () => {
    toggleSort();
    refreshMoreSheet();
  });
  if (els.moreThemeBtn) els.moreThemeBtn.addEventListener("click", () => {
    toggleTheme();
    refreshMoreSheet();
  });
  if (els.morePushBtn) els.morePushBtn.addEventListener("click", async () => {
    await togglePush();
    refreshMoreSheet();
  });

  // Brand mark — full reset to home (close player, sheets, modals; clear filters)
  if (els.brandMark) els.brandMark.addEventListener("click", (e) => {
    e.preventDefault();
    destroyPlayer();
    closeFilterSheet();
    closeMoreSheet();
    closeChannelSheet();
    closeModal();
    state.search = "";
    if (els.searchInput) els.searchInput.value = "";
    els.searchClearBtn?.classList.add("hidden");
    state.minorOnly = false;
    const t = document.getElementById("minorToggle");
    if (t) t.setAttribute("aria-checked", "false");
    setFilter("all");
    els.grid?.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Sidenav buttons
  els.themeBtn.addEventListener("click", toggleTheme);
  els.accountBtn.addEventListener("click", openAccountModal);
  els.diceBtn.addEventListener("click", openRandomModal);
  els.sortBtn.addEventListener("click", toggleSort);
  els.discloseToggle.addEventListener("click", toggleDisclose);
  const channelsBtn = document.getElementById("channelsBtn");
  if (channelsBtn) channelsBtn.addEventListener("click", openChannelSheet);
  const channelBackdrop = document.getElementById("channelSheetBackdrop");
  if (channelBackdrop) channelBackdrop.addEventListener("click", closeChannelSheet);
  const minorRowBtn = document.getElementById("minorRowBtn");
  if (minorRowBtn) minorRowBtn.addEventListener("click", toggleMinorOnly);
  const channelSearchInput = document.getElementById("channelSearchInput");
  if (channelSearchInput) {
    const onSearch = debounce(renderChannelSheet, 80);
    channelSearchInput.addEventListener("input", onSearch);
    channelSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        channelSearchInput.value = "";
        renderChannelSheet();
      }
    });
  }
  if (els.pushBtn) els.pushBtn.addEventListener("click", togglePush);

  // Name editor
  els.nameSaveBtn.addEventListener("click", saveName);
  els.nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveName(); }
  });
  els.nameInput.addEventListener("input", () => {
    const len = [...els.nameInput.value].length;
    if (len > 4) els.nameInput.value = [...els.nameInput.value].slice(0, 4).join("");
  });

  // Sort buttons (legacy class-based, keeping for safety)
  document.querySelectorAll(".sort button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sort button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.sort = btn.dataset.sort;
      renderGrid();
    });
  });

  // Global keyboard
  document.addEventListener("keydown", (e) => {
    // Sheets Esc
    if (e.key === "Escape" && !els.filterSheetRoot.classList.contains("hidden")) {
      e.preventDefault(); closeFilterSheet(); return;
    }
    if (e.key === "Escape" && !els.moreSheetRoot.classList.contains("hidden")) {
      e.preventDefault(); closeMoreSheet(); return;
    }
    const channelRoot = document.getElementById("channelSheetRoot");
    if (e.key === "Escape" && channelRoot && !channelRoot.classList.contains("hidden")) {
      e.preventDefault(); closeChannelSheet(); return;
    }
    // Player (modal or inline) keyboard transport — YouTube-style J / K / L
    if (playerIsOpen() && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      if (e.key === "Escape") { e.preventDefault(); destroyPlayer(); return; }
      if (e.key === "l" || e.key === "L") { e.preventDefault(); seekRel(+10); return; }
      if (e.key === "j" || e.key === "J") { e.preventDefault(); seekRel(-10); return; }
      if (e.key === "k" || e.key === "K") { e.preventDefault(); togglePlayPause(); return; }
      if (e.key === " ")                  { e.preventDefault(); togglePlayPause(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); seekRel(+5); return; }
      if (e.key === "ArrowLeft")  { e.preventDefault(); seekRel(-5); return; }
    }
    // Main modal Esc
    if (e.key === "Escape" && modalCfg?.skip) { closeModal(); return; }

    // Skip if a modal is open or a text input is focused
    if (!els.modalRoot.classList.contains("hidden")) return;
    if (!els.rmRoot.classList.contains("hidden")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(1, 0); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveSelection(-1, 0); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(0, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(0, -1); }
    else if (e.key === "l" || e.key === "L") { openRandomModal(); }
    else if (e.key === "s" || e.key === "S") { toggleSort(); }
    else if (e.key === "t" || e.key === "T") { toggleTheme(); }
    else if (e.key === "/") {
      e.preventDefault();
      els.searchInput?.focus();
      els.searchInput?.select();
    }
  });
}

// ---------- helpers ----------

async function loadJson(path) {
  const r = await fetch(path + "?t=" + Date.now(), { cache: "no-cache" });
  if (!r.ok) throw new Error("failed " + path);
  return r.json();
}
function displayName(id) { return state.users.find((u) => u.id === id)?.name || id; }
const USER_COLORS = [
  "#FF4757", "#FF8A3D", "#22C55E", "#3B82F6",
  "#A855F7", "#EC4899", "#06B6D4", "#F59E0B",
  "#10B981", "#F472B6",
];
function userColor(id) {
  const idx = state.users.findIndex((u) => u.id === id);
  if (idx < 0) return "#888";
  return USER_COLORS[idx % USER_COLORS.length];
}
function daysUntilExpiry(issuedAtIso) {
  if (!issuedAtIso) return null;
  const issued = new Date(issuedAtIso).getTime();
  if (Number.isNaN(issued)) return null;
  return (TOKEN_LIFETIME_DAYS * 86400000 - (Date.now() - issued)) / 86400000;
}
function formatDuration(days) {
  if (days < 1) {
    const h = Math.max(0, Math.round(days * 24));
    return `${h}時間`;
  }
  return `${Math.round(days)}日`;
}
function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const isAndroid = /Android/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isMobileUA = isAndroid || isIOS;

/**
 * Try to open the YouTube native app, falling back to the web URL.
 * Called from a click handler — `e.preventDefault()` first.
 */
function openVideoSmart(videoId, webUrl) {
  if (isAndroid) {
    // Android intent URL — opens app or falls back to browser URL
    const intent =
      `intent://watch?v=${videoId}#Intent;` +
      `package=com.google.android.youtube;` +
      `scheme=https;` +
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    window.location.href = intent;
    return;
  }
  if (isIOS) {
    // youtube:// scheme is registered by the YouTube iOS app
    const appUrl = `youtube://www.youtube.com/watch?v=${videoId}`;
    let opened = false;
    const onHide = () => { if (document.hidden) opened = true; };
    document.addEventListener("visibilitychange", onHide, { once: true });
    window.location.href = appUrl;
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!opened) window.open(webUrl, "_blank", "noopener,noreferrer");
    }, 1200);
    return;
  }
  // Desktop / unknown UA → standard new-tab open
  window.open(webUrl, "_blank", "noopener,noreferrer");
}

function parseDuration(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return "";
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(min)}:${pad(s)}`;
  return `${min}:${pad(s)}`;
}

function formatViews(n) {
  if (n == null) return "";
  n = +n;
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 10000) return `${n.toLocaleString("ja-JP")}回`;
  if (n < 100000000) {
    const v = n / 10000;
    const text = v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, "");
    return `${text}万回`;
  }
  const oku = n / 100000000;
  const text = oku >= 10 ? Math.round(oku).toString() : oku.toFixed(1).replace(/\.0$/, "");
  return `${text}億回`;
}

function videoAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const ms = Date.now() - t;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨日";
  if (d < 7) return `${d}日前`;
  if (d < 30) return `${Math.floor(d / 7)}週間前`;
  if (d < 365) return `${Math.floor(d / 30)}か月前`;
  return `${Math.floor(d / 365)}年前`;
}

function makeDot() {
  const s = document.createElement("span");
  s.className = "dot";
  s.textContent = "·";
  return s;
}

// ---------- Passcode gate ----------

function isPassed() {
  try { return localStorage.getItem(PASS_KEY) === "1"; } catch { return false; }
}

function showGate() {
  els.gate.classList.remove("hidden");
  setTimeout(() => els.gateInput.focus(), 60);
}

function hideGate() {
  els.gate.classList.add("fade-out");
  setTimeout(() => els.gate.classList.add("hidden"), 380);
}

async function tryPassword() {
  const v = (els.gateInput.value || "").trim().toLowerCase();
  if (PASSCODES.includes(v)) {
    try { localStorage.setItem(PASS_KEY, "1"); } catch {}
    hideGate();
    setTimeout(bootApp, 240);
  } else {
    els.gateInput.classList.remove("shake");
    void els.gateInput.offsetWidth; // restart animation
    els.gateInput.classList.add("shake");
    els.gateInput.value = "";
    els.gateInput.focus();
  }
}

// ---------- Channel sheet ----------

function openChannelSheet() {
  const searchInput = document.getElementById("channelSearchInput");
  if (searchInput) searchInput.value = "";
  renderChannelSheet();
  const root = document.getElementById("channelSheetRoot");
  root.classList.remove("hidden");
}
function closeChannelSheet() {
  document.getElementById("channelSheetRoot").classList.add("hidden");
}

function renderChannelSheet() {
  const sorted = aggregateChannels();
  const searchInput = document.getElementById("channelSearchInput");
  const query = (searchInput?.value || "").trim().toLowerCase();
  const filtered = query
    ? sorted.filter(([name]) => name.toLowerCase().includes(query))
    : sorted;

  const container = document.getElementById("channelSheetOptions");
  container.innerHTML = "";

  // "すべて" reset row
  const all = document.createElement("button");
  all.type = "button";
  all.className = "sheet-option" + (state.filter === "all" ? " active" : "");
  all.innerHTML =
    '<span class="sheet-option-icon">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/></svg></span>' +
    '<span class="sheet-option-label">すべてのチャンネル</span>' +
    '<span class="sheet-option-check"><svg viewBox="0 0 24 24" width="12" height="12" ' +
    'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 12.5l4 4L19 7"/></svg></span>';
  all.addEventListener("click", () => {
    setFilter("all");
    closeChannelSheet();
  });
  container.appendChild(all);

  for (const [name, count] of filtered) {
    const filterId = "channel:" + name;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "sheet-option" + (state.filter === filterId ? " active" : "");

    const icon = document.createElement("span");
    icon.className = "sheet-option-icon";
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="6" width="18" height="13" rx="2"/>' +
      '<path d="M8 3l4 3 4-3"/></svg>';
    row.appendChild(icon);

    const lbl = document.createElement("span");
    lbl.className = "sheet-option-label";
    lbl.textContent = name;
    row.appendChild(lbl);

    const badge = document.createElement("span");
    badge.className = "sheet-row-aux";
    badge.textContent = count + "本";
    row.appendChild(badge);

    const check = document.createElement("span");
    check.className = "sheet-option-check";
    check.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 12.5l4 4L19 7"/></svg>';
    row.appendChild(check);

    row.addEventListener("click", () => {
      setFilter(filterId);
      closeChannelSheet();
    });
    container.appendChild(row);
  }

  // Reflect current minor toggle state
  const t = document.getElementById("minorToggle");
  if (t) t.setAttribute("aria-checked", state.minorOnly ? "true" : "false");
}

function toggleMinorOnly() {
  state.minorOnly = !state.minorOnly;
  state.selectedIndex = -1;
  const t = document.getElementById("minorToggle");
  if (t) t.setAttribute("aria-checked", state.minorOnly ? "true" : "false");
  renderGrid();
  renderStatus();
  showToast(state.minorOnly ? "マイナー動画のみ表示" : "すべての動画を表示");
}

// ---------- Filter sheet (mobile) ----------

function openFilterSheet() {
  renderFilterSheet();
  els.filterSheetRoot.classList.remove("hidden");
}
function closeFilterSheet() {
  els.filterSheetRoot.classList.add("hidden");
}

function renderFilterSheet() {
  els.filterSheetOptions.innerHTML = "";

  // Top: minor-only toggle row (mobile-friendly access)
  const minorRow = document.createElement("button");
  minorRow.type = "button";
  minorRow.className = "toggle-row";
  minorRow.style.textAlign = "left";
  minorRow.style.marginBottom = "8px";
  minorRow.innerHTML =
    '<div>' +
      '<div class="toggle-label">マイナーな動画のみ</div>' +
      '<div class="toggle-hint">再生回数 10万未満の動画だけ</div>' +
    '</div>' +
    '<span class="toggle" role="switch" aria-checked="' + (state.minorOnly ? "true" : "false") + '">' +
      '<span class="toggle-thumb"></span>' +
    '</span>';
  minorRow.addEventListener("click", () => {
    toggleMinorOnly();
    const t = minorRow.querySelector(".toggle");
    if (t) t.setAttribute("aria-checked", state.minorOnly ? "true" : "false");
  });
  els.filterSheetOptions.appendChild(minorRow);

  // Section: ユーザー
  appendSheetHeader(els.filterSheetOptions, "ユーザー");

  const timelineOpt = makeSheetOption({
    id: "all",
    label: "タイムライン",
    icon:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  });
  els.filterSheetOptions.appendChild(timelineOpt);

  for (const u of disclosedUsers()) {
    const opt = makeSheetOption({
      id: u.id,
      label: u.name,
      avatarId: u.avatarId || "p1",
    });
    els.filterSheetOptions.appendChild(opt);
  }

  // Section: チャンネル別 (top 5 + "all" link to dedicated sheet with search)
  const channelEntries = aggregateChannels();
  if (channelEntries.length > 0) {
    appendSheetHeader(els.filterSheetOptions, `チャンネル別 (${channelEntries.length})`);
    const showInline = Math.min(5, channelEntries.length);
    for (const [name, count] of channelEntries.slice(0, showInline)) {
      const opt = makeSheetOption({
        id: "channel:" + name,
        label: name,
        aux: count + "本",
        icon:
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
          'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="3" y="6" width="18" height="13" rx="2"/>' +
          '<path d="M8 3l4 3 4-3"/></svg>',
      });
      els.filterSheetOptions.appendChild(opt);
    }
    if (channelEntries.length > showInline) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "sheet-option sheet-option-more";
      more.innerHTML =
        '<span class="sheet-option-icon">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9l3 3-3 3"/></svg></span>' +
        '<span class="sheet-option-label">すべてのチャンネルを見る</span>' +
        '<span class="sheet-row-aux">' + channelEntries.length + '</span>';
      more.addEventListener("click", () => {
        closeFilterSheet();
        setTimeout(openChannelSheet, 200);
      });
      els.filterSheetOptions.appendChild(more);
    }
  }
}

function aggregateChannels() {
  const counts = new Map();
  for (const v of state.videos) {
    const ch = v.channel;
    if (!ch) continue;
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  return Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")
  );
}

function appendSheetHeader(container, text) {
  const h = document.createElement("div");
  h.className = "sheet-section-header";
  h.textContent = text;
  container.appendChild(h);
}

function makeSheetOption({ id, label, icon, avatarId, aux }) {
  const opt = document.createElement("button");
  opt.type = "button";
  opt.className = "sheet-option" + (state.filter === id ? " active" : "");

  if (avatarId) {
    const av = document.createElement("span");
    av.className = "sheet-option-avatar";
    av.innerHTML = avatarSvg(avatarId);
    opt.appendChild(av);
  } else if (icon) {
    const ic = document.createElement("span");
    ic.className = "sheet-option-icon";
    ic.innerHTML = icon;
    opt.appendChild(ic);
  }

  const lbl = document.createElement("span");
  lbl.className = "sheet-option-label";
  lbl.textContent = label;
  opt.appendChild(lbl);

  if (aux) {
    const a = document.createElement("span");
    a.className = "sheet-row-aux";
    a.textContent = aux;
    opt.appendChild(a);
  }

  const check = document.createElement("span");
  check.className = "sheet-option-check";
  check.innerHTML =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 12.5l4 4L19 7"/></svg>';
  opt.appendChild(check);

  opt.addEventListener("click", () => {
    setFilter(id);
    closeFilterSheet();
    updateMobileActiveTab();
  });
  return opt;
}

// ---------- More sheet (mobile) ----------

function openMoreSheet() {
  refreshMoreSheet();
  els.moreSheetRoot.classList.remove("hidden");
}
function closeMoreSheet() {
  els.moreSheetRoot.classList.add("hidden");
}
function refreshMoreSheet() {
  els.moreSortAux.textContent = SORT_LABELS[state.sort] || "新着順";
  els.moreThemeAux.textContent = document.documentElement.dataset.theme === "dark" ? "ダーク" : "ライト";
  if (els.morePushBtn) {
    if (!("Notification" in window) || !("PushManager" in window) || !state.config?.vapidPublicKey || isLocalDev() || !state.me?.signedIn) {
      els.morePushBtn.classList.add("hidden");
    } else {
      els.morePushBtn.classList.remove("hidden");
      els.morePushAux.textContent = state.pushSubscribed ? "オン" : "オフ";
    }
  }
}

// ---------- Mobile bottom nav ----------

function updateMobileActiveTab() {
  if (!els.mobTimelineBtn) return;
  // "active" indicates which tab is current
  els.mobTimelineBtn.classList.toggle("active",
    state.filter === "all" && els.filterSheetRoot.classList.contains("hidden") &&
    els.moreSheetRoot.classList.contains("hidden") && els.rmRoot.classList.contains("hidden"));
  els.mobFilterBtn.classList.toggle("active", state.filter !== "all");
}

// ---------- Reactions ----------

// (Legacy 6-emoji reaction row removed — the unified mobile-style row is used everywhere.)

async function toggleReaction(videoId, code, on) {
  if (!state.me?.userId) { showToast("サインインが必要です"); return; }
  const userId = state.me.userId;

  // Optimistic update
  if (!state.reactions[videoId]) state.reactions[videoId] = {};
  if (!state.reactions[videoId][code]) state.reactions[videoId][code] = [];
  const arr = state.reactions[videoId][code];
  const had = arr.includes(userId);
  if (on && !had) arr.push(userId);
  else if (!on && had) state.reactions[videoId][code] = arr.filter((u) => u !== userId);
  if (state.reactions[videoId][code].length === 0) delete state.reactions[videoId][code];
  if (Object.keys(state.reactions[videoId]).length === 0) delete state.reactions[videoId];

  refreshReactionsRow(videoId);

  if (isLocalDev()) return;

  try {
    const r = await fetch(`${state.config.workerOrigin}/me/react`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, emoji: code, on }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
  } catch (e) {
    showToast("反映に失敗: " + e.message);
    // Revert
    if (!state.reactions[videoId]) state.reactions[videoId] = {};
    if (!state.reactions[videoId][code]) state.reactions[videoId][code] = [];
    const arr2 = state.reactions[videoId][code];
    if (on) state.reactions[videoId][code] = arr2.filter((u) => u !== userId);
    else if (!arr2.includes(userId)) arr2.push(userId);
    refreshReactionsRow(videoId);
  }
}

function refreshReactionsRow(videoId) {
  const old = els.grid.querySelector(
    `.reactions-mobile[data-video-id="${CSS.escape(videoId)}"]`
  );
  if (old) old.replaceWith(renderReactionsMobile(videoId));
}

/**
 * Mobile reactions: single + button, avatars of users who left any reaction.
 * Tapping + toggles a default reaction ("spark") for the current user.
 */
function renderReactionsMobile(videoId) {
  const wrap = document.createElement("div");
  wrap.className = "reactions-mobile";
  wrap.dataset.videoId = videoId;

  const reactionsByEmoji = state.reactions[videoId] || {};
  // Collect unique users who reacted with any emoji
  const reactors = new Set();
  for (const code of Object.keys(reactionsByEmoji)) {
    for (const uid of reactionsByEmoji[code]) reactors.add(uid);
  }
  const myId = state.me?.userId;
  const iReacted = !!myId && reactors.has(myId);

  if (reactors.size > 0) {
    const stamps = document.createElement("div");
    stamps.className = "stamps";
    // Show up to 4 stamps, with current user first if applicable
    const ordered = Array.from(reactors).sort((a, b) => {
      if (a === myId) return -1;
      if (b === myId) return 1;
      return 0;
    });
    for (const uid of ordered.slice(0, 4)) {
      const stamp = document.createElement("span");
      stamp.className = "stamp";
      stamp.title = displayName(uid);
      stamp.innerHTML = avatarSvg(userAvatarId(uid));
      stamps.appendChild(stamp);
    }
    wrap.appendChild(stamps);
  }

  const add = document.createElement("button");
  add.type = "button";
  add.className = "add" + (iReacted ? " mine" : "");
  add.setAttribute("aria-label", iReacted ? "リアクションを取り消す" : "リアクションを追加");
  add.textContent = iReacted ? "✓" : "+";
  add.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    toggleReaction(videoId, "spark", !iReacted);
  });
  wrap.appendChild(add);

  return wrap;
}

// ---------- "Today's hidden gem" (resurface) ----------

function loadSeen() {
  try {
    const arr = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    state.seen = new Set(arr);
  } catch { state.seen = new Set(); }
}
function saveSeen() {
  try {
    // Cap at 1000 most recent to bound storage
    const arr = Array.from(state.seen).slice(-1000);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}
function markSeen(videoId) {
  if (!videoId || state.seen.has(videoId)) return;
  state.seen.add(videoId);
  saveSeen();
  // Hide the resurface widget if user just opened today's pick
  if (state.todayResurface?.videoId === videoId) {
    state.todayResurface = null;
    renderResurface();
  }
}

function pickTodayResurface() {
  // One pick per day, deterministic per-day cache in localStorage
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(RESURFACE_KEY) || "null"); } catch {}
  const today = new Date().toISOString().slice(0, 10);

  if (cache && cache.date === today) {
    const found = state.videos.find((v) => v.videoId === cache.videoId);
    // Only show if still unseen
    if (found && !state.seen.has(found.videoId)) {
      state.todayResurface = found;
      return;
    }
  }

  const cutoff = Date.now() - RESURFACE_MIN_AGE_DAYS * 86400000;
  const candidates = state.videos.filter((v) => {
    if (state.seen.has(v.videoId)) return false;
    const t = new Date(v.likedAt || 0).getTime();
    if (Number.isNaN(t) || t > cutoff) return false;
    return (v.likedBy || []).some(isDisclosed);
  });
  if (candidates.length === 0) {
    state.todayResurface = null;
    return;
  }
  // Pick deterministically based on the date so everyone sees the same pick
  const seed = today.replace(/-/g, "");
  const idx = Math.abs(parseInt(seed, 10)) % candidates.length;
  const pick = candidates[idx];
  state.todayResurface = pick;
  try { localStorage.setItem(RESURFACE_KEY, JSON.stringify({ date: today, videoId: pick.videoId })); } catch {}
}

function renderResurface() {
  const v = state.todayResurface;
  if (!v || state.filter !== "all") {
    els.resurface.classList.add("hidden");
    els.resurface.innerHTML = "";
    return;
  }
  els.resurface.classList.remove("hidden");
  els.resurface.innerHTML = "";

  const link = document.createElement("a");
  link.href = v.url; link.rel = "noopener noreferrer";
  link.style.display = "contents";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    markSeen(v.videoId);
    openPlayer(v);
  });

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  if (v.thumbnail) {
    const img = document.createElement("img");
    img.src = v.thumbnail; img.alt = "";
    thumb.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "resurface-meta";

  const eyebrow = document.createElement("p");
  eyebrow.className = "resurface-eyebrow";
  eyebrow.textContent = "✨ 今日の埋もれた一本";

  const title = document.createElement("p");
  title.className = "resurface-title";
  title.textContent = v.title || "(untitled)";

  const sub = document.createElement("p");
  sub.className = "resurface-sub";
  const liker = (v.likedBy || []).filter(isDisclosed)[0];
  const ago = v.likedAt ? agoText(v.likedAt) : "";
  sub.textContent = liker
    ? `${displayName(liker)} が ${ago} に Like — まだ見てないかも`
    : "まだ見てないかも";

  meta.appendChild(eyebrow);
  meta.appendChild(title);
  meta.appendChild(sub);

  link.appendChild(thumb);
  link.appendChild(meta);
  els.resurface.appendChild(link);
}

function agoText(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}

// ---------- Push notifications ----------

let swReg = null;

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  try {
    swReg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
  } catch (e) { console.warn("SW register failed:", e); }
}

async function updatePushButton() {
  if (!els.pushBtn) return;
  if (!("Notification" in window) || !("PushManager" in window) || !state.config?.vapidPublicKey) {
    els.pushBtn.classList.add("hidden");
    return;
  }
  if (!state.me?.signedIn || isLocalDev()) {
    els.pushBtn.classList.add("hidden");
    return;
  }
  els.pushBtn.classList.remove("hidden");

  let subscribed = false;
  try {
    const sub = swReg ? await swReg.pushManager.getSubscription() : null;
    subscribed = !!sub;
  } catch {}
  state.pushSubscribed = subscribed;
  els.pushLabel.textContent = subscribed ? "通知ON" : "通知";
  els.pushBtn.classList.toggle("active", subscribed);
}

async function togglePush() {
  if (!swReg) {
    showToast("サービスワーカーが利用できません");
    return;
  }
  if (state.pushSubscribed) {
    await unsubscribePush();
  } else {
    await subscribePush();
  }
  updatePushButton();
}

async function subscribePush() {
  if (Notification.permission === "denied") {
    showToast("ブラウザ設定で通知が拒否されています");
    return;
  }
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    showToast("通知が許可されませんでした");
    return;
  }
  const vapid = state.config.vapidPublicKey;
  if (!vapid) { showToast("VAPID キーが設定されていません"); return; }

  let sub;
  try {
    sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapid),
    });
  } catch (e) {
    showToast("購読失敗: " + e.message);
    return;
  }

  try {
    const r = await fetch(`${state.config.workerOrigin}/push/subscribe`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToB64Url(sub.getKey("p256dh")),
          auth:   arrayBufferToB64Url(sub.getKey("auth")),
        },
      }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    showToast("通知をオンにしました");
  } catch (e) {
    try { await sub.unsubscribe(); } catch {}
    showToast("登録失敗: " + e.message);
  }
}

async function unsubscribePush() {
  try {
    const sub = await swReg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${state.config.workerOrigin}/push/unsubscribe`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
    showToast("通知をオフにしました");
  } catch (e) { showToast("解除失敗: " + e.message); }
}

function urlB64ToUint8Array(b64) {
  const padding = "=".repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function arrayBufferToB64Url(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- demo data (localhost only) ----------

const DEMO_VIDEOS = [
  { videoId: "jNQXAC9IVRw", title: "Me at the zoo", channel: "jawed",
    thumbnail: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    duration: "PT19S", viewCount: 365000000, publishedAt: "2005-04-23T00:00:00Z",
    likedBy: ["riki"], likedAt: "2026-05-07T08:30:00Z" },
  { videoId: "_OBlgSz8sSM", title: "Charlie bit my finger - again !", channel: "HDCYT",
    thumbnail: "https://i.ytimg.com/vi/_OBlgSz8sSM/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=_OBlgSz8sSM",
    duration: "PT55S", viewCount: 893000000, publishedAt: "2007-05-22T00:00:00Z",
    likedBy: ["riki", "yuji"], likedAt: "2026-05-07T12:00:00Z" },
  { videoId: "dMH0bHeiRNg", title: "Evolution of Dance — Judson Laipply", channel: "Judson Laipply",
    thumbnail: "https://i.ytimg.com/vi/dMH0bHeiRNg/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=dMH0bHeiRNg",
    duration: "PT6M0S", viewCount: 305000000, publishedAt: "2006-04-07T00:00:00Z",
    likedBy: ["yuji"], likedAt: "2026-05-06T18:00:00Z" },
  { videoId: "txqiwrbYGrs", title: "David After Dentist", channel: "booba1234",
    thumbnail: "https://i.ytimg.com/vi/txqiwrbYGrs/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=txqiwrbYGrs",
    duration: "PT1M58S", viewCount: 144000000, publishedAt: "2009-01-30T00:00:00Z",
    likedBy: ["riki"], likedAt: "2026-05-06T10:00:00Z" },
  { videoId: "J---aiyznGQ", title: "Charlie Schmidt's Keyboard Cat! - The Original",
    channel: "Charlie Schmidt",
    thumbnail: "https://i.ytimg.com/vi/J---aiyznGQ/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=J---aiyznGQ",
    duration: "PT55S", viewCount: 75000000, publishedAt: "2009-06-07T00:00:00Z",
    likedBy: ["yuji"], likedAt: "2026-05-05T22:00:00Z" },
  { videoId: "hFcLyDb6niA", title: "Sneezing Baby Panda", channel: "iPandacam",
    thumbnail: "https://i.ytimg.com/vi/hFcLyDb6niA/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=hFcLyDb6niA",
    duration: "PT16S", viewCount: 248000000, publishedAt: "2006-11-06T00:00:00Z",
    likedBy: ["riki", "yuji"], likedAt: "2026-05-05T11:00:00Z" },
  { videoId: "YE7VzlLtp-4", title: "Big Buck Bunny — Open Movie",
    channel: "Blender Foundation",
    thumbnail: "https://i.ytimg.com/vi/YE7VzlLtp-4/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=YE7VzlLtp-4",
    duration: "PT9M56S", viewCount: 12500000, publishedAt: "2008-05-20T00:00:00Z",
    likedBy: ["yuji"], likedAt: "2026-05-04T20:00:00Z" },
  { videoId: "eRsGyueVLvQ", title: "Sintel - Open Source Animated Short",
    channel: "Blender Foundation",
    thumbnail: "https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=eRsGyueVLvQ",
    duration: "PT14M48S", viewCount: 8200, publishedAt: "2010-09-30T00:00:00Z",
    likedBy: ["riki"], likedAt: "2026-05-03T15:00:00Z" },
];

init();
