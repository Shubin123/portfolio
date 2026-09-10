# Portfolio | https://shubin123.github.io/portfolio/

A static, single-page project showcase that pulls public GitHub repositories
live at page load. There's no build step, no backend, and no database — the
page calls the public GitHub REST API directly from the browser, so it always
reflects whatever public repos currently exist on the account, including new
ones, with nothing to keep in sync.

## How it works

- `index.html` — page structure (profile header, search/sort controls, project grid).
- `assets/css/style.css` — styling, including a dark theme that follows the visitor's OS preference.
- `assets/js/main.js` — fetches `https://api.github.com/users/<username>/repos` and `.../users/<username>` on load, then renders/filters/sorts the results client-side.
- `assets/icons/*.svg` + `assets/js/icons.js` — one mark per project (see below).

The header counts a repository once: **public repos = non-forks + forks**, all
three read off the same list the grid renders, so the total never disagrees with
what is on screen. Forks are hidden by default and the status line says how many
that is; the toggle shows them without changing the total.

## Project marks

Every card carries a hand-drawn SVG mark instead of an emoji, and the same file
ships on the project's own Pages site as its favicon and header logo, so a card
and the site it links to read as one project.

- `scripts/generate-icons.py` holds the geometry and writes both
  `assets/icons/<repo>.svg` and the `assets/js/icons.js` lookup. Add an entry
  there and re-run it (`python3 scripts/generate-icons.py`) to add a project;
  anything without a mark falls back to `project.svg`.
- `npm run check:icons` asserts every project in `tests/repos.json` has a mark
  and that the marks are pure vector geometry — no `<text>`, `<image>`,
  `<script>`, or emoji, so they stay crisp at any size and need no font.
- `scripts/icon-sites.json` records where each deployed site keeps its copy.
  `npm run test:live` fetches all 14 Pages deployments and fails if a site's
  icon is missing, unreachable, or no longer byte-identical to the card's.

## Tests

`npm test` runs the Playwright suite against a local server: the count
relationships above, cache/late-response races, icon integrity, Pages links, and
the grid's column growth from phone width to 2560px. `npm run test:live` is the
opt-in network check described above.

Because the GitHub REST API only returns public repositories for
unauthenticated requests, the page can never expose private projects.

Results are cached in `localStorage` — repos for 30 minutes, profile info for
24 hours (it rarely changes) — and while the cache is fresh, page loads skip
the network call entirely. This matters because GitHub's unauthenticated API
allows only 60 requests/hour per visitor IP, and that quota is consumed even
by conditional (ETag) requests that return a 304, so caching is the only real
lever. A "Refresh" link next to the status line lets a visitor force an
immediate check without waiting out the cache window. If a refresh fails
(e.g. rate limited), the page falls back to the cached copy and says how old
it is.

## Changing the GitHub account

Edit the constant at the top of `assets/js/main.js`:

```js
const GITHUB_USERNAME = "Shubin123";
```

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
