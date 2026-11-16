const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_API = 'http://localhost:5000/api';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome_mobile_nav_cdp';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';

async function api(path, options = {}) {
  const { method = 'GET', body, token } = options;
  const res = await fetch(`${BASE_API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- Step 1: Login tokens for testing ---');
  // Admin Login
  const adminRes = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' },
  });
  const adminToken = adminRes.data?.token;

  // Receptionist Login
  const recRes = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'reception@gaminglounge.com', password: 'StaffPassword@123' },
  });
  const recToken = recRes.data?.token;

  // Customer Login / Register
  const uId = Date.now().toString().slice(-5);
  const custRes = await api('/auth/register', {
    method: 'POST',
    body: {
      name: 'Pooja Verma',
      email: `pooja.${uId}@example.com`,
      phone: `95${uId}88`,
      password: 'Password@123',
    },
  });
  const custToken = custRes.data?.token;

  // Seed 2 bookings for customer
  const devRes = await api('/devices', { token: custToken });
  const gmRes = await api('/games', { token: custToken });
  if (devRes.data?.devices?.[0] && gmRes.data?.games?.[0]) {
    await api('/bookings', {
      method: 'POST',
      token: custToken,
      body: {
        deviceId: devRes.data.devices[0]._id,
        gameId: gmRes.data.games[0]._id,
        bookingDate: '2026-12-25',
        startTime: '16:00',
        duration: 1,
        bookingType: 'SHARED',
        playersCount: 1,
        paymentMethod: 'COUNTER',
      },
    });
  }

  console.log('--- Step 2: Spawning Chrome Headless on port 9222 ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  await sleep(1500);

  const targets = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
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
      const id = msgId++;
      pending.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await new Promise((r) => (ws.onopen = r));

  await send('Page.enable');
  await send('Runtime.enable');

  // ==========================================
  // SCENARIO 1: Mobile Bottom Nav on Homepage (390x844)
  // ==========================================
  console.log('--- Scenario 1: Mobile Bottom Nav on Homepage ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    hasTouch: true,
  });

  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(1000);
  await send('Runtime.evaluate', {
    expression: `
      localStorage.clear();
      location.hash = '#home';
      location.reload();
    `,
  });
  await sleep(3000);

  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile_bottom_nav_home.png'), Buffer.from(shot1.result.data, 'base64'));
  console.log('Saved mobile_bottom_nav_home.png');

  // ==========================================
  // SCENARIO 2: Mobile Bottom Nav inside Equipment/Overview
  // ==========================================
  console.log('--- Scenario 2: Mobile Bottom Nav with Equipment Active ---');
  await send('Runtime.evaluate', {
    expression: `
      // Click equipment button
      const buttons = Array.from(document.querySelectorAll('button[aria-label="Equipment"]'));
      if (buttons[0]) buttons[0].click();
      else location.hash = '#overview';
    `,
  });
  await sleep(2000);

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile_bottom_nav_equipment.png'), Buffer.from(shot2.result.data, 'base64'));
  console.log('Saved mobile_bottom_nav_equipment.png');

  // ==========================================
  // SCENARIO 3: Mobile Bottom Nav inside Customer Bookings Modal
  // ==========================================
  console.log('--- Scenario 3: Mobile Bottom Nav with Bookings Modal Active ---');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${custToken}');
      localStorage.setItem('nexus_auth_token', '${custToken}');
      location.hash = '#bookings';
      location.reload();
    `,
  });
  await sleep(3500);

  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile_bottom_nav_bookings.png'), Buffer.from(shot3.result.data, 'base64'));
  console.log('Saved mobile_bottom_nav_bookings.png');

  // ==========================================
  // SCENARIO 4: Mobile Bottom Nav inside Customer Profile
  // ==========================================
  console.log('--- Scenario 4: Mobile Bottom Nav with Profile Active ---');
  await send('Runtime.evaluate', {
    expression: `
      const buttons = Array.from(document.querySelectorAll('button[aria-label="Profile"]'));
      if (buttons[0]) buttons[0].click();
      else location.hash = '#profile';
    `,
  });
  await sleep(2000);

  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile_bottom_nav_profile.png'), Buffer.from(shot4.result.data, 'base64'));
  console.log('Saved mobile_bottom_nav_profile.png');

  // ==========================================
  // SCENARIO 5: Mobile Bottom Nav in Admin Suite (Hardware Section)
  // ==========================================
  console.log('--- Scenario 5: Mobile Bottom Nav in Admin Suite (Hardware Active) ---');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${adminToken}');
      localStorage.setItem('nexus_auth_token', '${adminToken}');
      location.hash = '#admin-devices';
      location.reload();
    `,
  });
  await sleep(3500);

  const shot5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile_bottom_nav_admin_hardware.png'), Buffer.from(shot5.result.data, 'base64'));
  console.log('Saved mobile_bottom_nav_admin_hardware.png');

  // ==========================================
  // SCENARIO 6: Desktop Admin Dashboard Single Dropdown Selector Open (1280x900)
  // ==========================================
  console.log('--- Scenario 6: Desktop Admin Dashboard with Single Dropdown Open ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Runtime.evaluate', {
    expression: `
      location.hash = '#admin';
      location.reload();
    `,
  });
  await sleep(3000);

  // Click the section dropdown to open it
  await send('Runtime.evaluate', {
    expression: `
      const dropdownBtn = document.querySelector('button[aria-expanded]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Switch Section') || b.innerText.includes('Dashboard Overview') || b.innerText.includes('Active Section'));
      if (dropdownBtn) dropdownBtn.click();
    `,
  });
  await sleep(1000);

  const shot6 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop_admin_dropdown_selector.png'), Buffer.from(shot6.result.data, 'base64'));
  console.log('Saved desktop_admin_dropdown_selector.png');

  // ==========================================
  // SCENARIO 7: Desktop Admin Bookings with Pagination (1280x900)
  // ==========================================
  console.log('--- Scenario 7: Desktop Admin Bookings with Pagination ---');
  await send('Runtime.evaluate', {
    expression: `
      location.hash = '#admin-bookings';
      location.reload();
    `,
  });
  await sleep(3500);

  const shot7 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop_admin_bookings_pagination.png'), Buffer.from(shot7.result.data, 'base64'));
  console.log('Saved desktop_admin_bookings_pagination.png');

  // ==========================================
  // SCENARIO 8: Receptionist Dashboard with Pagination (1280x900)
  // ==========================================
  console.log('--- Scenario 8: Receptionist Dashboard with Pagination ---');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${recToken}');
      localStorage.setItem('nexus_auth_token', '${recToken}');
      location.hash = '#receptionist-bookings';
      location.reload();
    `,
  });
  await sleep(3500);

  const shot8 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'desktop_receptionist_pagination.png'), Buffer.from(shot8.result.data, 'base64'));
  console.log('Saved desktop_receptionist_pagination.png');

  // Clean up
  ws.close();
  chromeProc.kill();
  console.log('🎉 All mobile navigation and pagination screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
