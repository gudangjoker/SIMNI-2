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
    const subjects = ['-Kosong-', 'Matematika', 'Bahasa Indonesia', 'Pendidikan Pancasila', 'IPAS', 'Seni Rupa', 'PJOK', 'PAI', 'Bahasa Inggris', 'Bahasa Sunda', 'Komputer', 'BTQ', 'Murojaah', 'Upacara', 'Pramuka', 'Istirahat'];
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const rows = [];
    for (let hour = 1; hour <= 10; hour += 1) {
        let row = `<tr><td class="p-2 border border-slate-200 dark:border-slate-800 font-bold bg-slate-50 dark:bg-[#111111]">${hour}</td>`;
        days.forEach((day) => {
            const current = state.jadwal.find((item) => item.Hari === day && Number(item.Jam_Ke) === hour && (!currentKelas || item.Kelas === currentKelas))?.Mapel || '';
            row += `<td class="p-1 border border-slate-200 dark:border-slate-800"><select class="jdw-sel w-full p-1 text-[10px] bg-transparent outline-none dark:bg-black" data-hari="${day}" data-jam="${hour}"><option value="">-</option>${subjects.map((subject) => `<option value="${escapeHTML(subject)}" ${subject === current ? 'selected' : ''}>${escapeHTML(subject)}</option>`).join('')}</select></td>`;
        });
        rows.push(`${row}</tr>`);
    }
    body.innerHTML = rows.join('');
}

async function saveJadwalMaster() {
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    // Retain schedules from other classes
    const schedule = state.jadwal.filter(item => currentKelas && item.Kelas && item.Kelas !== currentKelas);
    
    document.querySelectorAll('.jdw-sel').forEach((select) => {
        if (select.value && select.value !== '-Kosong-') {
            schedule.push({ Hari: select.dataset.hari, Jam_Ke: Number(select.dataset.jam), Mapel: select.value, Kelas: currentKelas });
        }
    });
    const result = await dbSet('Jadwal', schedule);
    if (result?.ok) {
        state.jadwal = schedule;
        renderJadwalSetting();
        generateFormJurnal();
        toast('Berhasil disimpan.', 'success');
    }
}

function checkJurnalDateChange(newDate) {
    const hasInput = [...document.querySelectorAll('.j-mat, .j-ket')].some((element) => element.value.trim() !== '');
    if (hasInput && !confirm('Peringatan: Teks jurnal yang belum disimpan akan hilang. Lanjutkan merubah tanggal?')) {
        document.getElementById('input-jurnal-tanggal').value = lastJurnalDate;
        return;
    }
    lastJurnalDate = newDate;
    generateFormJurnal();
}

function generateFormJurnal() {
    const date = document.getElementById('input-jurnal-tanggal')?.value;
    if (!date) return;
    const day = getNamaHari(date);
    const container = document.getElementById('jurnal-form-container');
    if (!container) return;
    const label = document.getElementById('jurnal-label-hari');
    if (label) label.innerText = day;

    if (day === 'Sabtu' || day === 'Minggu') {
        container.innerHTML = '<p class="text-center font-bold p-4 text-amber-500 border rounded-xl bg-amber-50 dark:bg-amber-900/10">Hari Libur.</p>';
        return;
    }

    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    
    let schedule = state.jadwal.filter((item) => item.Hari === day);
    if (currentKelas) {
        schedule = schedule.filter(item => item.Kelas === currentKelas);
    }
    schedule = schedule.sort((a, b) => Number(a.Jam_Ke) - Number(b.Jam_Ke));
    
    if (!schedule.length) {
        container.innerHTML = `<p class="text-center font-bold p-4 text-slate-500 border rounded-xl dark:border-slate-800">Jadwal hari ${escapeHTML(day)} kosong/belum diatur untuk kelas ini.</p>`;
        return;
    }

    container.innerHTML = schedule.map((item) => {
        const isIstirahat = (item.Mapel || '').toLowerCase().includes('istirahat');
        const existing = state.jurnal.find((journal) => journal.Tanggal === date && Number(journal.Jam_Ke) === Number(item.Jam_Ke) && (!currentKelas || journal.Kelas === currentKelas));
        
        const inputsHtml = isIstirahat 
            ? `<div class="p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg text-center"><i class="fas fa-coffee mr-2"></i>Waktu Istirahat (Tidak diisi jurnal)</div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3"><textarea class="j-mat p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full focus:ring-1 focus:outline-none bg-white dark:bg-black" rows="2" placeholder="Uraian Materi Pembelajaran...">${escapeHTML(existing?.Materi || '')}</textarea><textarea class="j-ket p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full focus:ring-1 focus:outline-none bg-white dark:bg-black" rows="2" placeholder="Catatan Tambahan / Refleksi...">${escapeHTML(existing?.Keterangan || '')}</textarea></div>`;
            
        return `<div class="p-4 border border-slate-200 dark:border-slate-800 rounded-xl mb-3 bg-slate-50 dark:bg-[#111111] j-row"><div class="flex items-center gap-3 ${isIstirahat ? 'mb-2' : 'mb-3'}"><div class="w-8 h-8 ${isIstirahat ? 'bg-amber-100 text-amber-700' : 'bg-primary/20 text-primary'} flex items-center justify-center font-bold rounded-lg text-sm">${escapeHTML(item.Jam_Ke)}</div><h4 class="font-bold text-sm ${isIstirahat ? 'text-amber-700 dark:text-amber-500' : ''}">${escapeHTML(item.Mapel || 'Mapel')}</h4><input type="hidden" class="j-jam" value="${escapeHTML(item.Jam_Ke)}"><input type="hidden" class="j-map" value="${escapeHTML(item.Mapel || 'Mapel')}"></div>${inputsHtml}</div>`;
    }).join('');
}

async function saveJurnalHarian() {
    const date = document.getElementById('input-jurnal-tanggal')?.value;
    if (!date) return toast('Isi tanggal jurnal.', 'warning');
    const updates = {};
    const committed = [];
    const removedIds = new Set();
    document.querySelectorAll('.j-row').forEach((row) => {
        const materi = row.querySelector('.j-mat')?.value.trim() || '';
        const keterangan = row.querySelector('.j-ket')?.value.trim() || '';
        const hour = row.querySelector('.j-jam')?.value;
        const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
        const id = currentKelas ? `JRN-${date}-${hour}-${currentKelas}` : `JRN-${date}-${hour}`;
        if (materi || keterangan) {
            const payload = { ID_Jurnal: id, Tanggal: date, Jam_Ke: Number(hour), Mapel: row.querySelector('.j-map')?.value || '', Materi: materi, Keterangan: keterangan, Kelas: currentKelas };
            updates[`Jurnal/${id}`] = payload;
            committed.push(payload);
            removedIds.add(id);
        } else if (state.jurnal.some((item) => item.ID_Jurnal === id)) {
            updates[`Jurnal/${id}`] = null;
            removedIds.add(id);
        }
    });
    if (!Object.keys(updates).length) return toast('Tidak ada data yang diproses.', 'info');
    const result = await dbUpdate(updates);
    if (result?.ok) {
        state.jurnal = state.jurnal.filter((item) => !removedIds.has(item.ID_Jurnal)).concat(committed);
        generateFormJurnal();
        renderRekapJurnal();
        renderDashboard();
        toast('Berhasil disimpan.', 'success');
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
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const filtered = state.jurnal.filter((item) => {
        if (currentKelas && item.Kelas && item.Kelas !== currentKelas) return false;
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
        values.forEach((value, index) => { const cell = document.createElement('td'); cell.className = index === 1 ? 'p-4 text-center font-bold text-primary' : index === 4 ? 'p-4 text-[10px] italic opacity-80' : index >= 2 ? 'p-4 text-xs whitespace-pre-wrap' : 'p-4 text-xs font-bold'; cell.textContent = value ?? ''; row.appendChild(cell); });
        const actionCell = document.createElement('td'); actionCell.className = 'p-4 text-center';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-red-400 hover:text-red-600 p-2'; button.setAttribute('aria-label','Hapus jurnal');
        const icon = document.createElement('i'); icon.className = 'fas fa-trash'; button.appendChild(icon); button.addEventListener('click', () => hapusJurnal(item.ID_Jurnal));
        actionCell.appendChild(button); row.appendChild(actionCell); body.appendChild(row);
    });
}

async function cetakJurnalPDF() {
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
