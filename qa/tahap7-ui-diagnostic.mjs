import puppeteer from 'puppeteer';
import { startAuditServer } from './uiux-audit-server.mjs';
const { server, origin } = await startAuditServer();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
 const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844 });
 await page.setRequestInterception(true); page.on('request', r => r.url().startsWith(origin) || /^(data|blob):/.test(r.url()) ? r.continue() : r.abort());
 page.on('console', msg => console.log('browser', msg.text())); page.on('pageerror', e => console.log('ERROR', e.message));
 await page.goto(origin); await page.waitForFunction(() => window.UIUXAuthReady); await page.evaluate(() => UIUXLogin());
 await page.evaluate(() => switchView('pengaturan')); await page.evaluate(() => switchView('siswa'));
 await page.$eval('[data-simni-action="openAddSiswaModal"]', el => el.scrollIntoView());
 console.log('BEFORE', await page.evaluate(() => {
   const e = document.querySelector('[data-simni-action="openAddSiswaModal"]'), r = e.getBoundingClientRect();
   return { box: r.toJSON(), disabled: e.disabled, inert: e.closest('[inert]')?.id, hit: document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)?.outerHTML, loading: getActiveLoadingOwners(), action: typeof openAddSiswaModal };
 }));
 await page.click('[data-simni-action="openAddSiswaModal"]');
 await new Promise(resolve => setTimeout(resolve, 500));
 console.log('AFTER', await page.evaluate(() => ({ focus: document.activeElement.outerHTML, modal: document.querySelector('#modal-form-siswa').className, inert: document.querySelector('#modal-form-siswa').closest('[inert]')?.id })));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
