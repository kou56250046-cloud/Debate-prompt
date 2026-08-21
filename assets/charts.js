/* 討論卓 — 可視化（依存ゼロ。SVG と CSS Grid を手書き）
   ① renderStanceMatrix : 論点 × 論者マトリクス
   ② renderFlowDiagram  : 議論フロー図（誰が誰の何を攻撃したか）
   ③ renderQuadrant     : 3×3 マトリクス（リスク／アイデア） */
(function(){
"use strict";
var DA = window.DA = window.DA || {};
var SVGNS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs){
  var n = document.createElementNS(SVGNS, tag);
  if(attrs) for(var k in attrs){
    if(Object.prototype.hasOwnProperty.call(attrs,k) && attrs[k] !== null && attrs[k] !== undefined)
      n.setAttribute(k, attrs[k]);
  }
  return n;
}
function svgText(x, y, str, attrs){
  var t = svgEl("text", Object.assign({ x:x, y:y }, attrs || {}));
  t.textContent = str;
  return t;
}
function hexA(hex, a){
  var h = String(hex).trim().replace("#","");
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  if(isNaN(r) || isNaN(g) || isNaN(b)) return String(hex);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}
/* テーマ変更に追従させるため、描画のたびに CSS 変数を読み直す */
function tok(name, fb){ return DA.cssVar(name, fb); }
function trunc(s, n){
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function seatName(rec, n){
  var s = (rec.meta.seats || [])[n-1];
  return (s && s.name) || ("SEAT " + String(n).padStart(2,"0"));
}
DA.seatName = seatName;

/* ==========================================================
   ① 論点 × 論者マトリクス
   ========================================================== */
var SIDE_STYLE = {
  "賛成":     { mark:"賛", fill:true  },
  "反対":     { mark:"反", fill:false },
  "条件付き": { mark:"条", half:true  },
  "中立":     { mark:"中", soft:true  }
};

DA.renderStanceMatrix = function(host, rec){
  host.innerHTML = "";
  if(!rec.issues.length){
    host.appendChild(DA.el("div.empty", null, [DA.el("p", { text:"論点が記録されていません。" })]));
    return;
  }

  var wrap = DA.el("div.matrix");
  var grid = DA.el("div.mx");
  grid.style.gridTemplateColumns = "minmax(210px,1.7fr) repeat(4,minmax(72px,1fr)) 92px";

  /* ヘッダ */
  grid.appendChild(DA.el("div.mx-cell.mx-head", { style:"text-align:left;justify-content:flex-start", text:"論点" }));
  for(var s=1; s<=4; s++){
    grid.appendChild(DA.el("div.mx-cell.mx-head.s" + s, { text: trunc(seatName(rec, s), 8) }));
  }
  grid.appendChild(DA.el("div.mx-cell.mx-head", { text:"状態" }));

  /* 行 */
  var issues = rec.issues.slice().sort(function(a,b){ return b.importance - a.importance; });
  issues.forEach(function(iss){
    var imp = DA.el("div.imp");
    for(var k=1; k<=5; k++) imp.appendChild(DA.el("i" + (k <= iss.importance ? ".on" : "")));

    var cell = DA.el("div.mx-cell.mx-issue", null, [
      DA.el("div.lb", { text: iss.label }),
      iss.question ? DA.el("div.qs", { text: trunc(iss.question, 44) }) : null,
      imp
    ]);
    cell.title = iss.question || iss.label;
    grid.appendChild(cell);

    for(var n=1; n<=4; n++){
      grid.appendChild(stanceCell(rec, iss, n));
    }

    var cls = iss.status === "対立" ? "b-conflict" : (iss.status === "合意" ? "b-agree" : "b-hold");
    var st = DA.el("div.mx-cell.mx-status", null, [ DA.el("span.badge." + cls, { text: iss.status }) ]);
    if(iss.unresolved) st.title = "未解決：" + iss.unresolved;
    grid.appendChild(st);
  });

  wrap.appendChild(grid);
  host.appendChild(wrap);

  /* 凡例 */
  var lg = DA.el("div.mx-legend");
  [["賛成","賛",1],["反対","反",0],["条件付き","条",2],["中立","中",3]].forEach(function(p){
    var b = DA.el("b");
    var style = SIDE_STYLE[p[0]];
    applyDotStyle(b, style, tok("--ink-3"), 1);
    b.style.width = "16px"; b.style.height = "16px"; b.style.fontSize = "9px";
    b.textContent = p[1];
    b.style.display = "flex"; b.style.alignItems = "center"; b.style.justifyContent = "center";
    lg.appendChild(DA.el("span", null, [ b, document.createTextNode(p[0]) ]));
  });
  lg.appendChild(DA.el("span", { text:"丸の濃さ＝論の強さ／左の点＝重要度" }));
  host.appendChild(lg);
};

function applyDotStyle(node, style, hex, strength){
  var a = 0.45 + (strength || 3) * 0.11;  // 0.56 〜 1.0
  if(style.fill){
    node.style.background = hexA(hex, a);
    node.style.color = a >= 0.7 ? tok("--on-accent") : tok("--ink");
    node.style.borderColor = "transparent";
  }else if(style.half){
    node.style.background = "linear-gradient(90deg," + hexA(hex, a) + " 50%," + tok("--card") + " 50%)";
    node.style.borderColor = hex;
    node.style.color = tok("--ink");
  }else if(style.soft){
    node.style.background = tok("--soft-bg");
    node.style.color = tok("--ink-3");
    node.style.borderColor = "transparent";
  }else{
    node.style.background = tok("--card");
    node.style.borderColor = hex;
    node.style.color = tok("--ink");
  }
}

function stanceCell(rec, iss, seat){
  var pos = null;
  for(var i=0;i<iss.positions.length;i++){
    if(iss.positions[i].seat === seat){ pos = iss.positions[i]; break; }
  }
  var cell = DA.el("div.mx-cell");
  if(!pos){
    cell.appendChild(DA.el("span.mx-dot.none", { title:"この論点に触れていません" }));
    return cell;
  }
  var hex = DA.seatHex(seat);
  var style = SIDE_STYLE[pos.side] || SIDE_STYLE["中立"];
  var dot = DA.el("button.mx-dot", {
    type:"button", "data-pop":"1",
    "aria-label": seatName(rec, seat) + "：" + pos.side + " " + pos.claim,
    text: style.mark
  });
  applyDotStyle(dot, style, hex, pos.strength);
  dot.addEventListener("click", function(e){
    e.stopPropagation();
    var body = DA.el("div", null, [
      DA.el("div.who", { style:"color:" + hex, text: seatName(rec, seat) + " ／ " + pos.side + " ／ 強さ " + pos.strength }),
      DA.el("div.cl", { text: pos.claim || "（主張の記載なし）" }),
      pos.grounds ? DA.el("div.gr", { text:"根拠：" + pos.grounds }) : null
    ]);
    DA.popover.show(dot, body);
  });
  cell.appendChild(dot);
  return cell;
}

/* ==========================================================
   ② 議論フロー図
   ========================================================== */
DA.renderFlowDiagram = function(host, rec, filterIssue){
  host.innerHTML = "";
  var moves = rec.moves.slice();
  if(!moves.length){
    host.appendChild(DA.el("div.empty", null, [DA.el("p", { text:"発言（moves）が記録されていません。" })]));
    return;
  }

  var maxRound = 1;
  moves.forEach(function(m){ if(m.round > maxRound) maxRound = m.round; });

  /* 各ラウンドで同じレーンに何個入るか → 列幅 */
  var counts = {};   // counts[round][seat] = n
  moves.forEach(function(m){
    counts[m.round] = counts[m.round] || {};
    counts[m.round][m.seat] = (counts[m.round][m.seat] || 0) + 1;
  });

  var LABEL_W = 116, PAD = 14, NODE_W = 156, NODE_H = 46, GAP_X = 10, LANE_H = 74, TOP = 44;
  var colX = [], colW = [];
  var x = LABEL_W;
  for(var r=1; r<=maxRound; r++){
    var maxN = 1;
    for(var s=1; s<=4; s++){
      var c = (counts[r] && counts[r][s]) || 0;
      if(c > maxN) maxN = c;
    }
    var w = PAD*2 + maxN*NODE_W + (maxN-1)*GAP_X;
    colX.push(x); colW.push(w); x += w;
  }
  var W = x + 8, H = TOP + LANE_H*4 + 16;

  var svg = svgEl("svg", { viewBox:"0 0 " + W + " " + H, width:W, height:H,
                           role:"img", "aria-label":"議論のフロー図" });

  /* 矢印マーカー */
  var defs = svgEl("defs");
  [["arw",tok("--line-strong")],["arw-a",tok("--danger")]].forEach(function(p){
    var mk = svgEl("marker", { id:p[0], viewBox:"0 0 10 10", refX:"9", refY:"5",
      markerWidth:"6", markerHeight:"6", orient:"auto-start-reverse" });
    mk.appendChild(svgEl("path", { d:"M0,0 L10,5 L0,10 z", fill:p[1], opacity: p[0]==="arw-a" ? ".6" : ".8" }));
    defs.appendChild(mk);
  });
  svg.appendChild(defs);

  /* レーン */
  for(var s2=1; s2<=4; s2++){
    var ly = TOP + (s2-1)*LANE_H;
    svg.appendChild(svgEl("rect", { x:0, y:ly, width:W, height:LANE_H-6, rx:8,
      class: "fl-lane " + (s2 % 2 ? "a" : "b") }));
    svg.appendChild(svgEl("rect", { x:0, y:ly, width:4, height:LANE_H-6, rx:2, fill:DA.seatHex(s2) }));
    var nm = svgText(14, ly + LANE_H/2 - 2, trunc(seatName(rec, s2), 7),
      { class:"fl-lane-name", fill:DA.seatHex(s2) });
    svg.appendChild(nm);
  }

  /* ラウンド見出し */
  for(var r2=0; r2<maxRound; r2++){
    svg.appendChild(svgText(colX[r2] + PAD, 24, "ROUND " + (r2+1), { class:"fl-round" }));
    if(r2 > 0){
      svg.appendChild(svgEl("line", { x1:colX[r2], y1:TOP-14, x2:colX[r2], y2:H-10, class:"fl-rline" }));
    }
  }

  /* ノード配置 */
  var seen = {}, posOf = {};
  moves.forEach(function(m){
    var key = m.round + ":" + m.seat;
    var i = seen[key] = (seen[key] === undefined ? 0 : seen[key] + 1);
    var cx = colX[m.round-1] + PAD + i*(NODE_W + GAP_X);
    var cy = TOP + (m.seat-1)*LANE_H + (LANE_H-6-NODE_H)/2;
    posOf[m.id] = { x:cx, y:cy, w:NODE_W, h:NODE_H, m:m };
  });

  /* 矢印（攻撃：後の発言 → 先の発言） */
  var gArrows = svgEl("g");
  moves.forEach(function(m){
    (m.targets || []).forEach(function(tid){
      var a = posOf[m.id], b = posOf[tid];
      if(!a || !b) return;
      var x1 = a.x, y1 = a.y + a.h/2;
      var x2 = b.x + b.w, y2 = b.y + b.h/2;
      if(x2 > x1){ x1 = a.x + a.w; x2 = b.x; }   // 対象が右にある場合
      var dx = Math.max(30, Math.abs(x1-x2) * 0.45);
      var d = "M" + x1 + "," + y1 + " C" + (x1 - dx) + "," + y1 + " " + (x2 + dx) + "," + y2 + " " + x2 + "," + y2;
      var attack = m.type === "反論" || m.type === "転換";
      var p = svgEl("path", { d:d, class:"fl-arrow" + (attack ? " attack" : ""),
        "marker-end":"url(#" + (attack ? "arw-a" : "arw") + ")",
        "data-from":m.id, "data-to":tid });
      gArrows.appendChild(p);
    });
  });
  svg.appendChild(gArrows);

  /* ノード描画 */
  var SHAPE = { "反論":"diamond", "データ提示":"round", "譲歩":"soft", "転換":"diamond" };
  moves.forEach(function(m){
    var p = posOf[m.id];
    var hex = DA.seatHex(m.seat);
    var g = svgEl("g", { class:"fl-node", "data-id":m.id, "data-issue":m.issue || "" });

    var shape = SHAPE[m.type] || "rect";
    var soft = (m.type === "譲歩");
    var rect = svgEl("rect", {
      x:p.x, y:p.y, width:p.w, height:p.h,
      rx: shape === "round" ? p.h/2 : 9,
      fill: soft ? hexA(hex, .18) : hexA(hex, .92),
      stroke: hex, "stroke-width": m.label ? 2 : 1,
      "stroke-dasharray": m.type === "反論" ? "5 3" : null
    });
    g.appendChild(rect);

    var tcol = soft ? hex : tok("--on-accent");
    var head = m.type + (m.label ? " 【" + m.label + "】" : "");
    g.appendChild(svgText(p.x + 10, p.y + 17, trunc(head, 12),
      { fill:tcol, "font-size":"10", "font-weight":"700", opacity:".85" }));
    g.appendChild(svgText(p.x + 10, p.y + 33, trunc(m.summary || m.id, 12),
      { fill:tcol, "font-size":"11", "font-weight":"700" }));

    g.addEventListener("click", function(e){
      e.stopPropagation();
      var anchor = { getBoundingClientRect: function(){ return rect.getBoundingClientRect(); } };
      var body = DA.el("div", null, [
        DA.el("div.who", { style:"color:" + hex,
          text: "ROUND " + m.round + " ／ " + seatName(rec, m.seat) + " ／ " + m.type + (m.label ? " 【" + m.label + "】" : "") }),
        DA.el("div.cl", { text: m.summary || "（要点の記載なし）" }),
        m.issue ? DA.el("div.gr", { text:"論点：" + issueLabel(rec, m.issue) }) : null,
        (m.targets && m.targets.length) ? DA.el("div.gr", {
          text:"攻撃対象：" + m.targets.map(function(t){
            var tm = posOf[t]; return tm ? (seatName(rec, tm.m.seat) + " の " + trunc(tm.m.summary, 14)) : t;
          }).join(" / ")
        }) : null
      ]);
      DA.popover.show(anchor, body);
    });
    var ttl = svgEl("title");
    ttl.textContent = seatName(rec, m.seat) + "：" + (m.summary || "");
    g.appendChild(ttl);
    svg.appendChild(g);
  });

  var box = DA.el("div.flowbox");
  box.appendChild(svg);
  host.appendChild(box);

  /* 論点フィルタ */
  if(filterIssue){
    applyFilter(svg, filterIssue);
  }
  host.__applyFilter = function(issueId){ applyFilter(svg, issueId); };
};

function applyFilter(svg, issueId){
  var nodes = svg.querySelectorAll(".fl-node");
  var live = {};
  nodes.forEach(function(n){
    var on = !issueId || n.getAttribute("data-issue") === issueId;
    n.classList.toggle("fl-dim", !on);
    if(on) live[n.getAttribute("data-id")] = true;
  });
  svg.querySelectorAll(".fl-arrow").forEach(function(a){
    var on = !issueId || (live[a.getAttribute("data-from")] && live[a.getAttribute("data-to")]);
    a.classList.toggle("fl-dim", !on);
  });
}

function issueLabel(rec, id){
  for(var i=0;i<rec.issues.length;i++){ if(rec.issues[i].id === id) return rec.issues[i].label; }
  return id;
}
DA.issueLabel = issueLabel;

/* ==========================================================
   ③ 3×3 マトリクス
   cfg = { items:[{text, x:"高|中|低", y:"高|中|低", note, seat}],
           xAxis, yAxis, accent, zones:{tr, tl, br, bl} }
   ========================================================== */
var LV = { "低":0, "中":1, "高":2 };

DA.renderQuadrant = function(host, cfg){
  host.innerHTML = "";
  var items = cfg.items || [];
  if(!items.length){
    host.appendChild(DA.el("p.qsub", { text: cfg.emptyText || "該当なし" }));
    return;
  }

  var W = 372, H = 284, L = 58, T = 28, R = 360, B = 248;
  var cw = (R - L) / 3, ch = (B - T) / 3;
  var svg = svgEl("svg", { viewBox:"0 0 " + W + " " + H, role:"img", "aria-label":cfg.aria || "" });

  /* セル背景（右上ほど濃く） */
  for(var xi=0; xi<3; xi++){
    for(var yi=0; yi<3; yi++){
      var heat = (xi + yi) / 4;
      svg.appendChild(svgEl("rect", {
        x: L + xi*cw, y: T + (2-yi)*ch, width:cw, height:ch,
        fill: hexA(cfg.accent, 0.04 + heat * 0.13)
      }));
    }
  }
  /* グリッド */
  for(var g=0; g<=3; g++){
    svg.appendChild(svgEl("line", { x1:L + g*cw, y1:T, x2:L + g*cw, y2:B, class:"qd-grid" }));
    svg.appendChild(svgEl("line", { x1:L, y1:T + g*ch, x2:R, y2:T + g*ch, class:"qd-grid" }));
  }
  /* 象限ラベル（点と重ならないよう、上側はプロット域の外に置く） */
  if(cfg.zones){
    if(cfg.zones.tr) svg.appendChild(svgText(R, T - 9, cfg.zones.tr,
      { class:"qd-zone", "text-anchor":"end", fill:cfg.accent, opacity:".8" }));
    if(cfg.zones.tl) svg.appendChild(svgText(L, T - 9, cfg.zones.tl,
      { class:"qd-zone", fill:cfg.accent, opacity:".8" }));
    if(cfg.zones.bl) svg.appendChild(svgText(L + 6, B - 7, cfg.zones.bl,
      { class:"qd-zone", fill:tok("--ink-3") }));
  }
  /* 軸 */
  ["低","中","高"].forEach(function(lab, i){
    svg.appendChild(svgText(L + cw*i + cw/2, B + 16, lab, { class:"qd-axis", "text-anchor":"middle" }));
    svg.appendChild(svgText(L - 8, T + ch*(2-i) + ch/2 + 4, lab, { class:"qd-axis", "text-anchor":"end" }));
  });
  svg.appendChild(svgText((L+R)/2, H - 4, cfg.xAxis + " →", { class:"qd-axis", "text-anchor":"middle" }));
  var yl = svgText(0, 0, cfg.yAxis + " →", { class:"qd-axis", "text-anchor":"middle" });
  yl.setAttribute("transform", "translate(15," + (T + (B-T)/2) + ") rotate(-90)");
  svg.appendChild(yl);

  /* 点（同一セルは自動オフセット） */
  var bucket = {};
  items.forEach(function(it, i){
    var xi = LV[it.x] !== undefined ? LV[it.x] : 1;
    var yi = LV[it.y] !== undefined ? LV[it.y] : 1;
    var key = xi + ":" + yi;
    var k = bucket[key] = (bucket[key] === undefined ? 0 : bucket[key] + 1);
    var perRow = 3;
    var ox = (k % perRow - 1) * 26;
    var oy = Math.floor(k / perRow) * 24 - 6;
    var cx = L + xi*cw + cw/2 + ox;
    var cy = T + (2-yi)*ch + ch/2 + oy;

    var g2 = svgEl("g", { class:"qd-pt" });
    g2.appendChild(svgEl("circle", { cx:cx, cy:cy, r:12, fill:cfg.accent,
      stroke:tok("--card"), "stroke-width":2 }));
    g2.appendChild(svgText(cx, cy + 3.5, String(i+1), { "text-anchor":"middle" }));
    var ttl = svgEl("title"); ttl.textContent = it.text; g2.appendChild(ttl);
    g2.addEventListener("click", function(e){
      e.stopPropagation();
      var anchor = { getBoundingClientRect: function(){ return g2.getBoundingClientRect(); } };
      DA.popover.show(anchor, DA.el("div", null, [
        DA.el("div.who", { style:"color:" + cfg.accent,
          text: cfg.xAxis + " " + it.x + " ／ " + cfg.yAxis + " " + it.y }),
        DA.el("div.cl", { text: it.text }),
        it.note ? DA.el("div.gr", { text: it.note }) : null,
        it.by ? DA.el("div.gr", { text:"提起：" + it.by }) : null
      ]));
    });
    svg.appendChild(g2);
  });

  host.appendChild(svg);

  /* 一覧 */
  var ul = DA.el("ul.qd-list");
  items.forEach(function(it, i){
    var num = DA.el("span.num", { style:"background:" + cfg.accent, text:String(i+1) });
    var body = DA.el("div", null, [
      document.createTextNode(it.text),
      it.note ? DA.el("small.mit", { text: it.note }) : null,
      it.by ? DA.el("small.mit", { text:"提起：" + it.by }) : null
    ]);
    ul.appendChild(DA.el("li", null, [ num, body ]));
  });
  host.appendChild(ul);
};
})();
