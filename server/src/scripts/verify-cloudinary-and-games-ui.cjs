const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5192;
const DIST_DIR = path.resolve(__dirname, '../../../client/dist');
const ARTIFACT_DIR = 'C:/Users/HP/.gemini/antigravity/brain/dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Content types for serving built client
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

// Create local test HTTP server serving Vite production build
const server = http.createServer((req, res) => {
  // Mock API endpoints for offline visual inspection
  if (req.url.startsWith('/api/users/profile')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        success: true,
        data: {
          user: {
            _id: 'cust-visual-1',
            name: 'Alex Mercer',
            email: 'alex.gamer@noahgaming.com',
            phone: '+91 98765 43210',
            role: 'customer',
            profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            profilePicturePublicId: 'noah-gaming/profiles/cust_alex',
          },
        },
      })
    );
  }

  if (req.url.startsWith('/api/games')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        success: true,
        data: {
          games: [
            {
              _id: 'g-fc24',
              name: 'EA Sports FC 24',
              description: 'The World’s Game with HyperMotionV and revolutionised Frostbite Engine.',
              coverImage: {
                url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
                publicId: 'noah-gaming/games/covers/fc24',
              },
              backgroundImage: {
                url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1920&q=80',
                publicId: 'noah-gaming/games/backgrounds/fc24',
              },
              genre: ['Sports', 'Football', 'Competitive'],
              platforms: ['PlayStation 5'],
              localPlayersSupported: 4,
              minPlayers: 1,
              maxPlayers: 4,
              bookingMode: 'BOTH',
              isExclusive: false,
              ratings: {
                rawg: { rating: 4.2, ratingsCount: 1420 },
                metacritic: { score: 76 },
              },
              trailers: [
                {
                  title: 'Official Trailer',
                  youtubeId: 'XhP3Xh4LMA8',
                },
              ],
              screenshots: [
                'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1280&q=80',
              ],
              multiplayer: {
                localCoop: true,
                splitScreen: false,
                offlineMultiplayer: true,
                maxOfflineMultiplayerPlayers: 4,
                onlineCoop: true,
                maxOnlinePlayers: 22,
              },
            },
            {
              _id: 'g-mk1',
              name: 'Mortal Kombat 1',
              description: 'Discover a reborn Mortal Kombat Universe created by the Fire God Liu Kang.',
              coverImage: {
                url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
              },
              genre: ['Fighting', 'Action'],
              platforms: ['PlayStation 5'],
              localPlayersSupported: 2,
              minPlayers: 1,
              maxPlayers: 2,
              isExclusive: false,
              ratings: {
                rawg: { rating: 4.4, ratingsCount: 890 },
                metacritic: { score: 83 },
              },
              trailers: [{ youtubeId: 'UYFlv_Q2i_c' }],
            },
            {
              _id: 'g-gta6',
              name: 'GTA 6',
              description: 'Grand Theft Auto VI heads to Vice City. Experience the premier private suite experience.',
              coverImage: {
                url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
              },
              genre: ['Action', 'Open World'],
              platforms: ['PlayStation 5'],
              localPlayersSupported: 1,
              isExclusive: true,
              ratings: {
                rawg: { rating: 4.9 },
                metacritic: { score: 98 },
              },
              trailers: [{ youtubeId: 'QdBZY2fkU-0' }],
            },
          ],
        },
      })
    );
  }

  // Serve static files
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
      res.end('Error loading ' + safePath);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

async function runVisualVerification() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[VisualTest] In-process static server listening on http://127.0.0.1:${PORT}`);

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--user-data-dir=C:/Users/HP/AppData/Local/Temp/chrome_visual_cloudinary_test',
    '--remote-debugging-port=9240',
    '--disable-gpu',
    '--no-first-run',
    'about:blank',
  ]);

  try {
    await new Promise((r) => setTimeout(r, 1800));

    const targets = await fetch('http://127.0.0.1:9240/json/list').then((r) => r.json());
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
      new Promise((resolve) => {
        const i = id++;
        pending.set(i, resolve);
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

    console.log('[VisualTest] Navigating to Home Page...');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    // Inject logged in customer state
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('noah_user', JSON.stringify({
          _id: 'cust-visual-1',
          name: 'Alex Mercer',
          email: 'alex.gamer@noahgaming.com',
          phone: '+91 98765 43210',
          role: 'customer',
          profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          profilePicturePublicId: 'noah-gaming/profiles/cust_alex'
        }));
        localStorage.setItem('noah_auth_token', 'mock_jwt_token_for_visual_tests');
        window.location.reload();
      `,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Capture 1: Game Catalogue with Cover Artwork, Badges, and Local Player Capacity
    await send('Runtime.evaluate', {
      expression: `
        const el = document.getElementById('games');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      `,
    });
    await new Promise((r) => setTimeout(r, 800));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '02_games_catalogue_with_artwork.png'),
      Buffer.from(shot1.result.data, 'base64')
    );
    console.log('📸 Captured: 02_games_catalogue_with_artwork.png');

    // Click "Details" on the first game (EA Sports FC 24)
    await send('Runtime.evaluate', {
      expression: `
        const detailsBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Details'));
        if (detailsBtns.length > 0) detailsBtns[0].click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture 2: Dedicated Game Details Modal with Overview & Ratings
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '03_game_details_modal_overview.png'),
      Buffer.from(shot2.result.data, 'base64')
    );
    console.log('📸 Captured: 03_game_details_modal_overview.png');

    // Click "Media & Trailer" tab inside Game Details Modal
    await send('Runtime.evaluate', {
      expression: `
        const mediaTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Media & Trailer'));
        if (mediaTab) mediaTab.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 800));

    // Capture 3: Game Details Modal Media Tab with YouTube Trailer
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '04_game_details_modal_trailer.png'),
      Buffer.from(shot3.result.data, 'base64')
    );
    console.log('📸 Captured: 04_game_details_modal_trailer.png');

    // Close Game Details Modal
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = document.querySelector('button[title="Close"]');
        if (closeBtn) closeBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 500));

    // Open Customer Dashboard Profile & Security Tab
    await send('Runtime.evaluate', {
      expression: `
        const profileBtn = document.querySelector('button[title="Open Profile"]');
        if (profileBtn) profileBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Select Profile tab inside Customer Dashboard
    await send('Runtime.evaluate', {
      expression: `
        const profTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Profile & Security'));
        if (profTab) profTab.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture 4: Customer Profile Photo Manager
    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '01_customer_profile_picture_manager.png'),
      Buffer.from(shot4.result.data, 'base64')
    );
    console.log('📸 Captured: 01_customer_profile_picture_manager.png');

    // Switch to Admin Role & Open Admin Dashboard Games Tab
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('noah_user', JSON.stringify({
          _id: 'adm-visual-1',
          name: 'Noah System Admin',
          email: 'admin@noahgaming.com',
          role: 'admin'
        }));
        window.location.hash = '#admin';
        window.location.reload();
      `,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Select Games Tab in Admin Dashboard
    await send('Runtime.evaluate', {
      expression: `
        const gamesTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Games & Inventory') || b.textContent.includes('Game Management') || b.textContent === 'Games');
        if (gamesTab) gamesTab.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Click "Import Game"
    await send('Runtime.evaluate', {
      expression: `
        const importBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Import Game'));
        if (importBtn) importBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture 5: Admin Game Import Modal
    const shot5 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, '05_admin_game_import_modal.png'),
      Buffer.from(shot5.result.data, 'base64')
    );
    console.log('📸 Captured: 05_admin_game_import_modal.png');

    console.log('🎉 All visual verification screenshots captured successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch (_) {}
    server.close();
  }
}

runVisualVerification().catch((e) => {
  console.error('Visual verification failed:', e);
  process.exit(1);
});
