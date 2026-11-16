const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval4',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9227/json/list').then(r => r.json());
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
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' })
  }).then(r => r.json());
  const token = res.data.token;
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1500));
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${token}');
      localStorage.setItem('nexus_auth_token', '${token}');
    `
  });
  await send('Page.navigate', { url: 'http://localhost:5173/#bookings' });
  await new Promise(r => setTimeout(r, 3500));
  const shotTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_top.png'), Buffer.from(shotTop.result.data, 'base64'));
  console.log('Saved bookings_scroll_desktop_top.png:', fs.statSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_top.png')).size);
  ws.close();
  chromeProc.kill();
})().catch(console.error);
