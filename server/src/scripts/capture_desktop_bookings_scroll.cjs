const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval3',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9225/json/list').then(r => r.json());
  const target = targets.find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  const send = (method, params = {}) => new Promise(r => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  // Login as admin
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' })
  }).then(r => r.json());
  const token = res.data.token;

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${token}');
      localStorage.setItem('nexus_auth_token', '${token}');
      location.hash = '#bookings';
      location.reload();
    `
  });
  // Wait 4 seconds for full render
  await new Promise(r => setTimeout(r, 4000));

  // Top screenshot
  const shotTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_top.png'), Buffer.from(shotTop.result.data, 'base64'));

  // Scroll to bottom
  await send('Runtime.evaluate', {
    expression: `document.getElementById('my-bookings-container').scrollTo({ top: 9999, behavior: 'instant' })`
  });
  await new Promise(r => setTimeout(r, 1000));

  // Bottom screenshot
  const shotBottom = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_bottom.png'), Buffer.from(shotBottom.result.data, 'base64'));

  // Tablet screenshot
  await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 2, mobile: false, hasTouch: true });
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.evaluate', {
    expression: `document.getElementById('my-bookings-container').scrollTo({ top: 9999, behavior: 'instant' })`
  });
  await new Promise(r => setTimeout(r, 1000));
  const shotTablet = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_tablet.png'), Buffer.from(shotTablet.result.data, 'base64'));

  const metrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.getElementById('my-bookings-container');
      const p = document.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      return {
        scrollTop: c.scrollTop,
        maxScroll: c.scrollHeight - c.clientHeight,
        paginationFound: !!p,
        paginationInView: p ? (p.getBoundingClientRect().top >= 0 && p.getBoundingClientRect().bottom <= window.innerHeight) : false
      };
    })()`,
    returnByValue: true
  });
  console.log('Final Desktop/Tablet Metrics:', metrics.result.result.value);

  ws.close();
  chromeProc.kill();
  console.log('✅ Desktop and Tablet Screenshots Captured!');
})().catch(console.error);
