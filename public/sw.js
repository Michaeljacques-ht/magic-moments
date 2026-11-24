const CACHE='magic-moments-pwa-v23';
const ASSETS=['/offline.html','/styles.css','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('magic-moments-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/media/'))return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('/offline.html')));return;}
 if(ASSETS.includes(u.pathname)&&!u.search)e.respondWith(fetch(r).then(async response=>{if(response.ok){const c=await caches.open(CACHE);await c.put(r,response.clone());}return response;}).catch(()=>caches.match(r)));
});
