/* 討論卓 — localStorage 保存層
   本体は debate-app:rec:<id> に個別保存、一覧は軽量インデックスを別キーで持つ。
   ブラウザのサイトデータ削除で消えるため、エクスポートを常に案内すること。 */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

var P = "debate-app:";
var K_INDEX = P + "index";
var K_DRAFT = P + "draft";
var K_FLAGS = P + "flags";
var K_REC   = P + "rec:";

function read(key, def){
  try{
    var s = localStorage.getItem(key);
    return s ? JSON.parse(s) : def;
  }catch(e){ return def; }
}
function write(key, val){
  try{
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  }catch(e){
    if(e && (e.name === "QuotaExceededError" || e.code === 22)){
      throw new Error("ブラウザの保存容量がいっぱいです。ダッシュボードから JSON をエクスポートし、古い記録を削除してください。");
    }
    throw new Error("保存できませんでした：" + (e && e.message ? e.message : e));
  }
}

var Store = DA.store = {

  /* ---------- 一覧 ---------- */
  list: function(){
    var idx = read(K_INDEX, []);
    if(!Array.isArray(idx)) idx = [];
    return idx.slice().sort(function(a,b){
      return String(b.date || "").localeCompare(String(a.date || "")) ||
             String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  },

  entry: function(rec){
    var s = DA.stat(rec);
    return {
      id: rec._id, title: rec.meta.title, category: rec.meta.category,
      date: rec.meta.date, tags: rec.meta.tags.slice(),
      topic: (rec._input && rec._input.topic) || "",
      updatedAt: rec._updatedAt,
      issues: s.issues, conflicts: s.conflicts, objections: s.objections,
      tasksOpen: s.tasksOpen, tasksAll: s.tasksAll
    };
  },

  /* ---------- 単体 ---------- */
  get: function(id){
    var raw = read(K_REC + id, null);
    return raw ? DA.normalize(raw) : null;
  },

  save: function(rec){
    rec._updatedAt = new Date().toISOString();
    write(K_REC + rec._id, rec);
    var idx = read(K_INDEX, []);
    if(!Array.isArray(idx)) idx = [];
    var e = Store.entry(rec), found = false;
    for(var i=0;i<idx.length;i++){
      if(idx[i].id === rec._id){ idx[i] = e; found = true; break; }
    }
    if(!found) idx.push(e);
    write(K_INDEX, idx);
    return rec;
  },

  remove: function(id){
    try{ localStorage.removeItem(K_REC + id); }catch(e){}
    var idx = read(K_INDEX, []).filter(function(e){ return e.id !== id; });
    write(K_INDEX, idx);
  },

  /* ---------- 一括 ---------- */
  all: function(){
    return Store.list().map(function(e){ return Store.get(e.id); }).filter(Boolean);
  },

  exportAll: function(){
    return JSON.stringify({
      app: "討論卓", schema: DA.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      records: Store.all()
    }, null, 2);
  },

  /* mode: "merge"（同IDは上書き・他は残す） | "replace"（全消去してから） */
  importAll: function(text, mode){
    var data = DA.repairJson(text);
    var recs = Array.isArray(data) ? data : (data.records || (data.schema ? [data] : null));
    if(!recs || !recs.length) throw new Error("記録が1件も含まれていません。");
    if(mode === "replace") Store.clearAll();
    var n = 0;
    recs.forEach(function(r){
      var rec = DA.normalize(r);
      if(!r._id) rec._id = DA.newId();
      Store.save(rec); n++;
    });
    return n;
  },

  clearAll: function(){
    Store.list().forEach(function(e){
      try{ localStorage.removeItem(K_REC + e.id); }catch(err){}
    });
    write(K_INDEX, []);
  },

  /* ---------- compose の下書き（import へ引き継ぐ） ---------- */
  saveDraft: function(d){ try{ write(K_DRAFT, d); }catch(e){} },
  loadDraft: function(){
    return read(K_DRAFT, { catLabel:"", rounds:3, toneIdx:2,
      input:{ topic:"", goal:"", context:"", limit:"", data:"" } });
  },

  /* ---------- フラグ（初回案内など） ---------- */
  flag: function(name, val){
    var f = read(K_FLAGS, {});
    if(val === undefined) return !!f[name];
    f[name] = val; write(K_FLAGS, f); return val;
  },

  /* ---------- 使用容量の目安 ---------- */
  usage: function(){
    var bytes = 0;
    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.indexOf(P) === 0) bytes += k.length + (localStorage.getItem(k) || "").length;
      }
    }catch(e){}
    return { bytes: bytes * 2, kb: Math.round(bytes * 2 / 1024) };
  }
};
})();
