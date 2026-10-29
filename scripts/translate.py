"""Build assets/i18n/zh.json with DeepL: every UI string plus the live GitHub text.

The page is static and DeepL keys must stay secret, so translation happens here
rather than in the browser. Run it whenever UI strings change or new repos and
gists are published:

    DEEPL_AUTH_KEY=... python3 scripts/translate.py         # translate what's new
    DEEPL_AUTH_KEY=... python3 scripts/translate.py --all   # re-translate everything
    python3 scripts/translate.py --check                    # offline: every UI string has a translation

Existing translations are reused, so a routine run only spends DeepL characters
on text that is new since the last run.
"""
from html.parser import HTMLParser
from pathlib import Path
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[1]
OUT = root / 'assets/i18n/zh.json'
MAIN_JS = (root / 'assets/js/main.js').read_text()
JS_SOURCES = [MAIN_JS, (root / 'assets/js/i18n.js').read_text()]
USER = re.search(r'const DEFAULT_GITHUB_USERNAME = "([^"]+)"', MAIN_JS)[1]
TARGET_LANG = 'ZH-HANS'

# GitHub's own Simplified Chinese terms, so the page reads like github.com in Chinese.
GLOSSARY = {
    'gist': 'Gist', 'gists': 'Gist', 'Gist': 'Gist', 'Gists': 'Gist',
    'fork': '复刻', 'forks': '复刻', 'Fork': '复刻', 'non-forks': '非复刻',
    'repo': '仓库', 'repos': '仓库', 'repository': '仓库', 'repositories': '仓库',
    'star': '星标', 'stars': '星标', 'GitHub': 'GitHub', 'cluster': '分组', 'clusters': '分组',
}
CONTEXT = {
    'ui': "Short interface labels, buttons and status messages on a developer's portfolio website that lists their public GitHub repositories and gists.",
    'content': 'Descriptions of software projects and code snippets that a developer published on GitHub.',
}
# Labels too short for DeepL to read correctly on their own get a request of their own with this context.
HINTS = {
    'Sort projects': 'Accessible name of the dropdown menu that chooses the sort order of a list of projects.',
    'Recently pushed': 'Sort option: projects with the most recent code pushes first.',
    'Recently created': 'Sort option: the most recently created projects first.',
    'Most stars': 'Sort option: projects with the most GitHub stars first.',
    'Focus cluster': 'Button on one group of projects; clicking it filters the page to show only that group.',
    'Pull down gists widget': 'Tooltip of a button that expands the collapsed sidebar panel listing gists.',
    'Collapse back to top {count} tags': 'Tooltip of a button that shrinks the expanded tag list so it lists only the {count} most used tags again.',
}
# A bare tag like "vision" or "gemini" is ambiguous, so tags are translated inside a sentence.
TAG_FRAME = 'Software project topic: <t>{}</t>'
# Placeholders go to DeepL as untranslatable sample values so it can place them naturally.
SAMPLES = {'shown': '12', 'total': '34', 'time': '3 days ago', 'tag': 'robotics', 'query': 'parser',
           'error': 'GitHub API error (500)', 'login': USER, 'user': USER, 'status': '500'}
JS_STRING = r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\''
JS_CALLS = [
    re.compile(rf'\b(?:t|localizedError)\(\s*({JS_STRING})'),
    re.compile(rf'\bplural\(\s*[^,]+,\s*({JS_STRING})\s*,\s*({JS_STRING})'),
]


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
    parser = StaticStrings()
    parser.feed((root / 'index.html').read_text())
    found = set(parser.found)
    for source in JS_SOURCES:
        for pattern in JS_CALLS:
            for match in pattern.finditer(source):
                found.update(js_literal(token) for token in match.groups())
    return {text for text in found if text}


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
    gists = [gist for gist in github(f'/users/{USER}/gists?per_page=100') if gist.get('public') is not False]

    content = {profile.get('bio') or ''} | {repo.get('description') or '' for repo in repos}
    content |= {gist.get('description') or '' for gist in gists}
    tags = {str(topic).lower().strip() for repo in repos for topic in repo.get('topics') or []}
    tags |= js_array_strings('PROJECT_TAGS_MAP') | {'desert-ant', 'ai'}
    return {text.strip() for text in content if text.strip()}, {tag for tag in tags if tag}


class DeepL:
    def __init__(self, key):
        self.key = key
        self.base = 'https://api-free.deepl.com' if key.endswith(':fx') else 'https://api.deepl.com'
        self.glossary = None
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
        entries = '\n'.join(f'{source}\t{target}' for source, target in GLOSSARY.items())
        self.glossary = self.call('POST', '/v2/glossaries', {
            'name': 'portfolio-github-terms', 'source_lang': 'en', 'target_lang': 'zh',
            'entries': entries, 'entries_format': 'tsv',
        })['glossary_id']
        return self

    def __exit__(self, *exc):
        if self.glossary:
            self.call('DELETE', f'/v2/glossaries/{self.glossary}')

    def translate(self, texts, context=None):
        out = []
        for i in range(0, len(texts), 50):
            batch = texts[i:i + 50]
            self.characters += sum(len(text) for text in batch)
            body = {
                'text': batch, 'source_lang': 'EN', 'target_lang': TARGET_LANG,
                'tag_handling': 'xml', 'ignore_tags': ['ph'], 'glossary_id': self.glossary,
            }
            if context:
                body['context'] = context
            out += [item['text'] for item in self.call('POST', '/v2/translate', body)['translations']]
        return out


def encode(text, templated):
    escaped = html.escape(text, quote=False)
    if not templated:
        return escaped
    return re.sub(r'\{(\w+)\}', lambda m: f'<ph id="{m[1]}">{html.escape(SAMPLES.get(m[1], "12"))}</ph>', escaped)


def decode(text):
    return html.unescape(re.sub(r'<ph id="(\w+)">.*?</ph>', r'{\1}', text, flags=re.S)).strip()


def decode_tag(tag, text):
    match = re.search(r'<t>(.*?)</t>', text, re.S)
    translated = html.unescape(match[1]).lstrip('#').strip() if match else ''
    # DeepL keeps names like "opengl" as-is; store the tag itself so it isn't re-sent.
    return translated if translated and not translated.isascii() else tag


def placeholders(text):
    return sorted(re.findall(r'\{(\w+)\}', text))


def main():
    args = set(sys.argv[1:])
    current = json.loads(OUT.read_text()) if OUT.exists() else {}
    strings, tags = current.get('strings', {}), current.get('tags', {})

    ui = ui_strings()

    if '--check' in args:
        missing = sorted(ui - strings.keys())
        if missing:
            sys.exit('Missing Chinese UI strings (run scripts/translate.py with DEEPL_AUTH_KEY):\n  ' + '\n  '.join(missing))
        print(f'All {len(ui)} UI strings have Chinese translations.')
        return

    key = os.environ.get('DEEPL_AUTH_KEY')
    if not key:
        sys.exit('Set DEEPL_AUTH_KEY to a DeepL API key.')
    reuse = '--all' not in args
    content, tag_names = github_text()
    fresh = {'strings': {}, 'tags': {}}
    todo = {'ui': [], 'content': [], 'tags': []}
    for group, sources in (('ui', ui), ('content', content - ui), ('tags', tag_names)):
        existing, target = (tags, fresh['tags']) if group == 'tags' else (strings, fresh['strings'])
        for source in sorted(sources):
            if reuse and source in existing:
                target[source] = existing[source]
            else:
                todo[group].append(source)

    count = sum(map(len, todo.values()))
    if not count:
        print('Nothing new to translate.')
    else:
        with DeepL(key) as deepl:
            texts = [TAG_FRAME.format(html.escape(tag.replace('-', ' '), quote=False)) for tag in todo['tags']]
            for tag, translated in zip(todo['tags'], deepl.translate(texts)):
                fresh['tags'][tag] = decode_tag(tag, translated)

            for group in ('ui', 'content'):
                templated = group == 'ui'
                plain = [s for s in todo[group] if s not in HINTS]
                results = list(zip(plain, deepl.translate([encode(s, templated) for s in plain], CONTEXT[group])))
                results += [(s, deepl.translate([encode(s, templated)], HINTS[s])[0]) for s in todo[group] if s in HINTS]
                for source, translated in results:
                    translated = decode(translated)
                    if templated and placeholders(translated) != placeholders(source):
                        print(f'  skipped (placeholders changed): {source!r} -> {translated!r}')
                    else:
                        fresh['strings'][source] = translated
            print(f'Translated {count} strings and tags ({deepl.characters} characters) with DeepL.')

    output = {
        'source': 'en', 'target': 'zh-CN', 'engine': 'DeepL',
        'strings': dict(sorted(fresh['strings'].items())),
        'tags': dict(sorted(fresh['tags'].items())),
    }
    text = json.dumps(output, ensure_ascii=False, indent=2) + '\n'
    if OUT.exists() and OUT.read_text() == text:
        print(f'{OUT.relative_to(root)} is up to date.')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    print(f"Wrote {OUT.relative_to(root)}: {len(output['strings'])} strings, {len(output['tags'])} tags.")


if __name__ == '__main__':
    main()
