/* 討論卓 — 共通UI部品（ナビ・アニメーション・コピー・DOMヘルパー） */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

DA.$  = function(id){ return document.getElementById(id); };
DA.qs = function(sel, root){ return (root || document).querySelector(sel); };

/* CSS 変数の実効値を読む（テーマ切り替えに追従させるため、描画時に毎回読む） */
DA.cssVar = function(name, fallback){
  var v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || "").trim() || fallback || "#8A919C";
};
/* 席番号(1-4) → 現在のテーマでの色 */
DA.seatHex = function(n){ return DA.cssVar("--c" + (((n-1)%4)+1)); };

/* ---------- テーマ（自動 / ライト / ダーク の3状態） ----------
   ちらつき防止のため、各ページの <head> で先に data-theme を当てている。
   ここではその状態を引き継いで切り替えボタンを提供する。 */
DA.theme = (function(){
  var KEY = "debate-app:theme";
  var STATES = [
    { v:"",      ico:"◐", lbl:"自動"   },
    { v:"dark",  ico:"☾", lbl:"ダーク" },
    { v:"light", ico:"☀", lbl:"ライト" }
  ];

  function get(){
    try{
      var v = localStorage.getItem(KEY);
      return (v === "dark" || v === "light") ? v : "";
    }catch(e){ return ""; }
  }
  function resolved(){
    var v = get();
    if(v) return v;
    return (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function set(v){
    try{
      if(v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY);
    }catch(e){}
    if(v) document.documentElement.setAttribute("data-theme", v);
    else  document.documentElement.removeAttribute("data-theme");
    document.dispatchEvent(new CustomEvent("da:theme", { detail:{ mode:v, resolved:resolved() } }));
  }
  function next(){
    var cur = get();
    for(var i=0;i<STATES.length;i++){
      if(STATES[i].v === cur){ set(STATES[(i+1) % STATES.length].v); return; }
    }
    set("dark");
  }
  function state(){
    var cur = get();
    for(var i=0;i<STATES.length;i++){ if(STATES[i].v === cur) return STATES[i]; }
    return STATES[0];
  }
  /* 自動のときはシステム設定の変化に追従させる */
  if(window.matchMedia){
    var mq = matchMedia("(prefers-color-scheme: dark)");
    var onChange = function(){
      if(!get()) document.dispatchEvent(new CustomEvent("da:theme", { detail:{ mode:"", resolved:resolved() } }));
    };
    if(mq.addEventListener) mq.addEventListener("change", onChange);
    else if(mq.addListener) mq.addListener(onChange);
  }
  return { get:get, set:set, next:next, state:state, resolved:resolved };
})();

/* テーマが変わったら呼ばれる（可視化の再描画用） */
DA.onTheme = function(cb){
  document.addEventListener("da:theme", function(e){ cb(e.detail); });
};

DA.esc = function(s){
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
};

/* el("div.role", {title:"x"}, [子 or 文字列]) */
DA.el = function(spec, attrs, kids){
  var parts = String(spec).split(".");
  var tag = parts.shift() || "div";
  var n = document.createElement(tag);
  if(parts.length) n.className = parts.join(" ");
  if(attrs) for(var k in attrs){
    if(!Object.prototype.hasOwnProperty.call(attrs,k)) continue;
    var v = attrs[k];
    if(v === null || v === undefined) continue;
    if(k === "text") n.textContent = v;
    else if(k === "html") n.innerHTML = v;
    else if(k === "style") n.setAttribute("style", v);
    else if(k.indexOf("on") === 0 && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  if(kids) [].concat(kids).forEach(function(c){
    if(c === null || c === undefined) return;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return n;
};

DA.param = function(name){
  var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
  return m ? decodeURIComponent(m[1].replace(/\+/g," ")) : "";
};

DA.fmtDate = function(s){
  if(!s) return "";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? (m[1] + "." + m[2] + "." + m[3]) : String(s).slice(0,10);
};

/* ---------- クリップボード ---------- */
DA.copyText = async function(t){
  try{ await navigator.clipboard.writeText(t); return true; }
  catch(e){
    var ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try{ ok = document.execCommand("copy"); }catch(_){}
    document.body.removeChild(ta); return ok;
  }
};

/* ボタンに「コピー → コピーしました」の挙動を付ける */
DA.bindCopy = function(btn, getText, labelDone){
  btn.addEventListener("click", async function(){
    var base = btn.dataset.base || btn.textContent;
    btn.dataset.base = base;
    var ok = await DA.copyText(getText());
    btn.textContent = ok ? (labelDone || "コピーしました") : "手動で選択してください";
    btn.classList.toggle("done", ok);
    setTimeout(function(){ btn.textContent = base; btn.classList.remove("done"); }, 2000);
  });
};

DA.download = function(filename, text, mime){
  var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
};

DA.safeName = function(s){
  return String(s || "untitled").replace(/[\\\/:*?"<>|\s]+/g, "_").slice(0, 60);
};

/* ---------- ナビ ---------- */
var PAGES = [
  { href:"index.html",   key:"index",   label:"記録" },
  { href:"compose.html", key:"compose", label:"討論をつくる" },
  { href:"import.html",  key:"import",  label:"取り込む" }
];

DA.mountNav = function(active){
  var nav = DA.el("nav");
  var inner = DA.el("div.nav-in");
  var mark = DA.el("a.mark", { href:"index.html" });
  var dots = DA.el("span.dots");
  for(var i=0;i<4;i++) dots.appendChild(DA.el("i"));
  mark.appendChild(dots);
  mark.appendChild(document.createTextNode("討論卓"));
  var links = DA.el("div.nav-links");
  PAGES.forEach(function(p){
    var a = DA.el("a", { href:p.href, text:p.label });
    if(p.key === active) a.setAttribute("aria-current","page");
    links.appendChild(a);
  });

  /* テーマ切り替え */
  var ico = DA.el("span.ico"), lbl = DA.el("span.lbl");
  var tbtn = DA.el("button.theme-btn", { type:"button" }, [ ico, lbl ]);
  function paint(){
    var s = DA.theme.state();
    ico.textContent = s.ico;
    lbl.textContent = s.lbl;
    tbtn.title = "表示テーマ：" + s.lbl + "（クリックで切り替え）";
    tbtn.setAttribute("aria-label", "表示テーマを切り替える。現在：" + s.lbl);
  }
  paint();
  tbtn.addEventListener("click", function(){ DA.theme.next(); paint(); });
  document.addEventListener("da:theme", paint);

  var right = DA.el("div.nav-right", null, [ links, tbtn ]);
  inner.appendChild(mark); inner.appendChild(right);
  nav.appendChild(inner);
  nav.appendChild(DA.el("div", { id:"bar" }));
  document.body.insertBefore(nav, document.body.firstChild);
};

/* ---------- スクロール演出 ---------- */
DA.initReveal = function(){
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold:.08, rootMargin:"0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });
  return io;
};

DA.initBar = function(){
  var bar = DA.$("bar");
  if(!bar) return;
  var ticking = false;
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();
};

DA.boot = function(active){
  DA.mountNav(active);
  DA.initBar();
  DA.initReveal();
};

/* ---------- 通知 ---------- */
DA.notice = function(host, kind, html){
  host.innerHTML = "";
  if(!html) return;
  host.appendChild(DA.el("div.notice." + kind, { html: html }));
};

/* ---------- ポップオーバー ---------- */
DA.popover = (function(){
  var node = null;
  function ensure(){
    if(node) return node;
    node = DA.el("div.pop");
    var x = DA.el("button.x", { type:"button", "aria-label":"閉じる", text:"×" });
    x.addEventListener("click", hide);
    node.appendChild(x);
    node.appendChild(DA.el("div", { id:"pop-body" }));
    document.body.appendChild(node);
    document.addEventListener("click", function(e){
      if(node.classList.contains("on") && !node.contains(e.target) && !e.target.closest("[data-pop]")) hide();
    });
    document.addEventListener("keydown", function(e){ if(e.key === "Escape") hide(); });
    return node;
  }
  function show(anchor, contentNode){
    var n = ensure();
    var body = DA.$("pop-body");
    body.innerHTML = "";
    body.appendChild(contentNode);
    n.classList.add("on");
    var r = anchor.getBoundingClientRect();
    var w = n.offsetWidth, h = n.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width/2 - w/2), window.innerWidth - w - 8);
    var top = r.top - h - 10;
    if(top < 8) top = r.bottom + 10;
    n.style.left = left + "px";
    n.style.top = top + "px";
  }
  function hide(){ if(node) node.classList.remove("on"); }
  return { show: show, hide: hide };
})();
})();
