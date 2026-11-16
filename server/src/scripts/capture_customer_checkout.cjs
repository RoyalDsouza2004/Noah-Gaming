const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval_rzp7',
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
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 1500));

  // Login as Customer
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      (async () => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'customer@gaminglounge.com', password: 'CustomerPassword@123' })
        }).then(r => r.json());
        localStorage.setItem('noah_auth_token', res.data.token);
        localStorage.setItem('nexus_auth_token', res.data.token);
        window.location.hash = '#bookings';
        window.location.reload();
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, 3500));

  // Find any Pay button in My Bookings or trigger payment
  await send('Runtime.evaluate', {
    expression: `
      const payButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('Pay'));
      if (payButtons[0]) {
        payButtons[0].click();
      }
    `,
  });
  await new Promise((r) => setTimeout(r, 2000));

  const shotCheckout = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'razorpay_checkout_modal.png'),
    Buffer.from(shotCheckout.result.data, 'base64')
  );
  console.log('Saved razorpay_checkout_modal.png:', fs.statSync(path.join(ARTIFACT_DIR, 'razorpay_checkout_modal.png')).size);

  ws.close();
  chromeProc.kill();
  process.exit(0);
})();
