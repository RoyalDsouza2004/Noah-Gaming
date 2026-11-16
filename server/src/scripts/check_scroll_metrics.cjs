const { spawn } = require('child_process');

(async () => {
  const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_test_eval',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const targets = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json());
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
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Login as admin
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@gaminglounge.com', password: 'AdminPassword@123' })
  }).then(r => r.json());
  const token = res.data.token;

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('noah_auth_token', '${token}');
      localStorage.setItem('nexus_auth_token', '${token}');
      location.hash = '#bookings';
      location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 3000));

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const container = document.getElementById('my-bookings-container');
      const cards = document.querySelectorAll('.space-y-3 > div');
      const pagination = document.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      const nav = document.querySelector('div[aria-label="Mobile Bottom Navigation"]');
      return {
        containerFound: !!container,
        scrollTop: container ? container.scrollTop : 0,
        scrollHeight: container ? container.scrollHeight : 0,
        clientHeight: container ? container.clientHeight : 0,
        cardCount: cards.length,
        paginationFound: !!pagination,
        navFound: !!nav,
        navBottom: nav ? nav.getBoundingClientRect().bottom : 0,
        navTop: nav ? nav.getBoundingClientRect().top : 0
      };
    })()`,
    returnByValue: true
  });
  console.log('DOM Evaluation on Mobile:', JSON.stringify(evalRes.result.result.value, null, 2));

  // Now scroll container to bottom
  await send('Runtime.evaluate', {
    expression: `document.getElementById('my-bookings-container').scrollTo({ top: 9999, behavior: 'instant' })`
  });
  await new Promise(r => setTimeout(r, 1000));

  const afterScroll = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.getElementById('my-bookings-container');
      const p = document.querySelector('[role="navigation"][aria-label="Pagination Navigation"]');
      const n = document.querySelector('div[aria-label="Mobile Bottom Navigation"]');
      return {
        scrollTop: c.scrollTop,
        maxScroll: c.scrollHeight - c.clientHeight,
        paginationRect: p ? p.getBoundingClientRect() : null,
        navRect: n ? n.getBoundingClientRect() : null,
        clearanceAboveNav: (n && p) ? (n.getBoundingClientRect().top - p.getBoundingClientRect().bottom) : null
      };
    })()`,
    returnByValue: true
  });
  console.log('After Scroll to Bottom:', JSON.stringify(afterScroll.result.result.value, null, 2));

  ws.close();
  chromeProc.kill();
})().catch(console.error);
