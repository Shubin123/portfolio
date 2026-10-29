"""Build the page's translations with DeepL: every UI string plus the live GitHub text.

The page is static and DeepL keys must stay secret, so translation happens here
rather than in the browser. Each language in LANGUAGES gets a dictionary keyed by
the English text, assets/i18n/<code>.json, and assets/js/languages.js lists them
with a hash of each, so browsers can keep a dictionary cached until it changes.
Run it whenever UI strings change or new repos and gists are published:

    DEEPL_AUTH_KEY=... python3 scripts/translate.py               # translate what's new
    DEEPL_AUTH_KEY=... python3 scripts/translate.py --lang fr,de  # only these languages
    DEEPL_AUTH_KEY=... python3 scripts/translate.py --all         # re-translate everything
    python3 scripts/translate.py --check                          # offline: every UI string has a translation

Existing translations are reused, so a routine run only spends DeepL characters
on text that is new since the last run. To add a language, add it to LANGUAGES.
"""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[1]
I18N_DIR = root / 'assets/i18n'
LANGUAGES_JS = root / 'assets/js/languages.js'
MAIN_JS = (root / 'assets/js/main.js').read_text()
JS_SOURCES = [MAIN_JS, (root / 'assets/js/i18n.js').read_text()]
USER = re.search(r'const DEFAULT_GITHUB_USERNAME = "([^"]+)"', MAIN_JS)[1]

# A sample count for each CLDR plural category the language uses for whole
# numbers, i.e. what Intl.PluralRules can pick in the browser. Each category gets
# its own translation, so a count agrees with its noun: 1 файл, 3 файла, 25 файлов.
ONE_OTHER = {'one': 1, 'other': 25}
OTHER = {'other': 25}
# DeepL otherwise reads "gist" as the English word for a summary.
GIST_TERMS = {'gist': 'Gist', 'gists': 'Gist', 'Gist': 'Gist', 'Gists': 'Gist'}
# Menu order. `glossary` pins terms DeepL gets wrong for that language, `article`
# matches one it puts in front of a tag, and `spaces` is False for scripts that
# don't separate words.
LANGUAGES = {
    'de': {'deepl': 'DE', 'label': 'Deutsch', 'plural': ONE_OTHER, 'article': r'(der|die|das) '},
    'es': {'deepl': 'ES', 'label': 'Español', 'plural': ONE_OTHER, 'article': r'(el|la|los|las) ',
           'glossary': {'fork': 'bifurcación', 'forks': 'bifurcaciones'}},
    'fr': {'deepl': 'FR', 'label': 'Français', 'plural': ONE_OTHER, 'article': r"(le|la|les) |l'",
           'glossary': {'tag': 'étiquette', 'tags': 'étiquettes', 'Tagged': 'Étiqueté'}},
    'pt-BR': {'deepl': 'PT-BR', 'label': 'Português (Brasil)', 'short': 'Português', 'plural': ONE_OTHER,
              'article': r'(o|a|os|as) '},
    'ru': {'deepl': 'RU', 'label': 'Русский', 'plural': {'one': 1, 'few': 3, 'many': 25},
           'glossary': {'gist': 'гист', 'gists': 'гисты', 'Gist': 'Гист', 'Gists': 'Гисты'}},
    'ja': {'deepl': 'JA', 'label': '日本語', 'plural': OTHER, 'spaces': False, 'glossary': GIST_TERMS},
    'ko': {'deepl': 'KO', 'label': '한국어', 'plural': OTHER, 'glossary': GIST_TERMS},
    # GitHub's own Simplified Chinese terms, so the page reads like github.com in Chinese.
    'zh': {'deepl': 'ZH-HANS', 'label': '中文（简体）', 'short': '中文', 'html': 'zh-CN', 'plural': OTHER, 'spaces': False, 'glossary': {
        **GIST_TERMS,
        'fork': '复刻', 'forks': '复刻', 'Fork': '复刻', 'non-forks': '非复刻',
        'repo': '仓库', 'repos': '仓库', 'repository': '仓库', 'repositories': '仓库',
        'star': '星标', 'stars': '星标', 'GitHub': 'GitHub', 'cluster': '分组', 'clusters': '分组',
    }},
}
CONTEXT = {
    'ui': "Short interface labels, buttons and status messages on a developer's portfolio website that lists their public GitHub repositories and gists.",
    'counts': "Counters on a developer's portfolio website that lists their GitHub repositories: how many GitHub stars or forks a repository has, how many files a gist contains, how many projects carry a tag.",
    'content': 'Descriptions of software projects and code snippets that a developer published on GitHub.',
}
# Labels too short for DeepL to read correctly on their own get a request of their own with this context.
HINTS = {
    'Sort projects': 'Accessible name of the dropdown menu that chooses the sort order of a list of projects.',
    'Recently pushed': 'Sort option: projects with the most recent code pushes first.',
    'Recently created': 'Sort option: the most recently created projects first.',
    'Most stars': 'Sort option: projects with the most GitHub stars first.',
    'Focus cluster': 'Imperative button label (a verb, not a noun): focus on this group of projects, i.e. show only this group.',
    'Pull down gists widget': 'Imperative tooltip of a button (a verb, not a noun): pull down, i.e. expand, the collapsed sidebar panel listing gists.',
    '+{count} more': 'Button that reveals the {count} remaining tags of a list; it means "{count} more".',
    'Check GitHub for new projects now': 'Tooltip of the Refresh button: clicking it checks GitHub for new projects now.',
    'Show only #{tag} projects': 'Tooltip of a button that filters the page to show only the projects tagged #{tag}.',
    'Collapse back to top {count} tags': 'Tooltip of a button that shrinks the expanded tag list so it lists only the {count} most used tags again.',
}
# Labels DeepL misreads however they're explained go to it reworded, same meaning.
REWORDED = {'Focus cluster': 'Show only this cluster'}
# A bare tag like "vision" or "gemini" is ambiguous, so tags are translated inside a sentence.
TAG_FRAME = 'Software project topic: <t>{}</t>'
GLOSSARY_PREFIX = 'portfolio-github-terms-'
# Placeholders go to DeepL as sample values. PLAIN ones go in as plain text, which
# DeepL words a sentence around far better than a tag ("25 stars" rather than a
# 25-star rating, "Updated 3 days ago" rather than "Updated v<ph>"), and are found
# in the output again by their own translation. The rest are tagged, so DeepL
# leaves them alone.
PLAIN = ('count', 'time', 'error')
PHRASES = ('time', 'error')
SAMPLES = {'time': '3 days ago', 'error': 'GitHub API error (500)', 'tag': 'robotics', 'query': 'parser',
           'login': USER, 'user': USER, 'status': '500'}
UI_COUNT = 12
JS_STRING = r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\''
T_CALL = re.compile(rf'\b(?:t|localizedError)\(\s*({JS_STRING})')
PLURAL_CALL = re.compile(rf'\bplural\(\s*[^,]+,\s*({JS_STRING})\s*,\s*({JS_STRING})')


def normalize(text):
    return ' '.join(text.split())


def js_literal(token):
    body = token[1:-1]
    if token[0] == "'":
        body = body.replace("\\'", "'").replace('"', '\\"')
    return json.loads(f'"{body}"')


class StaticStrings(HTMLParser):
    """Collects text marked data-i18n and attributes listed in data-i18n-attr."""

    def __init__(self):
        super().__init__()
        self.found, self.capture = [], None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.found += [normalize(attrs[name]) for name in (attrs.get('data-i18n-attr') or '').split()]
        if 'data-i18n' in attrs:
            self.capture = []

    def handle_data(self, data):
        if self.capture is not None:
            self.capture.append(data)

    def handle_endtag(self, tag):
        if self.capture is not None:
            self.found.append(normalize(''.join(self.capture)))
            self.capture = None


def ui_strings():
    """UI strings, and the plural() pairs as {other template: one template}."""
    parser = StaticStrings()
    parser.feed((root / 'index.html').read_text())
    strings, plurals = set(parser.found), {}
    for source in JS_SOURCES:
        strings.update(js_literal(match[1]) for match in T_CALL.finditer(source))
        plurals.update((js_literal(match[2]), js_literal(match[1])) for match in PLURAL_CALL.finditer(source))
    return {text for text in strings if text}, plurals


def js_array_strings(name):
    block = re.search(rf'const {name} = [\[{{](.*?)\n[\]}}];', MAIN_JS, re.S)[1]
    return {tag for array in re.findall(r'\[([^\]]*)\]', block) for tag in re.findall(r'"([^"]+)"', array)}


def github(path):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'portfolio-translate'}
    if os.environ.get('GITHUB_TOKEN'):
        headers['Authorization'] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    with urllib.request.urlopen(urllib.request.Request(f'https://api.github.com{path}', headers=headers)) as res:
        return json.load(res)


def github_text():
    """The same public data the page fetches: profile bio, repos, and the latest 100 gists."""
    profile = github(f'/users/{USER}')
    repos, page = [], 1
    while True:
        batch = github(f'/users/{USER}/repos?type=public&sort=updated&per_page=100&page={page}')
        repos += batch
        if len(batch) < 100:
            break
        page += 1
    repos = [repo for repo in repos if not repo.get('private')]
    # A token for this account also lists its secret gists, so page until there are 100 public ones.
    gists, page = [], 1
    while len(gists) < 100:
        batch = github(f'/users/{USER}/gists?per_page=100&page={page}')
        gists += [gist for gist in batch if gist.get('public') is not False]
        if len(batch) < 100:
            break
        page += 1
    gists = gists[:100]

    content = {profile.get('bio') or ''} | {repo.get('description') or '' for repo in repos}
    content |= {gist.get('description') or '' for gist in gists}
    tags = {str(topic).lower().strip() for repo in repos for topic in repo.get('topics') or []}
    tags |= js_array_strings('PROJECT_TAGS_MAP') | {'desert-ant', 'ai'}
    return {text.strip() for text in content if text.strip()}, {tag for tag in tags if tag}


class DeepL:
    def __init__(self, key):
        self.key = key
        self.base = 'https://api-free.deepl.com' if key.endswith(':fx') else 'https://api.deepl.com'
        self.glossary_ids = {}  # language -> glossary id, at most one at a time
        self.leftovers_dropped = False
        self.phrases = {}
        self.characters = 0

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        headers = {'Authorization': f'DeepL-Auth-Key {self.key}', 'Content-Type': 'application/json'}
        for attempt in range(6):
            request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(request) as res:
                    raw = res.read()
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as err:
                if err.code in (429, 500, 502, 503, 504) and attempt < 5:
                    time.sleep(2 ** attempt)
                    continue
                detail = err.read().decode(errors='replace')
                sys.exit(f'DeepL {method} {path} failed with HTTP {err.code}: {detail}')

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.drop_glossaries(keep=None)

    def drop_glossaries(self, keep):
        for lang in [lang for lang in self.glossary_ids if lang != keep]:
            self.call('DELETE', f'/v2/glossaries/{self.glossary_ids.pop(lang)}')

    def drop_leftover_glossaries(self):
        """Deletes glossaries a killed run (e.g. a cancelled CI job) left behind, which would use up Free's one."""
        if self.leftovers_dropped:
            return
        self.leftovers_dropped = True
        for glossary in self.call('GET', '/v2/glossaries')['glossaries']:
            if glossary['name'].startswith(GLOSSARY_PREFIX):
                self.call('DELETE', f"/v2/glossaries/{glossary['glossary_id']}")

    def glossary(self, lang):
        """A temporary glossary of the language's pinned terms. DeepL Free allows only one at a time."""
        self.drop_glossaries(keep=lang)
        entries = LANGUAGES[lang].get('glossary')
        if entries and lang not in self.glossary_ids:
            self.drop_leftover_glossaries()
            self.glossary_ids[lang] = self.call('POST', '/v2/glossaries', {
                'name': GLOSSARY_PREFIX + lang, 'source_lang': 'en',
                'target_lang': LANGUAGES[lang]['deepl'].split('-')[0].lower(),
                'entries': '\n'.join(f'{source}\t{target}' for source, target in entries.items()),
                'entries_format': 'tsv',
            })['glossary_id']
        return self.glossary_ids.get(lang)

    def renditions(self, lang, count):
        """How each plain sample reads in the language, to find it in a translation."""
        if lang not in self.phrases:
            self.phrases[lang] = dict(zip(PHRASES, self.translate(lang, [SAMPLES[name] for name in PHRASES], CONTEXT['ui'])))
        return {'count': str(count), **self.phrases[lang]}

    def translate(self, lang, texts, context=None):
        out = []
        for i in range(0, len(texts), 50):
            batch = texts[i:i + 50]
            self.characters += sum(len(text) for text in batch)
            body = {
                'text': batch, 'source_lang': 'EN', 'target_lang': LANGUAGES[lang]['deepl'],
                'tag_handling': 'xml', 'ignore_tags': ['ph'],
            }
            glossary = self.glossary(lang)
            if glossary:
                body['glossary_id'] = glossary
            if context:
                body['context'] = context
            out += [item['text'] for item in self.call('POST', '/v2/translate', body)['translations']]
        return out


def encode(text, samples, plain):
    """DeepL input for a UI template: `plain` placeholders as their sample text, the
    rest as tagged samples (a "#" in front of one rides inside its tag)."""
    def placeholder(match):
        prefix, name = match[1], match[2]
        if name in plain:
            return prefix + html.escape(samples[name], quote=False)
        return f'<ph id="{name}">{prefix}{html.escape(samples.get(name, "12"), quote=False)}</ph>'
    return re.sub(r'(#?)\{(\w+)\}', placeholder, html.escape(text, quote=False))


def decode(text, renditions):
    """Turns DeepL output back into a template, or None if a plain sample isn't in it exactly once."""
    text = html.unescape(re.sub(r'<ph id="(\w+)">(#?).*?</ph>', r'\2{\1}', text, flags=re.S)).strip()
    for name, rendition in renditions.items():
        pattern = rf'(?<!\d){rendition}(?!\d)' if rendition.isdigit() else re.escape(rendition.rstrip('.。'))
        text, found = re.subn(pattern, lambda _: f'{{{name}}}', text, flags=re.I)
        if found != 1:
            return None
    return text


def placeholders(text):
    return sorted(re.findall(r'\{(\w+)\}', text))


def translate_templates(deepl, lang, jobs, context):
    """Translates (template, sample count) jobs with plain samples, then retries any
    where one didn't survive with every placeholder tagged. None marks a template
    DeepL broke both ways."""
    if not jobs:
        return []
    out = [None] * len(jobs)

    def attempt(indices, plain):
        texts, expected = [], []
        for i in indices:
            source, count = jobs[i]
            names = set(placeholders(source))
            renditions = deepl.renditions(lang, count)
            samples = {**SAMPLES, 'count': str(count), 'shown': str(min(12, count - 1))}  # never "12 of 1"
            if not plain:
                samples |= renditions  # tagged phrases in the target language, so DeepL doesn't reword around them
            texts.append(encode(source, samples, names & set(plain)))
            expected.append({name: renditions[name] for name in names & set(plain)})
        for i, raw, renditions in zip(indices, deepl.translate(lang, texts, context), expected):
            text = decode(raw, renditions)
            if text is None or placeholders(text) != placeholders(jobs[i][0]):
                continue
            # A tagged placeholder sometimes loses its space or drags in a stray letter ("Aktualisiert v{time}").
            if LANGUAGES[lang].get('spaces', True) and re.search(r'[^\W\d_]#?\{', text):
                continue
            out[i] = text

    attempt(range(len(jobs)), PLAIN)
    retry = [i for i, text in enumerate(out) if text is None]
    if retry:
        attempt(retry, ())
    return out


def decode_tag(lang, tag, text):
    match = re.search(r'<t>(.*?)</t>', text, re.S)
    translated = html.unescape(match[1]).lstrip('#').strip() if match else ''
    if LANGUAGES[lang].get('article'):
        translated = re.sub(rf"^(?:{LANGUAGES[lang]['article']})", '', translated, flags=re.I)
    # DeepL keeps names like "opengl" as-is (or only recases them); store the tag itself so it isn't re-sent.
    if not translated or translated.isascii() and translated.casefold() == tag.replace('-', ' ').casefold():
        return tag
    return translated


def dictionary_path(lang):
    return I18N_DIR / f'{lang}.json'


def load_dictionary(lang):
    path = dictionary_path(lang)
    current = json.loads(path.read_text()) if path.exists() else {}
    return {table: current.get(table, {}) for table in ('strings', 'plurals', 'tags')}


def dictionary_text(lang, dictionary):
    output = {'source': 'en', 'target': html_lang(lang), 'engine': 'DeepL'}
    output |= {table: dict(sorted(dictionary[table].items())) for table in ('strings', 'plurals', 'tags')}
    return json.dumps(output, ensure_ascii=False, indent=2) + '\n'


def html_lang(lang):
    return LANGUAGES[lang].get('html', lang)


def languages_js():
    """The menu's language list, with a hash of each dictionary as its cache version."""
    entries = {}
    for lang, config in LANGUAGES.items():
        path = dictionary_path(lang)
        version = hashlib.sha256(path.read_bytes()).hexdigest()[:12] if path.exists() else ''
        entry = {'label': config['label'], 'short': config.get('short'), 'htmlLang': html_lang(lang), 'version': version}
        entries[lang] = {name: value for name, value in entry.items() if value is not None}
    return ('// Generated by scripts/translate.py from its LANGUAGES table: edit that and re-run it.\n'
            '// Each version is a hash of that dictionary, so browsers can cache it until it changes.\n'
            f'const TRANSLATIONS = {json.dumps(entries, ensure_ascii=False, indent=2)};\n')


def missing_entries(lang, dictionary, ui, plurals):
    missing = sorted(ui - dictionary['strings'].keys())
    for other in sorted(plurals):
        forms = dictionary['plurals'].get(other, {})
        missing += [f'{other} [{category}]' for category in LANGUAGES[lang]['plural'] if category not in forms]
    return missing


def translate_language(deepl, lang, current, ui, plurals, content, tags, reuse):
    """The language's dictionary: reusable entries plus fresh translations of everything else."""
    config = LANGUAGES[lang]
    fresh = {'strings': {}, 'plurals': {}, 'tags': {}}

    def todo(table, sources):
        pending = []
        for source in sorted(sources):
            if reuse and source in current[table]:
                fresh[table][source] = current[table][source]
            else:
                pending.append(source)
        return pending

    pending_tags = todo('tags', tags)
    frames = [TAG_FRAME.format(html.escape(tag.replace('-', ' '), quote=False)) for tag in pending_tags]
    for tag, translated in zip(pending_tags, deepl.translate(lang, frames)):
        fresh['tags'][tag] = decode_tag(lang, tag, translated)

    pending_ui = todo('strings', ui)
    plain = [s for s in pending_ui if s not in HINTS]
    jobs = [(REWORDED.get(s, s), UI_COUNT) for s in plain]
    results = list(zip(plain, translate_templates(deepl, lang, jobs, CONTEXT['ui'])))
    for source in (s for s in pending_ui if s in HINTS):
        results += zip([source], translate_templates(deepl, lang, [(REWORDED.get(source, source), UI_COUNT)], HINTS[source]))

    jobs, keys = [], []
    for other, one in sorted(plurals.items()):
        forms = current['plurals'].get(other, {}) if reuse else {}
        fresh['plurals'][other] = {category: forms[category] for category in config['plural'] if category in forms}
        for category, sample in config['plural'].items():
            if category not in forms:
                jobs.append((one if category == 'one' else other, sample))
                keys.append((other, category))
    for (other, category), translated in zip(keys, translate_templates(deepl, lang, jobs, CONTEXT['counts'])):
        if translated is None:
            print(f'  {lang}: skipped {other!r} [{category}], DeepL changed its placeholders')
        else:
            fresh['plurals'][other][category] = translated
    for other, forms in fresh['plurals'].items():
        fresh['plurals'][other] = {category: forms[category] for category in config['plural'] if category in forms}

    for source, translated in results:
        if translated is None:
            print(f'  {lang}: skipped {source!r}, DeepL changed its placeholders')
        else:
            fresh['strings'][source] = translated

    pending_content = todo('strings', content - ui)
    texts = [html.escape(text, quote=False) for text in pending_content]
    for source, translated in zip(pending_content, deepl.translate(lang, texts, CONTEXT['content'])):
        fresh['strings'][source] = html.unescape(translated).strip()
    return fresh, len(pending_tags) + len(pending_ui) + len(jobs) + len(pending_content)


def write_if_changed(path, text):
    if path.exists() and path.read_text() == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return True


def main():
    args = sys.argv[1:]
    langs = list(LANGUAGES)
    if '--lang' in args:
        langs = args[args.index('--lang') + 1].split(',')
        unknown = [lang for lang in langs if lang not in LANGUAGES]
        if unknown:
            sys.exit(f"Unknown language {', '.join(unknown)}; choose from {', '.join(LANGUAGES)}.")
    ui, plurals = ui_strings()

    if '--check' in args:
        problems = []
        for lang in langs:
            missing = missing_entries(lang, load_dictionary(lang), ui, plurals)
            if missing:
                problems.append(f'{lang} is missing:\n  ' + '\n  '.join(missing))
        if not LANGUAGES_JS.exists() or LANGUAGES_JS.read_text() != languages_js():
            problems.append(f'{LANGUAGES_JS.relative_to(root)} is out of date.')
        if problems:
            sys.exit('\n'.join(problems) + '\nRun scripts/translate.py with DEEPL_AUTH_KEY to fix.')
        print(f'All {len(ui) + len(plurals)} UI strings have translations in {", ".join(langs)}.')
        return

    key = os.environ.get('DEEPL_AUTH_KEY')
    if not key:
        sys.exit('Set DEEPL_AUTH_KEY to a DeepL API key.')
    content, tags = github_text()
    with DeepL(key) as deepl:
        for lang in langs:
            dictionary, count = translate_language(deepl, lang, load_dictionary(lang), ui, plurals, content, tags,
                                                   reuse='--all' not in args)
            path = dictionary_path(lang)
            changed = write_if_changed(path, dictionary_text(lang, dictionary))
            print(f"{lang}: translated {count} new strings and tags; "
                  f"{path.relative_to(root)} {'updated' if changed else 'is up to date'}.")
        print(f'Sent {deepl.characters} characters to DeepL.')
    if write_if_changed(LANGUAGES_JS, languages_js()):
        print(f'Wrote {LANGUAGES_JS.relative_to(root)}.')


if __name__ == '__main__':
    main()
