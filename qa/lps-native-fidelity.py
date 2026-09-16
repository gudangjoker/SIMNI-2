import json,zipfile,hashlib,xml.etree.ElementTree as E,pathlib,sys
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path('.');out=root/'test-output/lps-template-fidelity';ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};results=[]
def value_map(z,sheet):
 strings=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
 result={}
 for c in sheet.findall('.//s:sheetData/s:row/s:c',ns):
  if c.attrib.get('t')=='inlineStr': value=''.join(c.find('s:is',ns).itertext())
  else:
   v=c.find('s:v',ns); value='' if v is None else strings[int(v.text)] if c.attrib.get('t')=='s' else v.text
  result[c.attrib['r']]=value
 return result
def layout(sheet):
 result={}
 for el in sheet:
  tag=el.tag.split('}')[-1]
  if tag=='sheetData':
   result['rows']=[r.attrib for r in el]
   result['cells']=[{k:v for k,v in c.attrib.items() if k!='t'} for r in el for c in r]
  else:result[tag]=E.tostring(el,encoding='unicode')
 return result
def check(name,fn):
 try: detail=fn();results.append({'name':name,'status':'PASS','evidence':detail});print('PASS',name)
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)});print('FAIL',name,str(e))
for kind,filename in [('LPS','LPS KLS 2 contoh.xlsx'),('BLP','BLP contoh.xlsx')]:
 with zipfile.ZipFile(filename) as source:
  original=E.fromstring(source.read('xl/worksheets/sheet1.xml'));baseline=layout(original);originalValues=value_map(source,original)
  styles=E.fromstring(source.read('xl/styles.xml'));fonts=[f.find('s:name',ns).get('val') for f in styles.find('s:fonts',ns)];styleFonts=[fonts[int(x.get('fontId','0'))] for x in styles.find('s:cellXfs',ns)]
  for variant in ['reference','renamed','custom','extended']:
   path=out/(kind+'-'+variant+'-result.xlsx')
   if not path.exists():continue
   with zipfile.ZipFile(path) as generated:
    sheets=[p for p in generated.namelist() if p.startswith('xl/worksheets/sheet') and p.endswith('.xml')]
    def assets():
     for p in ['xl/styles.xml','xl/theme/theme1.xml','xl/media/image1.png','xl/printerSettings/printerSettings1.bin']:
      assert source.read(p)==generated.read(p),p+' differs'
     for i in range(1,len(sheets)+1):assert source.read('xl/drawings/drawing1.xml')==generated.read('xl/drawings/drawing'+str(i)+'.xml')
     return {'sheets':len(sheets),'nativeStylesThemeLogoPrinterDrawing':'identical bytes'}
    check(kind+' '+variant+' native assets',assets)
    for index,p in enumerate(sheets):
     sheet=E.fromstring(generated.read(p));values=value_map(generated,sheet)
     # Only selected student has edits; other report sheets remain based on the active template at export.
     if variant in ['reference','renamed']:
      def exact():
       actual=layout(sheet);diff=[key for key in baseline if baseline[key]!=actual.get(key)]
       assert not diff,'Layout differs: '+str(diff)
       assert values['D11'] and 'contoh' not in values['D11']
       assert values['D12'] not in ['13131313131',': 123456']
       assert not any(any(marker in v for marker in ['dddddddda','fwfwfwfw','eeggsdgsgsgsg','gdasgasass']) for v in values.values())
       if index==0 and kind=='BLP':
        assert values['A76']=='Catatan guru pertama';assert values['A84']=='Catatan guru kedua';assert values['A92']=='Tanggapan orang tua'
       return {'layoutParts':list(baseline),'identity':values['D11'],'responseCells':len(values)}
      check(kind+' '+variant+' sheet '+str(index+1)+' source layout and populated values',exact)
      if index==0:
       def glyphs():
        marks=[]
        for c in sheet.findall('.//s:sheetData/s:row/s:c',ns):
         value=values[c.get('r')]
         if value in ['ü','✓']:
          font=styleFonts[int(c.get('s','0'))];assert value==('ü' if font=='Wingdings' else '✓'),c.get('r')+' has incorrect mark for '+font
          marks.append({'cell':c.get('r'),'font':font,'glyph':value})
        expectedRows=([*range(27,34),*range(37,41),*range(43,46),*range(48,51),*range(56,65),*range(66,76),*range(77,91)] if kind=='LPS' else [*range(32,37),39,40,*range(46,51),*range(52,59),*range(60,67)])
        assert {m['cell'] for m in marks}=={'G'+str(row) for row in expectedRows},'Response marks missing or in wrong criterion'
        assert values['O18']=='A' and values['B20']=='Iqro 4 halaman 12'
        return marks
       check(kind+' '+variant+' checkmarks match destination fonts',glyphs)
     if index==0 and variant in ['renamed','custom']:
      def edited():
       assert 'BTQ hasil edit guru' in values.values()
       if variant=='renamed':assert 'Butir yang diubah guru' in values.values()
       else:
        assert 'Butir tambahan guru 1' in values.values() and 'Butir tambahan guru 2' in values.values()
        assert 'Butir yang diubah guru' not in values.values()
       return {'editedFieldsPresent':True}
      check(kind+' '+variant+' teacher edits exported',edited)
     if index==0 and variant=='extended':
      def extended():
       for text in ['C. Bagian pilihan guru','Aspek pilihan guru','Isian bebas guru','Detail pilihan guru','Catatan penilaian guru sintetis','Sangat baik / Baik / Perlu latihan']:
        assert text in values.values(),'Missing '+text
       assert 'Aspek Baru' not in values.values() and 'D. Bagian Baru' not in values.values()
       return {'addedSectionsAspectsTextAndCriteriaExported':True,'removedFieldsAbsent':True}
      check(kind+' extended teacher fields exported',extended)
def offline():
 with zipfile.ZipFile(out/'BLP-extended-result.xlsx') as online,zipfile.ZipFile(out/'BLP-offline-result.xlsx') as cached:
  assert sorted(online.namelist())==sorted(cached.namelist())
  assert all(online.read(p)==cached.read(p) for p in online.namelist()),'Offline workbook contents differ'
  return {'allWorkbookPartsMatchOnline':True}
check('Offline BLP matches online workbook contents',offline)
result={'buildId':json.loads((root/'public/build-manifest.json').read_text(encoding='utf-8'))['buildId'],'checks':results,'pass':sum(r['status']=='PASS' for r in results),'fail':sum(r['status']=='FAIL' for r in results)};out.joinpath('native-fidelity-results.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8');print(json.dumps({'pass':result['pass'],'fail':result['fail']}));sys.exit(bool(result['fail']))
