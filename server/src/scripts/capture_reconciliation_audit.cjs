const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval_audit',
    '--remote-debugging-port=9235',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await new Promise((r) => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9235/json/list').then((r) => r.json());
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

  // Click Financial Audit & Reconciliation tab
  await send('Runtime.evaluate', {
    expression: `
      const buttons = Array.from(document.querySelectorAll('button'));
      const reconBtn = buttons.find(b => b.textContent && b.textContent.includes('Financial Audit & Reconciliation'));
      if (reconBtn) reconBtn.click();
    `,
  });

  await new Promise((r) => setTimeout(r, 2000));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ARTIFACT_DIR, 'financial_reconciliation_audit.png');
  fs.writeFileSync(outPath, Buffer.from(shot.result.data, 'base64'));
  console.log('Saved financial_reconciliation_audit.png:', fs.statSync(outPath).size);

  // Scroll down to show itemized underlying transactions table
  await send('Runtime.evaluate', {
    expression: `
      const container = document.getElementById('admin-dashboard-container');
      if (container) container.scrollTop = 550;
      else window.scrollTo(0, 550);
    `,
  });
  await new Promise((r) => setTimeout(r, 1500));

  const shotBottom = await send('Page.captureScreenshot', { format: 'png' });
  const outBottomPath = path.join(ARTIFACT_DIR, 'financial_reconciliation_transactions_table.png');
  fs.writeFileSync(outBottomPath, Buffer.from(shotBottom.result.data, 'base64'));
  console.log('Saved financial_reconciliation_transactions_table.png:', fs.statSync(outBottomPath).size);

  ws.close();
  chromeProc.kill();
  process.exit(0);
})();
