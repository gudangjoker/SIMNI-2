// ==========================================
// FILE: js/ui/feedback.js
// Loading, toast, beep, dan status sinkronisasi.
// ==========================================

function showLoad(text) {
    const bar = document.getElementById('slim-loading-bar');
    if (bar) { bar.style.opacity = '1'; bar.style.width = '75%'; }
    const overlay = document.getElementById('loading-overlay');
    const label = document.getElementById('loading-text');
    if (overlay && label) {
        label.textContent = String(text || 'Memproses Data...');
        overlay.classList.remove('hidden', 'opacity-0', 'translate-y-10');
        overlay.classList.add('flex', 'opacity-100', 'translate-y-0');
    }
}

function hideLoad() {
    const bar = document.getElementById('slim-loading-bar');
    if (bar) {
        bar.style.width = '100%';
        setTimeout(() => { bar.style.opacity = '0'; setTimeout(() => { bar.style.width = '0'; }, 300); }, 300);
    }
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100', 'translate-y-0');
        overlay.classList.add('opacity-0', 'translate-y-10');
        setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 300);
    }
}

function playBeep() {
    try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        const context = new AudioContextCtor();
        if (context.state === 'suspended') context.resume().catch(() => {});
        const oscillator = context.createOscillator();
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        oscillator.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
        oscillator.addEventListener?.('ended', () => context.close?.().catch?.(() => {}), { once: true });
    } catch (error) {
        console.warn('Suara beep ditahan oleh browser.', error);
    }
}

function toast(message, type = 'info') {
    if (type === 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 opacity-0';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('aria-atomic', 'true');
        
        const popup = document.createElement('div');
        popup.className = 'bg-white dark:bg-[#111111] p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center transform scale-90 transition-transform duration-300 border border-slate-100 dark:border-slate-800';
        
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 text-emerald-500';
        iconWrapper.innerHTML = '<i class="fas fa-check-circle text-4xl" aria-hidden="true"></i>';
        
        const text = document.createElement('h3');
        text.className = 'text-xl font-bold text-slate-800 dark:text-slate-100 text-center';
        text.textContent = String(message ?? 'Berhasil disimpan');
        
        popup.append(iconWrapper, text);
        overlay.appendChild(popup);
        container.appendChild(overlay);
        
        if (String(message).includes('Hadir')) playBeep();
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            popup.classList.remove('scale-90');
            popup.classList.add('scale-100');
        });
        
        // Animate out after 1.5s
        setTimeout(() => {
            overlay.classList.add('opacity-0');
            popup.classList.remove('scale-100');
            popup.classList.add('scale-90');
            setTimeout(() => {
                if (container.contains(overlay)) container.removeChild(overlay);
            }, 300);
        }, 1500);
        
        return;
    }

    const container = document.getElementById('toast-container');
    if (!container) return;
    const palette = {
        success: 'bg-emerald-100 text-emerald-800 border-l-emerald-500 shadow-emerald-500/20',
        error: 'bg-red-100 text-red-800 border-l-red-500 shadow-red-500/20',
        warning: 'bg-amber-100 text-amber-800 border-l-amber-500 shadow-amber-500/20',
        info: 'bg-blue-100 text-blue-800 border-l-blue-500 shadow-blue-500/20'
    };
    const node = document.createElement('div');
    node.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border-l-4 font-bold text-sm fade-in ${palette[type] || palette.info} dark:bg-[#111111] dark:border dark:border-slate-800 dark:text-slate-200 transition-all duration-300 transform translate-x-0`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    const icon = document.createElement('i');
    icon.className = `${icons[type] || icons.info} text-lg shrink-0`;
    icon.setAttribute('aria-hidden', 'true');
    const span = document.createElement('span');
    span.textContent = String(message ?? '');
    node.append(icon, span);
    container.appendChild(node);
    
    setTimeout(() => {
        node.classList.replace('translate-x-0', 'translate-x-full');
        node.style.opacity = '0';
        setTimeout(() => { if (container.contains(node)) node.remove(); }, 300);
    }, 3000);
}

function updateSyncUI(online) {
    const label = online ? 'Online' : 'Offline';
    const render = (element, small = false) => {
        if (!element) return;
        element.replaceChildren();
        const dot = document.createElement('div');
        dot.className = `${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`;
        const text = document.createElement('span');
        text.className = small ? 'mobile-sync-label' : 'sync-label';
        text.textContent = label;
        element.append(dot, text);
    };
    render(document.getElementById('sync-status-desktop'));
    render(document.getElementById('sync-status-mobile'), true);
}
