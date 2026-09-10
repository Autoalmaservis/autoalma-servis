// Service worker pre Moju Garáž.
//
// Zámerne NECACHUJE stránky ani skripty. Appka tak nikdy neuviazne na starej
// verzii — čo je pri zle nastavenom cachovaní najčastejší a najhoršie
// dohľadateľný problém. Jediné, čo tu robíme navyše, je slušná hláška, keď
// telefón nemá signál.
//
// Obsluha udalosti "fetch" tu musí byť aj tak: bez nej prehliadač appku
// nepovažuje za inštalovateľnú a ponuku na inštaláciu vôbec neukáže.
//
// Sem neskôr pribudne obsluha "push" a "notificationclick" pre upozornenia
// z garáže.

self.addEventListener('install', () => {
  // Nová verzia sa má prevziať hneď, nečakáme na zatvorenie všetkých okien.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const OFFLINE_HTML = `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bez pripojenia</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#000; color:#fff; font-family:system-ui, -apple-system, sans-serif; padding:24px; }
    .box { text-align:center; max-width:320px; }
    h1 { font-size:20px; font-weight:900; text-transform:uppercase; font-style:italic;
         letter-spacing:-0.02em; margin:0 0 12px; }
    p { color:#a1a1aa; font-size:14px; line-height:1.6; margin:0 0 24px; }
    button { background:#dc2626; color:#fff; border:0; border-radius:14px; padding:14px 28px;
             font-weight:900; text-transform:uppercase; font-size:11px; letter-spacing:0.1em; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Ste bez pripojenia</h1>
    <p>Moja Garáž potrebuje internet, aby vám ukázala aktuálny stav vozidla.</p>
    <button onclick="location.reload()">Skúsiť znova</button>
  </div>
</body>
</html>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Zasahujeme len pri otváraní stránok. Obrázky, skripty a volania na API
  // necháme prehliadaču — nech si ich rieši sám ako doteraz.
  if (req.method !== 'GET' || req.mode !== 'navigate') return;

  event.respondWith(
    fetch(req).catch(() => new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }))
  );
});
