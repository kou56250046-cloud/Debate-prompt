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

/* state = { mode, cat, rounds, toneIdx, seats?, input:{topic,goal,context,limit,data} }
   seats は関係者総当りのようにユーザーが席を指定するモードでだけ入る */
function seatsOf(state){
  if(state.seats && state.seats.length) return state.seats;
  return DA.rolesOf(state.mode, state.cat);
}
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
  if(mode.key === "ideate")      return buildIdeate(state);
  if(mode.key === "deep")        return buildDeep(state);
  if(mode.key === "academic")    return buildAcademic(state);
  if(mode.key === "socratic")    return buildSocratic(state);
  if(mode.key === "redteam")     return buildRedteam(state);
  if(mode.key === "stakeholder") return buildStakeholder(state);
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

/* ── 学術討論 ── */
/* 唯一、外部知識を持ち出させるモード。捏造を防ぐため水準ラベルを義務づけ、
   記憶に頼った箇所は [要確認] として台帳に残させる。 */
var LEVEL_TAGS = "[確立] [有力] [議論あり] [限定的] [理論] [要確認]";
var EVIDENCE_LEVELS = `[確立]　　教科書・メタ分析の水準で、広く合意が取れている
[有力]　　複数の研究で支持されているが、決着はしていない
[議論あり] 研究者の間で見解が割れている
[限定的]　単一の研究・小規模・特定の集団や文脈でしか確かめられていない
[理論]　　理論的な推論であり、直接の実証はない
[要確認]　記憶に基づく記述であり、出典・数値の裏取りが必要`;

function buildAcademic(state){
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var members = seatsOf(state).map(function(r){ return r[0] + "：" + r[1]; }).join("\n");
  var b = roundBlocks(state, "証拠が足りていない点");

  return `# 役割
あなたは、4名の研究者と1名の司会からなる学術的な検討会を、一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、最後まで進めきること。

# 参加者
${members}
司会：水準ラベルのない断定を差し戻す。出典が曖昧なまま話が進むことを許さず、最後に証拠の台帳をまとめる。

# 証拠の水準ラベル（すべての根拠の冒頭に必ず付ける）
${EVIDENCE_LEVELS}

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${b.rules}
- すべての根拠に通し番号を振る（E01, E02 …）。以降の言及は必ず番号で行う。
- 各ラウンドの末尾で、司会が「証拠が足りていない点」を2〜3個、箇条書きで宣言してから次に進む。
- 相関を因果として語った発言が出たら、司会は即座に差し戻し、機構か比較対照のどちらで支えるのかを言わせる。
- 4名の見解が揃った場合、司会は最も証拠の弱い根拠を指名し、対抗仮説役にそれを崩させる。

# 禁止事項（最重要）
- 実在しない論文・著者・書名・学説・統計を作ること。思い出せない場合は「〜という研究群があると記憶しているが出典は要確認」と書き、著者名や刊行年を埋めてはならない
- 具体的な数値（効果量・割合・年・標本数）を [要確認] を付けずに書くこと
- 水準ラベルのない断定
- 「諸説あります」「研究によって異なります」で締めること
- 専門用語を、測り方の分かる言葉に置き換えずに使い続けること
- 権威（有名な研究者・大学・雑誌の名前）を根拠の代わりに使うこと

# トーン
${tone.text}

# 文体と分量
セリフ形式。1発言250〜450字。主張には必ず根拠番号を添える。
全体で5,000字以上。上限は設けない。網羅より、証拠の強さを見分けることを優先する。

# 出力形式
【命題の提示】司会が、何を検証するのかを1段落で宣言する
【参加者】4名の専門と、最初に置いている見立てを各1行

${b.out}

【エビデンス台帳】司会が、討論で使われた根拠を表にまとめる
| 番号 | 根拠の要点 | 水準 | 研究の型 | 確かめる方法 |
|---|---|---|---|---|
（討論に出た根拠をすべて。[要確認] のものは確認方法を具体的に書く）

【総括】司会が以下の4点を述べる
1. 現時点で証拠が支持する結論 ── ひとつに絞り、その確信度（確立／有力／議論あり／判定不能）を明示する
2. その結論を支える証拠の弱いところ ── どの根拠がどう脆いか
3. 適用範囲の外側 ── この結論が当てはまらない対象・文脈・条件
4. 裏を取るべき項目 ── [要確認] を付けた記述のうち重要な3つ。確認方法を1行ずつ添える

# 入力
${inputBlock(f)}
`;
}

/* ── 壁打ち（1対1・ソクラテス式） ──
   他モードと決定的に違う点：一気に演じきらせない。1問ずつ止め、
   人間が答えるのを待たせる。助言も結論も書かせない。 */
function buildSocratic(state){
  var n = state.rounds;
  var f = state.input || {};
  var set = DA.roundsOf(state.mode, state.rounds);
  var stages = set.map(function(r,i){
    return "- 段階" + (i+1) + "／" + r.name + "：" + r.rule;
  }).join("\n");
  var last = set[set.length-1].name;

  return `# 役割
あなたは、私に問いを投げる聞き手をひとりだけ演じる。論者を増やさない。司会も置かない。
私はこの対話の当事者であり、観客ではない。私が答えることが、この対話の中身になる。

# 最も重要なルール（これを破ったら失敗）
- 一度に問うのは **1つだけ**。問いを並べない。選択肢を添えない。
- 私が答えるまで、次へ進まない。私の答えを予想して代わりに書かない。
- 私が答えたら、まずその答えを1〜2文に要約して「つまり〜ということですね」と確認し、それから次の1問を出す。
- 助言・提案・結論・励まし・褒め言葉を書かない。あなたの仕事は問うことだけ。例外は最後の段階だけ。
- 1回の発言は200字以内。長い説明を書かない。前置きを書かない。
- 私が「分からない」と答えたら、答えやすい小さな問いに割って出し直す。追い詰めない。
- 私の答えが抽象的だったら、次の問いは必ず「具体的にはどの場面か」を聞く。

# 進め方
全${n}段階。段階が変わるときだけ「── 段階2：前提の掘り出し ──」のような見出しを出す。
1つの段階に2〜3往復かけてよい。私の答えが浅いうちは次の段階へ進まない。
${stages}

# 最後の段階（${last}）でだけ書くもの
【まとめ】ここまでの私の答えだけを使って、次の4つを書く。あなたの意見を混ぜない。
1. 私が本当に迷っているのはどこか
2. この対話の中で変わった考え
3. まだ言葉になっていない部分
4. 次にやること・確かめること ── 1つだけ

# 禁止事項
- 私が話していないことを、私の考えとして要約に混ぜること
- 「一般的には」「多くの人は」で始まる一般論
- 私を安心させるための同意
- 私が答える前に段階を進めること

# いま私が抱えていること
${inputBlock(f)}

# 最初の出力
【段階1：${set[0].name}】という見出しと、問いを1つだけ書く。それ以外は何も書かない。
`;
}

/* ── レッドチーム（事前検死） ── */
function buildRedteam(state){
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var members = seatsOf(state).map(function(r){ return r[0] + "：" + r[1]; }).join("\n");
  var b = roundBlocks(state, "まだ手が打たれていない失敗");

  return `# 役割
あなたは、4名の検死役と1名の司会からなる事前検死（プレモータム）を、一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、最後まで進めきること。

# この場の前提（絶対に崩さない）
下の決定はすでに実行された。そして **失敗した**。いま我々は、失敗した後の世界からその原因を振り返っている。
「まだ分からない」「うまくいく可能性もある」といった留保は、この場では一切認めない。全員が失敗を既成事実として語る。

# 参加者
${members}
司会：弁護と楽観を差し戻す。抽象的な失敗（「準備不足」など）を、誰が何をしなかったのかまで具体化させる。最後に打つ手と撤退線をまとめる。

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${b.rules}
- 失敗の筋書きにはすべて通し番号を振る（F01, F02 …）。以降の言及は必ず番号で行う。
- 各ラウンドの末尾で、司会が「まだ手が打たれていない失敗」を2〜3個、箇条書きで宣言してから次に進む。
- 「準備不足」「認識のズレ」「コミュニケーション不足」のような、誰も動けない言葉が出たら、司会は即座に差し戻し、誰が・いつ・何をしなかったのかまで言わせる。
- 同じ原因が3回続いたら、司会は打ち切り、まだ触れられていない側（外部／内部）を指定する。

# 禁止事項
- 対策を先に語ること（防御のラウンドまで持ち越す）
- 「リスクはあるが実行すべき」のような、決定そのものの擁護
- 起こる確率の低さを理由に筋書きを取り下げること
- 撤退の線を「様子を見て判断」で済ませること
- 入力に書かれていない事実の捏造。仮定を置く場合は明示する

# トーン
${tone.text}

# 文体と分量
セリフ形式。失敗の筋書きは過去形で語る。1発言200〜400字。
全体で5,000字以上。上限は設けない。

# 出力形式
【検死の対象】司会が、何が実行され何が失敗したのかを1段落で宣言する
【参加者】4名の担当を各1行

${b.out}

【撤退線の一覧】司会が表にまとめる
| 番号 | 失敗の筋書き | 最初の兆候 | 誰がいつ見るか | 打つ手 | 撤退・中止の線 |
|---|---|---|---|---|---|

【総括】司会が以下の4点を述べる
1. 最も起こりやすい失敗 ── ひとつ選び、その根拠を述べる
2. 最も痛手が大きい失敗 ── ひとつ選び、起きた場合に何が戻せなくなるかを述べる
3. いま既に見えている兆候 ── 入力の中に現れているものを名指しする
4. この決定を変えるとしたらどこか ── 1つだけ提案する。変える必要がないなら、その理由を述べる

# 検死の対象となる決定
${inputBlock(f)}
`;
}

/* ── 関係者総当り ── */
function buildStakeholder(state){
  var n = state.rounds;
  var tone = DA.TONES[state.toneIdx];
  var f = state.input || {};
  var members = seatsOf(state).map(function(r,i){ return (i+1) + ". " + r[0] + "：" + r[1]; }).join("\n");
  var b = roundBlocks(state, "まだ本音が出ていない立場");

  return `# 役割
あなたは、この件に実際に関わる4名と1名の司会を、一人で全員分演じる。私は観客であり、議論には参加しない。私に質問を投げ返さず、最後まで進めきること。

# 参加者（私が指定した実在の立場。役割を勝手に変えない）
${members}
司会：全員が納得したふりをすることを許さない。誰が何を我慢する案なのかを最後に明示する。

# 進行ルール
- 全${n}ラウンド。各ラウンドの目的は固定であり、逸脱しない。
${b.rules}
- 各自は自分の立場の利害だけを代弁する。全体最適の視点で語ってよいのは司会だけ。
- 各ラウンドの末尾で、司会が「まだ本音が出ていない立場」を名指ししてから次に進む。
- 発言には、その立場が実際に口にしそうな言い回しを1つ以上混ぜる。きれいな会議用語だけで話さない。
- 立場が2つ以上で意見が揃ったら、司会は最も弱い立場（決定の場にいない側）を指名し、反対側に立たせる。

# 禁止事項
- 誰も損をしない案を装うこと
- 「みんなで話し合って決める」で終わらせること
- ある立場の利害を、別の立場が代わりに譲ること
- 建前だけの発言（実際に思っていることを必ず併記させる）
- 入力に書かれていない事実の捏造。仮定を置く場合は明示する

# トーン
${tone.text}

# 文体と分量
セリフ形式の会話劇。1発言200〜400字。
全体で5,000字以上。上限は設けない。

# 出力形式
【この件の要点】司会が、何を決めるのかと、決まると誰に何が起きるのかを1段落で宣言する
【参加者】4名の立場と、この件での利害を各1行

${b.out}

【立場の一覧】司会が表にまとめる
| 立場 | 賛否 | いちばん困ること | 降りられる条件 | 譲れない一線 |
|---|---|---|---|---|

【総括】司会が以下の4点を述べる
1. 落としどころ ── ひとつ選び、誰がどの程度我慢する案なのかを明示する
2. いちばん反発する立場と、その理由
3. 決定の場にいない人への影響 ── 見落とされやすい側を名指しする
4. 伝える順番 ── 誰に何をどの順で伝えるか。最初のひとりを明示する

# 議題
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

  var kind = md.key === "ideate" ? "アイデア会議"
           : md.key === "deep" ? "検討"
           : md.key === "academic" ? "学術討論"
           : md.key === "socratic" ? "壁打ちの対話"
           : md.key === "redteam" ? "事前検死"
           : md.key === "stakeholder" ? "関係者の話し合い" : "討論";
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
    }else if(md.key === "academic"){
      rules.push("- issues には証拠をめぐって割れた争点を5〜9個入れる。importance は「命題の当否を左右する度合い」とする。");
      rules.push("- 各 issue の positions では、grounds の冒頭に討論で使われた水準ラベル（[確立] [有力] [議論あり] [限定的] [理論] [要確認]）をそのまま残す。strength は主張の勢いではなく **根拠の強さ** で付ける。");
      rules.push("- moves は各ラウンド × 各論者に最低1つ。方法論上の指摘・対抗仮説には targets（対象の move id）を必ず入れる。");
    }else if(md.key === "socratic"){
      rules.push("- これは4名の討論ではなく1対1の対話である。seat は 1（問い手）と 2（あなた＝人間）の2つだけを使い、3・4は作らない。");
      rules.push("- issues には対話で扱った問いを3〜7個入れる。importance は「その問いが本人の判断を左右した度合い」とする。");
      rules.push("- positions は seat 2（本人）の答えを主とし、seat 1 には問い手が突いた点を入れる。本人が答えていない問いは seat 1 だけでよい。");
      rules.push("- moves は往復の順に並べる。round は対話の段階番号。seat 1 の type は「反論」または「前提提示」、seat 2 は「主張」「譲歩」「転換」を使い分ける。考えが変わった箇所には label（撤回／修正／強化）を必ず付ける。");
    }else if(md.key === "redteam"){
      rules.push("- issues には失敗の筋書きごとの争点を5〜9個入れる。importance は「起きたときの痛手 × 起こりやすさ」とする。label には失敗の内容が分かる名前を付ける。");
      rules.push("- 各 issue の positions には、その失敗に触れた論者全員を入れる。side は決定への賛否ではなく、その筋書きが起こると見るか（賛成）／起こらないと見るか（反対）／条件付きかで判定する。");
      rules.push("- moves は各ラウンド × 各論者に最低1つ。他者の筋書きへの上乗せ・反証には targets（対象の move id）を必ず入れる。");
    }else if(md.key === "stakeholder"){
      rules.push("- seat 番号は私が指定した立場の並び順と一致させる。立場名を勝手に言い換えない。");
      rules.push("- issues には立場の間で正面からぶつかった対立を5〜9個入れる。importance は「決定を左右する度合い」とする。");
      rules.push("- 各 issue の positions には、その対立に関わる立場全員を入れる。claim には建前ではなく、その立場が実際に守ろうとしているものを書く。");
      rules.push("- moves は各ラウンド × 各立場に最低1つ。名指しの衝突には targets（対象の move id）を必ず入れる。");
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
    }else if(md.key === "academic"){
      rules.push("- objections は importance 4以上の論点それぞれについて最低2つ作る。「査読者や指導教員から返ってきそうな指摘」を voice に書き、evidence にはその指摘に返せる根拠を水準ラベル付きで書く。");
      rules.push("- tasks には、討論で [要確認] が付いた記述を裏取り項目として入れる。text に「何を確かめるか」、owner は空文字でよいが、確かめる先（統計・原典・実データ）が分かる書き方にする。");
      rules.push("- summary.blindspots には、この結論が通用しない範囲（対象・文脈・時代）を書く。");
    }else if(md.key === "socratic"){
      rules.push("- summary.recommendation には、本人が対話の中で辿り着いた到達点を書く。あなた（AI）の推奨を書かない。");
      rules.push("- decisions には対話で決まったこと、tasks には最後に決めた「次にやること」を入れる。tasks は多くて2件でよい。");
      rules.push("- objections は「この結論を人に話したときに返ってきそうな一言」を voice に書く。3〜5個。");
      rules.push("- summary.blindspots には、本人がまだ言葉にできていない部分を書く。ideas と risks は該当がなければ空配列 [] でよい。");
    }else if(md.key === "redteam"){
      rules.push("- risks がこのモードの主産物である。**最低8個**入れる。text は失敗の筋書き、likelihood は起こりやすさ、impact は起きたときの痛手、mitigation には「打つ手」と「撤退・中止の線」を1文にまとめて入れる。");
      rules.push("- tasks には兆候の見張りを入れる。text に「誰が・いつ・何を見るか」が分かる形で書く。");
      rules.push("- decisions には司会が最後に示した「決定を変えるならどこか」を入れる。変えないと判断した場合もその旨を入れる。");
      rules.push("- objections は「この検死結果を持っていったときに返ってきそうな反論（考えすぎだ、など）」を voice に書く。");
    }else if(md.key === "stakeholder"){
      rules.push("- decisions には落としどころと、誰がどの程度我慢する案なのかを rationale に書く。");
      rules.push("- tasks には「誰に何をどの順で伝えるか」を、伝える順に並べて入れる。owner にはその立場の名前を入れる。");
      rules.push("- objections は立場ごとに最低1つ作る。from にその立場名を入れ、voice にはその人が実際に言いそうな言い回しをそのまま書く。");
      rules.push("- summary.blindspots には、決定の場にいない人への影響を書く。");
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

/* 壁打ちの続き：卓を開かず、1問ずつ止まる形で未解決項目を扱う */
function followupSocratic(rec, issues, opts){
  var n = opts.rounds || 2;
  var set = DA.roundsOf("socratic", n);
  var stages = set.map(function(r,i){ return "- 段階" + (i+1) + "／" + r.name + "：" + r.rule; }).join("\n");
  var hist = historyBlock(rec);

  return `# 役割
前回までの検討の続きを、1対1の壁打ちで行う。あなたは問いを投げる聞き手をひとりだけ演じる。
私はこの対話の当事者であり、答える側である。

# 最も重要なルール（これを破ったら失敗）
- 一度に問うのは **1つだけ**。私が答えるまで次へ進まない。私の代わりに答えを書かない。
- 私が答えたら、その答えを1〜2文に要約して確認してから、次の1問を出す。
- 助言・提案・結論を書かない。問うことだけをする。例外は最後のまとめだけ。
- 1回の発言は200字以内。

# 前回までの到達点
議題：${line((rec._input && rec._input.topic) || rec.meta.title)}
${hist || "（結論の記録なし）"}

# 今回ほぐす項目（これ以外に話を広げない）
${issueBrief(rec, issues)}
${opts.extra ? "\n# 今回の追加条件\n" + opts.extra + "\n" : ""}
# 進め方
全${n}段階。段階が変わるときだけ見出しを出す。1段階に2〜3往復かけてよい。
${stages}
- 前回の記録に書かれている内容を私に読み上げない。私が今どう思っているかだけを聞く。

# 最後に書くもの
【まとめ】私の答えだけを使って、次の3つを書く
1. 今回はっきりしたこと
2. まだ決められないことと、その理由
3. 次にやること・確かめること ── 1つだけ

# 最初の出力
【段階1：${set[0].name}】という見出しと、上の項目についての問いを1つだけ書く。それ以外は何も書かない。
`;
}

/* opts = { kind:"debate"|"ideate"|"deep"|"academic"|"socratic"|"redteam"|"stakeholder", rounds:2, extra:"追加指示" } */
DA.buildFollowupPrompt = function(rec, issues, opts){
  opts = opts || {};
  var kind = opts.kind || "debate";
  var md = DA.findMode(kind);
  var n = opts.rounds || 2;
  if(kind === "socratic") return followupSocratic(rec, issues, opts);
  var set = DA.roundsOf(kind, n);
  var tone = DA.TONES[2];
  var hist = historyBlock(rec);

  var rules = set.map(function(r,i){ return "- ROUND " + (i+1) + "／" + r.name + "：" + r.rule; }).join("\n");
  var out = set.map(function(r,i){
    return "── ROUND " + (i+1) + "：" + r.name + " ──\n（4名の発言" + r.out + "）";
  }).join("\n\n");

  var aim =
    kind === "ideate"   ? "下の未解決項目を **解くための案** を出し切る。論の是非ではなく、打ち手を増やして選ぶ。"
  : kind === "deep"     ? "下の未解決項目を **掘り下げる**。決着させることより、なぜそこで詰まっているのかを解明する。"
  : kind === "academic" ? "下の未解決項目を **証拠に照らして判定する**。意見の強さではなく、根拠の水準で優劣を決める。"
  : kind === "redteam"  ? "下の未解決項目について、**それが原因で全体が失敗した世界から振り返る**。決着させるより、放置した場合に何が起きるかを洗い出す。"
  : kind === "stakeholder" ? "下の未解決項目を **関係者それぞれの利害から詰める**。正しさではなく、誰が何を我慢すれば動くのかを決める。"
  :                       "下の未解決項目を **詰め直して決着させる**。";

  var closing =
    kind === "ideate"   ? "【決着】司会が、この項目に対する打ち手を1つ選び、最初の一歩と、やめる判断基準を述べる。選ばなかった有力案も1つ挙げる"
  : kind === "deep"     ? "【決着】司会が、項目ごとに「ここまでは言える」「まだ言えない」「次に確かめる」を1行ずつ述べる"
  : kind === "academic" ? "【決着】司会が、項目ごとに証拠が支持する側を明言し、その確信度（確立／有力／議論あり／判定不能）と、この判定を覆しうる観察を1つ挙げる。あわせて [要確認] の裏取り項目を箇条書きにする"
  : kind === "redteam"  ? "【決着】司会が、項目ごとに最初の兆候・見張る人・打つ手・撤退の線を1行ずつ述べる。手が打てない項目は「受け入れるリスク」として明示する"
  : kind === "stakeholder" ? "【決着】司会が、項目ごとに落としどころと、誰がどの程度我慢する案なのかを明言する。飲めない立場があれば名指しし、その人に何を伝えるかまで述べる"
  :                       "【決着】司会が、項目ごとにどちらを採るかを明言する。まだ判断できない項目は「何が分かれば決まるか」を1つ挙げる";

  var kindRule =
    kind === "academic" ? "\n- すべての根拠の冒頭に水準ラベルを付ける（" + LEVEL_TAGS + "）。実在しない論文・著者・数値を作らない。思い出せない出典は [要確認] とし、著者名や刊行年を埋めない。"
  : kind === "redteam"  ? "\n- 上の項目が原因で全体が失敗した、という前提を崩さない。「まだ分からない」「うまくいく可能性もある」という留保を認めない。失敗の筋書きは過去形で語る。\n- 「準備不足」のような誰も動けない言葉が出たら、司会が誰が・いつ・何をしなかったのかまで言わせる。"
  : kind === "stakeholder" ? "\n- 各自は自分の立場の利害だけを代弁する。全体最適で語ってよいのは司会だけ。\n- 誰も損をしない案を装わない。飲めない立場が残る場合は、それを隠さず名指しする。"
  : "";

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
- 上に挙がっていない論点に話を広げない。広がったら司会が即座に戻す。${kindRule}

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
  if(kind === "academic"){
    rules.push("- positions の grounds は、冒頭に水準ラベル（" + LEVEL_TAGS + "）を付けたまま書く。strength は根拠の強さで付ける。");
    rules.push("- tasks には今回 [要確認] が付いた裏取り項目を入れる。確かめる先（統計・原典・実データ）が分かる書き方にする。");
  }
  if(kind === "socratic"){
    rules.push("- これは1対1の対話である。seat は 1（問い手）と 2（あなた＝人間）だけを使う。");
    rules.push("- moves は往復の順に並べ、考えが変わった箇所には label（撤回／修正／強化）を付ける。");
    rules.push("- summary_update.recommendation には本人の到達点だけを書く。AI の推奨を混ぜない。");
  }
  if(kind === "redteam"){
    rules.push("- risks を最低5個入れる。mitigation には「打つ手」と「撤退・中止の線」を1文にまとめる。");
    rules.push("- tasks には兆候の見張り（誰が・いつ・何を見るか）を入れる。");
  }
  if(kind === "stakeholder"){
    rules.push("- objections は今回発言した立場ごとに最低1つ作り、from にその立場名を入れる。");
    rules.push("- tasks には「誰に何をどの順で伝えるか」を、伝える順に並べて入れる。");
  }

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
