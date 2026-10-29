# Portfolio | https://shubin123.github.io/portfolio/

A static, single-page project showcase that pulls public GitHub repositories
live at page load. There's no build step, no backend, and no database — the
page calls the public GitHub REST API directly from the browser, so it always
reflects whatever public repos currently exist on the account, including new
ones, with nothing to keep in sync.

## How it works

- `index.html` — page structure (profile header, search/sort controls, tag cluster toolbar, project grid, gists widget).
- `assets/css/style.css` — styling, including a dark theme that follows the visitor's OS preference and responsive pane transitions.
- `assets/js/main.js` — fetches GitHub repositories, profile, and gists on load, then handles interactive sorting, tag-based clustering, live filtering, and widget pulldown client-side.
- `assets/icons/*.svg` + `assets/js/icons.js` — one mark per project (see below).
- `assets/js/i18n.js` + `assets/i18n/*.json` — the translate menu and its DeepL-built dictionaries, listed in the generated `assets/js/languages.js` (see below).

The header counts a repository once: **public repos = non-forks + forks**, all
three read off the same list the grid renders, so the total never disagrees with
what is on screen. Forks are hidden by default and the status line says how many
that is; the toggle shows them without changing the total.

## Tagging and project clusters

Projects are tagged and clustered by domain (such as AI, graphics, robotics, tools, web, and games).

- **Tag cluster bar**: Displays all tag clusters found across loaded repositories with live project counts. Clicking a tag pill filters the grid to that cluster; clicking it again (or clicking "All") restores the full view.
- **Interactive card tags**: Topic chips on project cards are interactive buttons. Clicking any tag chip on a card immediately focuses the view on that tag cluster.
- **Cluster by tag mode**: The "Cluster by tag" toggle organizes projects into categorized cluster sections complete with section headers and count badges.


## Translations (DeepL)

The translate button in the header opens a language menu: English (the source),
Deutsch, Español, Français, Português (Brasil), Русский, 日本語, 한국어, and 中文（简体）
— the languages GitHub publishes its own docs in. The choice is remembered per
visitor. Everything is translated — static markup, status lines, counts, and
tooltips, plus the live GitHub text: the profile bio, repo descriptions, the
latest 100 gist descriptions, and tags.

DeepL keys can't be used from a browser, so the page never calls DeepL.
`scripts/translate.py` does it ahead of time and writes one dictionary per
language, `assets/i18n/<code>.json`, keyed by the English text. It collects UI
strings from elements marked `data-i18n` / `data-i18n-attr` and from string
literals passed to `t()` / `plural()` in the JS, fetches the same public GitHub
data the page shows, and only sends text that isn't already translated.
Per-language glossaries keep GitHub's own terms (e.g. 复刻, 星标, 仓库 in Chinese).

Each dictionary is lazy-loaded and cached: the page downloads one only when a
visitor picks that language, keeps it in memory for switching back, and stores
it in `localStorage` so later visits apply it without the network.
`assets/js/languages.js`, also generated, gives every dictionary a content hash;
the hash is the cache key and the download's `?v=`, so a cached copy is replaced
as soon as the script publishes a new one.

Counts use each language's plural rules (`Intl.PluralRules`): the script
translates a form per plural category, so Russian reads 1 файл / 3 файла /
25 файлов and French treats 0 as singular.

```sh
DEEPL_AUTH_KEY=... npm run translate                 # translate what's new; add -- --all to redo everything
DEEPL_AUTH_KEY=... npm run translate -- --lang fr,de # only some languages
npm run check:i18n                                   # offline: fail if any UI string lacks a translation
```

To add a language, add it to `LANGUAGES` in `scripts/translate.py` and run the
script. A repo or gist published after the last run shows in English until the
script runs again.

## Project marks

Every card carries a hand-drawn SVG mark instead of an emoji, and the same file
ships on the project's own Pages site as its favicon and header logo, so a card
and the site it links to read as one project.

- `scripts/generate-icons.py` holds the geometry and writes both
  `assets/icons/<repo>.svg` and the `assets/js/icons.js` lookup. Add an entry
  there and re-run it (`python3 scripts/generate-icons.py`) to add a project;
  anything without a mark falls back to `project.svg`.
- `npm run check:icons` asserts every project in `tests/repos.json` has a mark
  and every mapped Pages site has a mark. It also checks all marks are pure vector geometry — no `<text>`, `<image>`,
  `<script>`, or emoji, so they stay crisp at any size and need no font.
- `scripts/icon-sites.json` records where each deployed site keeps its copy.
  `npm run test:live` fetches all 24 Pages deployments and fails if a site's
  icon is missing, unreachable, or no longer byte-identical to the card's.
  Sites with a header logo also check that the logo loads.

## Tests

`npm test` runs the Playwright suite against a local server: the count
relationships above, cache/late-response races, icon integrity, Pages links,
the grid's column growth from phone width to 2560px, and a fork served from
another account's Pages address showing that account. `npm run test:live` is the
opt-in network check described above. It also checks that
`https://shubin123.github.io/` still redirects to the portfolio.

GitHub Actions run both: `e2e` (icons and the local suite) on every push and
pull request, and `live` on every push to `main` and daily.

Because the GitHub REST API only returns public repositories for
unauthenticated requests, the page can never expose private projects.

Results are cached in `localStorage` — repos, gists, and profile info (which
carries the public gist count) for 30 minutes — and while the cache is fresh, page loads skip
the network call entirely. This matters because GitHub's unauthenticated API
allows only 60 requests/hour per visitor IP, and that quota is consumed even
by conditional (ETag) requests that return a 304, so caching is the only real
lever. A "Refresh" link next to the status line lets a visitor force an
immediate check of repos, profile, and gists without waiting out the cache window. If a refresh fails
(e.g. rate limited), the page falls back to the cached copy and says how old
it is.

## Fork it for your own account

The page works out which account to show from its own address: served from
`https://<you>.github.io/portfolio/`, it lists `<you>`'s public repos, profile
and gists. You don't need to edit any code.

1. **Fork** this repo: the **Fork** button at the top of
   [Shubin123/portfolio](https://github.com/Shubin123/portfolio). You can keep
   the name `portfolio` or rename it. The page works under any repo name.
2. In your fork, open **Settings → Pages** and set **Source** to
   *Deploy from a branch*, branch `main`, folder `/ (root)`, then **Save**.
   Forks don't inherit Pages settings, so this step is required.
3. Wait a minute for the first deploy, then visit
   `https://<you>.github.io/portfolio/`.
4. *(Optional)* Set the fork's **About → Website** to that URL so it shows on
   the repo page.

What carries over and what doesn't:

- **Your projects show up automatically.** The repo grid, profile header,
  "View on GitHub" link, gist widget and Pages links all use your account.
- **Project marks** are drawn for this account's repos. Your repos get the
  generic fallback mark until you add entries to `scripts/generate-icons.py`.
- **Local preview and custom domains** can't infer an account from the
  address, so they use the default at the top of `assets/js/main.js`. Change
  it to your username if you preview locally or use your own domain:

  ```js
  const DEFAULT_GITHUB_USERNAME = "Shubin123";
  ```

- **CI**: GitHub turns Actions off in new forks. Enable them on the fork's
  **Actions** tab to get the `e2e` checks on every push and pull request.
  The `live` workflow checks this account's real deployments, so it skips
  itself in forks.

### Make `https://<you>.github.io/` open the portfolio too

GitHub serves the bare user address from a repo named exactly
`<you>.github.io`. [Shubin123/shubin123.github.io](https://github.com/Shubin123/shubin123.github.io)
is a one-page redirect that sends visitors to `/portfolio/` on whichever
account serves it:

1. Click **Use this template → Create a new repository**, or fork it and rename
   the fork.
2. Name the new repo `<you>.github.io`. The name must match your username.
3. If you renamed your portfolio fork, change `/portfolio/` in its
   `index.html` to the new name.
4. Turn on Pages (`main`, root) as above if GitHub hasn't already.

## Running locally

Fetch requests need an HTTP origin, so open it via a local server rather than
double-clicking the file:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying (GitHub Pages)

1. Push this repo to GitHub.
2. In the repo's **Settings → Pages**, set the source to the `main` branch, root folder.
3. GitHub will publish `index.html` at `https://<username>.github.io/<repo>/`.

No further deploys are needed when you add new repos — the page fetches live
on every visit. A brand-new repo shows the fallback mark until it gets its own
entry in `scripts/generate-icons.py`.
