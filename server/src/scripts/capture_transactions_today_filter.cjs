const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval_tx_filter',
    '--remote-debugging-port=9236',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await new Promise((r) => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9236/json/list').then((r) => r.json());
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d);
      pending.delete(d.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = id++;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      (async () => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' })
        }).then(r => r.json());
        localStorage.setItem('noah_auth_token', res.data.token);
        localStorage.setItem('nexus_auth_token', res.data.token);
        window.location.hash = '#admin-payments';
        window.location.reload();
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, 3500));

  // Change dateRangeFilter to 'today'
  await send('Runtime.evaluate', {
    expression: `
      const selects = Array.from(document.querySelectorAll('select'));
      const dateSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'today'));
      if (dateSelect) {
        dateSelect.value = 'today';
        dateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `,
  });

  await new Promise((r) => setTimeout(r, 2000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ARTIFACT_DIR, 'transactions_log_today_filter.png');
  fs.writeFileSync(outPath, Buffer.from(shot.result.data, 'base64'));
  console.log('Saved transactions_log_today_filter.png:', fs.statSync(outPath).size);

  ws.close();
  chromeProc.kill();
  process.exit(0);
})();
