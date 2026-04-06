/**
 * PAWSPORT — Renderer Process
 */

const PORT = window.pawsport?.serverPort || 5000;
const API  = `http://127.0.0.1:${PORT}`;

// ── State ──────────────────────────────────────────────────────────────────
let currentImageBase64 = null;
let serverReady        = false;   // set to true once /health passes

// ── DOM refs ───────────────────────────────────────────────────────────────
const screens = {
  home:    document.getElementById("screen-home"),
  loading: document.getElementById("screen-loading"),
  results: document.getElementById("screen-results"),
  error:   document.getElementById("screen-error"),
};

const dropzone    = document.getElementById("dropzone");
const dropInner   = dropzone.querySelector(".dropzone-inner");
const previewWrap = document.getElementById("preview-wrap");
const previewImg  = document.getElementById("preview-img");
const btnBrowse   = document.getElementById("btn-browse");
const fileInput   = document.getElementById("file-input");
const btnAnalyze  = document.getElementById("btn-analyze");
const btnRetry    = document.getElementById("btn-retry");
const btnErrRetry = document.getElementById("btn-error-retry");
const btnPreviewRm= document.getElementById("preview-remove");
const loadingMsg  = document.getElementById("loading-msg");
const loadingFill = document.getElementById("loading-fill");

// Server status banner (injected dynamically)
let statusBanner = null;

function showBanner(msg, type = "warn") {
  if (!statusBanner) {
    statusBanner = document.createElement("div");
    statusBanner.id = "status-banner";
    statusBanner.style.cssText = `
      position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
      padding:10px 22px;border-radius:99px;font-size:12px;font-family:'Space Mono',monospace;
      letter-spacing:.08em;z-index:9999;transition:opacity .4s;pointer-events:none;
    `;
    document.body.appendChild(statusBanner);
  }
  statusBanner.textContent = msg;
  statusBanner.style.background = type === "ok"
    ? "rgba(26,188,156,.9)" : type === "err"
    ? "rgba(192,57,43,.9)"  : "rgba(212,168,67,.9)";
  statusBanner.style.color = "#0f1a2e";
  statusBanner.style.opacity = "1";
  if (type === "ok") setTimeout(() => { statusBanner.style.opacity = "0"; }, 3000);
}

// ── Screen transitions ─────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ── Image handling ─────────────────────────────────────────────────────────
function setImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    showError("Please upload a valid image file (JPG, PNG, WEBP).");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageBase64 = e.target.result;
    previewImg.src = currentImageBase64;
    dropInner.classList.add("hidden");
    previewWrap.classList.remove("hidden");
    btnAnalyze.disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  currentImageBase64 = null;
  previewImg.src     = "";
  previewWrap.classList.add("hidden");
  dropInner.classList.remove("hidden");
  btnAnalyze.disabled = true;
  fileInput.value     = "";
}

// ── Drag & drop ────────────────────────────────────────────────────────────
dropzone.addEventListener("click", (e) => {
  if (e.target === btnBrowse || e.target === btnPreviewRm) return;
  if (!currentImageBase64) triggerFilePicker();
});

["dragenter", "dragover"].forEach(ev =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    if (!currentImageBase64) dropzone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach(ev =>
  dropzone.addEventListener(ev, () => dropzone.classList.remove("drag-over"))
);
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) setImage(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setImage(fileInput.files[0]);
});

btnPreviewRm.addEventListener("click", (e) => { e.stopPropagation(); clearImage(); });

// ── File picker (Electron native dialog or <input>) ────────────────────────
async function triggerFilePicker() {
  if (window.pawsport?.openFileDialog) {
    const result = await window.pawsport.openFileDialog();
    if (result?.base64) {
      currentImageBase64 = result.base64;
      previewImg.src     = result.base64;
      dropInner.classList.add("hidden");
      previewWrap.classList.remove("hidden");
      btnAnalyze.disabled = false;
    }
  } else {
    fileInput.click();
  }
}

btnBrowse.addEventListener("click", (e) => { e.stopPropagation(); triggerFilePicker(); });

// ── Loading animation ──────────────────────────────────────────────────────
const LOADING_MSGS = [
  "Sniffing fur patterns…",
  "Consulting the breed registry…",
  "Tracing geographic origins…",
  "Fetching homeland weather…",
  "Stamping your PAWSPORT…",
];
let loadingTimer = null;

function startLoading() {
  showScreen("loading");
  let i = 0;
  loadingFill.style.width = "0%";
  loadingMsg.textContent  = LOADING_MSGS[0];
  loadingTimer = setInterval(() => {
    i++;
    if (i < LOADING_MSGS.length) {
      loadingMsg.textContent  = LOADING_MSGS[i];
      loadingFill.style.width = `${(i / LOADING_MSGS.length) * 90}%`;
    }
  }, 900);
}

function stopLoading() {
  clearInterval(loadingTimer);
  loadingFill.style.width = "100%";
}

// ── Analyze ────────────────────────────────────────────────────────────────
btnAnalyze.addEventListener("click", analyze);

async function analyze() {
  if (!currentImageBase64) return;
  startLoading();

  try {
    const resp = await fetch(`${API}/analyze`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ image_base64: currentImageBase64 }),
    });
    const data = await resp.json();
    stopLoading();

    if (!resp.ok || data.error) {
      showError(data.error || "Analysis failed. Please try again.");
      return;
    }
    renderResults(data);

  } catch (err) {
    stopLoading();
    showError(
      "Could not reach the analysis server.\n\n" +
      "Make sure Python is running:\n  python server.py\n\n" +
      err.message
    );
  }
}

// ── Render results ─────────────────────────────────────────────────────────
function renderResults(data) {
  document.getElementById("result-photo").src         = currentImageBase64;
  document.getElementById("r-breed").textContent      = data.breed   || "Unknown";
  document.getElementById("r-origin").textContent     = data.origin  || "Unknown";
  document.getElementById("r-conf").textContent       = data.confidence ? `${data.confidence}%` : "—";
  document.getElementById("r-emoji").textContent      = data.emoji   || "🐕";
  document.getElementById("r-breed-name").textContent = data.breed   || "Unknown";
  document.getElementById("r-conf-badge").textContent = data.confidence ? `${data.confidence}%` : "—";
  document.getElementById("r-description").textContent= data.description || "";
  document.getElementById("r-country").textContent    = data.origin  || "—";
  document.getElementById("r-city").textContent       = data.city    || "—";

  const w = data.weather || {};
  document.getElementById("w-temp").textContent     = w.temp_c    !== undefined ? `${w.temp_c}°C` : "—";
  document.getElementById("w-desc").textContent     = w.description || "—";
  document.getElementById("w-humidity").textContent = w.humidity   ?? "—";
  document.getElementById("w-wind").textContent     = w.wind_speed ?? "—";
  document.getElementById("w-feels").textContent    = w.feels_like ?? "—";

  const now = new Date();
  document.getElementById("entry-date").textContent =
    now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  document.getElementById("entry-city").textContent = (data.city || "").toUpperCase();

  renderStamps(data.breed);
  showScreen("results");
}

// ── Stamp decoration ───────────────────────────────────────────────────────
const STAMP_COLORS = [
  { border: "#3b82f6", color: "#3b82f6" },
  { border: "#c0392b", color: "#c0392b" },
  { border: "#1abc9c", color: "#1abc9c" },
  { border: "#d4a843", color: "#d4a843" },
  { border: "#8e44ad", color: "#8e44ad" },
];

const BREED_STAMPS = {
  "Bernese Mountain Dog": [["SWISS","CHE"],["ALPS","ALP"],["BERN","BRN"]],
  "Border Collie":        [["SCOTLAND","SCO"],["UK","GBR"],["HERDER","HRD"]],
  "Chihuahua":            [["MEXICO","MEX"],["AZTEC","AZT"],["SOUTH","STH"]],
  "Corgi":                [["WALES","WLS"],["ROYAL","RYL"],["CELTIC","CLT"]],
  "Dachshund":            [["GERMANY","DEU"],["BERLIN","BLN"],["BAVARIAN","BAV"]],
  "Golden Retriever":     [["SCOTLAND","SCO"],["HIGHLAND","HLD"],["GOLDEN","GLD"]],
  "Jack Russell Terrier": [["ENGLAND","ENG"],["LONDON","LDN"],["TERRIER","TRR"]],
  "Pug":                  [["CHINA","CHN"],["IMPERIAL","IMP"],["BEIJING","BEJ"]],
  "Siberian Husky":       [["RUSSIA","RUS"],["SIBERIA","SIB"],["ARCTIC","ARC"]],
};

function renderStamps(breed) {
  const grid = document.getElementById("stamps-grid");
  grid.innerHTML = "";
  const pairs = BREED_STAMPS[breed] || [["UNKNOWN","UNK"]];
  pairs.forEach(([label, code], i) => {
    const c  = STAMP_COLORS[i % STAMP_COLORS.length];
    const el = document.createElement("div");
    el.className = "stamp-item";
    el.style.borderColor      = c.border;
    el.style.color            = c.color;
    el.style.animationDelay   = `${i * 0.12}s`;
    el.textContent            = `${label} · ${code}`;
    grid.appendChild(el);
  });
}

// ── Error screen ───────────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById("error-msg").textContent = msg;
  showScreen("error");
}

btnRetry.addEventListener("click",    resetToHome);
btnErrRetry.addEventListener("click", resetToHome);

function resetToHome() {
  clearImage();
  showScreen("home");
}

// ── Server status from main process (Electron only) ────────────────────────
if (window.pawsport?.onServerReady) {
  window.pawsport.onServerReady(() => {
    serverReady = true;
    showBanner("Python server ready ✓", "ok");
  });
  window.pawsport.onServerUnavailable(() => {
    showBanner("Server offline — start  python server.py", "warn");
  });
}

// ── Init: quick health check (also works in browser without Electron) ──────
showScreen("home");

fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) })
  .then(r => r.json())
  .then(d => {
    serverReady = true;
    if (d.demo_mode) showBanner("Demo mode — no model loaded", "warn");
  })
  .catch(() => {
    // Silently ignore if server not up yet; onServerUnavailable handles messaging
  });
