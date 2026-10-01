"""Validate project coverage and safe, resolution-independent SVG sources."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[1]
repos = json.loads((root/'tests/repos.json').read_text())
sites = json.loads((root/'scripts/icon-sites.json').read_text())
names = {repo['name'].lower() for repo in repos} | {name.lower() for name in sites}
for name in names:
 assert (root/'assets/icons'/f'{name}.svg').is_file(), name
paths = list((root/'assets/icons').glob('*.svg'))
for path in paths:
 tree = ET.parse(path)
 assert tree.getroot().attrib['viewBox'] == '0 0 64 64', path
 assert all(node.tag.split('}')[-1] not in ('text','script','foreignObject','image') for node in tree.iter()), path
 assert all(ord(c)<128 for c in path.read_text()), path
print(f'{len(paths)} project marks validated; all use native vector shapes.')
