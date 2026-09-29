// ==========================================
// FILE: features/journal/journal.js
// Jadwal dan jurnal mengajar.
// ==========================================

function setJurnalTab(tab) {
    ['input', 'rekap', 'jadwal'].forEach((name) => {
        const button = document.getElementById(`tab-jurnal-${name}`);
        if (button) button.className = `simni-tab ${tab === name ? 'active' : ''} whitespace-nowrap`;
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
    const filtered = (state.jurnal || []).filter((item) => {
        if (!currentKelas || academicRecordClass(item) !== currentKelas) return false;
        return normalizeDate(item.Tanggal).startsWith(month);
    }).sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || Number(a.Jam_Ke) - Number(b.Jam_Ke));

    if (!filtered.length) {
        body.innerHTML = '<div class="p-8 text-center bg-white dark:bg-[#111111] rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-400 text-sm font-medium">Jurnal kosong pada bulan ini.</div>';
        return;
    }

    body.replaceChildren();
    filtered.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-[#111111] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transition-colors hover:border-slate-300 dark:hover:border-slate-700';

        // Baris Atas: Metadata jurnal (Tanggal, Jam Ke, Mapel, Keterangan, Tombol Hapus)
        const topRow = document.createElement('div');
        topRow.className = 'flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5';

        const infoGroup = document.createElement('div');
        infoGroup.className = 'flex items-center gap-2 flex-wrap';

        const dateBadge = document.createElement('span');
        dateBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-primary dark:text-indigo-400 text-xs font-bold';
        const calIcon = document.createElement('i');
        calIcon.className = 'far fa-calendar-alt text-[11px]';
        dateBadge.appendChild(calIcon);
        dateBadge.appendChild(document.createTextNode(normalizeDate(item.Tanggal)));
        infoGroup.appendChild(dateBadge);

        const jamBadge = document.createElement('span');
        jamBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold';
        jamBadge.textContent = `Jam ke-${item.Jam_Ke || '-'}`;
        infoGroup.appendChild(jamBadge);

        const mapelSpan = document.createElement('span');
        mapelSpan.className = 'font-bold text-sm text-slate-800 dark:text-white';
        mapelSpan.textContent = item.Mapel || '-';
        infoGroup.appendChild(mapelSpan);

        if (item.Keterangan) {
            const ketSpan = document.createElement('span');
            ketSpan.className = 'text-xs italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1a1a1a] px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800';
            ketSpan.textContent = item.Keterangan;
            infoGroup.appendChild(ketSpan);
        }

        topRow.appendChild(infoGroup);

        const actionWrap = document.createElement('div');
        actionWrap.className = 'flex items-center';
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors';
        deleteBtn.setAttribute('aria-label', 'Hapus jurnal');
        deleteBtn.setAttribute('title', 'Hapus Jurnal');
        const trashIcon = document.createElement('i');
        trashIcon.className = 'fas fa-trash text-sm';
        deleteBtn.appendChild(trashIcon);
        deleteBtn.addEventListener('click', () => hapusJurnal(item.ID_Jurnal));
        actionWrap.appendChild(deleteBtn);

        topRow.appendChild(actionWrap);
        card.appendChild(topRow);

        // Baris Bawah: Materi / Aktivitas ditempatkan di bawah membentang penuh (Full Width)
        const contentBox = document.createElement('div');
        contentBox.className = 'w-full bg-slate-50 dark:bg-[#000000]/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80';

        const contentLabel = document.createElement('div');
        contentLabel.className = 'text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1.5';
        const bookIcon = document.createElement('i');
        bookIcon.className = 'fas fa-book-open text-[10px]';
        contentLabel.appendChild(bookIcon);
        contentLabel.appendChild(document.createTextNode('Materi / Aktivitas'));

        const contentText = document.createElement('div');
        contentText.className = 'text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap';
        contentText.textContent = item.Materi || '-';

        contentBox.appendChild(contentLabel);
        contentBox.appendChild(contentText);
        card.appendChild(contentBox);

        body.appendChild(card);
    });
}

async function cetakJurnalPDF() {
    await window.ensureSIMNIVendors?.("pdf");
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');
    const monthInput = document.getElementById('filter-jurnal-bulan');
    const month = monthInput?.value || getJakartaMonthString();
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    const filtered = (state.jurnal || []).filter((item) => {
        if (!currentKelas || academicRecordClass(item) !== currentKelas) return false;
        return normalizeDate(item.Tanggal).startsWith(month);
    }).sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || Number(a.Jam_Ke) - Number(b.Jam_Ke));

    if (!filtered.length) return toast('Data jurnal kosong untuk bulan ini.', 'error');

    const rows = filtered.map((item) => `<tr>
        <td style="border:1px solid #000;padding:6px;text-align:center">${escapeHTML(normalizeDate(item.Tanggal))}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center">${escapeHTML(String(item.Jam_Ke || ''))}</td>
        <td style="border:1px solid #000;padding:6px;font-weight:bold">${escapeHTML(item.Mapel || '')}</td>
        <td style="border:1px solid #000;padding:6px;white-space:pre-wrap;line-height:1.4">${escapeHTML(item.Materi || '')}</td>
        <td style="border:1px solid #000;padding:6px">${escapeHTML(item.Keterangan || '-')}</td>
    </tr>`).join('');

    const element = document.createElement('div');
    element.innerHTML = `<div style="padding:20px;font-family:'Times New Roman',serif;color:#000;background:#fff">
        <h2 style="font-size:18px;font-weight:bold;text-align:center;margin-bottom:15px;text-transform:uppercase">
            Jurnal Mengajar Harian<br>Kelas ${escapeHTML(state?.pengaturan?.nama_kelas || currentKelas || '')} - ${escapeHTML(state?.pengaturan?.tahun_pelajaran || '')}
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
                <tr style="background:#f0f0f0">
                    <th style="border:1px solid #000;padding:6px;width:15%">Tanggal</th>
                    <th style="border:1px solid #000;padding:6px;width:8%">Jam</th>
                    <th style="border:1px solid #000;padding:6px;width:22%">Mapel</th>
                    <th style="border:1px solid #000;padding:6px;width:40%">Uraian Materi</th>
                    <th style="border:1px solid #000;padding:6px;width:15%">Catatan</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
    showLoad('Membuat PDF...');
    try {
        await html2pdf().set({
            margin: 0.5,
            filename: `${safeFilename(`Jurnal_Kelas_${state?.pengaturan?.nama_kelas || currentKelas || 'Rekap'}`)}.pdf`,
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

function previewPrintJurnal() {
    const monthInput = document.getElementById('filter-jurnal-bulan');
    const month = monthInput?.value || getJakartaMonthString();
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    const filtered = (state.jurnal || []).filter((item) => {
        if (!currentKelas || academicRecordClass(item) !== currentKelas) return false;
        return normalizeDate(item.Tanggal).startsWith(month);
    }).sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || Number(a.Jam_Ke) - Number(b.Jam_Ke));

    if (!filtered.length) return toast('Tidak ada data jurnal untuk bulan ini.', 'warning');

    const area = document.getElementById('area-preview-cetak-jurnal');
    if (!area) return;

    const logoUrl = escapeHTML(state?.pengaturan?.logo_url || './icons/school-logo.png');
    const namaYayasan = escapeHTML(state?.pengaturan?.nama_yayasan || 'YAYASAN SOSIAL DAN PENDIDIKAN BINA MUDA');
    const jenjangSekolah = escapeHTML(state?.pengaturan?.jenjang_sekolah || 'SEKOLAH DASAR ISLAM TERPADU');
    const namaSekolah = escapeHTML(state?.pengaturan?.nama_sekolah || 'SDIT BINA MUDA CICALENGKA');
    const statusAkreditasiRaw = state?.pengaturan?.status_akreditasi || 'A';
    const statusAkreditasi = escapeHTML(statusAkreditasiRaw.toLowerCase().includes('terakreditasi') ? statusAkreditasiRaw : `Terakreditasi "${statusAkreditasiRaw}"`);
    const nomorIzinRaw = state?.pengaturan?.nomor_izin || 'No.421.2/1143-Disdikbud/2011';
    const nomorIzin = escapeHTML(nomorIzinRaw.toLowerCase().includes('ijin') || nomorIzinRaw.toLowerCase().includes('izin') ? nomorIzinRaw : `Ijin Operasional/RPS : ${nomorIzinRaw}`);
    const kotaSekolah = escapeHTML(state?.pengaturan?.kota || 'Cicalengka');
    const tahunPelajaran = escapeHTML(state?.pengaturan?.tahun_pelajaran || '2026/2027');
    const semester = escapeHTML(state?.pengaturan?.semester || '1 (Ganjil)');
    const namaKelas = escapeHTML(state?.pengaturan?.nama_kelas || currentKelas || 'Semua Kelas');
    const namaGuru = escapeHTML(state?.pengaturan?.nama_wali_kelas || state?.pengaturan?.nama_guru || state?.user?.displayName || 'Guru Kelas');
    const nuptkGuru = escapeHTML(state?.pengaturan?.nuptk_wali_kelas || state?.pengaturan?.nuptk_guru || state?.pengaturan?.nip_guru || '-');
    const namaKamad = escapeHTML(state?.pengaturan?.nama_kepala_sekolah || state?.pengaturan?.nama_kamad || 'Kepala SDIT Bina Muda');
    const nuksKamad = escapeHTML(state?.pengaturan?.nuks_kepala_sekolah || state?.pengaturan?.nuks_kamad || state?.pengaturan?.nip_kamad || '-');
    const tglCetak = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    let formattedMonth = month;
    try {
        const [y, m] = month.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        formattedMonth = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
    } catch (_) {}

    const rowsHtml = filtered.map((item, idx) => {
        let tglFormatted = normalizeDate(item.Tanggal);
        try {
            const d = new Date(item.Tanggal);
            tglFormatted = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(d);
        } catch (_) {}

        return `
            <tr style="border-bottom: 1px solid #333;">
                <td style="border: 1px solid #333; padding: 6px 8px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; white-space: nowrap;">${escapeHTML(tglFormatted)}</td>
                <td style="border: 1px solid #333; padding: 6px 8px; text-align: center; font-weight: bold;">Ke-${escapeHTML(String(item.Jam_Ke || ''))}</td>
                <td style="border: 1px solid #333; padding: 6px 8px; font-weight: bold;">${escapeHTML(item.Mapel || '')}</td>
                <td style="border: 1px solid #333; padding: 6px 8px; text-align: left; line-height: 1.4; white-space: pre-wrap;">${escapeHTML(item.Materi || '-')}</td>
                <td style="border: 1px solid #333; padding: 6px 8px; text-align: left;">${escapeHTML(item.Keterangan || '-')}</td>
            </tr>
        `;
    }).join('');

    area.innerHTML = `
        <div style="font-family: 'Times New Roman', serif; color: #111; line-height: 1.3;">
            <!-- KOP SURAT RESMI IDENTIK LPS / BLP -->
            <header class="lps-letterhead" style="display: grid; grid-template-columns: 80px minmax(0, 1fr); align-items: center; gap: 12px; min-height: 85px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 16px;">
                <div class="lps-logo-box" style="display: flex; align-items: center; justify-content: center; width: 75px; height: 75px;">
                    <img src="${logoUrl}" alt="Logo sekolah" style="display: block; max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <div class="lps-school-copy" style="min-width: 0; text-align: center;">
                    <p style="margin: 0; font-size: 10pt; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${namaYayasan}</p>
                    <p style="margin: 1px 0 0 0; font-size: 9.5pt; font-weight: 600; text-transform: uppercase;">${jenjangSekolah}</p>
                    <h1 style="margin: 3px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16pt; font-weight: bold; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.5px;">${namaSekolah}</h1>
                    <strong style="display: block; margin: 1px 0 0 0; font-size: 9pt; font-weight: bold;">${statusAkreditasi}</strong>
                    <em style="display: block; margin: 1px 0 0 0; font-size: 8.5pt; font-style: normal; font-weight: 500;">${nomorIzin}</em>
                </div>
            </header>

            <!-- JUDUL JURNAL -->
            <div style="text-align: center; margin-bottom: 16px;">
                <h3 style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase;">JURNAL KEGIATAN PEMBELAJARAN HARIAN</h3>
                <p style="font-size: 10.5pt; font-weight: bold; margin: 4px 0 0 0;">Kelas: ${namaKelas} — Bulan: ${escapeHTML(formattedMonth)}</p>
                <p style="font-size: 9pt; margin: 2px 0 0 0;">Tahun Pelajaran ${tahunPelajaran} (Semester ${semester})</p>
            </div>

            <!-- TABEL JURNAL -->
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #f1f5f9; font-weight: bold; text-transform: uppercase;">
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 35px; text-align: center;">No</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 85px; text-align: center;">Hari, Tgl</th>
                        <th style="border: 1px solid #000; padding: 8px 6px; width: 60px; text-align: center;">Jam</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; width: 140px; text-align: left;">Mata Pelajaran</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; text-align: left;">Uraian Materi Pembelajaran</th>
                        <th style="border: 1px solid #000; padding: 8px 8px; width: 110px; text-align: left;">Catatan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- TANDA TANGAN -->
            <div style="display: flex; justify-content: space-between; page-break-inside: avoid; margin-top: 30px; font-size: 10pt;">
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">Mengetahui,</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Kepala SDIT Bina Muda</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaKamad}</p>
                    <p style="margin: 0; font-size: 9pt;">NUKS. ${nuksKamad}</p>
                </div>
                <div style="text-align: center; width: 220px;">
                    <p style="margin: 0;">${kotaSekolah}, ${tglCetak}</p>
                    <p style="font-weight: bold; margin: 0 0 55px 0;">Guru Kelas / Mata Pelajaran</p>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${namaGuru}</p>
                    <p style="margin: 0; font-size: 9pt;">NUPTK. ${nuptkGuru}</p>
                </div>
            </div>
        </div>
    `;

    openModal('modal-preview-cetak-jurnal');
}

async function executePrintJurnalPreview() {
    await window.ensureSIMNIVendors?.("pdf");
    const container = document.getElementById('area-preview-cetak-jurnal');
    if (!container) return;

    if (typeof html2pdf === 'function') {
        showLoad('Membuat dokumen PDF Jurnal...');
        const monthInput = document.getElementById('filter-jurnal-bulan');
        const month = monthInput?.value || getJakartaMonthString();
        const currentKelas = normalizeClassLabel(state?.activeKelas) || 'Semua';
        try {
            await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: `Jurnal_Mengajar_${currentKelas}_${month}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(container).save();
            toast('Dokumen PDF Jurnal berhasil disimpan.', 'success');
        } catch (err) {
            console.error(err);
            window.print();
        } finally {
            hideLoad();
        }
    } else {
        window.print();
    }
}

async function exportJurnalExcel() {
    await window.ensureSIMNIVendors?.("xlsx");
    if (!window.XLSX?.utils) return toast('Pustaka Excel belum siap. Muat ulang saat online.', 'error');

    const monthInput = document.getElementById('filter-jurnal-bulan');
    const month = monthInput?.value || getJakartaMonthString();
    const currentKelas = normalizeClassLabel(state?.activeKelas);
    const filtered = (state.jurnal || []).filter((item) => {
        if (!currentKelas || academicRecordClass(item) !== currentKelas) return false;
        return normalizeDate(item.Tanggal).startsWith(month);
    }).sort((a, b) => String(a.Tanggal).localeCompare(String(b.Tanggal)) || Number(a.Jam_Ke) - Number(b.Jam_Ke));

    if (!filtered.length) return toast('Tidak ada data jurnal untuk bulan ini.', 'warning');

    showLoad('Menyusun file Excel Jurnal...');
    try {
        const rows = filtered.map((item, idx) => ({
            'No': idx + 1,
            'Tanggal': normalizeDate(item.Tanggal),
            'Jam Ke': item.Jam_Ke || '',
            'Mata Pelajaran': item.Mapel || '',
            'Uraian Materi Pembelajaran': item.Materi || '',
            'Catatan / Keterangan': item.Keterangan || '',
            'Kelas': item.Kelas || currentKelas || ''
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 6 },   // No
            { wch: 14 },  // Tanggal
            { wch: 8 },   // Jam Ke
            { wch: 22 },  // Mapel
            { wch: 45 },  // Materi
            { wch: 25 },  // Catatan
            { wch: 8 }    // Kelas
        ];

        const wb = XLSX.utils.book_new();
        const sheetName = `Jurnal_${month.replace(/-/g, '_')}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const filename = `Jurnal_Mengajar_${safeFilename(currentKelas || 'Semua')}_${month}.xlsx`;
        XLSX.writeFile(wb, filename);
        toast(`Jurnal berhasil diekspor (${filtered.length} kegiatan).`, 'success');
    } catch (err) {
        console.error(err);
        toast(`Gagal mengekspor jurnal: ${err.message || err}`, 'error');
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
    window.previewPrintJurnal = previewPrintJurnal;
    window.executePrintJurnalPreview = executePrintJurnalPreview;
    window.exportJurnalExcel = exportJurnalExcel;
}
