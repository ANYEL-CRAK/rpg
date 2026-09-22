/* Godofredo - Service Worker v26 */
const CACHE = 'index';
const APP = './index.html';
const CORE = ['./', APP, './manifest.json', './service-worker.js', './icon-192.png', './icon-512.png'];
const ASSET_EXT = /\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a|css|js|html)(?:[?#].*)?$/i;

function normalizeUrl(value, base = self.location.href) {
  if (!value) return null;
  let v = String(value).trim().replace(/^['"]|['"]$/g, '');
  if (!v || v.startsWith('#')) return null;
  if (/^(?:data|blob|javascript|mailto|tel):/i.test(v)) return null;
  if (/^(?:https?:)?\/\//i.test(v)) return null;
  try { const u = new URL(v, base); if (u.origin !== self.location.origin) return null; u.hash = ''; return u.href; } catch (_) { return null; }
}
function isRelevantFile(url) { try { return ASSET_EXT.test(new URL(url).pathname); } catch (_) { return false; } }
function extractReferences(text, baseUrl) {
  const found = new Set(); if (!text) return found;
  const add = value => { const url = normalizeUrl(value, baseUrl); if (url && isRelevantFile(url)) found.add(url); };
  const attrRe = /(?:src|href|poster|content|data-src|data-image|data-icon|data-frame|data-sound)\s*=\s*["']([^"']+)["']/gi;
  let m; while ((m = attrRe.exec(text))) add(m[1]);
  const cssUrlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = cssUrlRe.exec(text))) add(m[1]);
  const localPathRe = /(?:^|["'`\s(=,:])((?:\.\/|\.\.\/)?(?:image|images|sounds|audio)\/[^"'`\s)>,;]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a))(?:["'`\s),;]|$)/gi;
  while ((m = localPathRe.exec(text))) add(m[1]);
  const quotedFileRe = /["'`]([^"'`\r\n]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a|css|js|html))["'`]/gi;
  while ((m = quotedFileRe.exec(text))) add(m[1]);
  return found;
}
async function cacheOne(cache, url) {
  try { const response = await fetch(new Request(url, {cache:'reload'})); if (!response || !response.ok) return null; await cache.put(url, response.clone()); return response; }
  catch (error) { console.warn('[Godofredo] Error precargando:', url, error); return null; }
}
async function precacheEverything() {
  const cache = await caches.open(CACHE);
  const queue = [...new Set(CORE.map(url => new URL(url, self.location.href).href))];
  const visited = new Set();
  while (queue.length) {
    const url = queue.shift(); if (visited.has(url)) continue; visited.add(url);
    const response = await cacheOne(cache, url); if (!response) continue;
    let type = ''; try { type = response.headers.get('content-type') || ''; } catch (_) {}
    const path = new URL(url).pathname.toLowerCase();
    const isText = type.includes('text/html') || type.includes('text/css') || type.includes('javascript') || /\.(?:html|css|js)$/i.test(path);
    if (!isText) continue;
    try { const refs = extractReferences(await response.clone().text(), url); for (const ref of refs) if (!visited.has(ref)) queue.push(ref); }
    catch (error) { console.warn('[Godofredo] No se pudo analizar:', url, error); }
  }
}
self.addEventListener('install', event => event.waitUntil((async()=>{ await precacheEverything(); await self.skipWaiting(); })()));
self.addEventListener('activate', event => event.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))); await self.clients.claim(); })()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    if (request.headers.has('range')) {
      const cachedAudio = await cache.match(request.url);
      if (cachedAudio) {
        const rangeHeader = request.headers.get('range');
        const match = rangeHeader && rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) try {
          const buffer = await cachedAudio.arrayBuffer(); const start=Number(match[1]); let end=match[2]?Number(match[2]):buffer.byteLength-1;
          if(start>=0 && start<buffer.byteLength){ end=Math.min(end,buffer.byteLength-1); if(end>=start){ const chunk=buffer.slice(start,end+1); return new Response(chunk,{status:206,statusText:'Partial Content',headers:{'Content-Type':cachedAudio.headers.get('Content-Type')||'audio/wav','Content-Range':`bytes ${start}-${end}/${buffer.byteLength}`,'Accept-Ranges':'bytes','Content-Length':String(chunk.byteLength)}}); } }
        } catch(error){ console.warn('[Godofredo] Error sirviendo audio Range:', error); }
      }
    }
    const cached = await cache.match(request); if (cached) return cached;
    try { const response=await fetch(request); if(response&&response.ok&&new URL(request.url).origin===self.location.origin) await cache.put(request,response.clone()); return response; }
    catch(error){ if(request.mode==='navigate') return (await cache.match(APP))||(await cache.match('./')); return new Response('',{status:503,statusText:'Offline'}); }
  })());
});
