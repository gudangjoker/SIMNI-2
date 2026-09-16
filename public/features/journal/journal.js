// ==========================================
// FILE: features/journal/journal.js
// Jadwal dan jurnal mengajar.
// ==========================================

function setJurnalTab(tab) {
    ['input', 'rekap', 'jadwal'].forEach((name) => {
        const button = document.getElementById(`tab-jurnal-${name}`);
        if (button) button.className = `whitespace-nowrap px-4 py-2 border-b-2 text-sm font-bold ${tab === name ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`;
        const panel = document.getElementById(`jurnal-tab-${name}`);
        if (panel) panel.classList.toggle('hidden', tab !== name);
    });
    if (tab === 'input') generateFormJurnal();
    else if (tab === 'rekap') renderRekapJurnal();
    else renderJadwalSetting();
}

function renderJadwalSetting() {
    const body = document.getElementById('jadwal-table-body');
    if (!body) return;
    if (!SIMNIFormDrafts.prepare(body)) return;
    const subjects = ['-Kosong-', 'Matematika', 'Bahasa Indonesia', 'Pendidikan Pancasila', 'IPAS', 'Seni Rupa', 'PJOK', 'PAI', 'Bahasa Inggris', 'Bahasa Sunda', 'Komputer', 'BTQ', 'Murojaah', 'Upacara', 'Pramuka', 'Istirahat'];
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    const rows = [];
    for (let hour = 1; hour <= 10; hour += 1) {
        let row = `<tr><td class="p-2 border border-slate-200 dark:border-slate-800 font-bold bg-slate-50 dark:bg-[#111111]">${hour}</td>`;
        days.forEach((day) => {
            const existing = state.jadwal.find((item) => item.Hari === day && Number(item.Jam_Ke) === hour && academicRecordClass(item) === currentKelas);
            const current = existing?.Mapel || '';
            row += `<td class="p-1 border border-slate-200 dark:border-slate-800"><select data-draft-key="${day}:${hour}" data-record-id="${escapeHTML(existing?.ID_Jadwal || '')}" data-baseline="${escapeHTML(current)}" class="jdw-sel w-full p-1 text-[10px] bg-transparent outline-none dark:bg-black" data-hari="${day}" data-jam="${hour}"><option value="">-</option>${subjects.filter(subject => window.SIMNICurrentAccess?.role !== 'vip' || ['PJOK', '-Kosong-', 'Istirahat'].includes(subject)).map((subject) => `<option value="${escapeHTML(subject)}" ${subject === current ? 'selected' : ''}>${escapeHTML(subject)}</option>`).join('')}</select></td>`;
        });
        rows.push(`${row}</tr>`);
    }
    body.innerHTML = rows.join('');
    SIMNIFormDrafts.restore(body);
}

async function saveJadwalMaster() {
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    if (!currentKelas) return toast('Pilih kelas dahulu.', 'warning');
    const changes = {}, expected = {};
    for (const select of document.querySelectorAll('.jdw-sel')) {
        const value = select.value === '-Kosong-' ? '' : select.value;
        if (value === select.dataset.baseline) continue;
        const matches = state.jadwal.filter(item => item.Hari === select.dataset.hari && Number(item.Jam_Ke) === Number(select.dataset.jam) && academicRecordClass(item) === currentKelas);
        if (matches.length > 1) return toast('Jadwal ganda ditemukan pada satu jam. Periksa data sebelum menyimpan.', 'error');
        const id = select.dataset.recordId || `JDW-${currentKelas}-${select.dataset.hari}-${select.dataset.jam}`;
        changes[id] = value ? { ID_Jadwal: id, Hari: select.dataset.hari, Jam_Ke: Number(select.dataset.jam), Mapel: value, Kelas: currentKelas } : null;
        expected[id] = select.dataset.recordId ? { Mapel: select.dataset.baseline } : null;
    }
    if (!Object.keys(changes).length) return toast('Tidak ada perubahan jadwal.', 'info');
    const body = document.getElementById('jadwal-table-body');
    const token = SIMNIFormDrafts.begin(body);
    const result = await dbCompareRecords('Jadwal', changes, expected);
    SIMNIFormDrafts.finish(token, result?.ok === true);
    if (!result?.ok) return toast(result?.error?.message || 'Jadwal gagal disimpan.', 'error');
    if (!SIMNIFormDrafts.sameSession(token)) return;
    state.jadwal = state.jadwal.filter(item => !Object.hasOwn(changes, item.ID_Jadwal)).concat(Object.values(changes).filter(Boolean));
    notifyCommittedSave(() => { if (SIMNIFormDrafts.isCurrent(body, token)) renderJadwalSetting(); generateFormJurnal(); });
}

function checkJurnalDateChange(newDate) {
    lastJurnalDate = newDate;
    generateFormJurnal();
}

function generateFormJurnal() {
    const date = document.getElementById('input-jurnal-tanggal')?.value;
    if (!date) return;
    const day = getNamaHari(date);
    const container = document.getElementById('jurnal-form-container');
    if (!container) return;
    if (!SIMNIFormDrafts.prepare(container, date)) return;
    const label = document.getElementById('jurnal-label-hari');
    if (label) label.innerText = day;


    const currentKelas = normalizeClassLabel(state?.activeKelas);
    
    let schedule = state.jadwal.filter((item) => item.Hari === day);
    if (currentKelas) {
        schedule = schedule.filter(item => academicRecordClass(item) === currentKelas);
    }
    schedule = schedule.sort((a, b) => Number(a.Jam_Ke) - Number(b.Jam_Ke));
    
    if (!schedule.length) {
        // Fallback: Jika jadwal mingguan belum diatur, sediakan 6 slot jam standar agar guru tetap bisa mengisi jurnal
        schedule = [1, 2, 3, 4, 5, 6].map((hour) => ({
            Hari: day,
            Jam_Ke: hour,
            Mapel: '',
            Kelas: currentKelas
        }));
    }

    const historical = state.jurnal.filter(journal => normalizeDate(journal.Tanggal) === date && academicRecordClass(journal) === currentKelas);
    for (const journal of historical) {
        if (!schedule.some(item => Number(item.Jam_Ke) === Number(journal.Jam_Ke))) schedule.push({ Jam_Ke: journal.Jam_Ke, Mapel: journal.Mapel });
    }
    schedule.sort((left, right) => Number(left.Jam_Ke) - Number(right.Jam_Ke));
    container.innerHTML = schedule.map((scheduled) => {
        const item = { ...scheduled };
        const existing = state.jurnal.find((journal) => normalizeDate(journal.Tanggal) === date && Number(journal.Jam_Ke) === Number(item.Jam_Ke) && academicRecordClass(journal) === currentKelas);
        if (existing) item.Mapel = existing.Mapel || '';
        const isIstirahat = !existing && (item.Mapel || '').toLowerCase().includes('istirahat');
        
        const inputsHtml = isIstirahat 
            ? `<div class="p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg text-center"><i class="fas fa-coffee mr-2"></i>Waktu Istirahat (Tidak diisi jurnal)</div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3"><textarea data-draft-key="${item.Jam_Ke}:materi" class="j-mat p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full focus:ring-1 focus:outline-none bg-white dark:bg-black" rows="2" placeholder="Uraian Materi Pembelajaran...">${escapeHTML(existing?.Materi || '')}</textarea><textarea data-draft-key="${item.Jam_Ke}:ket" class="j-ket p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full focus:ring-1 focus:outline-none bg-white dark:bg-black" rows="2" placeholder="Catatan Tambahan / Refleksi...">${escapeHTML(existing?.Keterangan || '')}</textarea></div>`;
            
        const mapel = item.Mapel || existing?.Mapel || '';
        const subjects = ['Matematika', 'Bahasa Indonesia', 'Pendidikan Pancasila', 'IPAS', 'Seni Rupa', 'PJOK', 'PAI', 'Bahasa Inggris', 'Bahasa Sunda', 'Komputer', 'BTQ', 'Murojaah'];
        const mapelInput = item.Mapel ? `<h4 class="font-bold text-sm">${escapeHTML(mapel)}</h4><input type="hidden" data-draft-key="${item.Jam_Ke}:mapel" class="j-map" value="${escapeHTML(mapel)}">` : `<select aria-label="Mata pelajaran jam ${item.Jam_Ke}" data-draft-key="${item.Jam_Ke}:mapel" class="j-map p-2 border rounded bg-white dark:bg-black"><option value="">Pilih mata pelajaran</option>${subjects.filter(subject => window.SIMNICurrentAccess?.role !== 'vip' || subject === 'PJOK').map(subject => `<option ${subject === mapel ? 'selected' : ''}>${escapeHTML(subject)}</option>`).join('')}</select>`;
        const baseline = existing ? { Materi: existing.Materi || '', Keterangan: existing.Keterangan || '', Mapel: existing.Mapel || '' } : null;
        return `<div data-record-id="${escapeHTML(existing?.ID_Jurnal || '')}" data-baseline="${escapeHTML(JSON.stringify(baseline))}" class="p-4 border border-slate-200 dark:border-slate-800 rounded-xl mb-3 bg-slate-50 dark:bg-[#111111] j-row"><div class="flex items-center gap-3 mb-3"><div class="font-bold">${escapeHTML(item.Jam_Ke)}</div>${mapelInput}<input type="hidden" class="j-jam" value="${escapeHTML(item.Jam_Ke)}"></div>${inputsHtml}</div>`;
    }).join('');
    SIMNIFormDrafts.restore(container);
}

async function saveJurnalHarian() {
    const date = document.getElementById('input-jurnal-tanggal')?.value;
    if (!date) return toast('Isi tanggal jurnal.', 'warning');
    const updates = {}, expected = {};
    const committed = [];
    const removedIds = new Set();
    for (const row of document.querySelectorAll('.j-row')) {
        if (!row.querySelector('.j-mat')) continue;
        const materi = row.querySelector('.j-mat')?.value.trim() || '';
        const keterangan = row.querySelector('.j-ket')?.value.trim() || '';
        const hour = row.querySelector('.j-jam')?.value;
        const currentKelas = normalizeClassLabel(state?.activeKelas);
        if (!currentKelas) return toast('Pilih kelas dahulu.', 'warning');
        const matches = state.jurnal.filter(item => normalizeDate(item.Tanggal) === date && Number(item.Jam_Ke) === Number(hour) && academicRecordClass(item) === currentKelas);
        if (matches.length > 1) return toast('Jurnal ganda ditemukan untuk jam ini. Data lama perlu diperiksa.', 'error');
        const id = row.dataset.recordId || `JRN-${date}-${hour}-${currentKelas}`;
        const baseline = JSON.parse(row.dataset.baseline);
        const mapel = row.querySelector('.j-map')?.value || '';
        if ((materi || keterangan) && (!mapel || (window.SIMNICurrentAccess?.role === 'vip' && mapel !== 'PJOK'))) return toast('Pilih mata pelajaran yang diizinkan untuk setiap jurnal terisi.', 'warning');
        if (baseline && baseline.Materi === materi && baseline.Keterangan === keterangan && baseline.Mapel === mapel) continue;
        expected[id] = baseline;
        if (materi || keterangan) {
            const payload = { ID_Jurnal: id, Tanggal: date, Jam_Ke: Number(hour), Mapel: row.querySelector('.j-map')?.value || '', Materi: materi, Keterangan: keterangan, Kelas: currentKelas };
            updates[id] = payload;
            committed.push(payload);
            removedIds.add(id);
        } else if (baseline) {
            updates[id] = null;
            removedIds.add(id);
        }
    }
    if (!Object.keys(updates).length) return toast('Tidak ada data yang diproses. Isi materi atau catatan terlebih dahulu.', 'info');
    const container = document.getElementById('jurnal-form-container');
    const token = SIMNIFormDrafts.begin(container);
    const result = await dbCompareRecords('Jurnal', updates, expected);
    SIMNIFormDrafts.finish(token, result?.ok === true);
    if (result?.ok) {
        if (!SIMNIFormDrafts.sameSession(token)) return;
        state.jurnal = state.jurnal.filter((item) => !removedIds.has(item.ID_Jurnal)).concat(committed);
        notifyCommittedSave(() => {
            if (SIMNIFormDrafts.isCurrent(container, token)) generateFormJurnal();
            renderRekapJurnal(); renderDashboard();
        });
    } else {
        toast(result?.error?.message || 'Gagal menyimpan jurnal.', 'error');
    }
}

async function hapusJurnal(id) {
    if (!confirm('Hapus jurnal ini?')) return;
    const result = await dbRemove(`Jurnal/${safeFirebaseKey(id, 'ID jurnal')}`);
    if (result?.ok) renderRekapJurnal();
}

function renderRekapJurnal() {
    const monthInput = document.getElementById('filter-jurnal-bulan');
    const body = document.getElementById('rekap-jurnal-body');
    if (!monthInput || !body) return;
    const month = monthInput.value || getJakartaMonthString();
    monthInput.value = month;
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    const filtered = state.jurnal.filter((item) => {
        if (!currentKelas || academicRecordClass(item) !== currentKelas) return false;
        return normalizeDate(item.Tanggal).startsWith(month);
    }).sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || Number(a.Jam_Ke) - Number(b.Jam_Ke));
    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400 text-xs">Jurnal kosong pada bulan ini.</td></tr>';
        return;
    }
    body.replaceChildren();
    filtered.forEach((item) => {
        const row = document.createElement('tr'); row.className = 'hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors';
        const values = [normalizeDate(item.Tanggal), item.Jam_Ke, item.Mapel, item.Materi, item.Keterangan || '-'];
        values.forEach((value, index) => {
            const cell = document.createElement('td');
            cell.className = index === 1
                ? 'p-4 text-center font-bold text-primary whitespace-nowrap'
                : index === 4
                ? 'p-4 text-xs italic text-slate-500 dark:text-slate-400 whitespace-nowrap'
                : index === 0
                ? 'p-4 text-xs font-bold whitespace-nowrap'
                : index === 2
                ? 'p-4 text-xs font-semibold whitespace-nowrap'
                : 'p-4 text-xs whitespace-pre-wrap leading-relaxed min-w-[200px]';
            cell.textContent = value ?? '';
            row.appendChild(cell);
        });
        const actionCell = document.createElement('td'); actionCell.className = 'p-4 text-center';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-red-400 hover:text-red-600 p-2'; button.setAttribute('aria-label','Hapus jurnal');
        const icon = document.createElement('i'); icon.className = 'fas fa-trash'; button.appendChild(icon); button.addEventListener('click', () => hapusJurnal(item.ID_Jurnal));
        actionCell.appendChild(button); row.appendChild(actionCell); body.appendChild(row);
    });
}

async function cetakJurnalPDF() {
    await window.ensureSIMNIVendors?.("pdf");
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');
    const rows = Array.from(document.querySelectorAll('#rekap-jurnal-body tr')).map((row) => row.cells.length > 1 ? `<tr><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(row.cells[0].innerText)}</td><td style="border:1px solid #000;padding:5px;text-align:center">${escapeHTML(row.cells[1].innerText)}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(row.cells[2].innerText)}</td><td style="border:1px solid #000;padding:5px;white-space:pre-wrap">${escapeHTML(row.cells[3].innerText)}</td><td style="border:1px solid #000;padding:5px">${escapeHTML(row.cells[4].innerText)}</td></tr>` : '').join('');
    if (!rows) return toast('Data kosong.', 'error');

    const element = document.createElement('div');
    element.innerHTML = `<div style="padding:20px;font-family:'Times New Roman',serif;color:#000;background:#fff"><h2 style="font-size:18px;font-weight:bold;text-align:center;margin-bottom:15px;text-transform:uppercase">Jurnal Mengajar Harian<br>Kelas ${escapeHTML(state.pengaturan.nama_kelas)} - ${escapeHTML(state.pengaturan.tahun_pelajaran)}</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="border:1px solid #000;padding:5px">Tanggal</th><th style="border:1px solid #000;padding:5px">Jam</th><th style="border:1px solid #000;padding:5px">Mapel</th><th style="border:1px solid #000;padding:5px">Uraian Materi</th><th style="border:1px solid #000;padding:5px">Catatan</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    showLoad('Membuat PDF...');
    try {
        await html2pdf().set({
            margin: 0.5,
            filename: `${safeFilename(`Jurnal_Kelas_${state.pengaturan.nama_kelas}`)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(element).save();
    } catch (error) {
        console.error(error);
        toast(`Gagal membuat PDF jurnal: ${error.message || error}`, 'error');
    } finally {
        hideLoad();
    }
}

if (typeof window !== 'undefined') {
    window.setJurnalTab = setJurnalTab;
    window.renderJadwalSetting = renderJadwalSetting;
    window.saveJadwalMaster = saveJadwalMaster;
    window.checkJurnalDateChange = checkJurnalDateChange;
    window.generateFormJurnal = generateFormJurnal;
    window.saveJurnalHarian = saveJurnalHarian;
    window.hapusJurnal = hapusJurnal;
    window.renderRekapJurnal = renderRekapJurnal;
    window.cetakJurnalPDF = cetakJurnalPDF;
}
