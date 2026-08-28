/* 討論卓 — プロンプト生成
   buildDebatePrompt        : 1段目（討論・アイデア出し・深掘り。モードで骨格が変わる）
   buildStructurePrompt     : 2段目（結果を JSON に構造化させる）
   buildDeepDivePrompt      : 単一論点の続き（互換のため残置）
   buildFollowupPrompt      : 未解決項目をまとめて詰め直す続きのプロンプト
   buildFollowupStructurePrompt : 続きの結果を追記用 JSON にさせるプロンプト */
(function(){
"use strict";
var DA = window.DA = window.DA || {};

function v(s, fb){ s = (s || "").trim(); return s || fb; }
function line(s){ return String(s || "").replace(/\s+/g," ").trim(); }

/* state = { mode, cat, rounds, toneIdx, input:{topic,goal,context,limit,data} } */
function seatsOf(state){ return DA.rolesOf(state.mode, state.cat); }
DA.seatsOf = seatsOf;

function seatLine(state){
  return seatsOf(state).map(function(r,i){ return (i+1) + "=" + r[0]; }).join(" / ");
}

function inputBlock(f){
  return `【議題・お題】
${v(f.topic,"（ここに議題を書く）")}

【今回の目的】
${v(f.goal,"（未記入）")}

【前提・背景】
${v(f.context,"（未記入）")}

【制約・避けたいこと】
${v(f.limit,"（未記入）")}

【利用可能な情報・データ】
${v(f.data,"（未記入）")}`;
}

/* ---------- 1段目：モード別の本編プロンプト ---------- */
DA.buildDebatePrompt = function(state){
  var mode = DA.findMode(state.mode);
  if(mode.key === "ideate") return buildIdeate(state);
  if(mode.key === "deep")   return buildDeep(state);
  return buildDebate(state);
};
DA.buildMainPrompt = DA.buildDebatePrompt;

function roundBlocks(state, chairLine){
  var set = DA.roundsOf(state.mode, state.rounds);
  return {
    rules: set.map(function(r,i){ return "- ROUND " + (i+1) + "／" + r.name + "：" + r.rule; }).join("\n"),
    out: set.map(function(r,i){
      return "── ROUND " + (i+1) + "：" + r.name + " ──\n（4名の発言" + r.out + "）\n司会：" + chairLine;
    }).join("\n\n")
  };
}

/* ── 討論（従来） ── */
function buildDebate(state){
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var members = seatsOf(state).map(function(r){ return r[0] + "：" + r[1]; }).join("\n");
  var b = roundBlocks(state, "未解決の対立点");

  return `# 役割
あなたは、4名の論者と1名の司会からなる討論を、一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、討論を最後まで進めきること。

# 参加者
${members}
司会：議論の交通整理をする。妥協と早すぎる合意を許さない。最後に自らの判断を下す。

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${b.rules}
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

${b.out}

【総括】司会が以下の4点を述べる
1. 結論・推奨案 ── 両論併記で逃げず、司会自身の判断としてひとつ選び、理由を述べる
2. 論点とトレードオフ ── 何を取れば何を失うか
3. 見落とされていた視点 ── 議題を持ち込んだ人間が気づいていない可能性が高いもの
4. 次に考えるべき問い ── 3つ

# 入力
${inputBlock(f)}
`;
}

/* ── アイデア出し ── */
function buildIdeate(state){
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var members = seatsOf(state).map(function(r){ return r[0] + "：" + r[1]; }).join("\n");
  var b = roundBlocks(state, "まだ誰も触れていない方向を2つ");

  return `# 役割
あなたは、4名の発想者と1名の司会からなるアイデア会議を、一人で全員分演じる。私は観客であり、口を挟まない。私に質問を投げ返さず、最後まで進めきること。

# 参加者
${members}
司会：数を止めない。似た案が続いたら方向転換を指示する。最後に案を選び、選んだ理由と捨てた理由を述べる。

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${b.rules}
- すべての案に通し番号を振る（A01, A02 …）。以降の言及は必ず番号で行う。
- 各ラウンドの末尾で、司会が「まだ誰も触れていない方向」を2つ指摘してから次に進む。
- 似た案が3つ続いたら、司会は即座に打ち切り、別の切り口を指定する。

# 禁止事項
- 最初に出た案に全員が乗ること
- 「〜を検討する」「〜を強化する」「〜を見直す」のような、何をするのか分からない案
- 発散のラウンドで実現可能性・予算・人手を理由に案を止めること（選別のラウンドまで持ち越す）
- 入力に書かれていない事実の捏造。仮定を置く場合は明示する
- 案の説明に字数を使いすぎること。1案は1行30〜60字に収める

# トーン
${tone.text}

# 文体と分量
案は箇条書き、番号付き。検討・選別のパートのみセリフ形式にする。
全体で5,000字以上。案の総数が60個を下回ったまま終わってはならない。

# 出力形式
【お題の再定義】司会が、何を探しているのかを1段落で宣言する
【参加者】4名の役割を各1行

${b.out}

【選抜】司会が上位5案を、効果（高中低）× 労力（高中低）の見立てとともに並べる

【総括】司会が以下の4点を述べる
1. 今すぐ着手する1案 ── ひとつ選び、最初の一歩と、やめる判断基準を述べる
2. 惜しかったが捨てた案 ── 2つ、捨てた理由とともに
3. この場で誰も出せなかった方向 ── 議題の性質上、発想が届いていない領域を指摘する
4. 次に考えるべき問い ── 3つ

# 入力
${inputBlock(f)}
`;
}

/* ── 思考の深掘り ── */
function buildDeep(state){
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var members = seatsOf(state).map(function(r){ return r[0] + "：" + r[1]; }).join("\n");
  var b = roundBlocks(state, "まだ確かめられていないこと");

  return `# 役割
あなたは、4名の思考者と1名の司会からなる検討を、一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、最後まで進めきること。

# 参加者
${members}
司会：問いを1つに保つ。話題が横に逸れたら差し戻す。最後に、現時点で言えることと言えないことを切り分ける。

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${b.rules}
- 各ラウンドの末尾で、司会が「まだ確かめられていないこと」を2〜3個、箇条書きで宣言してから次に進む。
- 結論を急ぐ発言が出たら、司会は「まだ早い」と介入し、根拠の階層をもう1段掘らせる。
- 4名の見解が揃った場合、司会は最も同意しやすい主張を指定し、反証役にそれを崩させる。

# 禁止事項
- 「人それぞれ」「時と場合による」「バランスが大事」で締めること
- 定義しないまま抽象語（本質・価値・成長・幸せ・信頼など）を使い続けること
- 具体例をひとつも出さずに1ラウンドを終えること
- 入力に書かれていない事実の捏造。不明な点は「不明」と述べ、仮定を置く場合は明示した上で論じる

# トーン
${tone.text}

# 文体と分量
セリフ形式。1発言250〜450字。抽象論には必ず具体例を1つ添える。
全体で5,000字以上。上限は設けない。浅いまま先へ進むより、1つを掘り切ることを優先する。

# 出力形式
【問いの提示】司会が、何を考えるのかを1段落で宣言する
【参加者】4名の役割と、最初に置いている見立てを各1行

${b.out}

【総括】司会が以下の4点を述べる
1. 現時点で最も確からしい見立て ── ひとつに絞って述べる
2. それを支える根拠と、根拠が弱い箇所 ── どこがまだ足元が緩いか
3. まだ言えないこと ── 分かった気になりやすい落とし穴として
4. 次に確かめるべき問い ── 3つ。確かめる方法も1行ずつ添える

# 入力
${inputBlock(f)}
`;
}

/* ---------- 2段目：構造化プロンプト ---------- */
/* mode: "full" | "p1" | "p2" */
DA.buildStructurePrompt = function(state, mode){
  mode = mode || "full";
  var md = DA.findMode(state.mode);
  var cat = state.cat;
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var seats = seatLine(state);

  var scopeNote =
    mode === "p1" ? "今回は PART 1 だけを出力する。meta / issues / moves の3つだけを含み、それ以外のキーは書かない。"
  : mode === "p2" ? "今回は PART 2 だけを出力する。risks / ideas / decisions / tasks / objections / summary だけを含み、それ以外のキーは書かない。"
  : "";

  var spec = mode === "p1" ? DA.specPart1(md.key) : mode === "p2" ? DA.specPart2() : DA.specFull(md.key);

  var kind = md.key === "ideate" ? "アイデア会議" : (md.key === "deep" ? "検討" : "討論");
  var head = "直前の" + kind + "を読み直し、下のJSONスキーマに従って構造化せよ。" +
             (mode === "p1" ? "（PART 1）" : mode === "p2" ? "（PART 2）" : "");

  var rules = [
    "- 出力は **JSONのコードブロック1つだけ**。前後に挨拶・説明・要約・感想を一切書くな。",
    "- 直前のやりとりに実際に出た内容だけを使え。新しい論点を創作するな。該当がなければ空配列 [] にする。",
    "- seat 番号は参加者の並び順と一致させる（" + seats + "）。",
    "- 文字列の中で改行するな。1項目は1〜2行に収める。カギカッコ内の引用も1行にする。",
    "- コメント（//）や説明文はスキーマの読み方の指示であり、出力には含めない。",
    "- 値が不明な項目は空文字 \"\" にする。null や「不明」という文字列を入れない（label だけは null 可）。"
  ];

  if(mode !== "p2"){
    if(md.key === "ideate"){
      rules.push("- issues には「案を選ぶときに意見が割れた判断軸」を3〜6個入れる（例：予算をどこまで使うか／誰の手を借りるか）。案そのものは issues ではなく ideas に入れる。");
      rules.push("- 各 issue の positions には、その軸について発言した論者だけを入れる。");
      rules.push("- moves には各ラウンド × 各論者の動きを最低1つずつ入れる。案を大量に出したラウンドは「主張」1件にまとめ、summary に代表的な案を2〜3個挙げる。");
    }else if(md.key === "deep"){
      rules.push("- issues には掘り下げた問い・前提・争点を5〜9個入れる。importance は「その問いが結論を左右する度合い」とする。");
      rules.push("- 各 issue の positions には、その問いに触れた論者全員を入れる。side は結論への賛否ではなく、その見立てを支持するか（賛成）／退けるか（反対）／条件付きかで判定する。");
      rules.push("- moves は各ラウンド × 各論者に最低1つ。前提の指摘・反証には targets（対象の move id）を必ず入れる。");
    }else{
      rules.push("- issues は5〜9個。議題の結論を左右する度合い（importance）が高い順に並べる。");
      rules.push("- 各 issue の positions には、その論点に触れた論者全員を入れる。触れていない論者は入れない。");
      rules.push("- moves は各ラウンド × 各論者に最低1つ。反論・再反論には targets（攻撃した相手の move id）を必ず入れる。");
    }
  }
  if(mode !== "p1"){
    if(md.key === "ideate"){
      rules.push("- ideas は出た案のうち **最低15個**。選抜された案とその周辺を優先し、番号（A01 など）は text に含めない。");
      rules.push("- objections は選抜された案それぞれについて最低2つ作る。「その案を人に提案したときに返ってきそうな一言」を voice に書く。");
      rules.push("- decisions には司会が選んだ案、tasks にはその最初の一歩を入れる。");
    }else if(md.key === "deep"){
      rules.push("- objections は importance 4以上の論点それぞれについて最低2つ作る。「この見立てを人に話したときに返ってきそうな異論」を voice に書く。");
      rules.push("- tasks には「次に確かめること」を、確かめる方法が分かる形で入れる。");
      rules.push("- summary.blindspots と summary.next_questions は必ず埋める。この2つがこのモードの主産物である。");
    }else{
      rules.push("- objections は importance 4以上の論点それぞれについて最低2つ作る。");
      rules.push("  討論の反論をそのまま写すのではなく、**実際の会議で人間が口にしそうな言い方**に翻訳して voice に書く。");
    }
    rules.push("- risks / ideas の likelihood・impact・effort は 高 / 中 / 低 の3値のみ。");
  }
  if(scopeNote) rules.push("- " + scopeNote);

  return `# 指示
${head}

# 絶対に守ること
${rules.join("\n")}

# この${kind}の前提（参照用）
モード：${md.label}（${md.key}）
カテゴリ：${cat.label}
ラウンド数：${n}／トーン：${tone.label}
参加者：${seats}
日付：${DA.today()}
議題：${v(f.topic,"（直前のやりとりの議題）")}

# 出力するJSONスキーマ
\`\`\`json
${spec}
\`\`\`
`;
};

/* ---------- 続き：未解決項目の詰め直し ---------- */

function seatRoster(rec){
  return rec.meta.seats.map(function(s){ return s.seat + "=" + s.name; }).join(" / ");
}

/* 選んだ論点を、前回の立場つきで並べる */
function issueBrief(rec, issues){
  return issues.map(function(iss, i){
    var pos = iss.positions.map(function(p){
      var name = (rec.meta.seats[p.seat-1] || {}).name || ("SEAT " + p.seat);
      return "   - " + name + "（" + p.side + "／強さ" + p.strength + "）：" + line(p.claim) +
             (p.grounds ? "　根拠：" + line(p.grounds) : "");
    }).join("\n");
    return [
      (i+1) + ". 【" + iss.label + "】（" + iss.status + "／重要度" + iss.importance + "／ID " + iss.id + "）",
      "   問い：" + (line(iss.question) || "（記載なし）"),
      iss.unresolved ? "   前回決着しなかった点：" + line(iss.unresolved) : "",
      iss.resolution ? "   これまでの到達点：" + line(iss.resolution) : "",
      pos ? "   前回の各自の立場：\n" + pos : "   前回の各自の立場：（記録なし）"
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

function historyBlock(rec){
  var out = [];
  if(rec.summary.recommendation) out.push("前回の司会の結論：" + line(rec.summary.recommendation));
  (rec._sessions || []).forEach(function(s){
    out.push("続き#" + s.no + "（" + s.date + "／" + s.kindLabel + "／" + s.focus + "）の到達点：" +
             (line(s.verdict) || "（記載なし）"));
  });
  return out.join("\n");
}

/* opts = { kind:"debate"|"ideate"|"deep", rounds:2, extra:"追加指示" } */
DA.buildFollowupPrompt = function(rec, issues, opts){
  opts = opts || {};
  var kind = opts.kind || "debate";
  var md = DA.findMode(kind);
  var n = opts.rounds || 2;
  var set = DA.roundsOf(kind, n);
  var tone = DA.TONES[2];
  var hist = historyBlock(rec);

  var rules = set.map(function(r,i){ return "- ROUND " + (i+1) + "／" + r.name + "：" + r.rule; }).join("\n");
  var out = set.map(function(r,i){
    return "── ROUND " + (i+1) + "：" + r.name + " ──\n（4名の発言" + r.out + "）";
  }).join("\n\n");

  var aim =
    kind === "ideate" ? "下の未解決項目を **解くための案** を出し切る。論の是非ではなく、打ち手を増やして選ぶ。"
  : kind === "deep"   ? "下の未解決項目を **掘り下げる**。決着させることより、なぜそこで詰まっているのかを解明する。"
  :                     "下の未解決項目を **詰め直して決着させる**。";

  var closing =
    kind === "ideate" ? "【決着】司会が、この項目に対する打ち手を1つ選び、最初の一歩と、やめる判断基準を述べる。選ばなかった有力案も1つ挙げる"
  : kind === "deep"   ? "【決着】司会が、項目ごとに「ここまでは言える」「まだ言えない」「次に確かめる」を1行ずつ述べる"
  :                     "【決着】司会が、項目ごとにどちらを採るかを明言する。まだ判断できない項目は「何が分かれば決まるか」を1つ挙げる";

  return `# 役割
前回までの${rec.meta.category ? rec.meta.category + "の" : ""}検討の続きを行う。4名の論者と1名の司会を、あなたが一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、最後まで進めきること。

# 参加者
${seatRoster(rec)}
（前回と同じ席・同じ役割を引き継ぐ。役割を入れ替えない）
司会：妥協と早すぎる合意を許さない。最後に自らの判断を下す。

# 前回までの到達点
議題：${line((rec._input && rec._input.topic) || rec.meta.title)}
${hist || "（結論の記録なし）"}

# 今回の目的
${aim}

# 今回扱う項目（これ以外に逃げてはならない）
${issueBrief(rec, issues)}
${opts.extra ? "\n# 今回の追加条件\n" + opts.extra + "\n" : ""}
# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${rules}
- 前回と同じ言い回しの繰り返しは禁止。前進しない発言は司会が差し戻す。
- 各自、前回の自分の立場を出発点にし、新しい根拠・具体例・数字のいずれかを必ず1つ加える。
- 上に挙がっていない論点に話を広げない。広がったら司会が即座に戻す。

# 禁止事項
- 「一概には言えない」「バランスが大事」で締めること
- 入力・前回の記録にない事実の捏造。仮定を置く場合は明示する

# トーン
${tone.text}

# 文体と分量
セリフ形式の会話劇。1発言200〜400字。全体で3,000字以上。

# 出力形式
【前回からの争点】司会が、今回何を詰めるのかを1段落で宣言する

${out}

${closing}
`;
};

/* 互換：単一論点の深掘り（record.html の旧ボタン用） */
DA.buildDeepDivePrompt = function(rec, issue){
  return DA.buildFollowupPrompt(rec, [issue], { kind:"debate", rounds:2 });
};

/* ---------- 続きの構造化（追記用 JSON） ---------- */
/* opts = { kind, rounds } */
DA.buildFollowupStructurePrompt = function(rec, issues, opts){
  opts = opts || {};
  var kind = opts.kind || "debate";
  var md = DA.findMode(kind);
  var n = opts.rounds || 2;

  var idList = issues.map(function(i){ return i.id + "＝" + i.label; }).join(" / ");
  var allIds = rec.issues.map(function(i){ return i.id + "＝" + i.label; }).join(" / ");

  var rules = [
    "- 出力は **JSONのコードブロック1つだけ**。前後に挨拶・説明・要約・感想を一切書くな。",
    "- 直前の続きの議論に実際に出た内容だけを使え。前回の記録の内容を書き写すな。**今回追加・更新された分だけ**を出す。",
    "- seat 番号は前回と同じ並び（" + seatRoster(rec) + "）。",
    "- 今回扱った論点の id は既存のものを使う（" + idList + "）。",
    "- 今回新しく生まれた論点だけを new_issues に入れる。id は N1, N2 … とする。",
    "- moves の id は F01, F02 … とする。round は今回の議論の中での 1〜" + n + " を書く（前回からの通算にしない）。",
    "- moves の targets には、今回の議論の中で攻撃した相手の move id（F01 など）を入れる。",
    "- 文字列の中で改行するな。1項目は1〜2行に収める。",
    "- 値が不明な項目は空文字 \"\" にする。該当がなければ空配列 [] にする。",
    "- コメント（//）は読み方の指示であり、出力には含めない。"
  ];
  if(kind === "ideate") rules.push("- ideas には今回出た案を最低8個入れる。decisions には選んだ案、tasks には最初の一歩を入れる。");
  if(kind === "deep")   rules.push("- summary_update.blindspots と next_questions は必ず埋める。");

  return `# 指示
直前の「続きの議論」を読み直し、下のJSONスキーマに従って構造化せよ。
これは既存の記録に**追記する差分**である。前回までの内容を繰り返さず、今回動いた分だけを出す。

# 絶対に守ること
${rules.join("\n")}

# 参照情報
続きのモード：${md.label}（${kind}）／ラウンド数：${n}／日付：${DA.today()}
元の記録：${rec.meta.title}
今回扱った論点：${idList}
記録にある全論点：${allIds}

# 出力するJSONスキーマ
\`\`\`json
${DA.specFollowup(kind, n, issues)}
\`\`\`
`;
};
})();
