/* PWA まわり：Service Worker の登録、更新の通知、ホーム画面への追加。
   他の assets/*.js には依存しないので、どのページでも単体で読み込める。 */
(function () {
  "use strict";

  /* ── ブラウザ UI の色をテーマに追随させる ───────── */
  /* 自動のときは <meta media="..."> の2本に任せ、手動で選ばれたときだけ
     media なしの1本を head 先頭に置いて上書きする（先勝ちのため）。 */
  (function () {
    var COLOR = { dark: "#0F1115", light: "#FFFFFF" };
    var meta = null;

    function apply(mode, resolved) {
      if (!mode) {                       /* 自動に戻した */
        if (meta) { meta.remove(); meta = null; }
        return;
      }
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.insertBefore(meta, document.head.firstChild);
      }
      meta.setAttribute("content", COLOR[resolved] || COLOR.light);
    }

    document.addEventListener("da:theme", function (e) {
      var d = e.detail || {};
      apply(d.mode, d.resolved);
    });

    try {
      var v = localStorage.getItem("debate-app:theme");
      if (v === "dark" || v === "light") apply(v, v);
    } catch (err) {}
  })();

  var BAR_CSS =
    ".pwa-bar{position:fixed;left:50%;transform:translateX(-50%) translateY(140%);" +
    "bottom:18px;z-index:9999;display:flex;gap:12px;align-items:center;max-width:min(560px,calc(100vw - 24px));" +
    "padding:11px 12px 11px 16px;border-radius:14px;background:var(--card,#fff);color:var(--ink,#14161B);" +
    "border:1px solid var(--line,rgba(0,0,0,.12));box-shadow:0 10px 34px rgba(0,0,0,.18);" +
    "font-family:var(--sans,system-ui),sans-serif;font-size:14px;line-height:1.45;" +
    "transition:transform .32s cubic-bezier(.2,.8,.2,1),opacity .32s;opacity:0}" +
    ".pwa-bar.is-in{transform:translateX(-50%) translateY(0);opacity:1}" +
    ".pwa-bar p{margin:0;flex:1 1 auto}" +
    ".pwa-bar button{appearance:none;cursor:pointer;font:inherit;border-radius:999px;padding:7px 14px;" +
    "border:1px solid transparent;white-space:nowrap}" +
    ".pwa-bar .pwa-yes{background:var(--c4,#7C3AED);color:var(--on-accent,#fff);font-weight:700}" +
    ".pwa-bar .pwa-no{background:transparent;color:var(--ink-3,#8A919C);padding:7px 6px}" +
    "@media (prefers-reduced-motion:reduce){.pwa-bar{transition:none}}";

  function style() {
    if (document.getElementById("pwa-style")) return;
    var s = document.createElement("style");
    s.id = "pwa-style";
    s.textContent = BAR_CSS;
    document.head.appendChild(s);
  }

  /* 画面下部のバーを1本だけ出す。onYes が null なら確認ボタンなし。 */
  var current = null;
  function bar(text, yesLabel, onYes) {
    style();
    if (current) current.remove();

    var el = document.createElement("div");
    el.className = "pwa-bar";
    el.setAttribute("role", "status");

    var p = document.createElement("p");
    p.textContent = text;
    el.appendChild(p);

    if (onYes) {
      var yes = document.createElement("button");
      yes.type = "button";
      yes.className = "pwa-yes";
      yes.textContent = yesLabel;
      yes.addEventListener("click", function () { close(el); onYes(); });
      el.appendChild(yes);
    }

    var no = document.createElement("button");
    no.type = "button";
    no.className = "pwa-no";
    no.textContent = "閉じる";
    no.setAttribute("aria-label", "通知を閉じる");
    no.addEventListener("click", function () { close(el); });
    el.appendChild(no);

    document.body.appendChild(el);
    current = el;
    requestAnimationFrame(function () { el.classList.add("is-in"); });
    return el;
  }

  function close(el) {
    el.classList.remove("is-in");
    setTimeout(function () { el.remove(); if (current === el) current = null; }, 340);
    return el;
  }

  /* ── Service Worker ─────────────────────────────── */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      var base = location.pathname.replace(/[^/]*$/, "");
      navigator.serviceWorker.register(base + "sw.js", { scope: base }).then(function (reg) {

        function watch(worker) {
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            /* 既存の SW がある状態で installed = 新しい版が控えている */
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              bar("新しい版があります。", "更新する", function () {
                worker.postMessage({ type: "SKIP_WAITING" });
              });
            }
          });
        }

        if (reg.waiting && navigator.serviceWorker.controller) {
          bar("新しい版があります。", "更新する", function () {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          });
        }
        watch(reg.installing);
        reg.addEventListener("updatefound", function () { watch(reg.installing); });
      }).catch(function () { /* 登録できなくても通常のページとして動く */ });

      /* 新しい SW が主導権を握ったら一度だけ読み直す */
      var reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
    });
  }

  /* ── ホーム画面への追加 ─────────────────────────── */
  var DISMISS_KEY = "debate-app:install-dismissed";

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    try { if (localStorage.getItem(DISMISS_KEY)) return; } catch (err) {}

    var el = bar("この討論卓をアプリとして入れておけます。", "追加する", function () {
      e.prompt();
    });
    el.querySelector(".pwa-no").addEventListener("click", function () {
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch (err) {}
    });
  });

  window.addEventListener("appinstalled", function () {
    try { localStorage.removeItem(DISMISS_KEY); } catch (err) {}
    if (current) close(current);
  });
})();
