"""Builds index.html (landing + app mount) from landing/landing.src.html. Run before `vite build` / `vite dev`."""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, "landing/landing.src.html"), encoding="utf-8").read()
s = re.sub(r"\{\{LOGO_(\w+)\}\}", lambda m: f"./logos/{m.group(1)}.png", s)
s = s.replace(':focus-visible { outline: 3px solid var(--magenta);', '#landing :focus-visible { outline: 3px solid var(--magenta);')
s = s.replace('<a class="btn btn-magenta" href="#inicio">Abrir o app', '<a class="btn btn-magenta" href="#app">Abrir o app')
head_end = s.index("</style>") + len("</style>")
head, body = s[:head_end], s[head_end:]
body = body.replace('<div class="gaveta-fundo"', '<div id="landing">\n<div class="gaveta-fundo"', 1)
i = body.index("<script>\n(function () {")
body = body[:i] + "</div>\n<div id=\"root\"></div>\n" + body[i:]
mode_css = """<style>
html.modo-app #landing { display: none; }
html:not(.modo-app) #root { display: none; }
</style>
<script>if (/^#app/.test(location.hash)) document.documentElement.classList.add("modo-app");</script>"""
out = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head}
{mode_css}
</head>
<body>
{body}
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
"""
open(os.path.join(root, "index.html"), "w", encoding="utf-8").write(out)
print("index.html ok")
