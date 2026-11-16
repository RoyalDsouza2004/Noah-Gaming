const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5198;
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

// High-resolution realistic gamer avatar image URL (Unsplash portrait)
const TEST_AVATAR_URL = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

const mockCustomer = {
  _id: 'cust-alex-99',
  customerId: 'CUST-NOAH01',
  name: 'Alex Mercer',
  email: 'alex.gamer@noahgaming.com',
  phone: '9876543210',
  role: 'customer',
  profilePicture: TEST_AVATAR_URL,
  profilePicturePublicId: 'noah-gaming/profiles/alex_mercer',
  membership: {
    status: 'ACTIVE',
    planName: 'VIP GTA 6 Club Pass',
    isUnlimited: false,
    dailyAllowanceMinutes: 120,
    dailyRemainingMinutes: 75,
  },
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Current authenticated user
  if (req.url.startsWith('/api/auth/me')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      data: { user: mockCustomer },
    }));
  }

  // Customer dashboard aggregated endpoint
  if (req.url.startsWith('/api/users/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      data: {
        customer: mockCustomer,
        totalSessions: 14,
        upcomingBookings: [],
        recentBookings: [],
        payments: [],
        membership: mockCustomer.membership,
      },
    }));
  }

  if (req.url.startsWith('/api/users/gaming-history')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { bookings: [], counts: { all: 14 } } }));
  }

  if (req.url.startsWith('/api/users/payment-history')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { payments: [] } }));
  }

  if (req.url.startsWith('/api/users/notifications')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { notifications: [], unreadCount: 0 } }));
  }

  if (req.url.startsWith('/api/memberships/my-subscriptions')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { subscriptions: [] } }));
  }

  if (req.url.startsWith('/api/memberships/my-usage')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { usages: [] } }));
  }

  if (req.url.startsWith('/api/devices')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { devices: [] } }));
  }

  if (req.url.startsWith('/api/games')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { games: [] } }));
  }

  if (req.url.startsWith('/api/pricing')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, data: { pricingPlans: [] } }));
  }

  // Serve Vite dist
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
  console.log(`[VisualTest] Test server listening on http://127.0.0.1:${PORT}`);

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_visual_mobilenav_test',
    '--remote-debugging-port=9245',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  try {
    await new Promise((r) => setTimeout(r, 1800));
    const targets = await fetch('http://127.0.0.1:9245/json/list').then((r) => r.json());
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

    // 1. Mobile viewport setup (iPhone 14 / modern Android: 390x844, DPR 2)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    console.log('[VisualTest] Navigating to set authenticated session in localStorage...');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise((r) => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('noah_auth_token', 'test_auth_jwt_token_alex');
        localStorage.setItem('noah_user', JSON.stringify(${JSON.stringify(mockCustomer)}));
      `,
    });

    // Reload with authenticated token & user state in mobile view
    console.log('[VisualTest] Reloading mobile home page with authenticated user...');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    await new Promise((r) => setTimeout(r, 2000));

    // Capture 1: Mobile Bottom Navigation showing actual user profile picture in Profile tab
    console.log('[VisualTest] Capturing mobile bottom nav with actual profile photo...');
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '07_mobile_nav_with_actual_profile_picture.png'),
      Buffer.from(shot1.data, 'base64')
    );
    console.log('✓ Saved: 07_mobile_nav_with_actual_profile_picture.png');

    // Capture 2: Navigate to Profile page by clicking the Profile nav button
    console.log('[VisualTest] Clicking Profile in mobile bottom nav...');
    await send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('#mobile-bottom-nav button'));
        const profileBtn = btns.find(b => b.getAttribute('aria-label') === 'Profile');
        if (profileBtn) profileBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Capture top header banner showing the actual profile photo
    console.log('[VisualTest] Capturing Customer Profile top header banner...');
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '08_customer_profile_header_with_photo.png'),
      Buffer.from(shot2.data, 'base64')
    );
    console.log('✓ Saved: 08_customer_profile_header_with_photo.png');

    // Capture 3: Switch to "Profile & Security" tab to show photo manager and active mobile pill
    console.log('[VisualTest] Switching to Profile & Security tab...');
    await send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('button'));
        const profTab = tabs.find(t => t.textContent && t.textContent.includes('Profile & Security'));
        if (profTab) profTab.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '09_customer_profile_tab_photo_manager.png'),
      Buffer.from(shot3.data, 'base64')
    );
    console.log('✓ Saved: 09_customer_profile_tab_photo_manager.png');

    ws.close();
  } catch (err) {
    console.error('Visual verification failed:', err);
  } finally {
    chromeProc.kill('SIGKILL');
    server.close();
    process.exit(0);
  }
}

run();
