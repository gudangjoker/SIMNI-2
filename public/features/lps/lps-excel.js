/* Reference-based XLSX output. Keep native OOXML parts instead of normalizing
 * the source workbook through a spreadsheet serializer. */
(function () {
    'use strict';
    const core = window.SIMNILPSCore;
    const refs = window.SIMNILPSReferenceData;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    const flatten = template => template.sections.flatMap(section => section.aspects);
    function createTemplate(settings, periodId) {
        const template = core.createDefaultTemplate(settings, periodId), reference = refs[template.reportType];
        template.sections.forEach((section, i) => { section.title = reference.sections[i]; });
        flatten(template).forEach((aspect, i) => {
            const source = reference.aspects[i];
            aspect.title = source.title;
            aspect.items.forEach((item, j) => { item.label = source.labels[j]; });
            aspect.descriptionLabel = template.reportType === 'BLP' ? 'Deskripsi' : 'Deskripsi dan Rekomendasi';
        });
        return template;
    }
    function matchesStructure(template, base) {
        const shape = t => t.sections.map(s => [s.id, s.aspects.map(a => [a.id, a.inputType, a.options.length, a.detailLabel, a.descriptionEnabled, a.descriptionLabel, a.items.map(i => i.id)])]);
        return JSON.stringify(shape(template)) === JSON.stringify(shape(base));
    }
    function sourceCells(xml) {
        const cells = new Map();
        for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const address = match[1].match(/\br="([A-Z]+\d+)"/)?.[1];
            if (address) cells.set(address, { attrs:match[1], body:match[2] || '', xml:match[0] });
        }
        return cells;
    }
    function patchCells(xml, changes) {
        const pending = new Map(changes);
        xml = xml.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (whole, attrs) => {
            const address = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
            if (!pending.has(address)) return whole;
            const value = pending.get(address); pending.delete(address);
            return `<c${attrs.replace(/\s+t="[^"]*"/g, '')} t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
        });
        if (pending.size) throw new Error('Sel acuan tidak tersedia: ' + [...pending.keys()].join(', '));
        return xml;
    }
    function fillIdentity(changes, report) {
        const school = report.schoolSnapshot || {}, student = report.studentSnapshot || {};
        ['nama_yayasan','jenjang_sekolah','nama_sekolah','status_akreditasi','nomor_izin'].forEach((key,i) => changes.set('A'+(i+1), school[key] || ''));
        changes.set('D11', student.name || ''); changes.set('D12', student.studentId || '');
        changes.set('A9', 'Tahun Pelajaran ' + (report.academicYearLabel || ''));
        if (report.reportType === 'BLP') {
            changes.set('U11', report.classLabel || ''); changes.set('U12', String(report.semester || ''));
        } else changes.set('A8', 'Hasil Observasi Pembiasaan, Hafalan dan Prestasi akademik Tengah Semester - ' + report.semester);
    }
    function fillClosing(changes, report, offset = 0) {
        const kind = report.reportType, school = report.schoolSnapshot || {}, footer = refs[kind].footer + offset;
        changes.set('S'+footer, school.kota ? school.kota+',' : '');
        changes.set('X'+footer, core.formatGregorianIndonesian(report.reportDate));
        changes.set('X'+(footer+1), report.hijriDate || '');
        if (kind === 'LPS') {
            changes.set('C'+(105+offset), school.nama_kepala_sekolah || '');
            changes.set('C'+(106+offset), 'NUKS. '+(school.nuks_kepala_sekolah || school.nuptk_kepala_sekolah || school.nip_kepala_sekolah || school.nuks_kamad || school.nip_kamad || '-'));
            changes.set('R'+(105+offset), school.nama_wali_kelas || '');
            changes.set('R'+(106+offset), 'NUPTK. '+(school.nuptk_wali_kelas || '-'));
        } else {
            changes.set('A'+(76+offset), report.teacherNote || '');
            changes.set('A'+(84+offset), report.teacherNoteSecondary || '');
            changes.set('A'+(92+offset), report.parentNote || '');
            for (const row of [81,89]) changes.set('R'+(row+offset), school.nama_wali_kelas || '');
            for (const row of [82,90]) changes.set('R'+(row+offset), 'NUPTK. '+(school.nuptk_wali_kelas || '-'));
        }
    }
    function nativeSheet(xml, report, template, base, styleFonts) {
        const changes = new Map(), cells = sourceCells(xml), reference = refs[report.reportType];
        fillIdentity(changes, report); fillClosing(changes, report);
        // Clear every response slot, including stray example marks inside merged cells.
        reference.aspects.forEach(binding => binding.itemRows.forEach(row => {
            for (const col of ['G','H','I','J','K','L','M','N','O','P','Q']) {
                const addr = col+row;
                if (cells.has(addr)) changes.set(addr, '');
            }
        }));
        template.sections.forEach((section,i) => {
            const original = base.sections[i];
            if (section.title !== original.title || section.code !== original.code) changes.set('A'+reference.sectionRows[i], section.code+'. '+section.title);
        });
        const originals = flatten(base);
        flatten(template).forEach((aspect,i) => {
            const binding = reference.aspects[i], original = originals[i], response = report.responses?.[aspect.id] || {};
            const row = binding.row, description = (binding.section ? 'R' : 'O') + (i===0 ? row+2 : row);
            if (aspect.title !== original.title) changes.set('B'+row, aspect.title);
            changes.set(description, aspect.descriptionEnabled !== false || aspect.inputType === 'text' ? response.description || response.overall || '' : '');
            if (i===0) {
                changes.set('O18', response.overall || ''); changes.set('B20', response.detail || ''); changes.set('B21', '');
            }
            const columns = binding.section ? ['G','J','O'] : aspect.id === 'aspect_7_kebiasaan' ? ['G','J'] : ['G','I','K','M'];
            const headerRow = binding.section || aspect.id === 'aspect_7_kebiasaan' ? row : row+1;
            if (JSON.stringify(aspect.options) !== JSON.stringify(original.options) && binding.itemRows.length) {
                if (aspect.id === 'aspect_7_kebiasaan') for (const addr of ['G25','G26','J25','K25','K26']) if(cells.has(addr)) changes.set(addr,'');
                aspect.options.forEach((option,j) => changes.set(columns[j]+headerRow, option));
            }
            aspect.items.forEach((item,j) => {
                const itemRow = binding.itemRows[j], value = response.items?.[item.id] || '';
                if (item.label !== original.items[j].label) changes.set('C'+itemRow,item.label);
                if (value) {
                    const selected = aspect.options.indexOf(value);
                    if (selected < 0) throw new Error('Nilai tidak sesuai kriteria '+aspect.title+': '+value);
                    const address = columns[selected]+itemRow;
                    const styleId = Number(cells.get(address)?.attrs.match(/\bs="(\d+)"/)?.[1] || 0);
                    // The reference mixes normal and symbol fonts even within
                    // one criterion row. Keep its styles and choose the glyph
                    // for the destination cell, not for the report type.
                    changes.set(address, styleFonts[styleId] === 'Wingdings' ? 'ü' : '✓');
                }
            });
        });
        return {xml:patchCells(xml,changes), mode:'reference', changedCells:[...changes.keys()]};
    }
    function customSheet(xml, report, template) {
        // A changed structure needs new rows. Retain the reference's columns,
        // fonts, logo and page settings; output every teacher-defined field.
        const cells=sourceCells(xml), reference=refs[report.reportType];
        const style=addr=>cells.get(addr)?.attrs.match(/\bs="(\d+)"/)?.[1] || '0';
        const rows=[], merges=[];let row=14;
        const append=(entries,height=24)=>{
            let body='';for(const [from,to,value,styleId] of entries){body+=`<c r="${from}${row}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;if(from!==to)merges.push(`${from}${row}:${to}${row}`);}
            rows.push(`<row r="${row}" ht="${height}" customHeight="1">${body}</row>`);row++;
        };
        const titleStyle=style('B16'), bodyStyle=style('O20');
        for(const section of template.sections){
            append([['A','AE',section.code+'. '+section.title,titleStyle]],32);
            for(const aspect of section.aspects){
                const response=report.responses?.[aspect.id] || {};
                append([['B','AE',aspect.title,titleStyle]],30);
                if(aspect.detailLabel)append([['B','N',aspect.detailLabel,bodyStyle],['O','AE',response.detail || '',bodyStyle]],48);
                if(aspect.items.length){
                    append([['B','N','Butir penilaian',titleStyle],['O','AE',aspect.options.length ? aspect.options.join(' / ') : 'Isian',titleStyle]],36);
                    for(const item of aspect.items)append([['B','N',item.label,bodyStyle],['O','AE',response.items?.[item.id] || '',bodyStyle]],Math.max(30,Math.min(409,Math.ceil(item.label.length/32)*16)));
                }else if(aspect.inputType!=='text')append([['B','N',aspect.options.join(' / ') || 'Nilai',bodyStyle],['O','AE',response.overall || '',bodyStyle]],36);
                if(aspect.descriptionEnabled!==false || aspect.inputType==='text')append([['B','N',aspect.descriptionLabel || 'Deskripsi',bodyStyle],['O','AE',response.description || response.overall || '',bodyStyle]],Math.max(50,Math.min(409,Math.ceil(String(response.description||'').length/45)*16)));
            }
            row++;
        }
        const offset=row-reference.footer;
        const move=(fragment)=>fragment.replace(/\b(r|ref)="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"/g,(_,key,col,n,endCol,end)=>`${key}="${col}${Number(n)+offset}${endCol?':'+endCol+(Number(end)+offset):''}"`).replace(/<row r="(\d+)"/g,(_,n)=>`<row r="${Number(n)+offset}"`);
        const sourceRows=[...xml.matchAll(/<row\b[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)].map(m=>m[0]);
        const number=r=>Number(r.match(/\br="(\d+)"/)[1]);
        const prefix=sourceRows.filter(r=>number(r)<14).join(''),suffix=sourceRows.filter(r=>number(r)>=reference.footer).map(move).join('');
        const originalMerges=[...xml.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map(m=>m[1]);
        const preserved=originalMerges.filter(m=>Number(m.match(/\d+/)[0])<14),closing=originalMerges.filter(m=>Number(m.match(/\d+/)[0])>=reference.footer).map(m=>move(`ref="${m}"`).slice(5,-1));
        xml=xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/,`<sheetData>${prefix}${rows.join('')}${suffix}</sheetData>`)
            .replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/,`<mergeCells count="${preserved.length+merges.length+closing.length}">${[...preserved,...merges,...closing].map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`)
            .replace(/<rowBreaks\b[^>]*>[\s\S]*?<\/rowBreaks>/g,'')
            .replace(/<dimension ref="[^"]*"\/>/,`<dimension ref="A1:AE${row+24}"/>`);
        const changes=new Map();fillIdentity(changes,report);fillClosing(changes,report,offset);
        return {xml:patchCells(xml,changes),mode:'edited-structure',changedCells:[...changes.keys()]};
    }
    async function createWorkbook(reports, names) {
        if(!reports.length)throw new Error('Tidak ada laporan untuk diekspor.');
        await window.ensureSIMNIVendors('zip');
        const kind=reports[0].reportType, reference=refs[kind];
        if(reports.some(r=>r.reportType!==kind))throw new Error('Satu workbook harus memakai jenis laporan yang sama.');
        const response=await fetch('templates/'+encodeURIComponent(reference.file));
        if(!response.ok)throw new Error('File acuan tidak dapat dimuat.');
        const bytes=await response.arrayBuffer();
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(digest!==reference.sha256)throw new Error('File acuan berubah. Perbarui katalog template sebelum mengekspor.');
        const zip=await window.JSZip.loadAsync(bytes), source=await zip.file('xl/worksheets/sheet1.xml').async('string');
        const styles=new DOMParser().parseFromString(await zip.file('xl/styles.xml').async('string'),'application/xml');
        const fonts=Array.from(styles.getElementsByTagName('fonts')[0].children, font=>font.getElementsByTagName('name')[0]?.getAttribute('val') || '');
        const styleFonts=Array.from(styles.getElementsByTagName('cellXfs')[0].children, xf=>fonts[Number(xf.getAttribute('fontId') || 0)]);
        let workbook=await zip.file('xl/workbook.xml').async('string'),relations=await zip.file('xl/_rels/workbook.xml.rels').async('string'),types=await zip.file('[Content_Types].xml').async('string');
        const sheetRels=await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'),drawing=await zip.file('xl/drawings/drawing1.xml').async('string'),drawingRels=await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string');
        const sheets=[],extraRels=[],modes=[];
        for(let index=0;index<reports.length;index++){
            const report=reports[index],i=index+1;
            if(report.status==='final' && !(await core.verifyReportHash(report)).ok)throw new Error('Integritas laporan final gagal.');
            const template=core.normalizeTemplate(report.templateSnapshot,report.schoolSnapshot,report.periodId),base=createTemplate(report.schoolSnapshot,report.periodId);
            const result=matchesStructure(template,base)?nativeSheet(source,report,template,base,styleFonts):customSheet(source,report,template);
            zip.file(`xl/worksheets/sheet${i}.xml`,result.xml);
            zip.file(`xl/worksheets/_rels/sheet${i}.xml.rels`,sheetRels.replace('../drawings/drawing1.xml',`../drawings/drawing${i}.xml`));
            zip.file(`xl/drawings/drawing${i}.xml`,drawing);zip.file(`xl/drawings/_rels/drawing${i}.xml.rels`,drawingRels);
            const relation=i===1?'rId1':`simniSheet${i}`;
            sheets.push(`<sheet name="${escape(names[index])}" sheetId="${i}" r:id="${relation}"/>`);
            if(i>1){extraRels.push(`<Relationship Id="${relation}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);types=types.replace('</Types>',`<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);}
            modes.push({sheet:names[index],...result,xml:undefined});
        }
        workbook=workbook.replace(/<sheets>[\s\S]*?<\/sheets>/,`<sheets>${sheets.join('')}</sheets>`);
        // Existing reference files have no formulas or defined names. Fail closed
        // if a future file introduces a dependency needing an explicit mapping.
        if(/<definedName\b|<f[ >]/.test(workbook+source))throw new Error('Acuan baru memiliki formula/range yang memerlukan pemetaan.');
        zip.file('xl/workbook.xml',workbook);zip.file('xl/_rels/workbook.xml.rels',relations.replace('</Relationships>',extraRels.join('')+'</Relationships>'));zip.file('[Content_Types].xml',types);
        let app=await zip.file('docProps/app.xml').async('string');
        app=app.replace(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/,`<TitlesOfParts><vt:vector size="${names.length}" baseType="lpstr">${names.map(n=>`<vt:lpstr>${escape(n)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>`).replace(/(<vt:lpstr>Worksheets<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)\d+(<\/vt:i4>)/,'$1'+names.length+'$2');
        zip.file('docProps/app.xml',app);
        return {blob:await zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),modes};
    }
    window.SIMNILPSExcel=Object.freeze({createTemplate,createWorkbook,matchesStructure});
}());
