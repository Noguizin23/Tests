import base64,re,sys,os
d=os.path.dirname(os.path.abspath(__file__))
s=open(f'{d}/landing.src.html').read()
s=re.sub(r'\{\{LOGO_(\w+)\}\}',lambda m:'data:image/png;base64,'+base64.b64encode(open(f'{d}/../public/logos/{m.group(1)}.png','rb').read()).decode(),s)
open(f'{d}/landing.html','w').write(s)
