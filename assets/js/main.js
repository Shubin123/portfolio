// Whose public GitHub projects are shown. On GitHub Pages the account is read
// from the address (<user>.github.io), so a fork shows its owner's projects
// with no edits; anywhere else (local preview, custom domain) this default is used.
const DEFAULT_GITHUB_USERNAME = "Shubin123";
const PAGES_HOST = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
const GITHUB_USERNAME = PAGES_HOST ? PAGES_HOST[1] : DEFAULT_GITHUB_USERNAME;
document.title = t("{user} — Projects", { user: GITHUB_USERNAME });

// GitHub's unauthenticated API allows only 60 requests/hour per visitor IP,
// and conditional (ETag) requests still consume that quota even on a 304 —
// so the only way to stay efficient is to avoid the network call entirely
// when cached data is still fresh.
const REPOS_CACHE_KEY = `gh-portfolio-repos:${GITHUB_USERNAME}`;
const REPOS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — new repos show up within this window
const PROFILE_CACHE_KEY = `gh-portfolio-profile:${GITHUB_USERNAME}`;
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — the profile carries the public gist count, which must track new gists
const GISTS_CACHE_KEY = `gh-portfolio-gists:${GITHUB_USERNAME}`;
const GISTS_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_GISTS_TO_SHOW = 5;

const LANGUAGE_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Vue: "#41b883",
  Dart: "#00B4AB",
  Scala: "#c22d40",
  R: "#198CE7",
  "Objective-C": "#438eff",
  Perl: "#0298c3",
  Lua: "#000080",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  Clojure: "#db5855",
  PowerShell: "#012456",
  "Jupyter Notebook": "#DA5B0B",
  Dockerfile: "#384d54",
  Makefile: "#427819",
};
const DEFAULT_LANGUAGE_COLOR = "#8b949e";

const ICON_STAR =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">' +
  '<polygon points="12,2 14.25,8.91 21.51,8.91 15.63,13.18 17.88,20.09 12,15.82 6.12,20.09 8.37,13.18 2.49,8.91 9.75,8.91"/>' +
  "</svg>";
const ICON_FORK =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="6" cy="6" r="2.5"></circle><circle cx="6" cy="18" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle>' +
  '<line x1="6" y1="8.5" x2="6" y2="15.5"></line><line x1="6" y1="10" x2="15.5" y2="6"></line>' +
  "</svg>";
const ICON_EXTERNAL =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="8,7 17,7 17,16"></polyline>' +
  "</svg>";

const MAX_COLLAPSED_TAGS = 14;

const CLUSTER_PRIORITY = [
  "desert-ant",
  "ai",
  "machine-learning",
  "robotics",
  "graphics",
  "hardware",
  "tools",
  "game",
  "scraping",
  "backend",
  "finance",
  "audio",
  "emulator",
  "visualization",
  "education",
  "web",
];

const PROJECT_TAGS_MAP = {
  // Desert Ant AI pipeline demos & tools
  "desert-ant-video-pipeline": ["desert-ant", "ai", "video", "pipeline"],
  "desert-ant-eye-demo": ["desert-ant", "ai", "vision", "demo"],
  "desert-ant-face-demo": ["desert-ant", "ai", "vision", "demo"],
  "desert-ant-schemer-demo": ["desert-ant", "ai", "demo"],
  "desert-ant-toxic-demo": ["desert-ant", "ai", "moderation", "demo"],
  "desert-ant-who-demo": ["desert-ant", "ai", "demo"],
  "desert-ant-align-demo": ["desert-ant", "ai", "speech", "demo"],
  "desert-ant-clear-demo": ["desert-ant", "ai", "speech", "demo"],
  "desert-ant-clips-demo": ["desert-ant", "ai", "video", "demo"],
  "desert-ant-ear-demo": ["desert-ant", "ai", "speech", "demo"],
  "desert-ant-emo-demo": ["desert-ant", "ai", "speech", "demo"],
  "desert-ant-gist-demo": ["desert-ant", "ai", "demo"],
  "desert-ant-moderator-demo": ["desert-ant", "ai", "moderation", "demo"],
  "desert-ant-redact-demo": ["desert-ant", "ai", "moderation", "demo"],
  "desert-ant-shapes-demo": ["desert-ant", "ai", "vision", "demo"],
  "desert-ant-title-demo": ["desert-ant", "ai", "demo"],
  "desert-ant-tongue-demo": ["desert-ant", "ai", "speech", "demo"],
  "desert-ant-uhm-demo": ["desert-ant", "ai", "speech", "demo"],
  "desert-ant-voz-demo": ["desert-ant", "ai", "speech", "demo"],

  // Graphics & 3D
  "gameglwfopengl": ["graphics", "opengl", "cpp"],
  "opengl-examples": ["graphics", "opengl", "cpp"],
  "cg-fall-2026": ["graphics", "opengl"],
  "cubesolver": ["graphics", "threejs", "visualization"],
  "6dof-gym-web": ["robotics", "simulation", "threejs", "web"],
  "vslam_gym": ["robotics", "computer-vision", "webgpu", "ai"],
  "vul": ["graphics", "vulkan", "cpp"],
  "zom": ["graphics", "vulkan"],

  // AI & Machine Learning
  "classifier": ["ai", "machine-learning", "vision"],
  "food_model": ["ai", "computer-vision", "python"],
  "gobot": ["ai", "game"],
  "kokorojs": ["ai", "speech", "web"],
  "ml-loop": ["ai", "optimization"],
  "oma-harness": ["ai", "python"],
  "gemini-cli": ["tools", "cli", "ai"],
  "card-battle-agent-lab": ["ai", "game"],
  "petals": ["ai", "distributed"],
  "aimjs": ["ai", "computer-vision", "arduino", "web"],

  // Hardware & Embedded
  "avr_visual": ["hardware", "arduino", "visualization"],
  "nrf-research-firmware": ["hardware", "embedded"],
  "arduino-web": ["hardware", "arduino", "web"],
  "gpi-case2-bt-controller": ["hardware", "bluetooth"],

  // Tools & macOS
  "terminalbar": ["tools", "macos"],
  "viewbar": ["tools", "macos"],
  "dashtop": ["tools", "monitoring", "dashboard"],
  "keydropper": ["tools", "macos"],
  "wynncraft-quicklaunch": ["tools", "gaming"],

  // Web & Backend
  "backendgraphql": ["backend", "graphql", "django"],
  "django-polls-app": ["backend", "django", "python"],
  "portfolio": ["web", "portfolio"],
  "gemini-browser": ["web", "developer-tools"],
  "csc320-concept-atlas": ["education", "visualization", "web"],
  "azahar": ["web", "audio"],
  "azahar_web": ["web", "audio"],
  "dolphin_web": ["emulator", "web"],
  "pcsx2_web": ["emulator", "web"],
  "qemu_web": ["emulator", "web"],
  "xemu_web": ["emulator", "web"],
  "flix": ["web", "media"],
  "netgraph": ["visualization", "network", "web"],

  // Data & Scraping
  "amazon-scraper": ["scraping", "python"],
  "ruby-web-crawler": ["scraping", "ruby"],
  "stonk": ["finance", "desktop-app"],
  "ff26-weekly-draft-picks": ["ai", "sports-analytics", "python"],

  // Games & Audio
  "doge": ["game", "lua"],
  "doom_ball": ["game", "graphics"],
  "submarine": ["game"],
  "space-loop": ["game", "graphics"],
  "possess": ["game"],
  "whyfightree": ["game"],
  "tile-editor": ["game", "tools"],
  "midi": ["audio", "music"],
};

function getRepoTags(repo) {
  const set = new Set();
  if (Array.isArray(repo.topics)) {
    for (const topic of repo.topics) {
      if (topic) set.add(String(topic).toLowerCase().trim());
    }
  }
  const key = (repo.name || "").toLowerCase();
  if (key.startsWith("desert-ant-")) {
    set.add("desert-ant");
    set.add("ai");
  }
  if (PROJECT_TAGS_MAP[key]) {
    for (const tag of PROJECT_TAGS_MAP[key]) {
      set.add(tag.toLowerCase().trim());
    }
  }
  return Array.from(set);
}

function getPrimaryCluster(repo) {
  const tags = getRepoTags(repo);
  if (!tags.length) return "other";
  for (const prio of CLUSTER_PRIORITY) {
    if (tags.includes(prio)) return prio;
  }
  return tags[0];
}

const state = {
  repos: [],
  reposLoaded: false,
  profile: null,
  gists: [],
  gistsFilter: "",
  gistsLimit: DEFAULT_GISTS_TO_SHOW,
  gistsCollapsed: false,
  search: "",
  sort: "updated",
  showForks: false,
  activeTag: null,
  clusterView: false,
  tagsExpanded: false,
  profileFailed: false,
  gistsFailed: false,
  reposError: null,
};

const els = {
  grid: document.getElementById("repo-grid"),
  status: document.getElementById("status"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshLabel: document.getElementById("refresh-label"),
  count: document.getElementById("repo-count"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  showForks: document.getElementById("show-forks"),
  clusterView: document.getElementById("cluster-view"),
  tagBar: document.getElementById("tag-bar"),
  avatarRing: document.getElementById("avatar-ring"),
  avatar: document.getElementById("avatar"),
  displayName: document.getElementById("display-name"),
  bio: document.getElementById("bio"),
  profileStats: document.getElementById("profile-stats"),
  profileLink: document.getElementById("profile-link"),
  contentLayout: document.querySelector(".content-layout"),
  gistsWidget: document.getElementById("gists-widget"),
  gistsToggle: document.getElementById("gists-toggle"),
  gistsBody: document.getElementById("gists-body"),
  gistsBadge: document.getElementById("gists-count-badge"),
  gistsFilter: document.getElementById("gists-filter"),
  gistsFilterClear: document.getElementById("gists-filter-clear"),
  gistsLink: document.getElementById("gists-link"),
  gistsList: document.getElementById("gists-list"),
  gistsStatus: document.getElementById("gists-status"),
};

// The static links in index.html name the default account; point them at the one shown.
els.profileLink.href = `https://github.com/${GITHUB_USERNAME}`;
els.gistsLink.href = `https://gist.github.com/${GITHUB_USERNAME}`;

// Status lines are kept as functions so a language switch can re-render them.
let statusRenderer = () => t("Loading projects…");

function getProjectIcon(name) {
  if (typeof projectIconUrl === "function") {
    return projectIconUrl(name);
  }
  return "assets/icons/project.svg";
}

init();

function init() {
  bindControls();
  bindGistsControls();
  renderSkeleton();
  initLanguage(applyLanguage);
  loadProfile();
  loadRepos();
  loadGists();
}

// Re-renders everything JS wrote, in the newly selected language. Static markup
// is handled by applyStaticTranslations() before this runs.
function applyLanguage() {
  document.title = t("{user} — Projects", { user: GITHUB_USERNAME });
  els.status.textContent = statusRenderer();
  setRefreshing(els.refreshBtn.disabled);
  toggleGistsWidget(state.gistsCollapsed);
  if (state.profile) {
    renderProfile(state.profile);
  } else {
    els.displayName.textContent = state.profileFailed ? GITHUB_USERNAME : t("Loading…");
    renderRepoStats();
  }
  if (state.reposLoaded) render();
  else if (state.reposError) renderError(state.reposError);
  if (state.profile || state.gists.length) renderGists();
  if (state.gistsFailed) els.gistsStatus.textContent = t("Gists are unavailable right now.");
  else if (!state.profile && !state.gists.length) els.gistsStatus.textContent = t("Loading gists…");
}

function bindControls() {
  els.search.addEventListener("input", (e) => {
    state.search = e.target.value;
    render();
  });
  els.sort.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });
  els.showForks.addEventListener("change", (e) => {
    state.showForks = e.target.checked;
    render();
  });
  if (els.clusterView) {
    els.clusterView.addEventListener("change", (e) => {
      state.clusterView = e.target.checked;
      render();
    });
  }
  els.refreshBtn.addEventListener("click", () => {
    loadRepos(true);
    loadProfile(true);
    loadGists(true);
  });
}

function bindGistsControls() {
  if (els.gistsToggle) {
    els.gistsToggle.addEventListener("click", () => {
      toggleGistsWidget();
    });
  }

  if (els.gistsFilter) {
    els.gistsFilter.addEventListener("input", (e) => {
      state.gistsFilter = e.target.value;
      if (els.gistsFilterClear) {
        els.gistsFilterClear.hidden = !state.gistsFilter;
      }
      renderGists();
    });
  }

  if (els.gistsFilterClear) {
    els.gistsFilterClear.addEventListener("click", () => {
      state.gistsFilter = "";
      state.gistsLimit = DEFAULT_GISTS_TO_SHOW;
      els.gistsFilter.value = "";
      els.gistsFilterClear.hidden = true;
      els.gistsFilter.focus();
      renderGists();
    });
  }
}

function toggleGistsWidget(forceState) {
  const nextCollapsed = typeof forceState === "boolean" ? forceState : !state.gistsCollapsed;
  state.gistsCollapsed = nextCollapsed;

  if (els.gistsWidget) {
    els.gistsWidget.classList.toggle("is-collapsed", nextCollapsed);
  }
  if (els.contentLayout) {
    els.contentLayout.classList.toggle("gists-collapsed", nextCollapsed);
  }
  if (els.gistsToggle) {
    els.gistsToggle.setAttribute("aria-expanded", String(!nextCollapsed));
    els.gistsToggle.title = nextCollapsed
      ? t("Pull down gists widget")
      : t("Collapse gists widget to expand projects pane");
  }
  if (els.gistsBody) {
    els.gistsBody.hidden = nextCollapsed;
  }
}

async function loadProfile(force = false) {
  const cached = readCache(PROFILE_CACHE_KEY, PROFILE_CACHE_TTL_MS);
  if (cached) {
    renderProfile(cached.data);
    renderGists();
  }
  if (cached && cached.isFresh && !force) return; // fresh — skip the network call

  try {
    const profile = await fetchJSON(`https://api.github.com/users/${GITHUB_USERNAME}`);
    renderProfile(profile);
    writeCache(PROFILE_CACHE_KEY, profile);
    renderGists();
  } catch {
    // Non-fatal — the repo grid is the important part, profile header can stay minimal.
    if (!cached) {
      state.profileFailed = true;
      els.displayName.textContent = GITHUB_USERNAME;
    }
  }
}

function renderProfile(profile) {
  if (profile.avatar_url) {
    els.avatar.src = profile.avatar_url;
    els.avatar.alt = t("{login} avatar", { login: profile.login });
    els.avatarRing.hidden = false;
  }
  els.displayName.textContent = profile.name || profile.login;
  els.bio.textContent = profile.bio ? t(profile.bio) : "";
  state.profile = profile;
  renderRepoStats();
  els.profileLink.href = profile.html_url || els.profileLink.href;
  els.gistsLink.href = profile.html_url ? `https://gist.github.com/${profile.login}` : els.gistsLink.href;
}

async function loadGists(force = false) {
  if (!state.profile) {
    const cachedProfile = readCache(PROFILE_CACHE_KEY, PROFILE_CACHE_TTL_MS);
    if (cachedProfile) state.profile = cachedProfile.data;
  }

  const cached = readCache(GISTS_CACHE_KEY, GISTS_CACHE_TTL_MS);
  if (cached) {
    state.gists = cached.data;
    renderGists();
  }
  if (cached && cached.isFresh && !force) return;

  try {
    const gists = await fetchJSON(`https://api.github.com/users/${GITHUB_USERNAME}/gists?per_page=100`);
    state.gists = gists;
    state.gistsFailed = false;
    writeCache(GISTS_CACHE_KEY, gists);
    renderGists();
  } catch {
    if (!cached) {
      state.gistsFailed = true;
      els.gistsStatus.textContent = t("Gists are unavailable right now.");
    }
  }
}

function getTotalGistsCount(loadedCount) {
  // The gist list and profile are fetched separately, so never report fewer gists than are actually loaded.
  const profileCount = Number.isFinite(state.profile?.public_gists) ? state.profile.public_gists : 0;
  return Math.max(profileCount, loadedCount);
}

function filterGists(gists, query) {
  if (!query) return gists;
  const q = query.trim().toLowerCase();
  return gists.filter((gist) => {
    const desc = (gist.description || "").toLowerCase();
    const translatedDesc = gist.description ? t(gist.description).toLowerCase() : "";
    const files = Object.keys(gist.files || {}).join(" ").toLowerCase();
    return desc.includes(q) || translatedDesc.includes(q) || files.includes(q);
  });
}

function renderGists() {
  if (!els.gistsList) return;
  els.gistsList.replaceChildren();

  const publicGists = [...state.gists]
    .filter((gist) => gist.public !== false)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const total = getTotalGistsCount(publicGists.length);

  if (els.gistsBadge) {
    if (total > 0) {
      els.gistsBadge.textContent = formatNumber(total);
      els.gistsBadge.hidden = false;
    } else {
      els.gistsBadge.hidden = true;
    }
  }

  const query = state.gistsFilter ? state.gistsFilter.trim() : "";
  const filtered = filterGists(publicGists, query);

  if (query) {
    if (filtered.length === 0) {
      els.gistsStatus.textContent = t('No gists match "{query}".', { query });
    } else {
      els.gistsStatus.textContent = plural(total, "Showing {shown} of {count} public gist", "Showing {shown} of {count} public gists", { shown: filtered.length });
    }
  } else {
    els.gistsStatus.textContent = total
      ? plural(total, "{count} public gist", "{count} public gists")
      : t("No public gists yet.");
  }

  if (filtered.length === 0 && query) {
    const empty = document.createElement("li");
    empty.className = "gist-empty";
    empty.textContent = t("Try searching for a different file or keyword.");
    els.gistsList.appendChild(empty);
    removeMoreBtn();
    return;
  }

  const sliceLimit = query ? filtered.length : state.gistsLimit;
  filtered.slice(0, sliceLimit).forEach((gist) => {
    const item = document.createElement("li");
    item.className = "gist-item";
    const link = document.createElement("a");
    link.href = gist.html_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "gist-title";
    const files = Object.keys(gist.files || {});
    const primaryFile = files[0] || "";
    link.textContent = gist.description ? t(gist.description) : primaryFile || t("Untitled gist");
    item.appendChild(link);
    const meta = document.createElement("span");
    meta.className = "gist-meta";
    const fileCount = files.length;
    const fileDesc = gist.description && primaryFile ? `${primaryFile} · ` : "";
    meta.textContent = `${fileDesc}${plural(fileCount, "{count} file", "{count} files")} · ${t("Updated {time}", { time: relativeTime(gist.updated_at) })}`;
    item.appendChild(meta);
    els.gistsList.appendChild(item);
  });

  updateMoreBtn(filtered.length, query);
}

function updateMoreBtn(totalItems, query) {
  let btn = document.getElementById("gists-more-btn");
  if (query || totalItems <= DEFAULT_GISTS_TO_SHOW) {
    if (btn) btn.remove();
    return;
  }

  if (!btn) {
    btn = document.createElement("button");
    btn.id = "gists-more-btn";
    btn.type = "button";
    btn.className = "gists-more-btn";
    btn.addEventListener("click", () => {
      if (state.gistsLimit < totalItems) {
        state.gistsLimit = Math.min(state.gistsLimit + 5, totalItems);
      } else {
        state.gistsLimit = DEFAULT_GISTS_TO_SHOW;
      }
      renderGists();
    });
    if (els.gistsBody) els.gistsBody.appendChild(btn);
  }

  if (state.gistsLimit < totalItems) {
    const remaining = totalItems - state.gistsLimit;
    btn.textContent = t("Show more ({count} more)", { count: Math.min(5, remaining) });
    btn.title = plural(totalItems, "Show 5 more of {count} loaded gist", "Show 5 more of {count} loaded gists");
  } else {
    btn.textContent = t("Show less");
    btn.title = t("Collapse back to latest {count} gists", { count: DEFAULT_GISTS_TO_SHOW });
  }
}

function removeMoreBtn() {
  const btn = document.getElementById("gists-more-btn");
  if (btn) btn.remove();
}

function publicRepos() {
  return state.repos.filter((repo) => !repo.private);
}

function renderRepoStats() {
  els.profileStats.replaceChildren();
  const repos = publicRepos();
  const forks = repos.filter((repo) => repo.fork).length;
  const stats = state.reposLoaded ? [
    [repos.length, plural(repos.length, "{count} public repo", "{count} public repos")],
    [repos.length - forks, plural(repos.length - forks, "{count} non-fork", "{count} non-forks")],
    [forks, plural(forks, "{count} fork", "{count} forks")],
  ] : [];
  if (Number.isFinite(state.profile?.followers)) {
    stats.push([state.profile.followers, plural(state.profile.followers, "{count} follower", "{count} followers")]);
  }
  for (const [, label] of stats) {
    const pill = document.createElement("span");
    pill.className = "stat-pill";
    pill.textContent = label;
    els.profileStats.appendChild(pill);
  }
  document.getElementById("fork-label").textContent = state.reposLoaded
    ? t("Include forks ({count})", { count: forks })
    : t("Include forks");
}

async function loadRepos(force = false) {
  const cached = readCache(REPOS_CACHE_KEY, REPOS_CACHE_TTL_MS);
  if (cached) {
    state.repos = cached.data;
    state.reposLoaded = true;
    render();
    setLastUpdated(cached.timestamp);
  }

  if (cached && cached.isFresh && !force) {
    return; // fresh cache — skip the network call to stay within GitHub's unauthenticated rate limit
  }

  if (!cached) setStatus(() => t("Loading projects…"));
  setRefreshing(true);

  try {
    const fresh = await fetchAllRepos();
    state.repos = fresh;
    state.reposLoaded = true;
    state.reposError = null;
    const now = Date.now();
    writeCache(REPOS_CACHE_KEY, fresh);
    render();
    setLastUpdated(now);
  } catch (err) {
    if (cached) {
      setStatus(() => t("Couldn't refresh ({error}) — last updated {time}", {
        error: errorMessage(err),
        time: relativeTime(new Date(cached.timestamp).toISOString()),
      }));
    } else {
      state.reposError = err;
      renderError(err);
    }
  } finally {
    setRefreshing(false);
  }
}

function setLastUpdated(timestamp) {
  setStatus(() => t("Last updated {time}", { time: relativeTime(new Date(timestamp).toISOString()) }));
}

function setRefreshing(isRefreshing) {
  els.refreshBtn.disabled = isRefreshing;
  els.refreshBtn.classList.toggle("is-refreshing", isRefreshing);
  els.refreshLabel.textContent = isRefreshing ? t("Refreshing…") : t("Refresh");
}

async function fetchAllRepos() {
  let page = 1;
  let all = [];
  while (true) {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?type=public&sort=updated&per_page=100&page=${page}`;
    const batch = await fetchJSON(url);
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      throw localizedError("GitHub API rate limit reached, try again later");
    }
    if (res.status === 404) {
      throw localizedError('GitHub user "{user}" not found', { user: GITHUB_USERNAME });
    }
    throw localizedError("GitHub API error ({status})", { status: res.status });
  }
  return res.json();
}

// Keeps the English template so the message can be shown again after a language switch.
function localizedError(template, vars) {
  const err = new Error(t(template, vars));
  err.template = template;
  err.vars = vars;
  return err;
}

function errorMessage(err) {
  return err.template ? t(err.template, err.vars) : err.message;
}

function readCache(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed.timestamp) || !parsed.data) return null;
    if (key === REPOS_CACHE_KEY && !Array.isArray(parsed.data)) return null;
    return { ...parsed, isFresh: Date.now() - parsed.timestamp <= ttlMs };
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Storage unavailable (e.g. private browsing) — safe to ignore, live fetch still works.
  }
}

function filterAndSort(repos) {
  let list = repos.filter((r) => !r.private);
  if (!state.showForks) list = list.filter((r) => !r.fork);
  if (state.activeTag) {
    const target = state.activeTag.toLowerCase();
    list = list.filter((r) => getRepoTags(r).includes(target));
  }
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.description ? t(r.description) : "").toLowerCase().includes(q) ||
        getRepoTags(r).some((tag) => tag.toLowerCase().includes(q) || tagLabel(tag).toLowerCase().includes(q))
    );
  }
  return [...list].sort(sortComparator(state.sort));
}

function sortComparator(mode) {
  switch (mode) {
    case "stars":
      return (a, b) => b.stargazers_count - a.stargazers_count;
    case "name":
      return (a, b) => a.name.localeCompare(b.name);
    case "created":
      return (a, b) => new Date(b.created_at) - new Date(a.created_at);
    case "updated":
    default:
      return (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at);
  }
}

function render() {
  const filtered = filterAndSort(state.repos);
  els.grid.innerHTML = "";

  renderRepoStats();
  renderTagBar();
  const repos = publicRepos();
  const forks = repos.filter((repo) => repo.fork).length;

  const total = repos.length;
  const shown = { shown: filtered.length };
  let countText;
  if (state.activeTag) {
    countText = plural(total, 'Showing {shown} of {count} public repository · Tagged "{tag}"', 'Showing {shown} of {count} public repositories · Tagged "{tag}"', { ...shown, tag: tagLabel(state.activeTag) });
  } else if (state.clusterView) {
    countText = plural(total, "Showing {shown} of {count} public repository across tag clusters", "Showing {shown} of {count} public repositories across tag clusters", shown);
  } else {
    countText = plural(total, "Showing {shown} of {count} public repository", "Showing {shown} of {count} public repositories", shown);
  }
  if (!state.showForks && forks) countText += ` · ${plural(forks, "{count} fork hidden", "{count} forks hidden")}`;
  els.count.textContent = countText;

  if (filtered.length === 0) {
    els.grid.classList.remove("is-clustered");
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = repos.length ? t("No projects match your filters.") : t("No public repositories yet.");
    if (repos.length && (state.activeTag || state.search.trim())) {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "retry-button";
      resetBtn.textContent = t("Clear filters");
      resetBtn.style.marginTop = "12px";
      resetBtn.addEventListener("click", () => {
        state.activeTag = null;
        state.search = "";
        if (els.search) els.search.value = "";
        render();
      });
      empty.appendChild(resetBtn);
    }
    els.grid.appendChild(empty);
    return;
  }

  if (state.clusterView) {
    renderClusteredGrid(filtered);
  } else {
    els.grid.classList.remove("is-clustered");
    filtered.forEach((repo, i) => els.grid.appendChild(buildCard(repo, i)));
  }
}

function renderTagBar() {
  if (!els.tagBar) return;
  els.tagBar.replaceChildren();

  const repos = publicRepos();
  let availableRepos = repos;
  if (!state.showForks) {
    availableRepos = availableRepos.filter((r) => !r.fork);
  }

  if (availableRepos.length === 0) {
    els.tagBar.hidden = true;
    return;
  }

  const tagCounts = new Map();
  for (const repo of availableRepos) {
    const tags = getRepoTags(repo);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  if (tagCounts.size === 0) {
    els.tagBar.hidden = true;
    return;
  }

  els.tagBar.hidden = false;

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  const isAllActive = !state.activeTag;
  allBtn.className = `tag-pill${isAllActive ? " is-active" : ""}`;
  allBtn.setAttribute("aria-pressed", String(isAllActive));
  allBtn.setAttribute("data-tag", "");
  
  const allLabel = document.createElement("span");
  allLabel.textContent = t("All");
  allBtn.appendChild(allLabel);

  const allCount = document.createElement("span");
  allCount.className = "tag-count";
  allCount.textContent = availableRepos.length;
  allBtn.appendChild(allCount);

  allBtn.addEventListener("click", () => {
    if (state.activeTag !== null) {
      state.activeTag = null;
      render();
    }
  });
  els.tagBar.appendChild(allBtn);

  const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const shouldCollapse = sortedTags.length > MAX_COLLAPSED_TAGS && !state.tagsExpanded;
  const visibleTags = shouldCollapse
    ? sortedTags.slice(0, MAX_COLLAPSED_TAGS)
    : [...sortedTags];

  if (shouldCollapse && state.activeTag && !visibleTags.some(([t]) => t === state.activeTag)) {
    const activeEntry = sortedTags.find(([t]) => t === state.activeTag);
    if (activeEntry) visibleTags.push(activeEntry);
  }

  visibleTags.forEach(([tag, count]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = state.activeTag === tag;
    btn.className = `tag-pill${isActive ? " is-active" : ""}`;
    btn.setAttribute("aria-pressed", String(isActive));
    btn.setAttribute("data-tag", tag);
    btn.setAttribute("aria-label", plural(count, "Filter projects by #{tag} ({count} project)", "Filter projects by #{tag} ({count} projects)", { tag: tagLabel(tag) }));

    const label = document.createElement("span");
    label.textContent = `#${tagLabel(tag)}`;
    btn.appendChild(label);

    const countEl = document.createElement("span");
    countEl.className = "tag-count";
    countEl.textContent = count;
    btn.appendChild(countEl);

    btn.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      render();
    });

    els.tagBar.appendChild(btn);
  });

  if (sortedTags.length > MAX_COLLAPSED_TAGS) {
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "tag-toggle-more";
    if (state.tagsExpanded) {
      moreBtn.textContent = t("Show fewer");
      moreBtn.title = t("Collapse back to top {count} tags", { count: MAX_COLLAPSED_TAGS });
    } else {
      const remaining = sortedTags.length - visibleTags.length;
      moreBtn.textContent = t("+{count} more", { count: remaining });
      moreBtn.title = plural(sortedTags.length, "Show all {count} tag", "Show all {count} tags");
    }
    moreBtn.addEventListener("click", () => {
      state.tagsExpanded = !state.tagsExpanded;
      renderTagBar();
    });
    els.tagBar.appendChild(moreBtn);
  }
}

function renderClusteredGrid(filteredRepos) {
  els.grid.innerHTML = "";
  els.grid.classList.add("is-clustered");

  const clusterMap = new Map();
  for (const repo of filteredRepos) {
    const cluster = state.activeTag || getPrimaryCluster(repo);
    if (!clusterMap.has(cluster)) {
      clusterMap.set(cluster, []);
    }
    clusterMap.get(cluster).push(repo);
  }

  const sortedClusters = Array.from(clusterMap.entries()).sort((a, b) => {
    if (a[0] === "other") return 1;
    if (b[0] === "other") return -1;
    return b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });

  let cardIndex = 0;
  for (const [clusterName, clusterRepos] of sortedClusters) {
    const section = document.createElement("section");
    section.className = "cluster-group";
    section.setAttribute("data-cluster", clusterName);

    const header = document.createElement("div");
    header.className = "cluster-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "cluster-title-wrap";

    const title = document.createElement("h3");
    title.className = "cluster-title";
    title.textContent = clusterName === "other" ? t("Other Projects") : `#${tagLabel(clusterName)}`;
    titleWrap.appendChild(title);

    const badge = document.createElement("span");
    badge.className = "cluster-badge";
    badge.textContent = plural(clusterRepos.length, "{count} project", "{count} projects");
    titleWrap.appendChild(badge);

    header.appendChild(titleWrap);

    if (!state.activeTag && clusterName !== "other") {
      const filterBtn = document.createElement("button");
      filterBtn.type = "button";
      filterBtn.className = "cluster-filter-btn";
      filterBtn.textContent = t("Focus cluster");
      filterBtn.title = t("Show only #{tag} projects", { tag: tagLabel(clusterName) });
      filterBtn.addEventListener("click", () => {
        state.activeTag = clusterName;
        render();
      });
      header.appendChild(filterBtn);
    } else if (state.activeTag) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "cluster-filter-btn";
      clearBtn.textContent = t("Show all clusters");
      clearBtn.title = t("View all clusters");
      clearBtn.addEventListener("click", () => {
        state.activeTag = null;
        render();
      });
      header.appendChild(clearBtn);
    }

    section.appendChild(header);

    const cardGrid = document.createElement("div");
    cardGrid.className = "cluster-cards";
    clusterRepos.forEach((repo) => cardGrid.appendChild(buildCard(repo, cardIndex++)));
    section.appendChild(cardGrid);

    els.grid.appendChild(section);
  }
}

function buildCard(repo, index = 0) {
  const card = document.createElement("article");
  card.className = "card";
  card.style.animationDelay = `${Math.min(index, 20) * 35}ms`;
  if (repo.language) {
    card.style.setProperty("--lang-color", LANGUAGE_COLORS[repo.language] || DEFAULT_LANGUAGE_COLOR);
  }
  const pagesUrl = getPagesUrl(repo);
  if (pagesUrl) card.classList.add("has-pages");

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";

  const link = document.createElement("a");
  link.href = repo.html_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "card-title";
  link.textContent = repo.name;
  const icon = document.createElement("img");
  icon.className = "project-icon";
  icon.src = getProjectIcon(repo.name);
  icon.alt = "";
  icon.width = 48;
  icon.height = 48;
  icon.loading = "lazy";
  titleRow.appendChild(icon);
  const heading = document.createElement("h3");
  heading.className = "card-heading";
  heading.appendChild(link);
  titleRow.appendChild(heading);

  if (repo.fork) { const badge = makeBadge(t("Fork")); badge.title = t("A copy of an existing repository"); titleRow.appendChild(badge); }
  if (repo.archived) titleRow.appendChild(makeBadge(t("Archived")));

  card.appendChild(titleRow);

  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = repo.description ? t(repo.description) : t("No description provided.");
  card.appendChild(desc);

  const tags = getRepoTags(repo);
  if (tags.length) {
    const topicsEl = document.createElement("div");
    topicsEl.className = "topics";
    let displayTags = tags.slice(0, 6);
    if (state.activeTag && tags.includes(state.activeTag) && !displayTags.includes(state.activeTag)) {
      displayTags = [state.activeTag, ...tags.filter((t) => t !== state.activeTag).slice(0, 5)];
    }
    displayTags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const isActive = state.activeTag === tag;
      chip.className = `topic-chip${isActive ? " is-active" : ""}`;
      chip.textContent = `#${tagLabel(tag)}`;
      chip.setAttribute("aria-label", t("Filter by tag #{tag}", { tag: tagLabel(tag) }));
      chip.setAttribute("aria-pressed", String(isActive));
      chip.setAttribute("data-tag", tag);
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.activeTag = state.activeTag === tag ? null : tag;
        render();
      });
      topicsEl.appendChild(chip);
    });
    card.appendChild(topicsEl);
  }

  const meta = document.createElement("div");
  meta.className = "card-meta";

  if (repo.language) {
    const langEl = document.createElement("span");
    langEl.className = "meta-item";
    const dot = document.createElement("span");
    dot.className = "lang-dot";
    dot.style.backgroundColor = LANGUAGE_COLORS[repo.language] || DEFAULT_LANGUAGE_COLOR;
    langEl.appendChild(dot);
    const langText = document.createElement("span");
    langText.textContent = repo.language;
    langEl.appendChild(langText);
    meta.appendChild(langEl);
  }

  meta.appendChild(makeMetaItem(ICON_STAR, plural(repo.stargazers_count, "{count} star", "{count} stars")));
  // "of this repo" separates a repo's own fork count from the Fork badge, which
  // says this repo is itself a fork of someone else's.
  meta.appendChild(makeMetaItem(ICON_FORK, plural(repo.forks_count, "{count} fork of this repo", "{count} forks of this repo")));
  meta.appendChild(makeMetaItem(null, t("Updated {time}", { time: relativeTime(repo.pushed_at) })));

  card.appendChild(meta);

  if (pagesUrl) card.appendChild(buildPagesCta(pagesUrl));

  return card;
}

function getPagesUrl(repo) {
  if (!repo.has_pages) return null;
  // Ignore repo.homepage: it often points at a demo video or a mirror, not the
  // Pages deployment this card links to.
  const isUserSite = repo.name.toLowerCase() === `${GITHUB_USERNAME.toLowerCase()}.github.io`;
  return isUserSite ? `https://${GITHUB_USERNAME}.github.io/` : `https://${GITHUB_USERNAME}.github.io/${repo.name}/`;
}

function buildPagesCta(url) {
  const cta = document.createElement("a");
  cta.className = "pages-cta";
  cta.href = url;
  cta.target = "_blank";
  cta.rel = "noopener noreferrer";

  const label = document.createElement("span");
  label.textContent = t("View live site");
  cta.appendChild(label);

  const icon = document.createElement("span");
  icon.innerHTML = ICON_EXTERNAL; // static, hardcoded icon markup — never repo-derived content
  cta.appendChild(icon);

  return cta;
}

function makeBadge(text) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = text;
  return badge;
}

function makeMetaItem(iconSvg, text) {
  const span = document.createElement("span");
  span.className = "meta-item";
  if (iconSvg) {
    const icon = document.createElement("span");
    icon.innerHTML = iconSvg; // static, hardcoded icon markup — never repo-derived content
    span.appendChild(icon);
  }
  const label = document.createElement("span");
  label.textContent = text;
  span.appendChild(label);
  return span;
}

function renderSkeleton() {
  els.grid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const card = document.createElement("div");
    card.className = "card skeleton";
    els.grid.appendChild(card);
  }
}

function renderError(err) {
  els.grid.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "error-state";

  const msg = document.createElement("p");
  msg.textContent = t("Couldn't load projects: {error}", { error: errorMessage(err) });
  wrap.appendChild(msg);

  const retry = document.createElement("button");
  retry.className = "retry-button";
  retry.textContent = t("Retry");
  retry.addEventListener("click", () => loadRepos(true));
  wrap.appendChild(retry);

  els.grid.appendChild(wrap);
  setStatus(() => "");
}

function setStatus(render) {
  statusRenderer = render;
  els.status.textContent = render();
}

function relativeTime(dateStr) {
  const date = new Date(dateStr);
  const seconds = Math.round((date - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: "auto" });
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Infinity, unit: "year" },
  ];
  let duration = seconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return "";
}
