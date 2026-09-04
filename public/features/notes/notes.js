// ==========================================
// FILE: features/notes/notes.js
// Catatan guru dan ekspor PDF.
// ==========================================

function setCatatanTab(tab) {
    ['input', 'rekap'].forEach((name) => {
        const button = document.getElementById(`tab-catatan-${name}`);
        if (button) button.className = `whitespace-nowrap px-4 py-2 border-b-2 text-sm font-bold ${tab === name ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`;
        const panel = document.getElementById(`catatan-tab-${name}`);
        if (panel) panel.classList.toggle('hidden', tab !== name);
    });
    if (tab === 'rekap') renderCatatanList();
}

async function submitCatatan(event) {
    event.preventDefault();
    const nisn = document.getElementById('input-catatan-siswa')?.value;
    if (!nisn) return toast('Pilih siswa!', 'warning');
    const student = state.students.find((item) => item.NISN === nisn);
    if (!student) return toast('Data siswa tidak ditemukan.', 'error');
    const text = document.getElementById('input-catatan-teks')?.value.trim() || '';
    if (!text) return toast('Isi catatan terlebih dahulu.', 'warning');
    const id = `CAT-${Date.now()}`;
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const payload = {
        ID_Catatan: id,
        Tanggal: document.getElementById('input-catatan-tanggal')?.value || getJakartaDateString(),
        ID_Siswa: student.ID_Siswa || `stu_${nisn}`,
        NISN: nisn,
        Nama: student['Nama Lengkap'],
        Catatan: text,
        Kelas: currentKelas
    };
    const result = await dbSet(`Catatan/${id}`, payload);
    if (result?.ok) {
        state.catatan = state.catatan.filter((item) => item.ID_Catatan !== id).concat(payload);
        event.target.reset();
        document.getElementById('input-catatan-tanggal').value = getJakartaDateString();
        setCatatanTab('rekap');
        toast('Berhasil disimpan.', 'success');
    }
}

async function hapusCatatan(id) {
    if (!confirm('Hapus catatan?')) return;
    const result = await dbRemove(`Catatan/${safeFirebaseKey(id, 'ID catatan')}`);
    if (result?.ok) renderCatatanList();
}

function renderCatatanList() {
    const nisn = document.getElementById('filter-catatan-siswa')?.value;
    const grid = document.getElementById('catatan-grid');
    if (!grid) return;
    const currentKelas = typeof state !== 'undefined' && state.activeKelas ? state.activeKelas : '';
    const filtered = state.catatan.filter((item) => {
        if (currentKelas && item.Kelas && item.Kelas !== currentKelas) return false;
        return nisn ? item.NISN === nisn : true;
    }).sort((a, b) => String(b.Tanggal || '').localeCompare(String(a.Tanggal || '')));
    grid.replaceChildren();
    if (!filtered.length) {
        const empty = document.createElement('div'); empty.className = 'col-span-full text-center p-6 text-slate-400'; empty.textContent = 'Tidak ada catatan untuk siswa ini.'; grid.appendChild(empty); return;
    }
    filtered.forEach((item) => {
        const card = document.createElement('div'); card.className = 'bg-white dark:bg-[#111111] p-5 border border-slate-200 dark:border-slate-800 rounded-xl relative group shadow-sm';
        const head = document.createElement('div'); head.className = 'flex justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3';
        const meta = document.createElement('div');
        const date = document.createElement('span'); date.className = 'text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded tracking-widest'; date.textContent = normalizeDate(item.Tanggal);
        const name = document.createElement('h4'); name.className = 'font-bold text-sm mt-2 text-slate-800 dark:text-slate-200'; name.textContent = item.Nama || '';
        meta.append(date, name);
        const del = document.createElement('button'); del.type = 'button'; del.className = 'text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity'; del.setAttribute('aria-label','Hapus catatan');
        const icon = document.createElement('i'); icon.className = 'fas fa-trash'; del.appendChild(icon); del.addEventListener('click', () => hapusCatatan(item.ID_Catatan));
        head.append(meta, del);
        const body = document.createElement('p'); body.className = 'text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed'; body.textContent = item.Catatan || '';
        card.append(head, body); grid.appendChild(card);
    });
}

async function cetakCatatanPDF() {
    if (typeof html2pdf !== 'function') return toast('Pustaka PDF belum tersedia. Muat ulang saat online.', 'error');
    const cards = Array.from(document.querySelectorAll('#catatan-grid > div'));
    if (!cards.length) return toast('Tidak ada catatan untuk dicetak.', 'info');
    const element = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "padding:30px;font-family:serif;color:#000;background:#fff";
    const heading = document.createElement('h2');
    heading.style.cssText = 'font-weight:bold;font-size:20px;text-align:center;margin-bottom:20px;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:10px';
    heading.textContent = `Catatan Jurnal Anekdotal Guru — Kelas ${state.pengaturan.nama_kelas || ''}`;
    wrapper.appendChild(heading);
    cards.forEach((card) => {
        const copy = card.cloneNode(true);
        copy.querySelectorAll('button').forEach((button) => button.remove());
        copy.removeAttribute('class');
        copy.style.cssText = 'border:1px solid #000;padding:15px;border-radius:8px;margin-bottom:15px;page-break-inside:avoid';
        wrapper.appendChild(copy);
    });
    element.appendChild(wrapper);
    showLoad('Membuat PDF...');
    try {
        await html2pdf().set({
            margin: 0.5,
            filename: `${safeFilename(`Catatan_Guru_${state.pengaturan.nama_kelas}`)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(element).save();
    } catch (error) {
        console.error(error);
        toast(`Gagal membuat PDF catatan: ${error.message || error}`, 'error');
    } finally {
        hideLoad();
    }
}
