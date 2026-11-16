const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5195;
const DIST_DIR = path.resolve(__dirname, '../../../client/dist');
const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webp': 'image/webp',
};

const mockDevices = [
  {
    _id: 'dev-ps5-1',
    name: 'PlayStation 5 - Station 1',
    deviceCode: 'PS5-01',
    deviceType: 'PS5',
    status: 'ACTIVE',
    capacity: 4,
    description: 'Sony PlayStation 5 with DualSense wireless controllers.',
  },
  {
    _id: 'dev-ps5-2',
    name: 'PlayStation 5 - Station 2',
    deviceCode: 'PS5-02',
    deviceType: 'PS5',
    status: 'ACTIVE',
    capacity: 4,
    description: 'Sony PlayStation 5 console station with ultra-fast SSD.',
  },
  {
    _id: 'dev-pool-1',
    name: 'Tournament 8-Ball Pool Table',
    deviceCode: 'POOL-01',
    deviceType: 'POOL',
    status: 'ACTIVE',
    capacity: 4,
    description: 'Professional slate bed tournament pool table.',
  },
];

const mockPricing = [
  {
    _id: '6af81521ffe69de3b39136df',
    name: 'PS5 Standard Hourly Rate',
    deviceType: 'PS5',
    billingType: 'PER_PLAYER_HOURLY',
    amount: 7000, // ₹70
    status: 'ACTIVE',
    minimumDuration: 60,
    maximumDuration: 240,
  },
  {
    _id: '6af81521ffe69de3b39136e1',
    name: '8-Ball Pool Table Rate',
    deviceType: 'POOL',
    billingType: 'PER_PLAYER_HOURLY',
    amount: 15000, // ₹150
    status: 'ACTIVE',
    minimumDuration: 60,
    maximumDuration: 240,
  },
  {
    _id: '6af81521ffe69de3b39136e3',
    name: 'GTA 6 Exclusive Hourly Rate',
    deviceType: 'EXCLUSIVE',
    billingType: 'PER_DEVICE_HOURLY',
    amount: 15000, // ₹150
    status: 'ACTIVE',
    minimumDuration: 60,
    maximumDuration: 240,
  },
];

const mockGames = [
  {
    _id: 'g-fc24',
    name: 'EA Sports FC 24',
    genre: ['Sports'],
    platforms: ['PlayStation 5'],
    minPlayers: 1,
    maxPlayers: 4,
    bookingMode: 'BOTH',
    isExclusive: false,
  },
];

const mockUserReceptionist = {
  _id: 'staff-1',
  name: 'Front Desk Receptionist',
  email: 'reception@noahgaming.in',
  role: 'receptionist',
};

const mockUserAdmin = {
  _id: 'admin-1',
  name: 'Noah Lounge Admin',
  email: 'admin@noahgaming.in',
  role: 'admin',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Auth me endpoint based on query or header
  if (req.url.startsWith('/api/auth/me')) {
    const isAdmin = req.url.includes('admin=true');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      data: { user: isAdmin ? mockUserAdmin : mockUserReceptionist },
    }));
  }

  if (req.url.startsWith('/api/devices')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { devices: mockDevices } }));
  }

  if (req.url.startsWith('/api/pricing')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { pricingPlans: mockPricing, total: mockPricing.length } }));
  }

  if (req.url.startsWith('/api/games')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { games: mockGames } }));
  }

  if (req.url.startsWith('/api/categories')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { categories: [{ _id: 'c1', name: 'Sports' }] } }));
  }

  if (req.url.startsWith('/api/receptionist/stats')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      data: {
        activeSessionsCount: 1,
        todayBookingsCount: 3,
        totalRevenueTodayRupees: 750,
      },
    }));
  }

  if (req.url.startsWith('/api/receptionist/active-sessions')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: [] }));
  }

  if (req.url.startsWith('/api/receptionist/today-bookings')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: [] }));
  }

  if (req.url.startsWith('/api/receptionist/pending-payments')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: [] }));
  }

  if (req.url.startsWith('/api/admin/automation')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { status: 'ONLINE' } }));
  }

  if (req.url.startsWith('/api/reports/analytics')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: {} }));
  }

  if (req.url.startsWith('/api/users/profile')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { user: mockUserAdmin } }));
  }

  let safePath = req.url.split('?')[0];
  if (safePath === '/') safePath = '/index.html';

  let filePath = path.join(DIST_DIR, safePath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

async function run() {
  await new Promise((r) => server.listen(PORT, r));

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_visual_pricing_extra',
    '--remote-debugging-port=9243',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  try {
    await new Promise((r) => setTimeout(r, 1800));
    const targets = await fetch('http://127.0.0.1:9243/json/list').then((r) => r.json());
    const target = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const msgId = id++;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await new Promise((r) => (ws.onopen = r));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1.5,
      mobile: false,
    });

    // 1. Receptionist Walk-In Station Selection View
    console.log('[VisualTest] Setting localStorage for Receptionist role...');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise((r) => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('nexus_token', 'test_token_receptionist');
        localStorage.setItem('nexus_user', JSON.stringify({
          _id: 'staff-1',
          name: 'Front Desk Receptionist',
          email: 'reception@noahgaming.in',
          role: 'receptionist'
        }));
      `,
    });

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise((r) => setTimeout(r, 2000));

    // Click Walk-in POS Tab
    await send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('button'));
        const walkInTab = tabs.find(t => t.textContent && t.textContent.includes('Walk-in POS'));
        if (walkInTab) walkInTab.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Fill customer step or skip to step 2
    await send('Runtime.evaluate', {
      expression: `
        const inputs = Array.from(document.querySelectorAll('input'));
        const qInput = inputs.find(i => i.placeholder && i.placeholder.includes('Search customer'));
        if (qInput) {
          qInput.value = 'Guest';
          qInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const guestBtns = Array.from(document.querySelectorAll('button'));
        const fastBtn = guestBtns.find(b => b.textContent && b.textContent.includes('Instant Guest Session'));
        if (fastBtn) fastBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    const shot5 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '05_receptionist_walkin_device_pricing.png'),
      Buffer.from(shot5.data, 'base64')
    );
    console.log('✓ Saved: 05_receptionist_walkin_device_pricing.png');

    // 2. Admin Dashboard Centralized Pricing Engine View
    console.log('[VisualTest] Switching to Admin role for Centralized Pricing Engine...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('nexus_user', JSON.stringify({
          _id: 'admin-1',
          name: 'Noah Lounge Admin',
          email: 'admin@noahgaming.in',
          role: 'admin'
        }));
      `,
    });

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise((r) => setTimeout(r, 2000));

    // Click Pricing tab
    await send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('button'));
        const pricingTab = tabs.find(t => t.textContent && t.textContent.includes('Pricing Engine'));
        if (pricingTab) pricingTab.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    const shot6 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '06_admin_pricing_management_table.png'),
      Buffer.from(shot6.data, 'base64')
    );
    console.log('✓ Saved: 06_admin_pricing_management_table.png');

    ws.close();
  } catch (err) {
    console.error('Visual test extra failed:', err);
  } finally {
    chromeProc.kill('SIGKILL');
    server.close();
    process.exit(0);
  }
}

run();
