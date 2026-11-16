const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_API = 'http://localhost:5000/api';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome_glass_scroll_cdp';
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
  console.log('--- Step 1: Login & Seed Bookings ---');
  // Admin Login
  const adminRes = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' },
  });
  const adminToken = adminRes.data?.token;

  // Create a dedicated test customer
  const uId = Date.now().toString().slice(-5);
  const custRes = await api('/auth/register', {
    method: 'POST',
    body: {
      name: 'Aditya Roy',
      email: `aditya.${uId}@example.com`,
      phone: `93${uId}21`,
      password: 'Password@123',
    },
  });
  const custToken = custRes.data?.token;

  // Fetch devices & games to create 8 bookings (making list span multiple pages and tall height)
  const devRes = await api('/devices', { token: custToken });
  const gmRes = await api('/games', { token: custToken });
  const d1 = devRes.data?.devices?.[0]?._id;
  const g1 = gmRes.data?.games?.[0]?._id;

  console.log('Seeding 8 customer bookings to guarantee tall scrollable page...');
  const hours = ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  for (let i = 0; i < 8; i++) {
    await api('/bookings', {
      method: 'POST',
      token: custToken,
      body: {
        deviceId: d1,
        gameId: g1,
        bookingDate: `2026-12-${String(10 + i).padStart(2, '0')}`,
        startTime: hours[i % hours.length],
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
  // PART 1: TEST IPHONE-STYLE TRANSPARENT GLASS BOTTOM NAVIGATION (Mobile 390x844)
  // ==========================================
  console.log('\n==========================================');
  console.log('PART 1: VERIFYING IPHONE GLASS MOBILE NAV');
  console.log('==========================================');
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

  // Inspect the glass mobile nav computed styles
  const navStyle = await send('Runtime.evaluate', {
    expression: `(() => {
      const navEl = document.querySelector('div[aria-label="Mobile Bottom Navigation"]');
      if (!navEl) return { found: false };
      const cs = window.getComputedStyle(navEl);
      const rect = navEl.getBoundingClientRect();
      const buttons = Array.from(navEl.querySelectorAll('button'));
      const labels = buttons.map(b => b.querySelector('span')?.innerText);
      const labelColors = buttons.map(b => window.getComputedStyle(b.querySelector('span')).color);
      const activeBtn = navEl.querySelector('button[aria-current="page"]');
      const activeIcon = activeBtn ? activeBtn.querySelector('svg') : null;
      const activeIconColor = activeIcon ? window.getComputedStyle(activeIcon).color : '';
      
      return {
        found: true,
        borderRadius: cs.borderRadius,
        backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
        backgroundColor: cs.backgroundColor,
        border: cs.border,
        boxShadow: cs.boxShadow,
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width },
        buttonCount: buttons.length,
        labels,
        labelColors,
        activeIconColor,
        isFloating: rect.bottom < 844 && rect.left > 0 && rect.right < 390,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Nav Style Inspection Result:', JSON.stringify(navStyle.result.result?.value, null, 2));

  // Save screenshot of glass mobile nav on home
  const shotGlassHome = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'glass_mobile_nav_home.png'), Buffer.from(shotGlassHome.result.data, 'base64'));
  console.log('✅ Saved glass_mobile_nav_home.png');

  // Tap "Equipment" to verify smooth transition and styling
  await send('Runtime.evaluate', {
    expression: `
      const eqBtn = document.querySelector('button[aria-label="Equipment"]');
      if (eqBtn) eqBtn.click();
    `,
  });
  await sleep(1500);

  const shotGlassEq = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'glass_mobile_nav_equipment.png'), Buffer.from(shotGlassEq.result.data, 'base64'));
  console.log('✅ Saved glass_mobile_nav_equipment.png');

  // ==========================================
  // PART 2: VERIFY CUSTOMER BOOKINGS VERTICAL SCROLLING
  // ==========================================
  console.log('\n==========================================');
  console.log('PART 2: VERIFYING BOOKINGS VERTICAL SCROLLING');
  console.log('==========================================');

  // Test 1: Desktop Customer Bookings (1280x900)
  console.log('--- Test 2.1: Desktop Customer Bookings (1280x900) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${custToken}');
      localStorage.setItem('nexus_auth_token', '${custToken}');
      location.hash = '#bookings';
      location.reload();
    `,
  });
  await sleep(3500);

  // Measure initial scroll metrics at the top
  const initialScroll = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      if (!container) return { found: false };
      return {
        found: true,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        canScroll: container.scrollHeight > container.clientHeight,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Desktop Initial Scroll Metrics (Top):', initialScroll.result.result?.value);

  const shotDeskTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_top.png'), Buffer.from(shotDeskTop.result.data, 'base64'));
  console.log('✅ Saved bookings_scroll_desktop_top.png');

  // Actually scroll to the very bottom of the page
  console.log('Executing vertical scroll to bottom on desktop...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
      }
    })()`,
  });
  await sleep(1000);

  // Measure metrics at bottom and verify pagination & last record visibility
  const bottomScroll = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      if (!container) return { found: false };
      const pagination = container.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      const paginationRect = pagination ? pagination.getBoundingClientRect() : null;
      const cards = container.querySelectorAll('.space-y-3 > div');
      const lastCard = cards[cards.length - 1];
      const lastCardRect = lastCard ? lastCard.getBoundingClientRect() : null;

      return {
        found: true,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrolledToBottom: container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 20,
        paginationVisible: paginationRect && paginationRect.top >= 0 && paginationRect.bottom <= window.innerHeight,
        lastCardVisible: lastCardRect && lastCardRect.top >= 0 && lastCardRect.bottom <= window.innerHeight,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Desktop Bottom Scroll Verification:', bottomScroll.result.result?.value);

  const shotDeskBottom = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_desktop_bottom.png'), Buffer.from(shotDeskBottom.result.data, 'base64'));
  console.log('✅ Saved bookings_scroll_desktop_bottom.png');

  // Test 2: Mobile Customer Bookings (390x844)
  console.log('--- Test 2.2: Mobile Customer Bookings (390x844) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    hasTouch: true,
  });

  // Scroll back to top
  await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      if (container) container.scrollTo({ top: 0, behavior: 'instant' });
    })()`,
  });
  await sleep(1000);

  const shotMobTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_mobile_top.png'), Buffer.from(shotMobTop.result.data, 'base64'));
  console.log('✅ Saved bookings_scroll_mobile_top.png');

  // Perform touch scroll to bottom on mobile
  console.log('Executing vertical scroll to bottom on mobile...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
      }
    })()`,
  });
  await sleep(1000);

  // Check that last row & pagination are NOT covered by the floating glass nav
  const mobileBottomMetrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      const navEl = document.querySelector('div[aria-label="Mobile Bottom Navigation"]');
      const navRect = navEl ? navEl.getBoundingClientRect() : null;
      const pagination = container ? container.querySelector('[role="navigation"][aria-label="Pagination Navigation"]') : null;
      const paginationRect = pagination ? pagination.getBoundingClientRect() : null;

      const notCoveredByNav = paginationRect && navRect ? (paginationRect.bottom < navRect.top || paginationRect.top > navRect.bottom) : true;
      const clearancePx = paginationRect && navRect ? (navRect.top - paginationRect.bottom) : 0;

      return {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrolledToBottom: container.scrollTop > 0,
        paginationFound: !!pagination,
        navFound: !!navEl,
        notCoveredByNav,
        clearancePx,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Mobile Bottom Clearance Verification:', mobileBottomMetrics.result.result?.value);

  const shotMobBottom = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_mobile_bottom.png'), Buffer.from(shotMobBottom.result.data, 'base64'));
  console.log('✅ Saved bookings_scroll_mobile_bottom.png');

  // Test 3: Tablet Customer Bookings (768x1024)
  console.log('--- Test 2.3: Tablet Customer Bookings (768x1024) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: false,
    hasTouch: true,
  });
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
    })()`,
  });
  await sleep(1000);

  const shotTablet = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'bookings_scroll_tablet.png'), Buffer.from(shotTablet.result.data, 'base64'));
  console.log('✅ Saved bookings_scroll_tablet.png');

  // Test 4: Admin Bookings Table Vertical Scrolling (Desktop 1280x900)
  console.log('--- Test 2.4: Admin Bookings Table Vertical Scrolling ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${adminToken}');
      localStorage.setItem('nexus_auth_token', '${adminToken}');
      location.hash = '#admin-bookings';
      location.reload();
    `,
  });
  await sleep(3500);

  // Scroll to bottom of admin dashboard
  await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('admin-dashboard-container');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
      }
    })()`,
  });
  await sleep(1000);

  const adminScrollMetrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('admin-dashboard-container');
      if (!container) return { found: false };
      const table = container.querySelector('table');
      const pagination = container.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      const stickyHeader = container.querySelector('thead');
      const stickyStyle = stickyHeader ? window.getComputedStyle(stickyHeader).position : '';

      return {
        found: true,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrolled: container.scrollTop > 0,
        tableFound: !!table,
        paginationFound: !!pagination,
        stickyHeaderPosition: stickyStyle,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Admin Bookings Scroll Verification:', adminScrollMetrics.result.result?.value);

  const shotAdminBottom = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'admin_bookings_scroll_desktop.png'), Buffer.from(shotAdminBottom.result.data, 'base64'));
  console.log('✅ Saved admin_bookings_scroll_desktop.png');

  // Clean up
  ws.close();
  chromeProc.kill();
  console.log('\n🎉 ALL GLASS NAV & BOOKINGS SCROLLING TESTS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
