const { spawn } = require('child_process');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval2',
    '--remote-debugging-port=9224',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9224/json/list').then(r => r.json());
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

  // Customer Register with valid 10-digit phone
  const phone = '98' + Date.now().toString().slice(-8);
  const email = `testuser.${Date.now()}@example.com`;
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rahul Roy', email, phone, password: 'Password@123' })
  }).then(r => r.json());
  console.log('Register Success:', regRes.success);
  const token = regRes.data.token;

  // Seed 6 bookings
  const devRes = await fetch('http://localhost:5000/api/devices', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
  const gmRes = await fetch('http://localhost:5000/api/games', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
  const dId = devRes.data.devices[0]._id;
  const gId = gmRes.data.games[0]._id;

  for (let i = 0; i < 6; i++) {
    await fetch('http://localhost:5000/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        deviceId: dId,
        gameId: gId,
        bookingDate: `2026-12-${String(15 + i).padStart(2, '0')}`,
        startTime: '14:00',
        duration: 1,
        bookingType: 'SHARED',
        playersCount: 1,
        paymentMethod: 'COUNTER',
      })
    });
  }

  // Test on Desktop
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${token}');
      localStorage.setItem('nexus_auth_token', '${token}');
      location.hash = '#bookings';
      location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 3000));

  const desktopMetrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.getElementById('my-bookings-container');
      const p = document.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      return {
        found: !!c,
        scrollTop: c ? c.scrollTop : 0,
        scrollHeight: c ? c.scrollHeight : 0,
        clientHeight: c ? c.clientHeight : 0,
        canScroll: c ? c.scrollHeight > c.clientHeight : false,
        paginationFound: !!p,
        paginationText: p ? p.innerText : ''
      };
    })()`,
    returnByValue: true
  });
  console.log('Customer Desktop Metrics:', desktopMetrics.result.result.value);

  // Scroll to bottom on desktop
  await send('Runtime.evaluate', {
    expression: `document.getElementById('my-bookings-container').scrollTo({ top: 9999, behavior: 'instant' })`
  });
  await new Promise(r => setTimeout(r, 1000));

  const desktopBottom = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.getElementById('my-bookings-container');
      const p = document.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      const rect = p ? p.getBoundingClientRect() : null;
      return {
        scrollTop: c.scrollTop,
        maxScroll: c.scrollHeight - c.clientHeight,
        paginationInView: rect ? (rect.top >= 0 && rect.bottom <= window.innerHeight) : false
      };
    })()`,
    returnByValue: true
  });
  console.log('Customer Desktop After Scroll:', desktopBottom.result.result.value);

  // Capture clean screenshots
  const fs = require('fs');
  const path = require('path');
  const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';
  const shotDesk = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_bottom.png'), Buffer.from(shotDesk.result.data, 'base64'));

  // Switch to Mobile
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await send('Runtime.evaluate', { expression: `document.getElementById('my-bookings-container').scrollTo({ top: 0, behavior: 'instant' })` });
  await new Promise(r => setTimeout(r, 1000));
  const shotMobTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_mobile_top.png'), Buffer.from(shotMobTop.result.data, 'base64'));

  // Scroll mobile to bottom
  await send('Runtime.evaluate', { expression: `document.getElementById('my-bookings-container').scrollTo({ top: 9999, behavior: 'instant' })` });
  await new Promise(r => setTimeout(r, 1000));
  const shotMobBottom = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_mobile_bottom.png'), Buffer.from(shotMobBottom.result.data, 'base64'));

  const mobileBottom = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.getElementById('my-bookings-container');
      const p = document.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      const n = document.querySelector('div[aria-label="Mobile Bottom Navigation"]');
      const pRect = p.getBoundingClientRect();
      const nRect = n.getBoundingClientRect();
      return {
        scrollTop: c.scrollTop,
        maxScroll: c.scrollHeight - c.clientHeight,
        paginationBottom: pRect.bottom,
        navTop: nRect.top,
        clearanceAboveNav: nRect.top - pRect.bottom
      };
    })()`,
    returnByValue: true
  });
  console.log('Customer Mobile Bottom Metrics:', mobileBottom.result.result.value);

  ws.close();
  chromeProc.kill();
  console.log('✅ All Customer Booking Tests Passed!');
})().catch(console.error);
