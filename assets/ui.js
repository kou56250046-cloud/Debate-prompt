/* 討論卓 — 共通UI部品（ナビ・アニメーション・コピー・DOMヘルパー） */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

DA.$  = function(id){ return document.getElementById(id); };
DA.qs = function(sel, root){ return (root || document).querySelector(sel); };

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
  inner.appendChild(mark); inner.appendChild(links);
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
