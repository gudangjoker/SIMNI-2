const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    
    try {
        const page = await browser.newPage();
        
        let consoleErrors = [];
        let failedAssets = [];
        let hasMixedCache = false;
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        
        page.on('response', response => {
            const status = response.status();
            if (status >= 400) {
                failedAssets.push(response.url());
            }
        });
        
        console.log('Loading page...');
        const response = await page.goto('https://admin-kelas-3a.web.app', { waitUntil: 'networkidle0' });
        
        if (!response.ok()) {
            throw new Error(`Main page failed to load: ${response.status()}`);
        }
        
        console.log('Waiting for SW registration...');
        // Wait for Service worker to be registered and activated
        const swStatus = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return 'No SW support';
            
            const registration = await navigator.serviceWorker.ready;
            return registration.active ? 'activated' : 'not activated';
        });
        
        console.log('SW Status:', swStatus);
        
        console.log('Checking Caches...');
        const cacheNames = await page.evaluate(async () => {
            return await caches.keys();
        });
        
        console.log('Caches found:', cacheNames.join(', '));
        
        // Checking for offline capability
        console.log('Going offline...');
        await page.setOfflineMode(true);
        
        console.log('Reloading offline...');
        const offlineResponse = await page.reload({ waitUntil: 'networkidle0' });
        console.log('Offline reload successful:', offlineResponse ? offlineResponse.ok() : 'from cache');
        
        console.log('Result:');
        console.log('Errors:', consoleErrors.length > 0 ? consoleErrors : 'NONE');
        console.log('Failed Assets:', failedAssets.length > 0 ? failedAssets : 'NONE');
        console.log('Has Mixed Cache:', cacheNames.some(c => c.includes('simni-app') && c !== 'simni-app-4.6.3'));
        
    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await browser.close();
    }
})();
