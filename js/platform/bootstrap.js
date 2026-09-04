let startupPromise = null;

export function startSIMNIPlatform() {
    if (!startupPromise) {
        startupPromise = import('./main.js').catch((error) => {
            startupPromise = null;
            throw error;
        });
    }
    return startupPromise;
}

window.startSIMNIPlatform = startSIMNIPlatform;

const startOnIntent = () => {
    void startSIMNIPlatform();
};

window.addEventListener('pointerdown', startOnIntent, { once: true, passive: true });
window.addEventListener('keydown', startOnIntent, { once: true, passive: true });
window.requestAnimationFrame(() => {
    window.setTimeout(startOnIntent, 150);
});
