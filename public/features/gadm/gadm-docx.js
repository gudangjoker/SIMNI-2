/**
 * GADM DOCX Generator
 * Produces valid, native Microsoft Word OpenXML (.docx) files 100% offline using JSZip.
 */

function escapeXml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function textRun(text, { bold = false, italic = false, size = 22, color = '1F2937' } = {}) {
    if (!text) return '';
    const rPr = [];
    rPr.push('<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>');
    if (bold) rPr.push('<w:b/>');
    if (italic) rPr.push('<w:i/>');
    if (size) rPr.push(`<w:sz w:val="${size}"/>`);
    if (color) rPr.push(`<w:color w:val="${color}"/>`);
    return `<w:r><w:rPr>${rPr.join('')}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(runsXml, { align = 'left', spaceBefore = 80, spaceAfter = 120, lineSpacing = 276 } = {}) {
    const jc = align === 'center' ? '<w:jc w:val="center"/>' : align === 'right' ? '<w:jc w:val="right"/>' : align === 'both' ? '<w:jc w:val="both"/>' : '';
    const spacing = `<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="${lineSpacing}" w:lineRule="auto"/>`;
    return `<w:p><w:pPr>${jc}${spacing}</w:pPr>${runsXml}</w:p>`;
}

function headingParagraph(text, level = 1) {
    if (level === 1) {
        return paragraph(textRun(text, { bold: true, size: 32, color: '111827' }), { align: 'center', spaceBefore: 240, spaceAfter: 160 });
    }
    if (level === 2) {
        return paragraph(textRun(text, { bold: true, size: 26, color: '1E3A8A' }), { align: 'left', spaceBefore: 200, spaceAfter: 120 });
    }
    return paragraph(textRun(text, { bold: true, size: 22, color: '374151' }), { align: 'left', spaceBefore: 160, spaceAfter: 80 });
}

function tableCell(cellXml, { width = null, isHeader = false, shading = null } = {}) {
    const borders = '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tcBorders>';
    const bg = shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${shading}"/>` : (isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : '');
    const mar = '<w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>';
    const widthXml = width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '<w:tcW w:w="0" w:type="auto"/>';
    return `<w:tc><w:tcPr>${widthXml}${borders}${bg}${mar}</w:tcPr>${cellXml}</w:tc>`;
}

function parseDomToOpenXml(container) {
    const parts = [];

    function processNode(node) {
        if (!node) return;
        if (node.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|IFRAME)$/i.test(node.tagName)) return;

        if (node.nodeType === 3) {
            const text = node.textContent?.trim();
            if (text) parts.push(paragraph(textRun(text)));
            return;
        }

        if (node.nodeType !== 1) return;
        const tag = node.tagName.toUpperCase();

        if (node.classList?.contains('gadm-doc-header')) {
            const h1 = node.querySelector('h1')?.textContent?.trim() || '';
            const p = node.querySelector('p')?.textContent?.trim() || '';
            if (h1) parts.push(headingParagraph(h1, 1));
            if (p) parts.push(paragraph(textRun(p, { italic: true, size: 20, color: '64748B' }), { align: 'center', spaceBefore: 40, spaceAfter: 200 }));
            return;
        }

        if (tag === 'H1') {
            parts.push(headingParagraph(node.textContent?.trim(), 1));
            return;
        }
        if (tag === 'H2') {
            parts.push(headingParagraph(node.textContent?.trim(), 2));
            return;
        }
        if (tag === 'H3') {
            parts.push(headingParagraph(node.textContent?.trim(), 3));
            return;
        }

        if (node.classList?.contains('gadm-doc-meta')) {
            const items = node.querySelectorAll(':scope > div');
            if (items.length) {
                let tableRowsXml = '';
                items.forEach((item) => {
                    const dt = item.querySelector('dt')?.textContent?.trim() || '';
                    const dd = item.querySelector('dd')?.textContent?.trim() || '';
                    const leftCell = tableCell(paragraph(textRun(dt, { bold: true, size: 20, color: '334155' }), { spaceBefore: 40, spaceAfter: 40 }), { width: 2600, shading: 'F8FAFC' });
                    const rightCell = tableCell(paragraph(textRun(dd, { size: 20, color: '0F172A' }), { spaceBefore: 40, spaceAfter: 40 }), { width: 6400 });
                    tableRowsXml += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${leftCell}${rightCell}</w:tr>`;
                });
                const tblPr = '<w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/></w:tblBorders></w:tblPr>';
                parts.push(`<w:tbl>${tblPr}${tableRowsXml}</w:tbl>`);
                parts.push(paragraph('', { spaceBefore: 80, spaceAfter: 80 }));
                return;
            }
        }

        if (node.classList?.contains('gadm-signature-grid')) {
            const divs = node.querySelectorAll(':scope > div');
            if (divs.length >= 2) {
                const col1Pars = Array.from(divs[0].querySelectorAll('p')).map((p) => p.textContent?.trim()).filter(Boolean);
                const col2Pars = Array.from(divs[1].querySelectorAll('p')).map((p) => p.textContent?.trim()).filter(Boolean);

                const c1Xml = col1Pars.map((t, idx) => {
                    const isLast = idx >= col1Pars.length - 2;
                    return paragraph(textRun(t, { bold: isLast, size: 20 }), { align: 'center', spaceBefore: idx === col1Pars.length - 2 ? 720 : 40, spaceAfter: 40 });
                }).join('') || paragraph('');

                const c2Xml = col2Pars.map((t, idx) => {
                    const isLast = idx >= col2Pars.length - 2;
                    return paragraph(textRun(t, { bold: isLast, size: 20 }), { align: 'center', spaceBefore: idx === col2Pars.length - 2 ? 720 : 40, spaceAfter: 40 });
                }).join('') || paragraph('');

                const noBorderCell = (inner) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr>${inner}</w:tc>`;
                const row = `<w:tr><w:trPr><w:cantSplit/></w:trPr>${noBorderCell(c1Xml)}${noBorderCell(c2Xml)}</w:tr>`;
                const tblPr = '<w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tblBorders></w:tblPr>';
                parts.push(paragraph('', { spaceBefore: 200, spaceAfter: 100 }));
                parts.push(`<w:tbl>${tblPr}${row}</w:tbl>`);
                return;
            }
        }

        if (tag === 'TABLE') {
            const rows = node.querySelectorAll('tr');
            if (rows.length) {
                let rowsXml = '';
                rows.forEach((row, rIdx) => {
                    const cells = row.querySelectorAll('th, td');
                    let cellsXml = '';
                    const isHeader = rIdx === 0 || row.querySelector('th') !== null;
                    cells.forEach((cell) => {
                        const cellText = cell.textContent?.trim() || '';
                        const pXml = paragraph(textRun(cellText, { bold: isHeader, size: 19 }), {
                            align: 'left',
                            spaceBefore: 40,
                            spaceAfter: 40
                        });
                        cellsXml += tableCell(pXml, { isHeader, shading: isHeader ? 'F1F5F9' : null });
                    });
                    rowsXml += `<w:tr><w:trPr><w:cantSplit/>${isHeader ? '<w:tblHeader/>' : ''}</w:trPr>${cellsXml}</w:tr>`;
                });
                const tblPr = '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/></w:tblBorders></w:tblPr>';
                parts.push(`<w:tbl>${tblPr}${rowsXml}</w:tbl>`);
                parts.push(paragraph('', { spaceBefore: 60, spaceAfter: 60 }));
                return;
            }
        }

        if (tag === 'UL' || tag === 'OL') {
            const items = node.querySelectorAll(':scope > li');
            items.forEach((item, idx) => {
                const bullet = tag === 'UL' ? '•  ' : `${idx + 1}.  `;
                const text = item.textContent?.trim() || '';
                parts.push(paragraph(
                    textRun(bullet, { bold: true, color: '4B5563' }) + textRun(text),
                    { spaceBefore: 40, spaceAfter: 40 }
                ));
            });
            return;
        }

        if (tag === 'P') {
            const text = node.textContent?.trim();
            if (text) {
                const isNote = node.classList?.contains('gadm-doc-note');
                parts.push(paragraph(
                    textRun(text, { italic: isNote, size: isNote ? 18 : 22, color: isNote ? '6B7280' : '1F2937' }),
                    { spaceBefore: 60, spaceAfter: 80 }
                ));
            }
            return;
        }

        for (const child of node.childNodes) {
            processNode(child);
        }
    }

    processNode(container);
    return parts.join('\n');
}

export async function createDocxBlob(snapshot) {
    await window.ensureSIMNIVendors?.("zip");
    const JSZipClass = (typeof window !== 'undefined' && window.JSZip) || (typeof JSZip !== 'undefined' ? JSZip : null);
    if (!JSZipClass) {
        throw new Error('Pustaka JSZip belum dimuat. Tidak dapat menghasilkan file .docx.');
    }

    const zip = new JSZipClass();
    const temp = document.createElement('div');
    temp.innerHTML = snapshot.result.html;
    temp.querySelectorAll('script,style,iframe,object,embed').forEach((el) => el.remove());

    const bodyContentXml = parseDomToOpenXml(temp);

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    zip.folder('word').folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

    zip.folder('word').file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1F2937"/>
        <w:lang w:val="id-ID"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`);

    zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${bodyContentXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
    </w:sectPr>
  </w:body>
</w:document>`);

    return await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}
