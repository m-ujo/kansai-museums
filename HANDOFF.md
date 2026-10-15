# 引き継ぎメモ（2026-10-15 クラウドのセッションから Mac へ）

このメモは、claude.ai のクラウドで進めてきた作業を、Mac の Claude Code の新しいセッションで続けるためのものです。仕組みの詳細は `README.md` にあります。このメモは「いまの状態」と「次にやること」をまとめています。

## 1. Mac での始め方

```bash
# 初回だけ（すでにクローンがあれば clone は不要）
git clone https://github.com/m-ujo/bid-monitor.git
cd bid-monitor
git switch main          # origin に古い kansai-museums ブランチが残っているが使わない
git pull origin main
node -v                  # 18 以上。無ければ brew install node
claude
```

最初のメッセージの例:

> kansai-museums/HANDOFF.md と kansai-museums/README.md を読んで、「4. 次にやること」の1から進めて。

- iPhone からも操作したい場合は、Mac のセッションで `/remote-control` を実行する。Mac をスリープさせないこと（蓋を閉じない。必要なら別のターミナルで `caffeinate -i`）。
- 前のクラウドのセッション（`session_01V284jhcGHnP9bUQczbWovK`）は会話が長いので、引き継がずに新しく始める方針。会話ごと移したい場合は、Mac のこのフォルダで `claude --teleport session_01V284jhcGHnP9bUQczbWovK`。

## 2. いまの状態（2026-10-15 時点）

| 項目 | 内容 |
|---|---|
| 公開ページ | https://m-ujo.github.io/bid-monitor/kansai-museums/ （main の `kansai-museums/index.html` を GitHub Pages が配信） |
| claude.ai の Artifact 版 | https://claude.ai/artifact/NQRBtUq2Qfs2Q6hfkNwqzv （`node build.js --artifact` で作る `artifact.html` を publish。`artifact.html` はコミットしない） |
| 館 | 132館（大阪・京都・兵庫・奈良・滋賀・和歌山・三重） |
| 展覧会 | 174件（すべて会期中か開催予定）。リンク先は official 137 / index 24 / news 6 / listing 6 / pdf 1 |
| 確度 medium の展覧会 | 34件 |
| 展覧会が1件も登録されていない館 | 46館（長期休館の4館を除く） |
| 長期休館として登録済み | moco（東洋陶磁）, himeji-art, kosetsu-mikage, irie |
| 特集 | 14件（README の「12本」は古い数） |

ファイルの役割と直し方:

- `src/` が編集する元データとコード。直したら `node build.js` で `index.html` を作り直し、`src/` と `index.html` を一緒にコミットする（`index.html` を直接編集しない）。
- `build.js` はファイルをつなげるだけで構文を確かめない。手で直したら、下の 4-2 の一覧コマンドがエラーなく動くことを確かめてから build する。画面は `open index.html` で確かめる。
- `src/data-<府県>.js` が館、`src/data-exhibitions.js` が展覧会（1行1件）と `EX_INDEX_URLS`（館の展覧会一覧ページ）、`src/data-collections.js` が特集。
- 既存の展覧会の行を直すときは `src/data-exhibitions.js` を手で編集する。`scripts/apply-added.js` は館とタイトルの組で行を探すので、タイトルを直す用途に使うと古い行が残って新しい行が増える。
- 新しい展覧会を足すときは `scripts/apply-added.js` を使うと便利。行を検証し、調べた館を `research/checked.json` に記録するので、定期タスクが同じ館を重ねて調べない。使い方はファイル冒頭のコメントにある（`--asof <今日>` で `DATA_ASOF` も書き換わる）。
- `src/app.js` の `DATA_ASOF` がデータの基準日。更新チェックの目印にも使っている。
- `research/candidates.json` は Actions が、`research/checked.json` は `apply-added.js` が書くファイル。

## 3. 自動更新（いま動いているもの）

| 時刻（JST） | 何が | 内容 |
|---|---|---|
| 月・木 06:40 | GitHub Actions `kansai-museums-update.yml` | `scripts/update-links.js`。館の一覧ページを取得して個別ページのリンクを自動設定、リンク切れの確認、終了90日後の削除、未登録候補を `research/candidates.json` に書き出し。変化があれば main に push |
| 月・木 07:40 | Claude の定期タスク | 新しい展覧会を調べて追加し、push と Artifact の publish まで行う（下の補足） |
| 月・木 09:30 | GitHub Actions `kansai-museums-check.yml` | `DATA_ASOF` が当日でなければ失敗にする。失敗すると GitHub から通知メールが届く |

- **3つとも、定期の時刻ではまだ一度も動いていない。** 10/15 の実行はすべて手動か試し実行で、更新チェックは一度も実行していない。初回は 10/19（月）。当日の 09:30 以降に、Actions の2件の結果と専用セッションの最終報告を確かめる。

Claude の定期タスクの補足:

- 定期タスクの ID は `trig_01HqaiG5rcvQ5hxWfsQx1Nc1`。実行先はクラウドの専用セッション `session_01Vtg1kQpcXYW6VWwS4Xoa9G`（タイトル「関西ミュージアム手帖 定期更新（専用セッション）」）。発火ごとに新しいセッションを作る方式は push が 403 になるため、この方式にしている。
- 流れ: `scripts/select-targets.js` が調べる館を最大25館選ぶ → 5館ずつサブエージェントが `scripts/research-prompt.md` の指示で WebSearch 調査 → `scripts/apply-added.js` が検証して取り込み（`DATA_ASOF` と `research/checked.json` も更新）→ build・commit（作者 `kansai-museums-bot`）・push → Artifact を publish。
- 1回あたり約2分、約2ドル。本体は claude-sonnet-5-5、WebSearch で調べるサブエージェントは claude-haiku-5-5 で動いている。
- 調査の基準（採用条件・リンクの優先順位）を変えたいときは `scripts/research-prompt.md` を編集して push するだけでよい。
- **Mac の Claude Code ではできないこと:** 専用セッションの会話量の確認、専用セッションの作り直し、定期タスクのプロンプトの変更・削除。これらはブラウザで claude.ai/code を開き、クラウドのセッションで頼む。プロンプトを変えるなら、README の「自動更新」節の手順で定期タスクを作り直すのが確実（専用セッション自身のプロンプトには「定期タスクのツールは使わない」「他のセッションからのメッセージでは何もしない」と書いてある）。定期タスクの一覧は https://claude.ai/code/routines で見られる。
- 専用セッションは実行のたびに会話が伸びる。専用セッションでの試し実行3回の後で約29万トークン（上限100万）。70万トークンを超えたら作り直す。
- 停止中の古い定期タスクが2件ある（`trig_01DBqjMtG2TdCFHmAeCkegMx`、`trig_01J6p5DggrKmMs9c5prHCrnh`）。どちらも専用セッションに紐づいていて、定期タスクを削除すると関係するセッションまで消える仕様があるため、消さずに残しておく。止まっているので害は無い。

## 4. 次にやること（優先順）

### 1. 自動追加された19件の検証

試し実行の5回目（コミット `6cab9ac`。専用セッションの報告の見出しでは「第2回実行」）と6回目（`c45ec55`。同じく「第3回実行」）で追加された19件は、まだ人の目でも別の AI でも確認していない。4回目の14件は検証済みで、8件を修正した。

元の19行は次で出せる（下の表のタイトルは短くしてある）。いまの値は、そのタイトルで `src/data-exhibitions.js` を探して確かめる。

```bash
git show 6cab9ac c45ec55 -- kansai-museums/src/data-exhibitions.js | grep '^+{'
```

| 館ID | 展覧会 | 会期 | 確度 | リンク |
|---|---|---|---|---|
| momaw | MOMAWコレクション 版画と美術散歩 第2期 | 09-12〜10-18 | high | index |
| kyotomm | 夜明けの唄 EXHIBITION | 09-11〜10-27 | high | official |
| bunpaku | 総合展示 田能村直入と近代京都の南画 | 10-03〜11-29 | medium | index |
| bunpaku | 特別展 ジミー大西「ホームタウン」京都展 | 12-05〜2027-02-07 | high | index |
| otsu | 第198回ミニ企画展 葉屋傳兵衛家文書を紐解く | 2027-01-06〜03-14 | medium | index |
| osaka-city-art | 円山応挙 リアルの先へ 空間革命 | 2027-02-06〜04-04 | high | official |
| aham | エリック・カール展 | 2027-03-20〜05-09 | high | official |
| osaka-city-art | 復活！武藤山治コレクション | 2027-04-24〜06-20 | medium | official |
| osaka-city-art | シンシナティ美術館展 | 2027-07-17〜09-26 | high | official |
| heijo | サクッと知りたい平城宮跡～秋の味覚編。 | 10-01〜10-18 | medium | news |
| dento | 「珈琲とうつわ」6th | 10-16〜10-30 | medium | official |
| bbplaza | 上前智祐の自画道 | 09-15〜11-08 | high | index |
| himeji-lit | やなせたかし展 | 09-19〜11-23 | high | news |
| fashion | 水木しげる 魂の漫画展 | 09-12〜11-29 | high | official |
| genji | 描かれる源氏物語 | 09-16〜11-29 | high | official |
| akashi | 特別展 はじめ展 | 07-30〜12-06 | high | official |
| genji | 寿ぐ！屏風絵 | 12-02〜2027-02-14 | high | official |
| wakayama-museum | 企画展 きのくに工芸のきらめき | 2027-02-27〜04-11 | high | index |
| genji | あっ、この場面知ってます | 2027-02-17〜04-18 | high | official |

年の無い会期は 2026年。確認のしかた:

- **ページは原文で見る:** `curl -sL <URL>` で取得して、会期とタイトルを原文の文字で照合する。WebFetch は小さなモデルの要約なので、日付の細部を取り違えることがある。本文が JavaScript で描かれていて取れないページは、Playwright で開くかユーザーに見てもらう。
- **その展覧会のページか:** 同じ URL を複数の展覧会が `official` で使っていたら、年間予定のページの可能性が高い（genji の3件がそう。ほかに saiku・kuwana・norinaga にもある）。展覧会ごとのページが無ければ `kind` を `index` にする。
- **展覧会と呼べるか:** heijo の「サクッと知りたい平城宮跡」は短い解説イベントの可能性がある。bunpaku の「田能村直入と近代京都の南画」は特別展ではなく総合展示で、調べたサブエージェントも載せるかの判断を求めていた。
- **Codex に確かめさせる:** `-s read-only` の Codex はネットに出られない。Claude が `curl` で取ったページをリポジトリの外（例: `~/kmt-check/`）に保存し、それを Codex に渡して照合させる。例: `codex exec -C ~/kmt-check --skip-git-repo-check -s read-only "保存したページと、bid-monitor/kansai-museums/src/data-exhibitions.js の該当行を照合し、タイトル・会期・URL の食い違いを一覧にして"`。

サブエージェントが書き残していた手がかり:

- **kyotomm:** 会場の表記が「ギャラリー4」と「1階多目的映像ホール」で食い違っていた（会期は一致）。
- **武藤山治展:** タイトルの表記が公式と artagenda で揺れている。`src` は museum.or.jp の館ページのまま。
- **momaw:** 個別ページの候補 https://www.momaw.jp/exhibit/2026col_prints_2nd/ があった。実在すれば `page` を差し替える。
- **bbplaza:** 会期の根拠は検索結果の要約だけで、`src` は公式トップなのに確度は high。
- **otsu の第198回:** 会期は検索結果の要約によるもので、kikakuten.html の本文では未確認。

### 2. 確度 medium の34件を公式サイトで確かめる

検索結果だけで登録したものが多い。公式ページで確認できたら `conf` を `high` にし、`src` もそのページの URL にする。違っていれば直す。一覧は `kansai-museums` で次を実行すると出る。

```bash
node -e "const fs=require('fs');const ex=new Function(fs.readFileSync('src/data-exhibitions.js','utf8')+';return EXHIBITIONS')();for(const e of ex.filter(e=>e.conf==='medium'))console.log(e.m,'|',e.title,'|',e.start,'~',e.end,'|',e.page||'-')"
```

既存データについて報告されていた注意:

- **白鶴美術館:** 公式の「展覧会情報」ページは更新が遅れていて、「開催中」欄に2025年以前の展覧会名が残っている。秋季展のリンク先がこのページなので、個別ページがあれば差し替える。
- **大阪市立科学館:** 登録済みの「月から火星へ」は会期を検索で確認できなかった。

### 3. 定期タスクが「要確認」「見送り」とした項目

公式サイトで確かめて、確定したら追加・修正する。

- **京都国立博物館:** 一覧ページに「雛まつりと人形」（2027-02-13〜03-22）、「嘉禄の法難800年」（2026-12-22〜2027-01-24）、「阿弥派の絵画Ⅰ」（同）が会期付きで載っていたが、検索では確認できず未登録。
- **あべのハルカス美術館:** 「HOKUSAI ―北斎が「北斎」だった時代―」（2027-05-22〜07-19）。個別ページが見つからず未登録。
- **細見美術館:** 次回展「絹の美、織の技 ―山口伊太郎と「源氏物語錦織絵巻」(仮)」（2027-03-06〜05-09）。仮称のため未登録。
- **松伯美術館:** 「上村三代の下絵と本画 －また初公開も－（仮）」（2027-03-13〜07-19）。仮称のため未登録。
- **芦屋市立美術博物館:** 「再考：具体／絵画」（2027-03-09〜05-30）。出典が情報サイトの館ページだけで、正式タイトルも未確認のため未登録。
- **滋賀県立琵琶湖博物館:** 第35回学芸員のこだわり展示「秀吉の湖上支配」（2026-08-04〜2027-09-13）。「開催予定」のページに載っているのに開始日が過去で、会期も約1年と長い。正しい会期を確かめるまで未登録。
- **平城宮跡資料館:** 秋期特別展「地下の正倉院展」（10-15〜11-13）。出典が公式の展覧会ページではないため未登録。
- **京都伝統産業ミュージアム:** 「Tradition Meets Today #7」京都市産業技術研究所支援企画展示（10-01〜12-28）。出典が2024年のシリーズページだけなので未登録。
- **比叡山延暦寺 国宝殿:** 秋季企画展「知りたい!!比叡山のほとけ様」。10/8 付の告知はあるが会期が未確認で未登録。
- **大津市歴史博物館:** 第191回ミニ企画展「新知恩院の十六羅漢図」（10/28〜11/30）と第192回「大津宿・街道・浮世絵」（12/2〜12/26）。曜日が2025年のもので、前年の掲載とみて未登録。今年度の日程を公式で確かめる。
- **市立伊丹ミュージアム:** 「伊丹っ子作品展」（10/27〜10/31）。日付に年がなく、子ども向けの小規模な展示のため未登録。載せるかは判断する。
- **長浜市曳山博物館:** 秋の企画展（09-09〜12-13 の可能性）。出典は museum.or.jp の館ページの表示だけで、タイトルも未確認。
- **彦根城博物館:** テーマ展「井伊家の家紋」（12-12 頃から）。会期未確定。
- **安土城考古博物館:** 第68回企画展と、秋季特別展「天下人の城下町～安土」の会期が未確認。
- **宝塚市立手塚治虫記念館:** 第99回企画展「吉田まゆみ☆ポップワールド」。会期不明で未登録。
- **高野山霊宝館:** 第46回大宝蔵展「高野山の名宝 ～大集合！金剛峯寺の宝物～」の会期が未確認（7月の予定表に載っているという記述だけ）。
- **京都文化博物館:** 追加した2件の出典は特別展スケジュールのページで、個別ページは未特定。
- **和歌山県立紀伊風土記の丘:** 「休館記念冬期特別展」や工事の記述があり、長期休館の可能性。確定したら `src/data-wakayama.js` の該当館に `closure` を書く。
- **サブエージェントの報告だけにある未確認の候補（会期かタイトルが不明で未登録）:** 兵庫県立人と自然の博物館「但馬牛博物館×ひとはくコラボ展2026」、滋賀県立美術館「小倉遊亀コーナー」（候補では 2026-02-25〜2027-04-04）、平城宮いざない館の関連展示「平城遷都」、姫路文学館「十二国記」山田章博原画展、京都伝統産業ミュージアム「たくしもの」伝統の虫 vol.18（11/3〜8、年不明）、芦屋市立美術博物館「北斎漫画と月岡芳年」、和歌山県立近代美術館「建築とデザイン」、大阪市立自然史博物館の大和川の特別展（2027年3月、タイトル未定）、奈良県立美術館「第77回奈良県美術展覧会」（12月中旬、日時未定）。
- **臨時休館のお知らせ（データには未記入）:** 比叡山延暦寺 国宝殿（10/8 付の告知、期間不明）、京都伝統産業ミュージアム（10月、日程不明）、高野山霊宝館（展示替えに伴う臨時休館日の告知、期間不明）、大和文華館（10/19〜23 展示替え）、神宮美術館（11/6・12/11）、滋賀県立美術館（12/17〜21 の展示替え。11/24〜12/8 は `shiga-art` に登録済み）。
  - 期間が決まったものを載せるなら、館データの `closedRanges` と `notice` を使う。`closedRanges` の日は理由に関係なく「本日休館（展示替え）」と表示される。
  - 12/28〜1/4 はアプリが全館を「年末年始・要確認」と表示するので、年末年始の休館は登録しない。

### 4. 公開ページを実際のブラウザで確認する

クラウドからは GitHub Pages を開けなかったので、公開版を実機で一度も見ていない。Chrome とスマホでの確認はユーザーに頼む。

- 地図タブで地図タイル（OpenStreetMap）が出て、点を押すとポップアップが開くか。ピンチやホイールで拡大縮小できるか。
- 展覧会タブの「タイムライン」「館ごと」「リスト」の表示と、展覧会名のリンク先。
- 「今日開いている館」の判定。アプリには日付を変える仕組みが無いので、Claude が Playwright の `page.clock.setFixedTime('2026-11-23T10:00:00+09:00')` で日付を固定して確かめる。11/23 は月曜の祝日なので月曜休館の館は開館、翌 11/24 は休館になるはず。

### 5. 展覧会が未登録の46館

46館のうち40館は、定期タスクがまだ調べていない（`research/checked.json` に記録なし）。10/19 と 10/22 の実行で順に回る見込み。調べて0件だった館は28日間は対象から外れる。その結果を見てから、0件の館を Mac で公式サイトから直接調べると早い。46館の一覧は `kansai-museums` で次を実行すると出る（`select-targets.js` は最近0件だった館を飛ばすので使わない）。

```bash
node -e "const fs=require('fs');const S=p=>fs.readFileSync('src/'+p,'utf8');const F=['osaka','kyoto','hyogo','nara','shiga','wakayama','mie'];const M=new Function(F.map(f=>S('data-'+f+'.js')).join('\n')+';return [].concat('+F.map(f=>'MUSEUMS_'+f.toUpperCase()).join(',')+')')();const [ex,ix]=new Function(S('data-exhibitions.js')+';return [EXHIBITIONS,EX_INDEX_URLS]')();const t=new Date().toISOString().slice(0,10);const has=new Set(ex.filter(e=>e.end>=t).map(e=>e.m));for(const m of M){if(m.closure||has.has(m.id))continue;console.log(m.id,'|',m.name,'|',ix[m.id]||m.url)}"
```

## 5. これまでに分かっている注意点

- **コミットと push:** 直したら `src/` と `index.html` を一緒に main へ直接 commit・push する（ブランチや PR は作らない。Pages は main を配信している）。作者は Mac の git 設定のままでよい（`kansai-museums-bot` は自動更新専用）。
- **main への push が重なる時間:** 月・木の 06:40〜08:00 は Actions と定期タスクが main に push する。手で push するときは先に `git pull --rebase origin main`。`index.html` が衝突したら、`src/` だけ直して `node build.js` で作り直したものを使う。
- **リンクの法則:** 公式の個別ページ（official）＞ 公式のお知らせ（news）＞ 情報サイトの個別ページ（listing）＞ 公式 PDF（pdf）＞ 館の一覧ページ（index）。URL は推測で作らない。一覧ページ内に展覧会ごとの id がある館はアンカー付き URL を使う（例: https://www.sci-museum.jp/event/#pl29139 ）。artagenda や museum.or.jp の「館ページ」は展覧会ページではない。`page` に使うと `apply-added.js` が拒否するが、`src` は検査しない。
- **`closure` は長期休館専用で、自動では消えない:** 設定した時点でその館は「休館中」と表示され、定期タスクの調査対象からも外れる。irie（2027-03-15 まで）、moco（2027年4月頃まで）、himeji-art（2027年12月末まで）は、再開したら手で消す。期間の決まった休館は `closedRanges`（`[["YYYY-MM-DD","YYYY-MM-DD"]]`）と `notice` に書く。
- **`added:true`** は三重県の初期データの目印。新しい行には付けない。
- **`update-links.js` を手元で実行するとデータを書き換える。** 普段は Actions に任せる。手元で試すときは差分を確かめてからコミットする。テスト用に `KMT_FIXTURES=<dir>` で一覧ページの代わりにローカルの HTML を読ませられる。
- **自動リンクの誤り対策:** 一覧ページの汎用アンカー（`#pan`, `#menu`, `#pannavi` など）は `update-links.js` の `GENERIC_ID` で除外している。新しい誤りを見つけたらここに足す。
- **Artifact 版への反映:** Mac でデータを直して push すれば、次の定期実行（月・木 07:40）が最新の main から Artifact を publish し直す。すぐに反映したいときだけ手で publish する（`node build.js --artifact` で `artifact.html` を作り、Artifact ツールで同じ URL に publish。同じ会話で一度 read してからでないと拒否される）。Mac のセッションに Artifact ツールが無ければ、次の定期実行に任せる。
- **クラウドの制約（参考）:** クラウドのセッションからは館の公式サイトと github.io が開けず、WebSearch だけで調べている。Mac ではこの制約はない。
- **失われた一時ファイル:** 地図（Leaflet と概略図）のピンチ・ドラッグ・ホイールでの拡大縮小と、拡大しても線が太くならないことを確かめる Playwright のテストは、クラウドの一時フォルダにしかなく、リポジトリには入っていない。関連するコミットは `c0221f9` と `715a69f`。作り直すときは Playwright をリポジトリの外（例: `~/kmt-test/`）に入れる（リポジトリには package.json も、.gitignore の node_modules も無いため）。

## 6. Mac での Codex と Gemini の使い方

他のセッションで実際に使っていた形:

```bash
# Codex（読み取り専用。ネットには出られない）
codex exec -C <作業フォルダ> --skip-git-repo-check -s read-only "（日本語の指示）"

# Gemini（agy コマンド経由）
agy -p "（指示）" --mode plan --model gemini-3.1-pro-high
```

- macOS には `timeout` コマンドが無い（使うなら coreutils の `gtimeout`）。
- 外部 AI に渡してよいのは公開情報だけ（クライアント名・金額・個人情報は渡さない）。このプロジェクトのデータは公開情報なので問題ない。使ったら、どの AI に何をさせたかを一行残す。
