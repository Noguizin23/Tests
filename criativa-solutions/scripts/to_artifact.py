"""Turns dist/index.html into the body fragment the Claude Artifact tool expects (it adds its own doctype/head)."""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, "dist/index.html"), encoding="utf-8").read()
head = s[s.index("<head>") + 6 : s.index("</head>")]
body = s[s.index("<body>") + 6 : s.rindex("</body>")]
head = re.sub(r'<meta charset="utf-8">\s*|<meta name="viewport"[^>]*>\s*', "", head)
title = re.search(r"<title>.*?</title>", head, re.S).group(0)
head = head.replace(title, "")
scripts = re.findall(r'<script type="module"[^>]*>.*?</script>', head, re.S)
for x in scripts: head = head.replace(x, "")
out = title + "\n" + head.strip() + "\n" + body.strip() + "\n" + "\n".join(scripts) + "\n"
open(os.path.join(root, "dist/artifact.html"), "w", encoding="utf-8").write(out)
print("artifact.html", len(out) // 1024, "KB")
