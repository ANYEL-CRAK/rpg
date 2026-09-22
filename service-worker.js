/* Godofredo - Service Worker v26
   Precarga index.html + CSS + JS + todos los recursos locales que estos archivos
   referencian. Esto incluye marcos de clase cargados dinámicamente desde JS/CSS.
*/

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

const ASSET_EXT = /\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a|css|js|html)(?:[?#].*)?$/i;

function normalizeUrl(value, base = self.location.href) {
  if (!value) return null;

  let v = String(value).trim().replace(/^['"]|['"]$/g, '');
  if (!v || v.startsWith('#')) return null;
  if (/^(?:data|blob|javascript|mailto|tel):/i.test(v)) return null;
  if (/^(?:https?:)?\/\//i.test(v)) return null;

  // Ignora rutas absolutas del sistema y conserva solo recursos del mismo sitio.
  try {
    const u = new URL(v, base);
    if (u.origin !== self.location.origin) return null;
    u.hash = '';
    return u.href;
  } catch (_) {
    return null;
  }
}

function isRelevantFile(url) {
  try {
    return ASSET_EXT.test(new URL(url).pathname);
  } catch (_) {
    return false;
  }
}

function extractReferences(text, baseUrl) {
  const found = new Set();
  if (!text) return found;

  const add = value => {
    const url = normalizeUrl(value, baseUrl);
    if (url && isRelevantFile(url)) found.add(url);
  };

  // src/href/poster/content y atributos similares.
  const attrRe = /(?:src|href|poster|content|data-src|data-image|data-icon|data-frame|data-sound)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(text))) add(m[1]);

  // url(...), típico de CSS.
  const cssUrlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = cssUrlRe.exec(text))) add(m[1]);

  // Rutas image/... y sounds/... aunque estén dentro de strings JS.
  const localPathRe = /(?:^|["'`\s(=,:])((?:\.\/|\.\.\/)?(?:image|images|sounds|audio)\/[^"'`\s)>,;]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a))(?:["'`\s),;]|$)/gi;
  while ((m = localPathRe.exec(text))) add(m[1]);

  // Cualquier string local que termine en un recurso conocido.
  const quotedFileRe = /["'`]([^"'`\r\n]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a|css|js|html))["'`]/gi;
  while ((m = quotedFileRe.exec(text))) add(m[1]);

  return found;
}

async function cacheOne(cache, url) {
  try {
    const request = new Request(url, { cache: 'reload' });
    const response = await fetch(request);
    if (!response || !response.ok) {
      console.warn('[Godofredo] No se pudo precargar:', url, response && response.status);
      return null;
    }
    await cache.put(url, response.clone());
    return response;
  } catch (error) {
    console.warn('[Godofredo] Error precargando:', url, error);
    return null;
  }
}

async function precacheEverything() {
  const cache = await caches.open(CACHE);
  const queue = [...new Set(CORE.map(url => new URL(url, self.location.href).href))];
  const visited = new Set();

  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const response = await cacheOne(cache, url);
    if (!response) continue;

    // Solo inspeccionamos texto de HTML/CSS/JS para descubrir más recursos.
    let type = '';
    try { type = response.headers.get('content-type') || ''; } catch (_) {}
    const path = new URL(url).pathname.toLowerCase();
    const isTextResource =
      type.includes('text/html') ||
      type.includes('text/css') ||
      type.includes('javascript') ||
      /\.(?:html|css|js)$/i.test(path);

    if (!isTextResource) continue;

    try {
      const text = await response.clone().text();
      const refs = extractReferences(text, url);
      for (const ref of refs) {
        if (!visited.has(ref)) queue.push(ref);
      }
    } catch (error) {
      console.warn('[Godofredo] No se pudo analizar:', url, error);
    }
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Si el HTML real se llama index.html, este es el archivo que se precarga.
    await precacheEverything();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Primero: servir desde caché. No usamos Range manual para los WAV.
    const cached = await cache.match(request);
    if (cached) return cached;

    // Si un recurso no estaba en la precarga, se guarda al usarlo mientras haya Internet.
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
