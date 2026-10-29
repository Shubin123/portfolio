// English is the page's source language. Other languages are dictionaries keyed
// by the English text, built ahead of time by scripts/translate.py with DeepL,
// so the DeepL key never reaches the browser. Anything a dictionary is missing
// (e.g. a repo created since the last translation run) falls back to English.
const LANGUAGES = {
  en: { label: "English", htmlLang: "en", locale: "en" },
  zh: { label: "中文（简体）", short: "中文", htmlLang: "zh-CN", locale: "zh-CN", url: "assets/i18n/zh.json" },
};
const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "gh-portfolio-lang";

const i18n = {
  lang: DEFAULT_LANGUAGE,
  dict: null, // { strings, tags } for i18n.lang, null for English
  dicts: {},
  request: 0,
  staticSources: new Map(),
  onChange: () => {},
};

// Translates English UI text or GitHub content. scripts/translate.py extracts
// the string-literal arguments of t() and plural() calls, so keep UI strings as
// literals at the call site.
function t(source, vars) {
  const template = (i18n.dict && i18n.dict.strings[source]) || source;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

function plural(count, one, other, vars = {}) {
  return t(count === 1 ? one : other, { count: count.toLocaleString(), ...vars });
}

function tagLabel(tag) {
  return (i18n.dict && i18n.dict.tags[tag]) || tag;
}

function currentLocale() {
  return LANGUAGES[i18n.lang].locale;
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
  if (saved && saved !== DEFAULT_LANGUAGE && LANGUAGES[saved]) setLanguage(saved, { persist: false });
}

async function setLanguage(lang, { persist = true } = {}) {
  if (!LANGUAGES[lang]) return;
  const request = ++i18n.request;
  const config = LANGUAGES[lang];
  let dict = null;

  if (config.url) {
    dict = i18n.dicts[lang];
    if (!dict) {
      setLanguageBusy(true);
      try {
        const res = await fetch(config.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        dict = { strings: data.strings || {}, tags: data.tags || {} };
        i18n.dicts[lang] = dict;
      } catch {
        if (request === i18n.request) {
          setLanguageBusy(false);
          renderLanguageMenu(t("Translation unavailable right now."));
        }
        return;
      }
    }
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
    note: document.getElementById("lang-note"),
    items: [...document.querySelectorAll("#lang-options [data-lang]")],
  };
}

function bindLanguageMenu() {
  const { toggle, options, items } = languageMenuEls();
  if (!toggle || !options) return;

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
  if (note) note.textContent = noteOverride || t("Chinese translation by DeepL");
}
