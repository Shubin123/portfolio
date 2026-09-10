"""Validate project coverage and safe, resolution-independent SVG sources."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[1]
repos = json.loads((root/'tests/repos.json').read_text())
for repo in repos:
 path = root/'assets/icons'/f"{repo['name'].lower()}.svg"
 tree = ET.parse(path)
 assert tree.getroot().attrib['viewBox'] == '0 0 64 64', path
 assert all(node.tag.split('}')[-1] not in ('text','script','foreignObject','image') for node in tree.iter()), path
 assert all(ord(c)<128 for c in path.read_text()), path
print(f'{len(repos)} project marks validated; all use native vector shapes.')
