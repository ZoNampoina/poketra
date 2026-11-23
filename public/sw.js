const CACHE='poketra-__BUILD__';
const BASIC=['/','/import','/manifest.webmanifest','/favicon.svg','/icon-192.png','/icon-512.png','/icon-maskable.png'];
function safeShell(response){return response.ok&&!response.redirected&&response.headers.get('content-type')?.includes('text/html');}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE),response=await fetch('/offline-assets.json',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('Offline manifest unavailable');const paths=[...new Set([...BASIC,...await response.json()])];let index=0;await Promise.all(Array.from({length:Math.min(4,paths.length)},async()=>{while(index<paths.length){const path=paths[index++],res=await fetch(path,{cache:'reload',credentials:'same-origin'});if(!res.ok||(path==='/'&&!safeShell(res)))throw new Error('Precache failed');await cache.put(path,res);}}));await cache.put('/__poketra_ready__',new Response('1'));const clients=await self.clients.matchAll();for(const client of clients)client.postMessage({type:'UPDATE_AVAILABLE'});})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=(await caches.keys()).filter(k=>k.startsWith('poketra-'));for(const key of keys.filter(k=>k!==CACHE).slice(0,-1))await caches.delete(key);await self.clients.claim();for(const c of await self.clients.matchAll())c.postMessage({type:'OFFLINE_READY'});})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());if(event.data?.type==='STATUS')event.waitUntil(caches.open(CACHE).then(c=>c.match('/__poketra_ready__')).then(r=>event.ports[0]?.postMessage({ready:!!r})));});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname.includes('sign')||url.pathname.startsWith('/callback'))return;
 if(request.mode==='navigate')event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const path=url.pathname==='/import/'?'/import':url.pathname;
  try{
    // The previous worker always returned cached '/' for every route, causing stale UI
    // and preventing standalone recovery pages from loading on Android PWAs.
    const res=await fetch(request,{cache:'no-store'});
    if((path==='/'||path==='/import')&&safeShell(res))await cache.put(path,res.clone());
    return res;
  }catch{
    const saved=await cache.match(path);
    if(saved)return saved;
    // Never substitute the home page for a failed recovery route.
    return new Response('Page indisponible hors connexion. Reconnecte-toi sans vider les données.',{
      status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}
    });
  }
})());
 else event.respondWith((async()=>{const cache=await caches.open(CACHE);let saved=await cache.match(request);if(saved)return saved;for(const key of(await caches.keys()).filter(k=>k.startsWith('poketra-')&&k!==CACHE)){saved=await(await caches.open(key)).match(request);if(saved)return saved;}const res=await fetch(request);if(res.ok&&!res.redirected&&/\.(png|svg|css|js|webmanifest|ttf|woff2?)$/.test(url.pathname))await cache.put(request,res.clone());return res;})());
});
