/* 討論卓 — 記録スキーマ debate-record/v1
   ChatGPT に出力させる形と、保存する形を一致させる。
   normalize() は欠損を埋め、validate() は落とさず警告を返す。 */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

DA.SCHEMA_VERSION = "debate-record/v1";
DA.FOLLOWUP_VERSION = "debate-followup/v1";

DA.SIDES   = ["賛成","反対","条件付き","中立"];
DA.STATUS  = ["対立","合意","保留"];
DA.MTYPES  = ["主張","反論","前提提示","データ提示","譲歩","転換"];
DA.LEVELS  = ["高","中","低"];
DA.LABELS  = ["撤回","修正","強化"];

/* ---------- ChatGPT に見せるスキーマ本文 ---------- */
DA.specMeta = function(mode){
  return [
  '  "schema": "debate-record/v1",',
  '  "meta": {',
  '    "title": "この回の短いタイトル（20字以内）",',
  '    "mode": "' + (mode || "debate") + '",           // debate | ideate | deep | academic | socratic | redteam | stakeholder（変更しない）',
  '    "category": "カテゴリ名", "rounds": 3, "tone": "トーン名", "date": "YYYY-MM-DD",',
  '    "tags": ["横断検索用のキーワードを2〜4個"],',
  '    "seats": [ { "seat": 1, "name": "論者名", "stance": "初期スタンス1行", "premise": "この論者が置いている前提" } ]',
  '  },'
  ].join("\n");
};
/* 互換：旧コードが参照していた定数 */
DA.SPEC_META = DA.specMeta("debate");

DA.SPEC_ISSUES = [
'  // 論点：実際に争われた争点・掘り下げた問い。5〜9個。importance の高い順に並べる',
'  "issues": [ {',
'    "id": "I1", "label": "短い論点名（15字以内）", "question": "何を論じたか（疑問形で1文）",',
'    "importance": 5,                       // 1〜5。議題の結論を左右する度合い',
'    "status": "対立",                      // 対立 | 合意 | 保留',
'    "positions": [ {',
'      "seat": 1, "side": "賛成",           // 賛成 | 反対 | 条件付き | 中立',
'      "claim": "その論者の主張1行", "grounds": "根拠", "strength": 4   // strength は1〜5（論の強さ）',
'    } ],',
'    "unresolved": "決着しなかった点（合意なら空文字）"',
'  } ],'
].join("\n");

DA.SPEC_MOVES = [
'  // 発言の骨格：誰がどのラウンドで何を言い、誰の何を攻撃したか',
'  "moves": [ {',
'    "id": "M01", "round": 1, "seat": 1, "issue": "I1",',
'    "type": "主張",                        // 主張 | 反論 | 前提提示 | データ提示 | 譲歩 | 転換',
'    "summary": "発言の要点を1〜2行で",',
'    "targets": [],                         // 反論なら攻撃対象の move id を入れる 例 ["M03"]',
'    "label": null                          // 撤回 | 修正 | 強化 | null',
'  } ],'
].join("\n");

DA.SPEC_REST = [
'  "risks": [ { "text": "リスク", "likelihood": "高", "impact": "高", "raised_by": 2, "mitigation": "対策案" } ],',
'  "ideas": [ { "text": "議論中に出た案", "impact": "高", "effort": "低", "raised_by": 4 } ],',
'  "decisions": [ { "text": "司会が下した判断・確定した事項", "rationale": "理由", "confidence": "中" } ],',
'  "tasks": [ { "text": "次にやるべきこと", "owner": "担当（不明なら空文字）", "due": "期限（不明なら空文字）", "blocked_by": "" } ],',
'  // 想定問答集：実際の会議で出そうな反対意見と、その返し',
'  "objections": [ {',
'    "issue": "I1",',
'    "voice": "会議で誰かが実際に言いそうな言い回しで書く",',
'    "from": "どんな立場の人が言うか（例：予算を握る人／現場の担当者）",',
'    "counter": "こちらの返し方", "evidence": "根拠にできる事実・数字",',
'    "risk_if_ignored": "この意見を無視して進めた場合に起きること"',
'  } ],',
'  "summary": {',
'    "recommendation": "司会の結論・推奨案（両論併記で逃げない）",',
'    "reasons": ["理由1","理由2"],',
'    "tradeoffs": [ { "gain": "得るもの", "loss": "失うもの" } ],',
'    "blindspots": ["議題を持ち込んだ本人が気づいていない可能性が高い視点"],',
'    "next_questions": ["次に考えるべき問い"]',
'  }'
].join("\n");

DA.specFull = function(mode){
  return "{\n" + DA.specMeta(mode) + "\n" + DA.SPEC_ISSUES + "\n" + DA.SPEC_MOVES + "\n" + DA.SPEC_REST + "\n}";
};
DA.specPart1 = function(mode){
  return "{\n" + DA.specMeta(mode) + "\n" + DA.SPEC_ISSUES + "\n" + DA.SPEC_MOVES.replace(/,$/,"") + "\n}";
};
DA.specPart2 = function(){
  return "{\n" + DA.SPEC_REST + "\n}";
};

/* ---------- 続き（追記用）のスキーマ debate-followup/v1 ---------- */
/* kind: debate | ideate | deep | academic | socratic | redteam | stakeholder ／ rounds: 今回のラウンド数 ／ issues: 今回扱った論点 */
DA.specFollowup = function(kind, rounds, issues){
  var ids = (issues || []).map(function(i){ return i.id; });
  var ex = ids[0] || "I1";
  var n = rounds || 2;
  return [
  '{',
  '  "schema": "debate-followup/v1",',
  '  "session": {',
  '    "kind": "' + (kind || "debate") + '",        // 今回のモード（変更しない）',
  '    "rounds": ' + n + ', "date": "' + DA.today() + '",',
  '    "focus": "今回詰め直した項目を一言で",',
  '    "verdict": "今回の到達点を2〜3行で。決着したこと／しなかったことを書く"',
  '  },',
  '  // 既存の論点の更新。今回動いた論点だけを入れる',
  '  "issue_updates": [ {',
  '    "id": "' + ex + '",',
  '    "status": "合意",                      // 対立 | 合意 | 保留（今回の結果）',
  '    "resolution": "今回どう決着したか（決着していなければ空文字）",',
  '    "unresolved": "まだ残っている点（無ければ空文字）",',
  '    // 今回立場が変わった論者だけを入れる。変わっていない論者は書かない',
  '    "positions": [ { "seat": 1, "side": "条件付き", "claim": "更新後の主張1行", "grounds": "根拠", "strength": 4 } ]',
  '  } ],',
  '  // 今回新しく生まれた論点。無ければ []',
  '  "new_issues": [ {',
  '    "id": "N1", "label": "短い論点名（15字以内）", "question": "何を論じたか（疑問形で1文）",',
  '    "importance": 4, "status": "保留",',
  '    "positions": [ { "seat": 2, "side": "反対", "claim": "主張1行", "grounds": "根拠", "strength": 3 } ],',
  '    "unresolved": "決着しなかった点"',
  '  } ],',
  '  // 今回の発言。round は 1〜' + n + '（前回からの通算にしない）',
  '  "moves": [ {',
  '    "id": "F01", "round": 1, "seat": 1, "issue": "' + ex + '",',
  '    "type": "主張",                        // 主張 | 反論 | 前提提示 | データ提示 | 譲歩 | 転換',
  '    "summary": "発言の要点を1〜2行で",',
  '    "targets": [],                         // 今回の議論で攻撃した相手の move id 例 ["F02"]',
  '    "label": null                          // 撤回 | 修正 | 強化 | null',
  '  } ],',
  '  // 以下はすべて「今回新しく出た分だけ」。無ければ []',
  '  "risks": [ { "text": "リスク", "likelihood": "高", "impact": "高", "raised_by": 2, "mitigation": "対策案" } ],',
  '  "ideas": [ { "text": "今回出た案", "impact": "高", "effort": "低", "raised_by": 4 } ],',
  '  "decisions": [ { "text": "今回確定した事項", "rationale": "理由", "confidence": "中" } ],',
  '  "tasks": [ { "text": "次にやるべきこと", "owner": "", "due": "", "blocked_by": "" } ],',
  '  "objections": [ {',
  '    "issue": "' + ex + '",',
  '    "voice": "会議で誰かが実際に言いそうな言い回し", "from": "どんな立場の人が言うか",',
  '    "counter": "こちらの返し方", "evidence": "根拠にできる事実・数字",',
  '    "risk_if_ignored": "無視して進めた場合に起きること"',
  '  } ],',
  '  "summary_update": {',
  '    "recommendation": "結論が変わった場合のみ新しい結論を書く。変わらなければ空文字",',
  '    "reasons": ["今回加わった理由だけ"],',
  '    "tradeoffs": [ { "gain": "得るもの", "loss": "失うもの" } ],',
  '    "blindspots": ["今回見えた見落とし"],',
  '    "next_questions": ["次に考えるべき問い"]',
  '  }',
  '}'
  ].join("\n");
};

/* ---------- JSON の崩れを直してから parse ---------- */
DA.repairJson = function(raw){
  if(!raw || !String(raw).trim()) throw new Error("何も貼り付けられていません。");
  var t = String(raw);

  // 1. コードフェンス除去
  t = t.replace(/```[a-zA-Z]*\s*/g, "").replace(/```/g, "");
  // 2. 全角の引用符・記号を半角へ
  t = t.replace(/[\u201C\u201D\u301D\u301E]/g, '"').replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/\uFF1A(?=\s*[\[{"])/g, ":");
  // 3. 前後の地の文を落とす（最初の { から最後の } まで）
  var s = t.indexOf("{"), e = t.lastIndexOf("}");
  if(s < 0 || e < 0 || e <= s) throw new Error("JSON が見つかりません。{ から } までが貼り付けられているか確認してください。");
  t = t.slice(s, e + 1);
  // 4. 行コメントを除去（文字列内の // は残す）
  t = t.replace(/^\s*\/\/.*$/gm, "");
  t = t.replace(/([^:"'\\])\/\/[^\n"]*$/gm, "$1");
  // 5. 末尾カンマ除去
  t = t.replace(/,(\s*[}\]])/g, "$1");
  // 6. 制御文字
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  try{
    return JSON.parse(t);
  }catch(err){
    var m = /position (\d+)/.exec(err.message);
    var near = "";
    if(m){
      var p = parseInt(m[1],10);
      near = "\n該当箇所付近：… " + t.slice(Math.max(0,p-70), p+70).replace(/\s+/g," ") + " …";
    }
    throw new Error("JSON として読めませんでした（" + err.message + "）。" + near);
  }
};

/* ---------- 正規化 ---------- */
function str(v){ return v === null || v === undefined ? "" : String(v).trim(); }
function arr(v){ return Array.isArray(v) ? v : (v === null || v === undefined || v === "" ? [] : [v]); }
function int(v, def){ var n = parseInt(v,10); return isNaN(n) ? def : n; }
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
function pick(v, list, def){ var s = str(v); return list.indexOf(s) >= 0 ? s : def; }

var LEVEL_MAP = {"高":"高","中":"中","低":"低","high":"高","medium":"中","mid":"中","middle":"中","low":"低",
  "大":"高","小":"低","強":"高","弱":"低"};
function level(v, def){
  var s = str(v);
  if(LEVEL_MAP[s]) return LEVEL_MAP[s];
  if(LEVEL_MAP[s.toLowerCase()]) return LEVEL_MAP[s.toLowerCase()];
  var n = parseInt(s,10);
  if(!isNaN(n)) return n >= 4 ? "高" : (n === 3 ? "中" : "低");
  return def || "中";
}
DA.level = level;

var SIDE_MAP = {"賛成":"賛成","反対":"反対","条件付き":"条件付き","中立":"中立",
  "条件付":"条件付き","条件つき":"条件付き","賛成（条件付き）":"条件付き","保留":"中立","中間":"中立"};

DA.normalize = function(input, extra){
  var raw = input || {};
  var meta = raw.meta || {};
  extra = extra || {};

  var rec = {
    schema: DA.SCHEMA_VERSION,
    meta: {
      title: str(meta.title) || str(extra.title) || "無題の討論",
      mode: pick(meta.mode, ["debate","ideate","deep","academic","socratic","redteam","stakeholder"], pick(extra.mode, ["debate","ideate","deep","academic","socratic","redteam","stakeholder"], "debate")),
      category: str(meta.category) || str(extra.category),
      rounds: clamp(int(meta.rounds, int(extra.rounds, 3)), 1, 40),
      tone: str(meta.tone) || str(extra.tone),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(meta.date)) ? str(meta.date) : DA.today(),
      tags: arr(meta.tags).map(str).filter(Boolean),
      seats: []
    },
    issues: [], moves: [], risks: [], ideas: [],
    decisions: [], tasks: [], objections: [],
    summary: { recommendation:"", reasons:[], tradeoffs:[], blindspots:[], next_questions:[] }
  };

  // 席：JSON に無ければモード／カテゴリ定義から復元
  var seats = arr(meta.seats);
  if(!seats.length && DA.rolesOf){
    var cat = rec.meta.category && DA.findCat ? DA.findCat(rec.meta.category) : null;
    var roles = DA.rolesOf(rec.meta.mode, cat);
    if(roles) seats = roles.map(function(r,i){ return {seat:i+1, name:r[0], stance:"", premise:""}; });
  }
  rec.meta.seats = seats.slice(0,4).map(function(s, i){
    return { seat: clamp(int(s && s.seat, i+1), 1, 4), name: str(s && s.name) || ("SEAT " + (i+1)),
             stance: str(s && s.stance), premise: str(s && s.premise) };
  });

  // 論点
  rec.issues = arr(raw.issues).map(function(x, i){
    x = x || {};
    return {
      id: str(x.id) || ("I" + (i+1)),
      label: str(x.label) || str(x.question).slice(0,20) || ("論点" + (i+1)),
      question: str(x.question),
      importance: clamp(int(x.importance, 3), 1, 5),
      status: pick(x.status, DA.STATUS, "保留"),
      unresolved: str(x.unresolved),
      resolution: str(x.resolution),          /* 続きの討論で決着した内容 */
      session: clamp(int(x.session, 0), 0, 50),         /* 何回目の続きで追加されたか（0＝初回） */
      lastSession: clamp(int(x.lastSession, 0), 0, 50), /* 最後に更新された続きの回 */
      positions: arr(x.positions).map(function(p){
        p = p || {};
        return {
          seat: clamp(int(p.seat, 1), 1, 4),
          side: SIDE_MAP[str(p.side)] || "中立",
          claim: str(p.claim), grounds: str(p.grounds),
          strength: clamp(int(p.strength, 3), 1, 5)
        };
      })
    };
  });

  // 発言
  var pad = function(n){ return n < 10 ? "M0" + n : "M" + n; };
  rec.moves = arr(raw.moves).map(function(x, i){
    x = x || {};
    return {
      id: str(x.id) || pad(i+1),
      round: clamp(int(x.round, 1), 1, 40),
      seat: clamp(int(x.seat, 1), 1, 4),
      issue: str(x.issue),
      type: pick(x.type, DA.MTYPES, "主張"),
      summary: str(x.summary),
      targets: arr(x.targets).map(str).filter(Boolean),
      label: DA.LABELS.indexOf(str(x.label)) >= 0 ? str(x.label) : null,
      session: clamp(int(x.session, 0), 0, 50)
    };
  });

  rec.risks = arr(raw.risks).map(function(x){
    x = x || {};
    return { text: str(x.text), likelihood: level(x.likelihood), impact: level(x.impact),
             raised_by: clamp(int(x.raised_by, 0), 0, 4), mitigation: str(x.mitigation),
             session: clamp(int(x.session, 0), 0, 50) };
  }).filter(function(x){ return x.text; });

  rec.ideas = arr(raw.ideas).map(function(x){
    x = x || {};
    return { text: str(x.text), impact: level(x.impact), effort: level(x.effort),
             raised_by: clamp(int(x.raised_by, 0), 0, 4),
             session: clamp(int(x.session, 0), 0, 50) };
  }).filter(function(x){ return x.text; });

  rec.decisions = arr(raw.decisions).map(function(x){
    x = x || {};
    return { text: str(x.text), rationale: str(x.rationale), confidence: level(x.confidence),
             session: clamp(int(x.session, 0), 0, 50) };
  }).filter(function(x){ return x.text; });

  rec.tasks = arr(raw.tasks).map(function(x){
    x = x || {};
    return { text: str(x.text), owner: str(x.owner), due: str(x.due),
             blocked_by: str(x.blocked_by), done: !!x.done,
             session: clamp(int(x.session, 0), 0, 50) };
  }).filter(function(x){ return x.text; });

  rec.objections = arr(raw.objections).map(function(x){
    x = x || {};
    return { issue: str(x.issue), voice: str(x.voice), from: str(x.from),
             counter: str(x.counter), evidence: str(x.evidence),
             risk_if_ignored: str(x.risk_if_ignored),
             /* 拡張：実際の会議での照合結果 出た | 出なかった | 未確認 */
             actual: pick(x.actual, ["出た","出なかった","未確認"], "未確認"),
             session: clamp(int(x.session, 0), 0, 50) };
  }).filter(function(x){ return x.voice; });

  var sm = raw.summary || {};
  rec.summary = {
    recommendation: str(sm.recommendation),
    reasons: arr(sm.reasons).map(str).filter(Boolean),
    tradeoffs: arr(sm.tradeoffs).map(function(t){
      if(typeof t === "string") return { gain: t, loss: "" };
      t = t || {}; return { gain: str(t.gain), loss: str(t.loss) };
    }).filter(function(t){ return t.gain || t.loss; }),
    blindspots: arr(sm.blindspots).map(str).filter(Boolean),
    next_questions: arr(sm.next_questions).map(str).filter(Boolean)
  };

  // アプリ側フィールド
  rec._id = str(raw._id) || str(extra._id) || DA.newId();
  rec._createdAt = str(raw._createdAt) || new Date().toISOString();
  rec._updatedAt = new Date().toISOString();
  rec._input = raw._input || extra._input || { topic:"", goal:"", context:"", limit:"", data:"" };
  rec._notes = str(raw._notes);

  // 続きの履歴（追記のたびに1件増える）
  rec._sessions = arr(raw._sessions).map(function(s, i){
    s = s || {};
    return {
      no: int(s.no, i+1),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(s.date)) ? str(s.date) : DA.today(),
      kind: pick(s.kind, ["debate","ideate","deep","academic","socratic","redteam","stakeholder"], "debate"),
      kindLabel: str(s.kindLabel) || (DA.findMode ? DA.findMode(str(s.kind)).label : "討論"),
      focus: str(s.focus),
      rounds: clamp(int(s.rounds, 2), 1, 10),
      verdict: str(s.verdict),
      roundFrom: int(s.roundFrom, 0),
      added: s.added || {}
    };
  });
  return rec;
};

DA.today = function(){
  var d = new Date(), p = function(n){ return (n<10?"0":"") + n; };
  return d.getFullYear() + "-" + p(d.getMonth()+1) + "-" + p(d.getDate());
};
DA.newId = function(){
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,7);
};

/* ---------- 検証（落とさず警告を返す） ---------- */
DA.validate = function(rec){
  var w = [];
  if(!rec.issues.length) w.push("論点（issues）が1つもありません。討論のコピー範囲が足りていない可能性があります。");
  if(!rec.moves.length)  w.push("発言（moves）が空です。議論フロー図は表示できません。");
  if(!rec.objections.length) w.push("想定問答（objections）が空です。会議用の想定問答集は空になります。");
  if(!rec.meta.seats.length) w.push("参加者（meta.seats）が空です。論者名が SEAT 01〜04 表示になります。");

  var issueIds = {};
  rec.issues.forEach(function(i){
    if(issueIds[i.id]) w.push("論点 ID が重複しています：" + i.id);
    issueIds[i.id] = true;
    if(!i.positions.length) w.push("論点「" + i.label + "」に各論者の立場（positions）がありません。");
  });

  var moveIds = {};
  rec.moves.forEach(function(m){ moveIds[m.id] = true; });
  var unknownTargets = [], unknownIssues = [];
  rec.moves.forEach(function(m){
    m.targets.forEach(function(t){ if(!moveIds[t] && unknownTargets.indexOf(t) < 0) unknownTargets.push(t); });
    if(m.issue && !issueIds[m.issue] && unknownIssues.indexOf(m.issue) < 0) unknownIssues.push(m.issue);
  });
  if(unknownTargets.length) w.push("存在しない発言 ID を攻撃対象にしている箇所があります：" + unknownTargets.join(", ") + "（その矢印は描画されません）");
  if(unknownIssues.length)  w.push("存在しない論点 ID を参照している発言があります：" + unknownIssues.join(", "));

  var objBad = [];
  rec.objections.forEach(function(o){
    if(o.issue && !issueIds[o.issue] && objBad.indexOf(o.issue) < 0) objBad.push(o.issue);
  });
  if(objBad.length) w.push("想定問答が存在しない論点を参照しています：" + objBad.join(", ") + "（「その他」に分類されます）");

  if(!rec.summary.recommendation) w.push("総括の推奨案（summary.recommendation）が空です。");
  return w;
};

/* ---------- 分割出力のマージ ---------- */
DA.mergeParts = function(a, b){
  var out = {}, k;
  for(k in a){ if(Object.prototype.hasOwnProperty.call(a,k)) out[k] = a[k]; }
  for(k in b){
    if(!Object.prototype.hasOwnProperty.call(b,k)) continue;
    var v = b[k];
    if(v === null || v === undefined) continue;
    if(Array.isArray(v) && !v.length) continue;
    if(k === "meta" && out.meta){
      for(var mk in v){ if(v[mk]) out.meta[mk] = v[mk]; }
      continue;
    }
    out[k] = v;
  }
  return out;
};

/* ---------- 続きの追記（debate-followup/v1 → 既存の記録にマージ） ----------
   既存の内容は消さず、追加と更新だけを行う。
   ラウンド番号は前回の続きから振り直され、発言 ID には回数の接頭辞が付く。 */
DA.applyFollowup = function(rec, patch){
  if(!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new Error("追記データとして読めませんでした。");
  if(patch.records || (patch.issues && patch.meta))
    throw new Error("これは記録そのもの（debate-record）のようです。新しい記録として保存したい場合は取り込み画面を使ってください。");
  var hasAny = patch.session || patch.issue_updates || patch.new_issues || patch.moves ||
               patch.summary_update || patch.ideas || patch.decisions || patch.objections;
  if(!hasAny)
    throw new Error("続きの JSON（debate-followup/v1）ではないようです。issue_updates / new_issues / moves のいずれも入っていません。");

  var base = DA.normalize(JSON.parse(JSON.stringify(rec)));
  var no = base._sessions.length + 1;
  var sess = patch.session || {};
  var kind = pick(sess.kind, ["debate","ideate","deep","academic","socratic","redteam","stakeholder"], "debate");
  var rounds = clamp(int(sess.rounds, 2), 1, 10);

  /* 既存の最終ラウンドの後ろに積む */
  var offset = base.meta.rounds || 0;
  base.moves.forEach(function(m){ if(m.round > offset) offset = m.round; });

  var issueById = {};
  base.issues.forEach(function(i){ issueById[i.id] = i; });
  var freeIssueId = function(){
    for(var k=1; k<200; k++){ if(!issueById["I" + k]) return "I" + k; }
    return "I" + Date.now().toString(36);
  };

  var report = { issuesUpdated:0, issuesAdded:0, moves:0, risks:0, ideas:0,
                 decisions:0, tasks:0, objections:0 };
  var idMap = {};   // 追記 JSON の論点 ID → 記録上の論点 ID

  /* 1. 新しい論点 */
  arr(patch.new_issues).forEach(function(x){
    var norm = DA.normalize({ issues:[x] }).issues[0];
    if(!norm || !norm.label) return;
    var want = norm.id;
    if(issueById[want]) want = freeIssueId();
    idMap[norm.id] = want;
    norm.id = want;
    norm.session = no;
    norm.lastSession = no;
    base.issues.push(norm);
    issueById[want] = norm;
    report.issuesAdded++;
  });

  /* 2. 既存の論点の更新 */
  arr(patch.issue_updates).forEach(function(u){
    u = u || {};
    var id = str(u.id);
    var tgt = issueById[id] || issueById[idMap[id]];
    if(!tgt){
      /* ID が合わない場合は新しい論点として拾う（取りこぼしを防ぐ） */
      var add = DA.normalize({ issues:[{ id:"", label:str(u.label) || str(u.resolution).slice(0,15) || id,
        question:str(u.question), importance:u.importance, status:u.status,
        unresolved:u.unresolved, resolution:u.resolution, positions:u.positions }] }).issues[0];
      if(!add || !add.label) return;
      add.id = freeIssueId(); add.session = no; add.lastSession = no;
      base.issues.push(add); issueById[add.id] = add; idMap[id] = add.id;
      report.issuesAdded++;
      return;
    }
    if(str(u.status)) tgt.status = pick(u.status, DA.STATUS, tgt.status);
    if(u.unresolved !== undefined) tgt.unresolved = str(u.unresolved);
    if(str(u.resolution)){
      tgt.resolution = [tgt.resolution, str(u.resolution)].filter(Boolean).join(" ／ ");
    }
    arr(u.positions).forEach(function(p){
      var np = DA.normalize({ issues:[{ positions:[p] }] }).issues[0].positions[0];
      if(!np) return;
      var found = false;
      for(var i=0;i<tgt.positions.length;i++){
        if(tgt.positions[i].seat === np.seat){ tgt.positions[i] = np; found = true; break; }
      }
      if(!found) tgt.positions.push(np);
    });
    tgt.lastSession = no;
    report.issuesUpdated++;
  });

  /* 3. 発言（ID を付け替え、ラウンドを後ろにずらす） */
  var normMoves = DA.normalize({ moves: arr(patch.moves) }).moves;
  var mvMap = {};
  normMoves.forEach(function(m){ mvMap[m.id] = "F" + no + "-" + m.id; });
  normMoves.forEach(function(m){
    base.moves.push({
      id: mvMap[m.id],
      round: clamp(offset + m.round, 1, 40),
      seat: m.seat,
      issue: idMap[m.issue] || m.issue,
      type: m.type,
      summary: m.summary,
      targets: m.targets.map(function(t){ return mvMap[t] || t; }),
      label: m.label,
      session: no
    });
    report.moves++;
  });

  /* 4. リスト系（すべて追加のみ） */
  var add = DA.normalize({ risks:patch.risks, ideas:patch.ideas, decisions:patch.decisions,
                           tasks:patch.tasks, objections:patch.objections });
  ["risks","ideas","decisions","tasks","objections"].forEach(function(k){
    add[k].forEach(function(x){
      x.session = no;
      if(k === "objections" && x.issue) x.issue = idMap[x.issue] || x.issue;
      base[k].push(x);
      report[k]++;
    });
  });

  /* 5. 総括の更新 */
  var su = patch.summary_update || patch.summary || {};
  if(str(su.recommendation)) base.summary.recommendation = str(su.recommendation);
  function pushUniq(list, items){
    arr(items).map(str).filter(Boolean).forEach(function(t){
      if(list.indexOf(t) < 0) list.push(t);
    });
  }
  pushUniq(base.summary.reasons, su.reasons);
  pushUniq(base.summary.blindspots, su.blindspots);
  pushUniq(base.summary.next_questions, su.next_questions);
  arr(su.tradeoffs).forEach(function(t){
    if(typeof t === "string") t = { gain:t, loss:"" };
    t = t || {};
    var g = str(t.gain), l = str(t.loss);
    if(!g && !l) return;
    var dup = base.summary.tradeoffs.some(function(o){ return o.gain === g && o.loss === l; });
    if(!dup) base.summary.tradeoffs.push({ gain:g, loss:l });
  });

  /* 6. 履歴 */
  var focus = str(sess.focus);
  if(!focus){
    var names = [];
    arr(patch.issue_updates).forEach(function(u){
      var t = issueById[str(u && u.id)];
      if(t) names.push(t.label);
    });
    focus = names.slice(0,3).join("・") || "続きの議論";
  }
  base._sessions.push({
    no: no,
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(sess.date)) ? str(sess.date) : DA.today(),
    kind: kind,
    kindLabel: DA.findMode ? DA.findMode(kind).label : "討論",
    focus: focus,
    rounds: rounds,
    verdict: str(sess.verdict),
    roundFrom: offset + 1,
    added: report
  });
  base.meta.rounds = clamp(offset + (normMoves.length ? Math.max(rounds, maxRound(normMoves)) : rounds), 1, 40);

  return { rec: base, report: report, session: base._sessions[base._sessions.length-1] };
};

function maxRound(moves){
  var m = 1;
  moves.forEach(function(x){ if(x.round > m) m = x.round; });
  return m;
}

/* ---------- 集計ヘルパー ---------- */
DA.stat = function(rec){
  return {
    issues: rec.issues.length,
    conflicts: rec.issues.filter(function(i){ return i.status === "対立"; }).length,
    moves: rec.moves.length,
    risks: rec.risks.length,
    ideas: rec.ideas.length,
    objections: rec.objections.length,
    tasksOpen: rec.tasks.filter(function(t){ return !t.done; }).length,
    tasksAll: rec.tasks.length,
    sessions: (rec._sessions || []).length
  };
};
})();
