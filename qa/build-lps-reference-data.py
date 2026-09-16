import json, pathlib, hashlib
root=pathlib.Path('.'); inspected=json.loads((root/'test-output/lps-template-fidelity/reference-structure.json').read_text(encoding='utf-8'))
layouts={
 'LPS': {'file':'LPS KLS 2 contoh.xlsx','sectionRows':[14,52],'footer':96,'aspects':[[18,[],0],[25,list(range(27,34)),0],[35,list(range(37,41)),0],[41,list(range(43,46)),0],[46,list(range(48,51)),0],[55,list(range(56,65)),1],[65,list(range(66,76)),1],[76,list(range(77,91)),1]]},
 'BLP': {'file':'BLP contoh.xlsx','sectionRows':[14,42],'footer':72,'aspects':[[18,[],0],[25,[],0],[30,list(range(32,37)),0],[37,list(range(39,41)),0],[45,list(range(46,51)),1],[51,list(range(52,59)),1],[59,list(range(60,67)),1]]}
}
for kind,layout in layouts.items():
 cells=inspected[layout['file']]['cells'];layout['sha256']=hashlib.sha256((root/layout['file']).read_bytes()).hexdigest()
 layout['sections']=[cells['A'+str(n)].strip().split('. ',1)[1] for n in layout['sectionRows']]
 layout['aspects']=[{'row':row,'itemRows':rows,'section':section,'title':cells['B'+str(row)].strip(),'labels':[cells['C'+str(n)].strip() for n in rows]} for row,rows,section in layout['aspects']]
(root/'features/lps/lps-reference-data.js').write_text('// Generated from root reference workbooks by qa/build-lps-reference-data.py.\nwindow.SIMNILPSReferenceData = '+json.dumps(layouts,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
