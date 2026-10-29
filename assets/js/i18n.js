// English is the page's source language. Every other language is a dictionary
// keyed by the English text, built ahead of time by scripts/translate.py with
// DeepL, so the DeepL key never reaches the browser. TRANSLATIONS (generated into
// languages.js) lists them. A dictionary is downloaded only when a visitor picks
// its language, then kept in memory and in localStorage until its version
// changes. Anything a dictionary is missing (e.g. a repo created since the last
// translation run) falls back to English.
const LANGUAGES = {
  en: { label: "English", htmlLang: "en" },
  ...(typeof TRANSLATIONS === "object" ? TRANSLATIONS : {}),
};
const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "gh-portfolio-lang";
const DICTIONARY_CACHE_PREFIX = "gh-portfolio-i18n:";

const i18n = {
  lang: DEFAULT_LANGUAGE,
  dict: null, // { version, strings, plurals, tags } for i18n.lang, null for English
  dicts: {},
  pluralRules: {},
  request: 0,
  staticSources: new Map(),
  onChange: () => {},
};

// Translates English UI text or GitHub content. scripts/translate.py extracts
// the string-literal arguments of t() and plural() calls, so keep UI strings as
// literals at the call site.
function t(source, vars) {
  return fill((i18n.dict && i18n.dict.strings[source]) || source, vars);
}

// Dictionaries hold a form for each plural category of their language (Russian
// has three, Chinese one); English and untranslated text use one/other.
function plural(count, one, other, vars = {}) {
  const forms = i18n.dict && i18n.dict.plurals[other];
  const template = (forms && (forms[pluralCategory(count)] || forms.other)) || (count === 1 ? one : other);
  return fill(template, { ...vars, count });
}

function fill(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in vars)) return match;
    return typeof vars[name] === "number" ? formatNumber(vars[name]) : String(vars[name]);
  });
}

function formatNumber(value) {
  return value.toLocaleString(currentLocale());
}

function pluralCategory(count) {
  const locale = currentLocale();
  i18n.pluralRules[locale] ||= new Intl.PluralRules(locale);
  return i18n.pluralRules[locale].select(count);
}

function tagLabel(tag) {
  return (i18n.dict && i18n.dict.tags[tag]) || tag;
}

function currentLocale() {
  return LANGUAGES[i18n.lang].htmlLang;
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function initLanguage(onChange) {
  i18n.onChange = onChange;
  document.querySelectorAll("[data-i18n], [data-i18n-attr]").forEach((el) => {
    const source = { text: null, attrs: {} };
    if (el.hasAttribute("data-i18n")) source.text = normalizeText(el.textContent);
    for (const name of (el.dataset.i18nAttr || "").split(/\s+/).filter(Boolean)) {
      source.attrs[name] = normalizeText(el.getAttribute(name) || "");
    }
    i18n.staticSources.set(el, source);
  });
  bindLanguageMenu();

  let saved = null;
  try {
    saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage unavailable — stay on the default language.
  }
  // A cached dictionary applies synchronously, before the first render.
  if (saved && saved !== DEFAULT_LANGUAGE && LANGUAGES[saved]) setLanguage(saved, { persist: false });
}

async function setLanguage(lang, { persist = true } = {}) {
  const config = LANGUAGES[lang];
  if (!config) return;
  const request = ++i18n.request;
  let dict = null;

  if (lang !== DEFAULT_LANGUAGE) {
    dict = i18n.dicts[lang] || readCachedDictionary(lang);
    if (!dict) {
      setLanguageBusy(true);
      try {
        dict = await downloadDictionary(lang);
      } catch {
        if (request === i18n.request) {
          setLanguageBusy(false);
          renderLanguageMenu(t("Translation unavailable right now."));
        }
        return;
      }
    }
    i18n.dicts[lang] = dict;
  }
  if (request !== i18n.request) return; // a later choice won the race

  i18n.lang = lang;
  i18n.dict = dict;
  setLanguageBusy(false);
  document.documentElement.lang = config.htmlLang;
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Storage unavailable — the choice still applies to this visit.
    }
  }
  applyStaticTranslations();
  renderLanguageMenu();
  i18n.onChange();
}

// The version is a hash of the dictionary, so a stored copy is good until
// translate.py publishes a different one.
function readCachedDictionary(lang) {
  try {
    const cached = JSON.parse(localStorage.getItem(DICTIONARY_CACHE_PREFIX + lang));
    if (cached && cached.version === LANGUAGES[lang].version) return cached;
  } catch {
    // Storage unavailable or corrupt — download instead.
  }
  return null;
}

async function downloadDictionary(lang) {
  const { version } = LANGUAGES[lang];
  const res = await fetch(`assets/i18n/${lang}.json?v=${version}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const dict = { version, strings: data.strings || {}, plurals: data.plurals || {}, tags: data.tags || {} };
  try {
    localStorage.setItem(DICTIONARY_CACHE_PREFIX + lang, JSON.stringify(dict));
  } catch {
    // Storage full or unavailable — the dictionary still applies to this visit.
  }
  return dict;
}

function applyStaticTranslations() {
  for (const [el, source] of i18n.staticSources) {
    if (source.text !== null) el.textContent = t(source.text);
    for (const [name, value] of Object.entries(source.attrs)) el.setAttribute(name, t(value));
  }
}

function languageMenuEls() {
  return {
    toggle: document.getElementById("lang-toggle"),
    current: document.getElementById("lang-current"),
    options: document.getElementById("lang-options"),
    list: document.getElementById("lang-list"),
    note: document.getElementById("lang-note"),
    items: [...document.querySelectorAll("#lang-options [data-lang]")],
  };
}

function bindLanguageMenu() {
  const { toggle, options, list } = languageMenuEls();
  if (!toggle || !options || !list) return;

  list.replaceChildren(...Object.entries(LANGUAGES).map(([code, config]) => {
    const item = document.createElement("li");
    item.setAttribute("role", "none");
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitemradio");
    button.dataset.lang = code;
    button.lang = config.htmlLang;
    button.textContent = config.label;
    item.appendChild(button);
    return item;
  }));
  const { items } = languageMenuEls();

  toggle.addEventListener("click", () => {
    setLanguageMenuOpen(options.hidden);
  });
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setLanguageMenuOpen(true);
    }
  });
  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      setLanguageMenuOpen(false);
      toggle.focus();
      if (item.dataset.lang !== i18n.lang) setLanguage(item.dataset.lang);
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        items[(index + step + items.length) % items.length].focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        items[e.key === "Home" ? 0 : items.length - 1].focus();
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !options.hidden) {
      setLanguageMenuOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!options.hidden && !e.target.closest("#lang-menu")) setLanguageMenuOpen(false);
  });
  renderLanguageMenu();
}

function setLanguageMenuOpen(open) {
  const { toggle, options, items } = languageMenuEls();
  options.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) (items.find((item) => item.dataset.lang === i18n.lang) || items[0]).focus();
}

function setLanguageBusy(busy) {
  const { toggle } = languageMenuEls();
  if (toggle) toggle.setAttribute("aria-busy", String(busy));
}

function renderLanguageMenu(noteOverride) {
  const { current, note, items } = languageMenuEls();
  const config = LANGUAGES[i18n.lang];
  if (current) current.textContent = config.short || config.label;
  items.forEach((item) => item.setAttribute("aria-checked", String(item.dataset.lang === i18n.lang)));
  if (note) note.textContent = noteOverride || t("Translations by DeepL");
}
