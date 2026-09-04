/* 討論卓 Service Worker
   ─ ナビゲーション：ネットワーク優先 → キャッシュ → offline.html
   ─ 静的アセット：stale-while-revalidate（表示は即時、裏で更新）
   キャッシュを作り直したいときは CACHE の版番号を上げる。 */

var VERSION = "v5";
var CACHE = "debate-app-" + VERSION;

/* 初回インストール時に取り込む一式。アプリ全体がオフラインで動く。 */
var PRECACHE = [
  "./",
  "./index.html",
  "./compose.html",
  "./import.html",
  "./record.html",
  "./debate-table.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/tokens.css",
  "./assets/catalog.js",
  "./assets/charts.js",
  "./assets/prompt.js",
  "./assets/pwa.js",
  "./assets/qa.js",
  "./assets/schema.js",
  "./assets/store.js",
  "./assets/ui.js",
  "./samples/sample-record.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 1件でも欠けると addAll 全体が失敗するので個別に入れる */
      return Promise.all(PRECACHE.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ページ側の「更新する」ボタンから待機中の SW を有効化する */
self.addEventListener("message", function (e) {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* 外部リソースは素通し */

  /* ページ遷移：まずネットワーク、落ちたらキャッシュ、最後にオフライン案内 */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match("./offline.html") || Response.error();
          });
        })
    );
    return;
  }

  /* 静的アセット：キャッシュを即返しつつ裏で取り直す */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req)
        .then(function (res) {
          if (res && res.status === 200 && res.type === "basic") {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        })
        .catch(function () { return hit; });
      return hit || net;
    })
  );
});
