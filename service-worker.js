const CACHE = 'godofredo-v24-pwa';
const APP_SHELL = [
  "./",
  "./Godofredo-v24-pwa.html",
  "./icon-192.png",
  "./icon-512.png",
  "./image/advertencia.webp",
  "./image/ajuste.webp",
  "./image/alas.webp",
  "./image/arbol.webp",
  "./image/balansa.webp",
  "./image/basura.webp",
  "./image/bola.webp",
  "./image/bolsa.webp",
  "./image/calavera.webp",
  "./image/candado.webp",
  "./image/cascada.webp",
  "./image/castillo.webp",
  "./image/cofre.webp",
  "./image/confeti.webp",
  "./image/corazon.webp",
  "./image/corona.webp",
  "./image/daga.webp",
  "./image/destello.webp",
  "./image/diana.webp",
  "./image/dos_espada.webp",
  "./image/elixir.webp",
  "./image/escudo.webp",
  "./image/espada.webp",
  "./image/estandarte.webp",
  "./image/estrella.webp",
  "./image/fuego.webp",
  "./image/gema.webp",
  "./image/hp_grande.webp",
  "./image/hp_pequena.webp",
  "./image/huella.webp",
  "./image/infinito.webp",
  "./image/logrado.webp",
  "./image/mana_local.webp",
  "./image/marco.webp",
  "./image/marco_cobre.webp",
  "./image/marco_esmeralda.webp",
  "./image/marco_oro.webp",
  "./image/marco_plata.webp",
  "./image/medalla.webp",
  "./image/montana.webp",
  "./image/mp_grande.webp",
  "./image/mp_mediano.webp",
  "./image/mp_pequeno.webp",
  "./image/nueva_mision.webp",
  "./image/oro_moneda.webp",
  "./image/papel.webp",
  "./image/planta.webp",
  "./image/rayo.webp",
  "./image/regalo.webp",
  "./image/retono.webp",
  "./image/sana.webp",
  "./image/tienda.webp",
  "./image/trofeo.webp",
  "./image/volcan.webp",
  "./manifest.json",
  "./service-worker.js",
  "./sounds/boton_epico.wav",
  "./sounds/guerrero_espada.wav",
  "./sounds/mago_magia.wav",
  "./sounds/mision_completada.wav",
  "./sounds/mision_fallida.wav",
  "./sounds/mision_fallida_oscura_v2.wav",
  "./sounds/paladin_escudo.wav",
  "./sounds/paladin_escudo_impacto_epico.wav",
  "./sounds/picaro_daga.wav",
  "./sounds/sanador_curacion.wav",
  "./sounds/subir_nivel_epico.wav",
  "./sounds/tienda_monedas.wav"
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache every known local game resource, but do not let one missing file
    // prevent the whole PWA from installing.
    await Promise.all(APP_SHELL.map(async url => {
      try { await cache.add(url); } catch (e) { console.warn('No se pudo cachear:', url); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const response = await fetch(req);
      if (response && response.ok && new URL(req.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
      }
      return response;
    } catch (e) {
      if (req.mode === 'navigate') return caches.match('./Godofredo-v24-pwa.html');
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
