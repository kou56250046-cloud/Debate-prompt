/* 討論卓 — プロンプト生成
   buildDebatePrompt : 1段目（討論そのもの）  ※debate-table.html の buildPrompt を純関数化
   buildStructurePrompt : 2段目（討論を JSON に構造化させる） */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

function v(s, fb){ s = (s || "").trim(); return s || fb; }

/* state = { cat, rounds, toneIdx, input:{topic,goal,context,limit,data} } */
DA.buildDebatePrompt = function(state){
  var cat = state.cat;
  var n = state.rounds;
  var set = DA.ROUND_SETS[n];
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};

  var members = cat.roles.map(function(r){ return r[0] + "：" + r[1]; }).join("\n");
  var rules = set.map(function(r,i){ return "- ROUND " + (i+1) + "／" + r.name + "：" + r.rule; }).join("\n");
  var outFmt = set.map(function(r,i){
    return "── ROUND " + (i+1) + "：" + r.name + " ──\n（4名の発言" + r.out + "）\n司会：未解決の対立点";
  }).join("\n\n");

  return `# 役割
あなたは、4名の論者と1名の司会からなる討論を、一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、討論を最後まで進めきること。

# 参加者
${members}
司会：議論の交通整理をする。妥協と早すぎる合意を許さない。最後に自らの判断を下す。

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${rules}
- 各ラウンドの末尾で、司会が「未解決の対立点」を2〜3個、箇条書きで宣言してから次に進む。
- 全員の意見が近づいたら、司会は「合意が早すぎる」と介入し、最も安易に同意した者を指名して反対側に立たせる。
- 最終ラウンド終了時点で対立が実質的に解けていない場合に限り、延長ラウンドを1回だけ行ってよい。

# 禁止事項
- 「一概には言えない」「バランスが大事」「ケースバイケース」で締めること
- 全員が同じ方向を向いた無風の議論
- 役割の入れ替わり（各論者は最後まで自分の立場を代表する）
- 入力に書かれていない事実の捏造。不明な点は「不明」と述べ、仮定を置く場合は明示した上で論じる

# トーン
${tone.text}

# 文体と分量
セリフ形式の会話劇。地の文は最小限。1発言200〜400字。
全体で5,000字以上。上限は設けない。分量を削るより、対立を書き切ることを優先する。

# 出力形式
【議題の再定義】司会が、何を論じるのかを1段落で宣言する
【参加者】4名の役割と初期スタンスを各1行

${outFmt}

【総括】司会が以下の4点を述べる
1. 結論・推奨案 ── 両論併記で逃げず、司会自身の判断としてひとつ選び、理由を述べる
2. 論点とトレードオフ ── 何を取れば何を失うか
3. 見落とされていた視点 ── 議題を持ち込んだ人間が気づいていない可能性が高いもの
4. 次に考えるべき問い ── 3つ

# 入力
【議題・課題】
${v(f.topic,"（ここに議題を書く）")}

【今回の目的】
${v(f.goal,"（未記入）")}

【前提・背景】
${v(f.context,"（未記入）")}

【制約・避けたいこと】
${v(f.limit,"（未記入）")}

【利用可能な情報・データ】
${v(f.data,"（未記入）")}
`;
};

/* ---------- 2段目：構造化プロンプト ---------- */
/* mode: "full" | "p1" | "p2" */
DA.buildStructurePrompt = function(state, mode){
  mode = mode || "full";
  var cat = state.cat;
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};

  var seatLine = cat.roles.map(function(r,i){ return (i+1) + "=" + r[0]; }).join(" / ");

  var scopeNote =
    mode === "p1" ? "今回は PART 1 だけを出力する。meta / issues / moves の3つだけを含み、それ以外のキーは書かない。"
  : mode === "p2" ? "今回は PART 2 だけを出力する。risks / ideas / decisions / tasks / objections / summary だけを含み、それ以外のキーは書かない。"
  : "";

  var spec = mode === "p1" ? DA.specPart1() : mode === "p2" ? DA.specPart2() : DA.specFull();

  var head = mode === "p2"
    ? "直前の討論を読み直し、下のJSONスキーマに従って構造化せよ。（PART 2）"
    : "直前の討論を読み直し、下のJSONスキーマに従って構造化せよ。" + (mode === "p1" ? "（PART 1）" : "");

  var rules = [
    "- 出力は **JSONのコードブロック1つだけ**。前後に挨拶・説明・要約・感想を一切書くな。",
    "- 討論に実際に出た内容だけを使え。新しい論点を創作するな。該当がなければ空配列 [] にする。",
    "- seat 番号は参加者の並び順と一致させる（" + seatLine + "）。",
    "- 文字列の中で改行するな。1項目は1〜2行に収める。カギカッコ内の引用も1行にする。",
    "- コメント（//）や説明文はスキーマの読み方の指示であり、出力には含めない。",
    "- 値が不明な項目は空文字 \"\" にする。null や「不明」という文字列を入れない（label だけは null 可）。"
  ];
  if(mode !== "p2"){
    rules.push("- issues は5〜9個。議題の結論を左右する度合い（importance）が高い順に並べる。");
    rules.push("- 各 issue の positions には、その論点に触れた論者全員を入れる。触れていない論者は入れない。");
    rules.push("- moves は各ラウンド × 各論者に最低1つ。反論・再反論には targets（攻撃した相手の move id）を必ず入れる。");
  }
  if(mode !== "p1"){
    rules.push("- objections は importance 4以上の論点それぞれについて最低2つ作る。");
    rules.push("  討論の反論をそのまま写すのではなく、**実際の会議で人間が口にしそうな言い方**に翻訳して voice に書く。");
    rules.push("- risks / ideas の likelihood・impact・effort は 高 / 中 / 低 の3値のみ。");
  }
  if(scopeNote) rules.push("- " + scopeNote);

  return `# 指示
${head}

# 絶対に守ること
${rules.join("\n")}

# この討論の前提（参照用）
カテゴリ：${cat.label}
ラウンド数：${n}／トーン：${tone.label}
参加者：${seatLine}
日付：${DA.today()}
議題：${v(f.topic,"（直前の討論の議題）")}

# 出力するJSONスキーマ
\`\`\`json
${spec}
\`\`\`
`;
};

/* ---------- 深掘り（未解決論点の再討論） ---------- */
DA.buildDeepDivePrompt = function(rec, issue){
  var seats = rec.meta.seats.map(function(s){ return s.seat + "=" + s.name; }).join(" / ");
  var pos = issue.positions.map(function(p){
    var name = (rec.meta.seats[p.seat-1] || {}).name || ("SEAT " + p.seat);
    return "- " + name + "（" + p.side + "）：" + p.claim + (p.grounds ? "　根拠：" + p.grounds : "");
  }).join("\n");

  return `# 役割
前回の討論の続きを行う。4名の論者と1名の司会を、あなたが一人で全員分演じる。私は観客であり、議論には参加しない。

# 参加者
${seats}
司会：妥協と早すぎる合意を許さない。最後に自らの判断を下す。

# 前回の到達点
議題：${rec._input.topic || rec.meta.title}
今回さらに掘る論点：${issue.label}
問い：${issue.question}
${issue.unresolved ? "決着しなかった点：" + issue.unresolved : ""}

前回それぞれが述べた立場：
${pos}

# 今回のルール
- この論点だけを論じる。他の論点に逃げてはならない。
- 全2ラウンド。ROUND 1：前回の自分の立場を、新しい根拠か具体例を1つ加えて述べ直す。他の論者の前提を最低1名分、名指しで潰す。
- ROUND 2：受けた攻撃に対し【撤回】【修正】【強化】のいずれかをラベリングして応答する。
- 前回と同じ言い回しの繰り返しは禁止。前進しない発言は司会が差し戻す。

# 出力
【前回からの争点】司会が1段落で宣言
── ROUND 1 ──（4名の発言）
── ROUND 2 ──（4名の発言）
【決着】司会が、この論点についてどちらを採るかを明言し、まだ判断できない場合は「何が分かれば決まるか」を1つ挙げる
`;
};
})();
