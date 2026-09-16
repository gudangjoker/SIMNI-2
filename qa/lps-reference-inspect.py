import zipfile, xml.etree.ElementTree as E, json, pathlib, sys
sys.stdout.reconfigure(encoding='utf-8')
out=pathlib.Path('test-output/lps-template-fidelity');out.mkdir(parents=True,exist_ok=True)
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
result={}
for filename in ['LPS KLS 2 contoh.xlsx','BLP contoh.xlsx']:
 with zipfile.ZipFile(filename) as z:
  strings=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
  root=E.fromstring(z.read('xl/worksheets/sheet1.xml'));cells={}
  for c in root.findall('.//s:sheetData/s:row/s:c',ns):
   v=c.find('s:v',ns)
   if v is not None: cells[c.attrib['r']]=strings[int(v.text)] if c.attrib.get('t')=='s' else v.text
  result[filename]={'cells':cells,'parts':z.namelist(),'sheetTail':z.read('xl/worksheets/sheet1.xml').decode()[-2400:]}
  print(filename)
  if filename.startswith('BLP'):
   for k,v in cells.items():print(k+'='+v.replace('\n',' ')[:100])
out.joinpath('reference-structure.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
