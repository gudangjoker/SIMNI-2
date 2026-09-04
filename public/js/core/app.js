let bootstrapped = false;

export async function bootstrapApp() {
    if (bootstrapped) return true;
    bootstrapped = true;

    window.initDarkMode?.();
    window.renderIdentitas?.();
    window.initDates?.();

    window.addEventListener('online', () => {
        window.updateSyncUI?.(true);
        if (window.isUserLoggedIn && window.SIMNICurrentAccess) {
            window.resumeSIMNIAuthSession?.();
        }
    });

    window.addEventListener('offline', () => {
        window.updateSyncUI?.(false);
    });

    window.updateSyncUI?.(navigator.onLine);
    return true;
}
