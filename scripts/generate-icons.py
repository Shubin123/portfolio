"""Generate canonical project marks from vector geometry, never fonts or emoji."""
from pathlib import Path
import json

# All marks share a 64px canvas, rounded tile, and 2.6px stroke.
MARKS = {
'aimjs': ('blue','<circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="4"/><path d="M32 12v10m0 20v10M12 32h10m20 0h10"/>'),
'amazon-scraper': ('gold','<path d="M19 26h26l3 23H16l3-23Zm6 0v-5a7 7 0 0 1 14 0v5M24 35h16m-16 7h10"/>'),
'avr_visual': ('green','<rect x="21" y="21" width="22" height="22" rx="3"/><path d="M27 13v8m10-8v8m-10 22v8m10-8v8M13 27h8m-8 10h8m22-10h8m-8 10h8m-24-1 5-9 5 9m-8-3h6"/>'),
'backendgraphql': ('pink','<path d="m32 13 17 10v19L32 52 15 42V23L32 13Zm0 0L15 42h34L32 13Zm-17 10 34 19M49 23 15 42"/><g fill="currentColor" stroke="none"><circle cx="32" cy="13" r="3"/><circle cx="49" cy="23" r="3"/><circle cx="49" cy="42" r="3"/><circle cx="32" cy="52" r="3"/><circle cx="15" cy="42" r="3"/><circle cx="15" cy="23" r="3"/></g>'),
'classifier': ('lime','<path d="M32 24c-18-9-20 11-12 22 5 7 9 2 12 2s7 5 12-2c8-11 6-31-12-22Zm0 0c-1-7 3-12 9-12-1 7-4 10-9 12M11 23v-9h9m24 0h9v9M11 43v9h9m24 0h9v-9"/>'),
'cubesolver': ('blue','<path d="m32 11 20 11v23L32 56 12 45V22l20-11Zm0 23v22M12 22l20 12 20-12M22 17l20 12v21M42 17 22 29v21M12 34l20 11 20-11"/>'),
'dashtop': ('cyan','<rect x="12" y="16" width="40" height="30" rx="5"/><path d="M24 53h16m-8-7v7M19 36a13 13 0 0 1 26 0m-13 0 8-10"/><circle cx="32" cy="36" r="2" fill="currentColor"/>'),
'django-polls-app': ('green','<rect x="14" y="13" width="36" height="40" rx="5"/><path d="m21 24 3 3 6-6m-9 16 3 3 6-6m5-9h8m-8 13h8"/>'),
'food_model': ('gold','<path d="M16 33h32c-1 11-7 17-16 17S17 44 16 33Zm5 21h22M31 30c-8-1-12-6-11-13 8 0 13 4 11 13Zm1-3c0-9 5-14 13-14 0 8-5 13-13 14M12 23v-9h7m26 0h7v9"/>'),
'gameglwfopengl': ('purple','<path d="M21 24h22c7 0 14 24 8 26-4 2-9-8-12-8H25c-3 0-8 10-12 8-6-2 1-26 8-26Zm5 7v10m-5-5h10M27 17h10"/><circle cx="42" cy="32" r="2" fill="currentColor"/><circle cx="47" cy="38" r="2" fill="currentColor"/>'),
'gemini-browser': ('purple','<rect x="12" y="14" width="40" height="36" rx="5"/><path d="M12 24h40M19 19h1m5 0h1M34 28c0 6-3 9-9 9 6 0 9 3 9 9 0-6 3-9 9-9-6 0-9-3-9-9Z"/>'),
'gemini-cli': ('purple','<rect x="11" y="16" width="42" height="33" rx="5"/><path d="m18 27 6 6-6 6m11 1h10M43 22c0 4-2 6-6 6 4 0 6 2 6 6 0-4 2-6 6-6-4 0-6-2-6-6Z"/>'),
'gobot': ('gold','<path d="M15 16h34M15 27h34M15 38h34M15 49h34M16 15v34m11-34v34m11-34v34m11-34v34" opacity=".5"/><circle cx="27" cy="27" r="8" fill="#f4eee0" stroke="#f4eee0"/><circle cx="38" cy="38" r="8" fill="#171d23"/>'),
'kokorojs': ('pink','<path d="M16 17h32a6 6 0 0 1 6 6v17a6 6 0 0 1-6 6H31L21 53v-7h-5a6 6 0 0 1-6-6V23a6 6 0 0 1 6-6Z"/><path d="M19 29v6m7-11v16m7-20v24m7-18v12m7-9v6"/>'),
'midi': ('purple','<rect x="12" y="17" width="40" height="31" rx="4"/><path d="M22 33v15m10-15v15m10-15v15"/><path d="M20 17v16h5V17m5 0v16h5V17m5 0v16h5V17" fill="currentColor"/>'),
'ml-loop': ('green','<path d="M20 17c24-8 38 6 25 17S11 36 17 48c6 10 34 4 32-8" stroke-dasharray="4 5"/><circle cx="20" cy="17" r="5"/><circle cx="45" cy="34" r="5"/><circle cx="17" cy="48" r="5"/><path d="m28 28 8 5-8 5Z" fill="currentColor" stroke="none"/>'),
'netgraph': ('blue','<path d="m17 20 15 12 15-16M17 20l-3 27 18-15 16 15M32 32v20"/><g fill="#192b3b"><circle cx="17" cy="20" r="5"/><circle cx="32" cy="32" r="6"/><circle cx="47" cy="16" r="5"/><circle cx="14" cy="47" r="5"/><circle cx="48" cy="47" r="5"/></g>'),
'nrf-research-firmware': ('lime','<path d="M32 33v19m-8 0h16M22 24a14 14 0 0 1 20 0M15 17a24 24 0 0 1 34 0M22 24a14 14 0 0 0 0 20m20-20a14 14 0 0 1 0 20"/><circle cx="32" cy="33" r="4" fill="currentColor"/>'),
'oma-harness': ('purple','<path d="m19 20 13 12 13-12M32 32 18 46m14-14 14 14"/><rect x="12" y="12" width="14" height="14" rx="4"/><rect x="38" y="12" width="14" height="14" rx="4"/><rect x="11" y="39" width="14" height="14" rx="4"/><rect x="39" y="39" width="14" height="14" rx="4"/><circle cx="32" cy="32" r="5" fill="currentColor"/>'),
'opengl-examples': ('cyan','<path d="m32 12 22 36H10L32 12Zm0 0v43m-22-7 22 7 22-7M21 30h22M16 39h32"/>'),
'portfolio': ('purple','<rect x="13" y="13" width="16" height="16" rx="4"/><rect x="35" y="13" width="16" height="24" rx="4"/><rect x="13" y="35" width="16" height="16" rx="4"/><rect x="35" y="43" width="16" height="8" rx="3" fill="currentColor"/>'),
'ruby-web-crawler': ('pink','<path d="m32 18 10 10-10 17-10-17 10-10Zm-10 10h20M22 28l-9-8m9 14-11 2m17 8-10 9m24-25 9-8m-9 14 11 2m-17 8 10 9"/>'),
'shubin123': ('cyan','<path d="M45 19H27a8 8 0 0 0 0 16h10a8 8 0 0 1 0 16H19M20 13h24"/>'),
'stonk': ('stonk','<path d="M14 14v36h38M21 40l9-11 8 5 13-17m-12 0h12v12"/>'),
'symmetrical-book': ('purple','<path d="M32 21c-5-5-13-7-21-6v32c8-1 16 1 21 6 5-5 13-7 21-6V15c-8-1-16 1-21 6Zm0 0v32M18 25l7 3m-7 6 7 3m14-9 7-3m-7 12 7-3"/>'),
'terminalbar': ('green','<rect x="10" y="22" width="44" height="22" rx="5"/><path d="m17 28 5 5-5 5m10 0h10m7-10v10"/>'),
'tile-editor': ('gold','<path d="M13 13h16v16H13Zm22 0h16v16H35ZM13 35h16v16H13Z"/><path d="m39 34 13 8-8 2-3 8-2-18Z" fill="currentColor"/>'),
'viewbar': ('cyan','<rect x="12" y="13" width="40" height="28" rx="4"/><rect x="16" y="48" width="32" height="7" rx="2"/><path d="M22 23h20m-20 7h12m-2 11v7"/>'),
'vslam_gym': ('cyan','<path d="m15 53 9-39m25 39-9-39M32 16v8m0 8v8m0 8v5"/><rect x="22" y="25" width="20" height="17" rx="4" fill="#19353a"/><circle cx="32" cy="33.5" r="5"/>'),
'vul': ('coral','<path d="m12 17 20 36 20-36H12Zm10 0 10 20 10-20M12 17l20-7 20 7M21 48h-8m38 0h-8"/>'),
'whyfightree': ('lime','<path d="M32 51V28m0 12-12-8m12 2 12-8"/><path d="M21 37c-15-1-13-19-2-19 2-13 23-13 26 0 13 0 15 19 0 19M15 50h34"/>'),
'zom': ('lime','<path d="M18 14h28v7h6v25h-9v7H21v-7h-9V21h6v-7Z"/><path d="M23 25v8m18-8v8M23 43h18m-13-4v8m8-8v8"/>'),
'project': ('blue','<rect x="14" y="17" width="36" height="33" rx="5"/><path d="M14 25h36m-27 7-5 5 5 5m18-10 5 5-5 5m-6-11-6 13"/>'),
}
PALETTE = {'blue':('#192b3b','#88caff'),'gold':('#302b18','#e3d17f'),'green':('#19352e','#8ce2bf'),'pink':('#342337','#f2b0d5'),'lime':('#243223','#bbe495'),'cyan':('#19353a','#8adce4'),'purple':('#27263d','#b7b2ff'),'coral':('#3c2721','#ffb299'),'stonk':('#23301c','#d7fc70')}
root = Path(__file__).resolve().parents[1]
for name,(palette,geometry) in MARKS.items():
 bg,fg=PALETTE[palette]
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="16" fill="{bg}"/>
  <rect x=".75" y=".75" width="62.5" height="62.5" rx="15.25" stroke="{fg}" stroke-opacity=".18" stroke-width="1.5"/>
  <g color="{fg}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{geometry}</g>
</svg>
'''
 (root/'assets'/'icons'/f'{name}.svg').write_text(svg)
(root/'assets'/'js'/'icons.js').write_text('// Generated by scripts/generate-icons.py.\nconst PROJECT_ICON_NAMES = new Set('+json.dumps(list(MARKS))+');\nfunction projectIconUrl(name) {\n  const key = name.toLowerCase();\n  return `assets/icons/${PROJECT_ICON_NAMES.has(key) ? key : "project"}.svg`;\n}\n')
print(f'Generated {len(MARKS)} SVG marks.')
