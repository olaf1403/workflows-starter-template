const CACHE = "relay-inbox-v2";
const scopeUrl = self.registration.scope;
const APP_SHELL = ["", "manifest.webmanifest", "app-icon.svg", "app-icon-192.png", "app-icon-512.png", "apple-touch-icon.png"].map(
	(path) => new URL(path, scopeUrl).href,
);

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET" || new URL(event.request.url).pathname.includes("/api/")) return;
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				const copy = response.clone();
				caches.open(CACHE).then((cache) => cache.put(event.request, copy));
				return response;
			})
			.catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(scopeUrl))),
	);
});
