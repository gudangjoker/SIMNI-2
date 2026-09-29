import { listAccounts, accountCommand } from '../../js/auth/registration-service.js';

const $ = (id) => document.getElementById(id);
const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { students: 'Data Siswa', attendance: 'Presensi', grades: 'Nilai & TP', journal: 'Jurnal', notes: 'Catatan', gadm: 'GADM', lps: 'LPS/BLP', settings: 'Pengaturan Kelas', backup: 'Backup', archive: 'Arsip' };
const statusLabel = {
    pending_approval: 'Menunggu persetujuan',
    pending: 'Menunggu persetujuan',
    active: 'Aktif',
    unassigned: 'Belum ditugaskan',
    disabled: 'Nonaktif',
    revoked: 'Dicabut',
    deleting: 'Penghapusan belum selesai',
    rejected: 'Ditolak',
    approved: 'Disetujui'
};

const SECTION_META = {
    requests: {
        title: 'Permohonan Guru',
        desc: 'Tinjau dan proses permohonan akses dari guru yang mendaftar.',
        icon: 'fa-inbox',
        empty: 'Tidak ada permohonan menunggu saat ini.'
    },
    classes: {
        title: 'Penempatan Kelas',
        desc: 'Tetapkan wali kelas atau guru pengampu untuk masing-masing kelas.',
        icon: 'fa-chalkboard',
        empty: 'Seluruh kelas sudah ditugaskan atau belum tersedia.'
    },
    users: {
        title: 'Akun & Kewenangan',
        desc: 'Kelola akun guru aktif, perizinan modul, dan status akun.',
        icon: 'fa-user-shield',
        empty: 'Belum ada akun guru terdaftar.'
    },
    invites: {
        title: 'Undangan Guru',
        desc: 'Buat kode tiket sekali pakai untuk mengundang guru baru bergabung.',
        icon: 'fa-ticket-alt',
        empty: 'Belum ada undangan yang dibuat.'
    },
    year: {
        title: 'Tahun Ajaran',
        desc: 'Persiapkan susunan penempatan guru untuk tahun ajaran berikutnya.',
        icon: 'fa-calendar-alt',
        empty: 'Belum ada draf penempatan tahun berikutnya.'
    },
    history: {
        title: 'Riwayat Operasi',
        desc: 'Log catatan audit mutasi akun dan arsip data aktivitas.',
        icon: 'fa-history',
        empty: 'Belum ada riwayat aktivitas.'
    }
};

let data = null, section = 'hub', busy = false, submitAction = null, opener = null, pendingPayload = null;

function feedback(text) {
    const el = $('accounts-feedback');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = `<i class="fas fa-info-circle text-sm text-primary mr-1"></i> <span>${escape(text)}</span>`;
}

function updateAccountsNavBadge(count) {
    const n = Number(count) || 0;
    const desktopBadge = $('badge-nav-accounts-desktop');
    const mobileBadge = $('badge-nav-accounts-mobile');
    const hamburgerDot = $('badge-hamburger-dot');
    [desktopBadge, mobileBadge].forEach(el => {
        if (!el) return;
        if (n > 0) {
            el.textContent = n;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
    if (hamburgerDot) {
        if (n > 0) hamburgerDot.classList.remove('hidden');
        else hamburgerDot.classList.add('hidden');
    }
}

function button(action, text, attrs = '', variant = 'secondary') {
    let cls = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0';
    if (variant === 'primary' || action === 'approve' || action === 'assign') {
        cls += ' bg-primary hover:bg-indigo-600 text-white shadow-primary/20';
    } else if (variant === 'danger' || action === 'reject' || action === 'delete' || action === 'revoke-invite') {
        cls += ' bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 text-rose-600';
    } else {
        cls += ' bg-slate-100 hover:bg-slate-200 dark:bg-[#1f2438] dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60';
    }
    return `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${escape(text)}</button>`;
}

function card(title, description, actions = '', icon = 'fa-user-circle', badge = '') {
    return `<article class="bg-white dark:bg-[#111111] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-primary flex items-center justify-center text-xs flex-shrink-0 shadow-2xs"><i class="fas ${icon}"></i></span>
                    <h3 class="font-bold text-sm text-slate-800 dark:text-white truncate">${escape(title)}</h3>
                </div>
                ${badge ? `<div class="shrink-0">${badge}</div>` : ''}
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${escape(description)}</p>
        </div>
        ${actions ? `<div class="flex flex-wrap gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">${actions}</div>` : ''}
    </article>`;
}

function uidAttr(uid) {
    return `data-uid="${escape(uid)}"`;
}

function render() {
    if (!data) return;
    $('accounts-metrics').hidden = false;
    const pendingCount = Object.values(data.requests).filter(r => r.status === 'pending').length;
    const activeCount = Object.values(data.users).filter(u => u.role !== 'superuser' && u.status === 'active').length;
    const availableCount = data.items.filter(s => !s.assignedUid && !s.systemOwned).length;

    $('accounts-count-pending').textContent = pendingCount;
    $('accounts-count-active').textContent = activeCount;
    $('accounts-count-available').textContent = availableCount;

    // Update Badges on Hub Menu Cards
    if ($('badge-menu-requests')) $('badge-menu-requests').textContent = `${pendingCount} Menunggu`;
    if ($('badge-menu-classes')) $('badge-menu-classes').textContent = `${availableCount} Tersedia`;
    if ($('badge-menu-users')) $('badge-menu-users').textContent = `${activeCount} Aktif`;
    if ($('badge-menu-year')) $('badge-menu-year').textContent = `Tahun ${data.activeYear}`;

    const regToggle = $('accounts-registration-toggle');
    const regThumb = $('accounts-registration-switch-thumb');
    const regBadge = $('accounts-registration-badge');
    const regIndicator = $('accounts-registration-indicator');
    if (regToggle && regThumb && regBadge) {
        regToggle.setAttribute('aria-checked', String(data.enabled));
        if (data.enabled) {
            regToggle.classList.remove('bg-slate-300', 'dark:bg-slate-700');
            regToggle.classList.add('bg-emerald-500');
            regThumb.classList.remove('translate-x-0');
            regThumb.classList.add('translate-x-4');
            regBadge.textContent = 'Terbuka';
            regBadge.className = 'text-xs font-bold mt-0.5 text-emerald-600 dark:text-emerald-400';
            if (regIndicator) regIndicator.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]';
        } else {
            regToggle.classList.remove('bg-emerald-500');
            regToggle.classList.add('bg-slate-300', 'dark:bg-slate-700');
            regThumb.classList.remove('translate-x-4');
            regThumb.classList.add('translate-x-0');
            regBadge.textContent = 'Tertutup';
            regBadge.className = 'text-xs font-bold mt-0.5 text-rose-500 dark:text-rose-400';
            if (regIndicator) regIndicator.className = 'w-2 h-2 rounded-full bg-rose-500';
        }
    }
    updateAccountsNavBadge(pendingCount);
    $('accounts-summary').textContent = `${pendingCount} permohonan menunggu · ${availableCount} kelas belum ditugaskan · Tahun ${data.activeYear}`;

    if (section === 'hub') {
        if ($('accounts-hub')) $('accounts-hub').hidden = false;
        if ($('accounts-subview')) $('accounts-subview').hidden = true;
        return;
    }

    if ($('accounts-hub')) $('accounts-hub').hidden = true;
    if ($('accounts-subview')) $('accounts-subview').hidden = false;

    const meta = SECTION_META[section] || SECTION_META.requests;
    if ($('accounts-subview-title')) $('accounts-subview-title').innerHTML = `<i class="fas ${meta.icon} text-primary mr-2"></i>${meta.title}`;
    if ($('accounts-subview-desc')) $('accounts-subview-desc').textContent = meta.desc;

    // Action buttons on subview header
    const actionsEl = $('accounts-subview-actions');
    if (actionsEl) {
        if (section === 'invites') {
            actionsEl.innerHTML = button('invite', '+ Buat Undangan Baru', '', 'primary');
        } else if (section === 'history') {
            actionsEl.innerHTML = button('archive-history', 'Ekspor Riwayat', '', 'primary');
        } else if (section === 'year') {
            const start = Number(data.activeYear.slice(0, 4)), year = `${start + 1}-${start + 2}`;
            actionsEl.innerHTML = button('save-draft', 'Susun Draf Baru', `data-year="${year}"`, 'primary');
        } else {
            actionsEl.innerHTML = '';
        }
    }

    $('view-kelola-akun').querySelectorAll('.accounts-tab-btn').forEach(b => {
        const active = b.dataset.section === section;
        b.className = `accounts-tab-btn whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            active
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`;
        b.setAttribute('aria-current', String(active));
    });

    let html = '';
    if (section === 'requests') {
        html = Object.values(data.requests).filter(r => r.status === 'pending').map(r =>
            card(r.displayName || r.email, `${r.email} · meminta penugasan kelas ${r.classId}`,
                button('approve', 'Tinjau & Setujui', uidAttr(r.uid), 'primary') + button('reject', 'Tolak', uidAttr(r.uid), 'danger'),
                'fa-inbox',
                '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 shadow-2xs">Menunggu</span>'
            )
        ).join('');
    }
    if (section === 'classes') {
        html = data.items.map(s => {
            const p = data.users[s.assignedUid];
            const classBadge = s.systemOwned
                ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-bold border border-slate-500/20 shadow-2xs">Sistem</span>'
                : s.assignedUid
                    ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shadow-2xs">Terisi</span>'
                    : '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 shadow-2xs">Kosong</span>';
            return card(`Kelas ${s.classId}`,
                p ? `${p.displayName || p.email} · ${statusLabel[p.status] || p.status}` : 'Belum ditugaskan guru',
                s.systemOwned ? '<span class="text-xs text-slate-400 font-medium">Khusus Superuser</span>' : s.assignedUid ? (button('replace', 'Ganti Guru', uidAttr(s.assignedUid)) + button('unassign', 'Cabut Penugasan', uidAttr(s.assignedUid), 'danger')) : (button('assign', 'Tetapkan Guru', `data-class="${s.classId}"`, 'primary') + button('invite', 'Buat Undangan', `data-class="${s.classId}"`)),
                'fa-chalkboard',
                classBadge
            );
        }).join('');
    }
    if (section === 'users') {
        html = Object.values(data.users).map(p => {
            const userBadge = p.role === 'superuser'
                ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20 shadow-2xs">Superuser</span>'
                : p.status === 'active'
                    ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shadow-2xs">Aktif</span>'
                    : p.status === 'disabled'
                        ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-bold border border-slate-500/20 shadow-2xs">Nonaktif</span>'
                        : `<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 shadow-2xs">${escape(statusLabel[p.status] || p.status)}</span>`;
            return card(p.displayName || p.email, `${p.email} · Kelas: ${p.classId || 'Belum ditugaskan'}`,
                p.role === 'superuser' ? '<span class="text-xs text-primary font-bold"><i class="fas fa-shield-alt mr-1"></i> Superuser</span>' : (p.status === 'deleting' ? button('resume-delete', 'Lanjutkan Penghapusan', uidAttr(p.uid), 'danger') : button('permissions', 'Atur Izin', uidAttr(p.uid))) + (p.role === 'teacher' ? (button('move', 'Pindahkan Kelas', uidAttr(p.uid)) + button('archive-access', 'Akses Arsip', uidAttr(p.uid))) : '') + (['active', 'unassigned', 'disabled'].includes(p.status) ? button('status', p.status === 'disabled' ? 'Aktifkan' : 'Nonaktifkan', uidAttr(p.uid)) : '') + button('delete', 'Hapus Akun', uidAttr(p.uid), 'danger'),
                p.role === 'superuser' ? 'fa-shield-alt' : 'fa-user-shield',
                userBadge
            );
        }).join('');
    }
    if (section === 'invites') {
        html = card('Undangan Baru', 'Kode sekali pakai ditampilkan saat dibuat. Guru tetap membutuhkan persetujuanmu.', button('invite', 'Buat Undangan', '', 'primary'), 'fa-ticket-alt', '<span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20 shadow-2xs">Baru</span>');
        html += data.invitations.map(inv => {
            const isRevoked = Boolean(inv.revokedAt);
            const isConsumed = Boolean(inv.consumedBy);
            const isExpired = inv.expiresAt < Date.now();
            const state = isRevoked ? 'Dicabut' : isConsumed ? (data.requests[inv.consumedBy]?.status === 'pending' ? 'Menunggu persetujuan' : 'Sudah digunakan') : isExpired ? 'Kedaluwarsa' : 'Belum digunakan';
            const inviteBadge = isRevoked
                ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/20 shadow-2xs">Dicabut</span>'
                : isConsumed
                    ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shadow-2xs">Digunakan</span>'
                    : isExpired
                        ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-bold border border-slate-500/20 shadow-2xs">Kedaluwarsa</span>'
                        : '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20 shadow-2xs">Aktif</span>';
            return card(`Undangan Kelas ${inv.classId}`, `${inv.email} · Berlaku s/d ${new Date(inv.expiresAt).toLocaleString('id-ID')}`,
                button('invite', 'Buat Ulang', `data-class="${inv.classId}"`) + button('revoke-invite', 'Cabut', `data-class="${inv.classId}"`, 'danger'),
                'fa-envelope-open-text',
                inviteBadge
            );
        }).join('');
    }
    if (section === 'year') {
        const start = Number(data.activeYear.slice(0, 4)), year = `${start + 1}-${start + 2}`, draft = data.drafts[year];
        html = card(`Penempatan Tahun ${year}`, 'Siapkan susunan guru tahun berikutnya. Aktivasi penempatan tidak menghapus data tahun lama.',
            button('save-draft', 'Susun Draf', `data-year="${year}"`, 'primary') + (draft ? button('activate-year', 'Tinjau & Aktifkan', `data-year="${year}"`) : ''),
            'fa-calendar-alt',
            draft ? '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 shadow-2xs">Draf Siap</span>' : '<span class="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">Belum Ada</span>'
        );
        if (draft) html += Object.entries(draft.placement).map(([cls, uid]) => card(`Kelas ${cls}`, data.users[uid]?.displayName || data.users[uid]?.email || uid, '', 'fa-user-check', '<span class="simni-badge-dot px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shadow-2xs">Ditempatkan</span>')).join('');
    }
    if (section === 'history') {
        html = card('Arsip Riwayat', 'Ekspor 20 catatan tertua, lalu konfirmasikan penyimpanan sebelum membersihkannya dari server.', button('archive-history', 'Ekspor & Rapikan Riwayat', '', 'primary'), 'fa-archive') + data.audit.map(a => card(a.action, `${new Date(a.at).toLocaleString('id-ID')} · ${data.users[a.actor]?.displayName || a.actor} · ${a.target || ''}`, '', 'fa-history', '<span class="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">Log</span>')).join('');
    }

    const emptyMsg = SECTION_META[section]?.empty || 'Belum ada data pada bagian ini.';
    $('accounts-content').innerHTML = html || `
        <div class="col-span-full py-12 px-6 text-center bg-white dark:bg-[#111111] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#1a1a1a] text-slate-400 flex items-center justify-center mx-auto mb-3 text-lg">
                <i class="fas fa-folder-open"></i>
            </div>
            <h3 class="font-bold text-sm text-slate-800 dark:text-white mb-1">${escape(emptyMsg)}</h3>
            <p class="text-xs text-slate-400">Belum ada data pada bagian ini.</p>
        </div>`;
}

function setLoadState(phase, error = null) {
    const loading = phase === 'loading', ready = phase === 'ready';
    $('accounts-load-state').hidden = ready;
    if ($('accounts-hub')) $('accounts-hub').hidden = !ready || section !== 'hub';
    if ($('accounts-subview')) $('accounts-subview').hidden = !ready || section === 'hub';
    $('accounts-metrics').hidden = !ready;
    $('accounts-summary').hidden = !ready;
    $('accounts-refresh').disabled = loading;
    $('accounts-registration-toggle').disabled = !ready;
    $('accounts-retry').hidden = !error;
    $('accounts-load-details').hidden = !error;

    const spinner = $('accounts-load-spinner');
    if (spinner) {
        spinner.className = error ? 'fas fa-exclamation-circle text-rose-500' : 'fas fa-spinner fa-spin text-primary';
    }

    $('accounts-load-title').textContent = error ? 'Data akun belum dapat dimuat' : 'Memuat akun guru…';
    const configuration = /service account|secret|konfigurasi/i.test(error?.message || '');
    $('accounts-load-description').textContent = error
        ? (configuration ? 'Layanan akun sedang dipersiapkan. Klik Coba Lagi untuk memuat kembali.' : 'Koneksi ke layanan akun terputus. Periksa koneksi lalu coba lagi.')
        : 'Menyiapkan permohonan dan penempatan kelas.';
    $('accounts-load-error').textContent = error ? String(error.message || 'Layanan tidak tersedia') : '';
    $('accounts-content').setAttribute('aria-busy', String(loading));
}

async function refresh() {
    if (busy) return;
    busy = true; setLoadState('loading');
    try {
        data = await listAccounts();
        render();
        setLoadState('ready');
    } catch (error) {
        data = null;
        $('accounts-content').replaceChildren();
        setLoadState('error', error);
    } finally {
        busy = false;
    }
}

function field(name, label, type = 'text', value = '', extra = '') {
    return `<div>
        <label for="account-field-${name}" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">${escape(label)}</label>
        <input id="account-field-${name}" name="${name}" type="${type}" value="${escape(value)}" class="w-full px-3 py-2 bg-slate-50 dark:bg-[#000000] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary" ${extra}>
    </div>`;
}

function select(name, label, options, value = '') {
    return `<div>
        <label for="account-field-${name}" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">${escape(label)}</label>
        <select id="account-field-${name}" name="${name}" class="w-full px-3 py-2 bg-slate-50 dark:bg-[#000000] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary">
            ${options.map(([v, t]) => `<option value="${escape(v)}" ${v === value ? 'selected' : ''}>${escape(t)}</option>`).join('')}
        </select>
    </div>`;
}

function permissionFields(grants = data.preset) {
    return data.features.map(f => select(`p_${f}`, labels[f] || f, [['none', 'Tidak diizinkan'], ['read', 'Lihat'], ['manage', 'Kelola']], grants?.[f] || 'none')).join('') + select('p_export', 'Ekspor data kelas', [['false', 'Tidak diizinkan'], ['true', 'Diizinkan']], String(grants?.export === true));
}

function grants(form) {
    return Object.fromEntries([...data.features.map(f => [f, form.get(`p_${f}`)]), ['export', form.get('p_export') === 'true']]);
}

function classes() {
    return data.items.filter(s => !s.systemOwned).map(s => [s.classId, `Kelas ${s.classId}${s.assignedUid ? ' · sudah terisi' : ''}`]);
}

function modal(title, fields, handler, label = 'Simpan') {
    opener = document.activeElement; pendingPayload = null; submitAction = handler;
    $('accounts-dialog-title').textContent = title;
    $('accounts-dialog-fields').innerHTML = fields;
    $('accounts-dialog-error').textContent = '';
    $('accounts-confirm').textContent = label;
    $('accounts-confirm').hidden = !handler;
    $('accounts-dialog').showModal();
    $('accounts-dialog').querySelector('input,select,button')?.focus();
}

function close() {
    if (busy) return;
    $('accounts-dialog').close();
    $('accounts-dialog-fields').replaceChildren();
    submitAction = null;
    pendingPayload = null;
    opener?.focus();
}

async function action(actionName, body) {
    const encoded = JSON.stringify({ actionName, body });
    if (!pendingPayload || pendingPayload.encoded !== encoded) {
        pendingPayload = { encoded, payload: { ...body, operationId: `acct_${crypto.randomUUID().replaceAll('-', '')}`, issuedAt: Date.now(), expectedRevision: data.revision } };
    }
    return accountCommand(actionName, pendingPayload.payload);
}

async function showInvite(code, cls) {
    const link = new URL('./register.html', window.location.href);
    link.hash = new URLSearchParams({ slot: `kelas-${cls.toLowerCase()}`, code }).toString();
    await window.ensureSIMNIVendors?.('qr');

    modal('Undangan Dibuat', `
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            Simpan kode atau bagikan tautan/QR code ini kepada guru kelas. Guru masih harus disetujui setelah mendaftar.
        </p>
        <div class="space-y-3">
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kode Undangan</label>
                <pre id="accounts-secret" class="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-primary font-mono text-sm font-bold rounded-xl border border-indigo-200 dark:border-indigo-800/50 break-all select-all">${escape(code)}</pre>
            </div>
            <div class="flex flex-wrap gap-2">
                ${button('copy-code', 'Salin Kode', '', 'primary')}
                ${button('copy-link', 'Salin Tautan')}
                ${button('toggle-qr', 'Tampilkan QR Code')}
            </div>
            <div id="accounts-qr-container" class="hidden flex flex-col items-center justify-center p-4 bg-white dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-slate-800 mt-2">
                <div id="accounts-invite-qr-target" class="p-2 bg-white rounded-lg shadow-xs"></div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">Pindai dengan kamera ponsel guru untuk membuka formulir pendaftaran.</p>
            </div>
        </div>
    `, null);

    const fields = $('accounts-dialog-fields');
    fields.querySelector('[data-action="copy-code"]').onclick = () => navigator.clipboard.writeText(code).then(() => { $('accounts-dialog-error').textContent = 'Kode disalin ke clipboard.'; }).catch(() => { $('accounts-dialog-error').textContent = 'Pilih dan salin kode secara manual.'; });
    fields.querySelector('[data-action="copy-link"]').onclick = () => navigator.clipboard.writeText(link.href).then(() => { $('accounts-dialog-error').textContent = 'Tautan disalin ke clipboard.'; }).catch(() => { $('accounts-secret').textContent = link.href; });
    const toggleQrBtn = fields.querySelector('[data-action="toggle-qr"]');
    const qrContainer = $('accounts-qr-container');
    const qrTarget = $('accounts-invite-qr-target');
    let qrRendered = false;
    if (toggleQrBtn && qrContainer && qrTarget) {
        toggleQrBtn.onclick = () => {
            if (qrContainer.classList.contains('hidden')) {
                qrContainer.classList.remove('hidden');
                toggleQrBtn.textContent = 'Sembunyikan QR';
                if (!qrRendered && typeof QRCode === 'function') {
                    qrTarget.replaceChildren();
                    new QRCode(qrTarget, { text: link.href, width: 140, height: 140 });
                    qrRendered = true;
                }
            } else {
                qrContainer.classList.add('hidden');
                toggleQrBtn.textContent = 'Tampilkan QR Code';
            }
        };
    }
}

function openAction(buttonElement) {
    if (busy || !data) return;
    const a = buttonElement.dataset.action, uid = buttonElement.dataset.uid, p = data.users[uid], cls = buttonElement.dataset.class, year = buttonElement.dataset.year;
    if (a === 'archive-history') {
        const records = data.audit.slice(0, 20);
        if (!records.length) return feedback('Riwayat masih kosong.');
        return modal('Arsipkan riwayat', '<p class="text-xs text-slate-500 mb-3">Unduh JSON dahulu. Setelah berkas tersimpan, konfirmasikan untuk menghapus catatan yang sama dari server.</p><div class="mb-3">' + button('download-audit', 'Unduh JSON Riwayat', '', 'primary') + '</div>' + field('saved', 'Ketik TERSIMPAN setelah berkas tersimpan', 'text', '', 'required'), async f => {
            if (f.get('saved') !== 'TERSIMPAN') throw new Error('Konfirmasikan berkas sudah tersimpan.');
            return action('prune-audit', { entries: records });
        }, 'Bersihkan yang sudah diarsipkan');
    }
    if (a === 'invite' || a === 'replace') {
        return modal(a === 'replace' ? 'Ganti guru' : 'Buat / buat ulang undangan', (a === 'replace' ? '<p class="text-xs text-slate-500 mb-3">Akses guru lama dicabut. Data kelas tetap tersimpan.</p>' : select('classId', 'Kelas', classes(), cls)) + field('email', 'Email guru baru', 'email', '', 'required') + field('days', 'Masa berlaku (hari)', 'number', '7', 'min="1" max="30" required'), f => action(a, { uid, classId: a === 'replace' ? p.classId : f.get('classId'), email: f.get('email'), days: Number(f.get('days')) }), 'Buat undangan');
    }
    if (a === 'approve') {
        return modal(`Setujui ${p.displayName || p.email}`, select('classId', 'Penempatan yang disetujui', classes(), data.requests[uid]?.classId) + permissionFields(), f => action('approve', { uid, classId: f.get('classId'), permissions: grants(f) }), 'Setujui & tetapkan');
    }
    if (a === 'archive-access') {
        return modal('Akses baca arsip penugasan lama', field('year', 'Tahun arsip, contoh 2025-2026', 'text', '', 'required pattern="[0-9]{4}-[0-9]{4}"') + select('classId', 'Kelas penugasan lama', classes()) + select('enabled', 'Akses baca', [['true', 'Izinkan'], ['false', 'Cabut']]), f => action(a, { uid, year: f.get('year'), classId: f.get('classId'), enabled: f.get('enabled') === 'true' }));
    }
    if (a === 'permissions') {
        return modal(`Izin ${p.displayName || p.email}`, permissionFields(p.permissions), f => action(a, { uid, permissions: grants(f) }));
    }
    if (a === 'reject') {
        return modal('Tolak permohonan', field('reason', 'Alasan penolakan', 'text', '', 'maxlength="300"'), f => action(a, { uid, reason: f.get('reason') }), 'Tolak');
    }
    if (a === 'delete') {
        return modal('Hapus akun', `<p class="text-xs text-slate-500 mb-3">${escape(p.email)} · kelas ${escape(p.classId || '-')}. Akun dihapus, data kelas dipertahankan. Login ulang diperlukan jika sesi administratif sudah lama.</p>`);
    }
    if (a === 'resume-delete') {
        const op = data.operations.find(o => o.uid === uid);
        return modal('Lanjutkan penghapusan', '<p class="text-xs text-slate-500 mb-3">Akses sudah diblokir. Selesaikan penghapusan identitas akun.</p>', () => accountCommand('resume-delete', { operationId: op?.operationId }), 'Lanjutkan');
    }
    if (a === 'status') {
        return modal(p.status === 'disabled' ? 'Aktifkan akun' : 'Nonaktifkan akun', `<p class="text-xs text-slate-500 mb-3">${escape(p.email)}. Mengaktifkan akun tidak memulihkan penugasan yang sudah dicabut.</p>`, () => action(a, { uid, status: p.status === 'disabled' ? 'active' : 'disabled' }));
    }
    if (a === 'unassign') {
        return modal('Cabut penugasan', `<p class="text-xs text-slate-500 mb-3">${escape(p.email)} kehilangan akses kelas. Akun dan data kelas dipertahankan.</p>`, () => action(a, { uid }));
    }
    if (a === 'revoke-invite') {
        return modal('Cabut undangan', '<p class="text-xs text-slate-500 mb-3">Kode lama tidak berlaku. Permohonan pending dari kode ini juga ditolak.</p>', () => action(a, { classId: cls }), 'Cabut');
    }
    if (a === 'assign' || a === 'move') {
        const options = Object.values(data.users).filter(u => u.role === 'teacher' && ['active', 'unassigned'].includes(u.status)).map(u => [u.uid, u.displayName || u.email]);
        return modal(a === 'move' ? 'Pindahkan / tukar kelas' : 'Tetapkan guru', (uid ? '' : select('uid', 'Guru', options)) + select('classId', 'Kelas tujuan', classes(), cls) + select('swap', 'Jika tujuan terisi', [['false', 'Tolak jika terisi'], ['true', 'Tukar dengan guru tujuan']]), f => {
            const targetUid = uid || f.get('uid'), dest = f.get('classId'), source = data.users[targetUid];
            const occupant = data.items.find(s => s.classId === dest)?.assignedUid;
            const changes = [{ uid: targetUid, classId: dest, permissions: source?.permissions || data.preset }];
            if (occupant && occupant !== targetUid && f.get('swap') === 'true') {
                if (!source?.classId) throw new Error('Guru asal belum memiliki kelas untuk ditukar.');
                changes.push({ uid: occupant, classId: source.classId, permissions: data.users[occupant]?.permissions || data.preset });
            }
            return action('move', { changes });
        });
    }
    if (a === 'save-draft') {
        const options = [['', 'Belum ditugaskan'], ...Object.values(data.users).filter(p => p.role === 'teacher' && ['active', 'unassigned'].includes(p.status)).map(p => [p.uid, p.displayName || p.email])];
        return modal(`Penempatan ${year}`, data.items.filter(s => !s.systemOwned).map(s => select(`class_${s.classId}`, `Kelas ${s.classId}`, options, data.drafts[year]?.placement?.[s.classId] || s.assignedUid || '')).join(''), f => action(a, { year, placement: Object.fromEntries(data.items.filter(s => !s.systemOwned).map(s => [s.classId, f.get(`class_${s.classId}`)])) }), 'Simpan draf');
    }
    if (a === 'activate-year') {
        const draft = data.drafts[year];
        const summary = data.items.filter(s => !s.systemOwned).map(s => `Kelas ${s.classId}: ${data.users[draft.placement[s.classId]]?.displayName || 'Belum ditugaskan'}`).join('\n');
        return modal(`Aktifkan ${year}`, `<pre class="p-3 bg-slate-50 dark:bg-black rounded-xl font-mono text-xs mb-3 text-slate-700 dark:text-slate-300">${escape(summary)}</pre><p class="text-xs text-slate-500 mb-3">Akses mengikuti penempatan baru. Data tahun lama tetap tersimpan.</p>` + field('confirmYear', 'Ketik tahun tujuan', 'text', '', 'required'), f => {
            if (f.get('confirmYear') !== year) throw new Error('Tahun konfirmasi tidak cocok.');
            return action(a, { year, draftVersion: draft.version });
        }, 'Aktifkan tahun');
    }
}

$('accounts-action-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !submitAction) return;
    busy = true;
    $('accounts-confirm').disabled = true;
    $('accounts-cancel').disabled = true;
    try {
        const result = await submitAction(new FormData(e.currentTarget));
        busy = false;
        close();
        feedback(result.pending ? 'Akses diblokir. Penghapusan masih perlu dilanjutkan.' : 'Perubahan berhasil disimpan.');
        await refresh();
        if (result.inviteCode) showInvite(result.inviteCode, result.classId);
        else if (result.replayed && result.invitationId) feedback('Undangan sudah dibuat sebelumnya. Kode hanya tampil saat pembuatan; buat ulang bila kode belum tersimpan.');
    } catch (error) {
        $('accounts-dialog-error').textContent = error.message;
        if (error.code === 'accounts/stale') {
            $('accounts-dialog-error').textContent += ' Tutup dialog dan muat ulang.';
            pendingPayload = null;
        }
    } finally {
        busy = false;
        $('accounts-confirm').disabled = false;
        $('accounts-cancel').disabled = false;
    }
});

$('accounts-dialog-fields')?.addEventListener('click', async e => {
    if (e.target.closest('[data-action="download-audit"]')) {
        try {
            await window.SIMNIDownloadService.downloadBlob(new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), records: data.audit.slice(0, 20) }, null, 2)], { type: 'application/json' }), `SIMNI_Riwayat_Akun_${Date.now()}.json`);
        } catch (error) {
            $('accounts-dialog-error').textContent = error.message;
        }
    }
});

$('accounts-cancel')?.addEventListener('click', close);
$('accounts-dialog-close')?.addEventListener('click', close);
$('accounts-retry')?.addEventListener('click', refresh);
$('accounts-back-btn')?.addEventListener('click', () => { section = 'hub'; render(); });
$('accounts-dialog')?.addEventListener('cancel', e => { e.preventDefault(); close(); });
$('accounts-content')?.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) openAction(b); });
$('accounts-subview-actions')?.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) openAction(b); });
$('view-kelola-akun')?.addEventListener('click', e => {
    const b = e.target.closest('[data-section]');
    if (b) {
        section = b.dataset.section;
        render();
        $('accounts-subview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
$('accounts-refresh')?.addEventListener('click', refresh);
$('accounts-registration-toggle')?.addEventListener('click', () => {
    if (!data || busy) return;
    const targetState = !data.enabled;
    modal(
        targetState ? 'Buka Pendaftaran Guru' : 'Tutup Pendaftaran Guru',
        `<p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            ${targetState 
                ? 'Pendaftaran akan dibuka. Calon guru dapat memilih kelas kosong dan mendaftar dengan tiket/undangan yang sah. Persetujuan Superuser tetap mutlak diperlukan sebelum akses diberikan.' 
                : 'Pendaftaran umum akan ditutup. Calon guru baru tidak dapat mengajukan permohonan mandiri sampai pendaftaran diaktifkan kembali.'}
        </p>`,
        () => action('registration', { enabled: targetState }),
        targetState ? 'Buka Pendaftaran' : 'Tutup Pendaftaran'
    );
});
window.addEventListener('pagehide', () => { $('accounts-dialog-fields')?.replaceChildren(); pendingPayload = null; });

window.refreshSIMNIAccounts = refresh;
window.updateAccountsNavBadge = updateAccountsNavBadge;

refresh();
