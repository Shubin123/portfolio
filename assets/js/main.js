// Change this to switch whose public GitHub projects are shown.
const GITHUB_USERNAME = "Shubin123";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_KEY = `gh-portfolio-cache:${GITHUB_USERNAME}`;

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

const state = {
  repos: [],
  search: "",
  sort: "updated",
  showForks: false,
};

const els = {
  grid: document.getElementById("repo-grid"),
  status: document.getElementById("status"),
  count: document.getElementById("repo-count"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  showForks: document.getElementById("show-forks"),
  avatar: document.getElementById("avatar"),
  displayName: document.getElementById("display-name"),
  bio: document.getElementById("bio"),
  profileStats: document.getElementById("profile-stats"),
  profileLink: document.getElementById("profile-link"),
};

init();

function init() {
  bindControls();
  renderSkeleton();
  loadProfile();
  loadRepos();
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
}

async function loadProfile() {
  try {
    const profile = await fetchJSON(`https://api.github.com/users/${GITHUB_USERNAME}`);
    renderProfile(profile);
  } catch {
    // Non-fatal — the repo grid is the important part, profile header can stay minimal.
    els.displayName.textContent = GITHUB_USERNAME;
  }
}

function renderProfile(profile) {
  if (profile.avatar_url) {
    els.avatar.src = profile.avatar_url;
    els.avatar.alt = `${profile.login} avatar`;
    els.avatar.hidden = false;
  }
  els.displayName.textContent = profile.name || profile.login;
  els.bio.textContent = profile.bio || "";
  els.profileStats.textContent = "";
  const stats = [
    [profile.public_repos, "public repos"],
    [profile.followers, "followers"],
  ];
  stats.forEach(([value, label], i) => {
    if (i > 0) els.profileStats.append(" · ");
    const span = document.createElement("span");
    span.textContent = `${value} ${label}`;
    els.profileStats.appendChild(span);
  });
  els.profileLink.href = profile.html_url || els.profileLink.href;
}

async function loadRepos() {
  const cached = readCache();
  if (cached) {
    state.repos = cached.data;
    render();
    setStatus(`Showing cached data from ${relativeTime(new Date(cached.timestamp).toISOString())}, refreshing…`);
  }

  try {
    const fresh = await fetchAllRepos();
    state.repos = fresh;
    writeCache(fresh);
    render();
    setStatus(`Live from GitHub, updated ${relativeTime(new Date().toISOString())}`);
  } catch (err) {
    if (cached) {
      setStatus(`Couldn't refresh (${err.message}) — showing cached data from ${relativeTime(new Date(cached.timestamp).toISOString())}`);
    } else {
      renderError(err);
    }
  }
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
      throw new Error("GitHub API rate limit reached, try again later");
    }
    if (res.status === 404) {
      throw new Error(`GitHub user "${GITHUB_USERNAME}" not found`);
    }
    throw new Error(`GitHub API error (${res.status})`);
  }
  return res.json();
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Storage unavailable (e.g. private browsing) — safe to ignore, live fetch still works.
  }
}

function filterAndSort(repos) {
  let list = repos.filter((r) => !r.private);
  if (!state.showForks) list = list.filter((r) => !r.fork);
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.topics || []).some((t) => t.toLowerCase().includes(q))
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

  if (state.repos.length === 0) return; // still loading, skeleton is showing

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No projects match your filters.";
    els.grid.appendChild(empty);
    els.count.textContent = "";
    return;
  }

  filtered.forEach((repo) => els.grid.appendChild(buildCard(repo)));
  els.count.textContent = `${filtered.length} project${filtered.length === 1 ? "" : "s"}`;
}

function buildCard(repo) {
  const card = document.createElement("article");
  card.className = "card";

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";

  const link = document.createElement("a");
  link.href = repo.html_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "card-title";
  link.textContent = repo.name;
  titleRow.appendChild(link);

  if (repo.fork) titleRow.appendChild(makeBadge("Fork"));
  if (repo.archived) titleRow.appendChild(makeBadge("Archived"));

  card.appendChild(titleRow);

  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = repo.description || "No description provided.";
  card.appendChild(desc);

  if (repo.topics && repo.topics.length) {
    const topicsEl = document.createElement("div");
    topicsEl.className = "topics";
    repo.topics.slice(0, 6).forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "topic-chip";
      chip.textContent = t;
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

  meta.appendChild(makeMetaItem(`★ ${repo.stargazers_count}`));
  meta.appendChild(makeMetaItem(`⑂ ${repo.forks_count}`));
  meta.appendChild(makeMetaItem(`Updated ${relativeTime(repo.pushed_at)}`));

  card.appendChild(meta);

  return card;
}

function makeBadge(text) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = text;
  return badge;
}

function makeMetaItem(text) {
  const span = document.createElement("span");
  span.className = "meta-item";
  span.textContent = text;
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
  msg.textContent = `Couldn't load projects: ${err.message}`;
  wrap.appendChild(msg);

  const retry = document.createElement("button");
  retry.className = "retry-button";
  retry.textContent = "Retry";
  retry.addEventListener("click", loadRepos);
  wrap.appendChild(retry);

  els.grid.appendChild(wrap);
  setStatus("");
}

function setStatus(text) {
  els.status.textContent = text;
}

function relativeTime(dateStr) {
  const date = new Date(dateStr);
  const seconds = Math.round((date - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
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
