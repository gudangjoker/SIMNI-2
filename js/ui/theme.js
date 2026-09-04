// ==========================================
// FILE: js/ui/theme.js
// Tema gelap/terang dan Tema Warna Dinamis.
// ==========================================

const THEMES = Object.freeze({
    ocean: Object.freeze({ name: 'Ocean (Indigo)', primary: '#4F46E5', hover: '#4338CA', strong: '#3730A3', soft: '#EEF2FF', softHover: '#E0E7FF', canvas: '#F6F7FF', surface: '#FFFFFF', border: '#DDE3F3', glow: 'rgba(79, 70, 229, 0.24)', darkCanvas: '#070A18', darkSurface: '#10142A', darkSoft: '#191F3C', darkBorder: '#2A3154' }),
    sage: Object.freeze({ name: 'Sage (Teal)', primary: '#0D9488', hover: '#0F766E', strong: '#115E59', soft: '#E7F8F4', softHover: '#CCF1E9', canvas: '#F3FAF8', surface: '#FFFFFF', border: '#CFE7E1', glow: 'rgba(13, 148, 136, 0.22)', darkCanvas: '#061513', darkSurface: '#0D2420', darkSoft: '#12372F', darkBorder: '#285249' }),
    lavender: Object.freeze({ name: 'Lavender (Violet)', primary: '#7C3AED', hover: '#6D28D9', strong: '#5B21B6', soft: '#F3EEFF', softHover: '#E9DEFF', canvas: '#FAF7FF', surface: '#FFFFFF', border: '#E3D8F7', glow: 'rgba(124, 58, 237, 0.22)', darkCanvas: '#10091E', darkSurface: '#1C1230', darkSoft: '#2B1B47', darkBorder: '#493369' }),
    sakura: Object.freeze({ name: 'Sakura (Rose)', primary: '#E11D48', hover: '#BE123C', strong: '#9F1239', soft: '#FFF0F4', softHover: '#FFE0E8', canvas: '#FFF7F9', surface: '#FFFFFF', border: '#F1D4DC', glow: 'rgba(225, 29, 72, 0.20)', darkCanvas: '#1C090F', darkSurface: '#2B1019', darkSoft: '#421725', darkBorder: '#6B2A3D' }),
    sunset: Object.freeze({ name: 'Sunset (Orange)', primary: '#EA580C', hover: '#C2410C', strong: '#9A3412', soft: '#FFF3E8', softHover: '#FFE5CC', canvas: '#FFF9F3', surface: '#FFFFFF', border: '#F0DCC8', glow: 'rgba(234, 88, 12, 0.21)', darkCanvas: '#1B0E06', darkSurface: '#2B170B', darkSoft: '#44240F', darkBorder: '#6D3D1D' }),
    coffee: Object.freeze({ name: 'Coffee (Stone)', primary: '#57534E', hover: '#44403C', strong: '#292524', soft: '#F4F1EE', softHover: '#E9E3DD', canvas: '#FAF8F6', surface: '#FFFFFF', border: '#DED8D2', glow: 'rgba(87, 83, 78, 0.20)', darkCanvas: '#11100F', darkSurface: '#1D1B19', darkSoft: '#2B2825', darkBorder: '#49443F' })
});

function selectedThemeKey(value) {
    return Object.prototype.hasOwnProperty.call(THEMES, value) ? value : 'ocean';
}

function updateBrowserThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = document.documentElement.classList.contains('dark') ? theme.darkCanvas : theme.primary;
}

window.applyColorTheme = function applyColorTheme(requestedKey) {
    const themeKey = selectedThemeKey(requestedKey);
    const theme = THEMES[themeKey];
    const root = document.documentElement;
    const properties = {
        '--simni-primary': theme.primary,
        '--simni-primary-hover': theme.hover,
        '--simni-primary-strong': theme.strong,
        '--simni-primary-soft': theme.soft,
        '--simni-primary-soft-hover': theme.softHover,
        '--simni-canvas': theme.canvas,
        '--simni-surface': theme.surface,
        '--simni-border': theme.border,
        '--simni-glow': theme.glow,
        '--simni-dark-canvas': theme.darkCanvas,
        '--simni-dark-surface': theme.darkSurface,
        '--simni-dark-soft': theme.darkSoft,
        '--simni-dark-border': theme.darkBorder
    };

    for (const [property, value] of Object.entries(properties)) root.style.setProperty(property, value);
    root.dataset.colorTheme = themeKey;
    try {
        localStorage.setItem('color_theme', themeKey);
    } catch (_) {
        window.toast?.('Tema diterapkan untuk sesi ini.', 'warning');
    }

    document.querySelectorAll('.theme-btn').forEach((button) => button.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-300'));
    const activeButton = document.querySelector(`.theme-btn[data-theme="${themeKey}"]`);
    if (activeButton) activeButton.classList.add('ring-4', 'ring-offset-2', 'ring-slate-300');

    const label = document.getElementById('current-theme-label');
    if (label) label.textContent = `Tema aktif saat ini: ${theme.name}`;
    const dropdown = document.getElementById('theme-selector-dropdown');
    if (dropdown) dropdown.value = themeKey;
    updateBrowserThemeColor(theme);
    window.dispatchEvent(new CustomEvent('simni:theme-changed', { detail: Object.freeze({ key: themeKey, name: theme.name }) }));
};

window.saveThemeFromDropdown = function() {
    const dropdown = document.getElementById('theme-selector-dropdown');
    if (dropdown) {
        applyColorTheme(dropdown.value);
        if (typeof toast === 'function') toast('Berhasil disimpan: tema aplikasi diperbarui.', 'success');
    }
};

function initColorTheme() {
    let saved = 'ocean';
    try {
        saved = localStorage.getItem('color_theme') || 'ocean';
    } catch (_) {
        saved = 'ocean';
    }
    window.applyColorTheme(saved);
}

function initDarkMode() { 
    let darkMode = false;
    try {
        darkMode = localStorage.getItem('theme') === 'dark';
    } catch (_) {
        darkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    }
    if (darkMode) {
        document.documentElement.classList.add('dark'); 
    }
    initColorTheme();
}

function toggleDarkMode() { 
    document.documentElement.classList.toggle('dark'); 
    try {
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    } catch (_) {
        window.toast?.('Mode tampilan diterapkan untuk sesi ini.', 'warning');
    }
    window.applyColorTheme(document.documentElement.dataset.colorTheme || 'ocean');
}

window.SIMNIColorThemes = THEMES;
initDarkMode();
