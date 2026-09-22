const CACHE = 'index';
const APP = './index.html';
const CORE = [
  './',
  APP,
  './manifest.json',
  './service-worker.js',
  './icon-192.png',
  './icon-512.png'
];

function isLocalAsset(value) {
  if (!value) return false;
  let v = value.trim().replace(/^['"]|['"]$/g, '');
  if (!v || v.startsWith('data:') || v.startsWith('#') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//')) return false;
  if (v.startsWith('javascript:')) return false;
  if (v.startsWith('/')) v = '.' + v;
  return v.startsWith('./') || v.startsWith('../') || (!v.includes(':') && !v.startsWith('mailto:'));
}

function extractAssets(html) {
  const found = new Set(CORE);
  const patterns = [
    /(?:src|href|poster|content)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    /(?:sounds|image)\/[A-Za-z0-9_().%+\-]+\.(?:webp|png|jpg|jpeg|gif|svg|wav|mp3|ogg|m4a)/gi
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      const raw = match[1] || match[0];
      if (!raw) continue;
      const candidates = match[1] ? [raw] : [raw];
      for (const candidate of candidates) {
        let value = candidate.trim();
        value = value.replace(/[?#].*$/, '');
        if (!isLocalAsset(value)) continue;
        if (!value.startsWith('./') && !value.startsWith('../')) value = './' + value;
        found.add(value);
      }
    }
  }
  return [...found];
}

async function cacheOne(cache, url) {
  try {
    const request = new Request(url, { cache: 'reload' });
    const response = await fetch(request);
    if (response && response.ok) await cache.put(url, response.clone());
    return true;
  } catch (error) {
    console.warn('[Godofredo] No se pudo precargar:', url);
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Primero descarga el HTML completo mientras hay Internet.
    const htmlResponse = await fetch(new Request(APP, { cache: 'reload' }));
    if (htmlResponse && htmlResponse.ok) {
      await cache.put(APP, htmlResponse.clone());
      const html = await htmlResponse.clone().text();
      const assets = extractAssets(html);

      // Descarga TODOS los recursos locales mencionados en el HTML,
      // aunque todavía no se hayan mostrado en pantalla.
      await Promise.all(assets.map(url => cacheOne(cache, url)));
    } else {
      await Promise.all(CORE.map(url => cacheOne(cache, url)));
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Servir directamente los recursos ya precargados, incluidos los WAV.
    // No manipulamos respuestas Range para evitar problemas de reproducción.
    const cached = await cache.match(request);
    if (cached) return cached;

    // Si todavía no está en caché, obtenerlo de Internet y guardarlo.
    try {
      const response = await fetch(request);

      if (
        response &&
        response.ok &&
        new URL(request.url).origin === self.location.origin
      ) {
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        return (await cache.match(APP)) || (await cache.match('./'));
      }

      return new Response('', {
        status: 503,
        statusText: 'Offline'
      });
    }
  })());
});
