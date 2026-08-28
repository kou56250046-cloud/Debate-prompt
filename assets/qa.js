/* 討論卓 — 想定問答集（会議に持ち込む1枚）
   renderQA : 論点ごとにカード表示（印刷・スマホ対応）
   qaMarkdown / recordMarkdown : Markdown 書き出し */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

function groupByIssue(rec){
  var byId = {};
  rec.issues.forEach(function(i){ byId[i.id] = i; });

  var groups = [], seen = {};
  rec.issues.slice().sort(function(a,b){ return b.importance - a.importance; }).forEach(function(iss){
    var list = rec.objections.filter(function(o){ return o.issue === iss.id; });
    if(list.length){ groups.push({ issue: iss, items: list }); seen[iss.id] = true; }
  });
  var rest = rec.objections.filter(function(o){ return !o.issue || !byId[o.issue]; });
  if(rest.length) groups.push({ issue: null, items: rest });
  return groups;
}
DA.qaGroups = groupByIssue;

DA.renderQA = function(host, rec){
  host.innerHTML = "";
  var groups = groupByIssue(rec);
  if(!groups.length){
    host.appendChild(DA.el("div.empty", null, [
      DA.el("h3", { text:"想定問答がまだありません" }),
      DA.el("p", { text:"構造化プロンプトの objections が空だった可能性があります。取り込み画面で PART 2 をもう一度出させると埋まります。" })
    ]));
    return;
  }

  groups.forEach(function(g){
    var head = DA.el("h3", null, [
      document.createTextNode(g.issue ? g.issue.label : "その他")
    ]);
    if(g.issue){
      var cls = g.issue.status === "対立" ? "b-conflict" : (g.issue.status === "合意" ? "b-agree" : "b-hold");
      head.appendChild(DA.el("span.badge." + cls, { text: g.issue.status }));
      head.appendChild(DA.el("span.badge", { text:"重要度 " + g.issue.importance }));
    }

    var cards = DA.el("div.qa-cards");
    g.items.forEach(function(o){
      var dl = DA.el("dl");
      function row(k, v, muted){
        if(!v) return;
        dl.appendChild(DA.el("div", null, [
          DA.el("dt", { text:k }),
          DA.el("dd" + (muted ? ".muted" : ""), { text:v })
        ]));
      }
      row("こちらの返し", o.counter);
      row("根拠にできること", o.evidence, true);
      row("無視して進めた場合", o.risk_if_ignored, true);

      var voice = DA.el("div.v");
      if(o.from) voice.appendChild(DA.el("span.from", { text: o.from }));
      voice.appendChild(document.createTextNode("「" + o.voice + "」"));

      cards.appendChild(DA.el("div.qa-card", null, [ voice, dl ]));
    });

    host.appendChild(DA.el("div.qa-group", null, [
      head,
      g.issue && g.issue.question ? DA.el("p.q", { text: g.issue.question }) : null,
      cards
    ]));
  });
};

/* ---------- Markdown ---------- */
function line(s){ return String(s || "").replace(/\n+/g, " ").trim(); }

DA.qaMarkdown = function(rec){
  var out = [];
  out.push("# 想定問答集 — " + rec.meta.title);
  out.push("");
  if(rec._input && rec._input.topic) out.push("**議題**：" + line(rec._input.topic));
  out.push("**カテゴリ**：" + rec.meta.category + "　**日付**：" + rec.meta.date);
  if(rec.summary.recommendation) out.push("**討論の結論**：" + line(rec.summary.recommendation));
  out.push("");

  groupByIssue(rec).forEach(function(g){
    var t = g.issue ? (g.issue.label + "（" + g.issue.status + "・重要度" + g.issue.importance + "）") : "その他";
    out.push("## " + t);
    if(g.issue && g.issue.question) out.push("> " + line(g.issue.question));
    out.push("");
    g.items.forEach(function(o){
      out.push("### 「" + line(o.voice) + "」" + (o.from ? "　— " + line(o.from) : ""));
      if(o.counter)         out.push("- **返し**：" + line(o.counter));
      if(o.evidence)        out.push("- **根拠**：" + line(o.evidence));
      if(o.risk_if_ignored) out.push("- **無視した場合**：" + line(o.risk_if_ignored));
      out.push("");
    });
  });
  return out.join("\n");
};

DA.recordMarkdown = function(rec){
  var out = [];
  out.push("---");
  out.push("title: " + JSON.stringify(rec.meta.title));
  out.push("date: " + rec.meta.date);
  out.push("category: " + JSON.stringify(rec.meta.category));
  out.push("tags: [" + rec.meta.tags.map(function(t){ return JSON.stringify(t); }).join(", ") + "]");
  out.push("---");
  out.push("");
  out.push("# " + rec.meta.title);
  out.push("");
  if(rec._input && rec._input.topic){ out.push("**議題**：" + line(rec._input.topic)); out.push(""); }

  out.push("## 参加者");
  rec.meta.seats.forEach(function(s){
    out.push("- **" + s.name + "**" + (s.stance ? "：" + line(s.stance) : "") +
             (s.premise ? "　（前提：" + line(s.premise) + "）" : ""));
  });
  out.push("");

  out.push("## 論点");
  rec.issues.slice().sort(function(a,b){ return b.importance - a.importance; }).forEach(function(i){
    out.push("### " + i.label + "　`" + i.status + "` 重要度" + i.importance);
    if(i.question) out.push("> " + line(i.question));
    i.positions.forEach(function(p){
      out.push("- " + DA.seatName(rec, p.seat) + "（" + p.side + "／強さ" + p.strength + "）：" +
               line(p.claim) + (p.grounds ? "　根拠：" + line(p.grounds) : ""));
    });
    if(i.resolution) out.push("- **到達点**：" + line(i.resolution));
    if(i.unresolved) out.push("- **未解決**：" + line(i.unresolved));
    out.push("");
  });

  if((rec._sessions || []).length){
    out.push("## 続きの議論");
    rec._sessions.forEach(function(s){
      out.push("- **続き#" + s.no + "**（" + s.date + "／" + s.kindLabel + "／ROUND " +
               s.roundFrom + "〜" + (s.roundFrom + s.rounds - 1) + "）" + line(s.focus) +
               (s.verdict ? "　到達点：" + line(s.verdict) : ""));
    });
    out.push("");
  }

  if(rec.risks.length){
    out.push("## リスク");
    rec.risks.forEach(function(r){
      out.push("- " + line(r.text) + "（起こりやすさ" + r.likelihood + "／影響" + r.impact + "）" +
               (r.mitigation ? "　対策：" + line(r.mitigation) : ""));
    });
    out.push("");
  }
  if(rec.ideas.length){
    out.push("## アイデア");
    rec.ideas.forEach(function(i){
      out.push("- " + line(i.text) + "（効果" + i.impact + "／労力" + i.effort + "）");
    });
    out.push("");
  }
  if(rec.decisions.length){
    out.push("## 決定事項");
    rec.decisions.forEach(function(d){
      out.push("- " + line(d.text) + (d.rationale ? "　理由：" + line(d.rationale) : "") + "（確度" + d.confidence + "）");
    });
    out.push("");
  }
  if(rec.tasks.length){
    out.push("## タスク");
    rec.tasks.forEach(function(t){
      out.push("- [" + (t.done ? "x" : " ") + "] " + line(t.text) +
               (t.owner ? "　@" + line(t.owner) : "") + (t.due ? "　期限:" + line(t.due) : ""));
    });
    out.push("");
  }

  out.push("## 総括");
  if(rec.summary.recommendation) out.push("**推奨案**：" + line(rec.summary.recommendation));
  if(rec.summary.reasons.length){
    out.push("");
    out.push("理由：");
    rec.summary.reasons.forEach(function(r){ out.push("- " + line(r)); });
  }
  if(rec.summary.tradeoffs.length){
    out.push("");
    out.push("トレードオフ：");
    rec.summary.tradeoffs.forEach(function(t){ out.push("- 得る：" + line(t.gain) + " ／ 失う：" + line(t.loss)); });
  }
  if(rec.summary.blindspots.length){
    out.push("");
    out.push("見落とされていた視点：");
    rec.summary.blindspots.forEach(function(b){ out.push("- " + line(b)); });
  }
  if(rec.summary.next_questions.length){
    out.push("");
    out.push("次に考えるべき問い：");
    rec.summary.next_questions.forEach(function(q){ out.push("- " + line(q)); });
  }
  out.push("");
  out.push(DA.qaMarkdown(rec).replace(/^# /, "## ").replace(/\n## /g, "\n### ").replace(/\n### 「/g, "\n#### 「"));
  return out.join("\n");
};
})();
