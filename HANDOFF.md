# 引き継ぎメモ（2026-10-15 クラウドのセッションから Mac へ）

このメモは、claude.ai のクラウドで進めてきた作業を、Mac の Claude Code の新しいセッションで続けるためのものです。仕組みの詳細は `README.md` にあります。このメモは「いまの状態」と「次にやること」をまとめています。

## 1. Mac での始め方

```bash
# 初回だけ（すでにクローンがあれば git pull だけでよい）
git clone https://github.com/m-ujo/bid-monitor.git
cd bid-monitor
git pull origin main
claude
```

最初のメッセージの例:

> kansai-museums/HANDOFF.md と kansai-museums/README.md を読んで、「4. 次にやること」の1から進めて。

- iPhone からも操作したい場合は、Mac のセッションで `/remote-control` を実行し、Mac を起動したままにしておく。
- 前のクラウドのセッション（`session_01V284jhcGHnP9bUQczbWovK`）は会話が長いので、引き継がずに新しく始める方針。会話ごと移したい場合は Mac のこのフォルダで `claude --teleport session_01V284jhcGHnP9bUQczbWovK`。

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
| 特集 | 14件 |

ファイルの役割:

- `src/` が編集する元データとコード。`node build.js` で `index.html` を作り直して一緒にコミットする（`index.html` を直接編集しない）。
- `src/data-<府県>.js` が館、`src/data-exhibitions.js` が展覧会（1行1件）と `EX_INDEX_URLS`（館の展覧会一覧ページ）、`src/data-collections.js` が特集。
- `src/app.js` の `DATA_ASOF` がデータの基準日。更新チェックの目印にも使っている。
- `scripts/` に自動更新用のスクリプト（下の表）。`research/candidates.json` と `research/checked.json` は自動更新が書くファイル。

## 3. 自動更新（いま動いているもの）

| 時刻（JST） | 何が | 内容 |
|---|---|---|
| 月・木 06:40 | GitHub Actions `kansai-museums-update.yml` | `scripts/update-links.js`。館の一覧ページを取得して個別ページのリンクを自動設定、リンク切れの確認、終了90日後の削除、未登録候補を `research/candidates.json` に書き出し。変化があれば main に push |
| 月・木 07:40 | Claude の定期タスク | 新しい展覧会を調べて追加し、push と Artifact の publish まで行う（下の補足） |
| 月・木 09:30 | GitHub Actions `kansai-museums-check.yml` | `DATA_ASOF` が当日でなければ失敗にする。失敗すると GitHub から通知メールが届く |

Claude の定期タスクの補足:

- 定期タスクの ID は `trig_01HqaiG5rcvQ5hxWfsQx1Nc1`。実行先はクラウドの専用セッション `session_01Vtg1kQpcXYW6VWwS4Xoa9G`（タイトル「関西ミュージアム手帖 定期更新（専用セッション）」）。発火ごとに新しいセッションを作る方式は push が 403 になるため、この方式にしている。
- 流れ: `scripts/select-targets.js` が調べる館を最大25館選ぶ → 5館ずつサブエージェントが `scripts/research-prompt.md` の指示で WebSearch 調査 → `scripts/apply-added.js` が検証して取り込み（`DATA_ASOF` と `research/checked.json` も更新）→ build・commit（作者 `kansai-museums-bot`）・push → Artifact を publish。
- 調査の基準（採用条件・リンクの優先順位）を変えたいときは `scripts/research-prompt.md` を編集して push するだけでよい。定期タスクのプロンプト本体は、その専用セッションの会話の中からしか変更できない（別の会話から `update_trigger` で変えようとすると拒否される）。
- 停止中の古い定期タスクが2件ある: `trig_01DBqjMtG2TdCFHmAeCkegMx` と `trig_01J6p5DggrKmMs9c5prHCrnh`。不要なので削除してよい。
- 専用セッションは実行のたびに会話が伸びる（10/15 の試し実行3回後で約29万トークン、上限100万）。70万トークンを超えたら作り直す。手順は README の「自動更新」節。
- 1回あたり約2分、約2ドル（モデル claude-sonnet-5-5）。

## 4. 次にやること（優先順）

### 1. 自動追加された19件の検証

試し実行の5回目（コミット `6cab9ac`）と6回目（`c45ec55`）で追加された19件は、まだ人の目でも別の AI でも確認していない（4回目の14件は検証済みで、8件を修正した）。Mac では館の公式サイトを直接開けるので、ページの中身と会期を確かめる。Codex にも同じ確認をさせると良い。

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

年の無い会期は 2026年。確認の観点は、会期とタイトルが公式の記載どおりか、`page` の URL が実在してその展覧会のページか（`kind` が正しいか）、展示替えのイベントなど「展覧会」と呼べないものが混じっていないか（heijo の「サクッと知りたい平城宮跡」は短い解説イベントの可能性がある）。

### 2. 確度 medium の34件を公式サイトで確かめる

検索結果だけで登録したものが多い。公式ページで確認できたら `conf` を `high` にし、違っていれば直す。一覧は次で出せる。

```bash
cd kansai-museums
node -e "const fs=require('fs');const ex=new Function(fs.readFileSync('src/data-exhibitions.js','utf8')+';return EXHIBITIONS')();for(const e of ex.filter(e=>e.conf==='medium'))console.log(e.m,'|',e.title,'|',e.start,'~',e.end,'|',e.page||'-')"
```

### 3. 定期タスクが「要確認」として残した項目

追加を見送ったもの、または確認が必要と報告されたもの。公式サイトで確かめて、確定したら追加・修正する。

- **京都国立博物館:** 一覧ページに「雛まつりと人形」（2027-02-13〜03-22）、「嘉禄の法難800年」（2026-12-22〜2027-01-24）、「阿弥派の絵画Ⅰ」（同）が会期付きで載っていたが、検索では確認できず未登録。
- **あべのハルカス美術館:** 「HOKUSAI ―北斎が「北斎」だった時代―」（2027-05-22〜07-19）。個別ページが見つからず未登録。
- **細見美術館:** 次回展（2027-03-06〜05-09）。タイトルが仮称のため未登録。
- **松伯美術館:** 「上村三代の下絵と本画 －また初公開も－（仮）」（2027-03-13〜07-19）。仮称のため未登録。
- **芦屋市立美術博物館:** 「再考：具体／絵画」（2027-03-09〜05-30）。出典が情報サイトの館ページだけで、正式タイトルも未確認のため未登録。
- **滋賀県立琵琶湖博物館:** 「秀吉の湖上支配」（2026-08-04〜2027-09-13）。会期が不自然なため未登録。
- **平城宮跡資料館:** 秋期特別展「地下の正倉院展」（10-15〜11-13）。出典が公式の展覧会ページではないため未登録。
- **長浜市曳山博物館:** 秋の企画展（09-09〜12-13 の可能性）。タイトル未確認。
- **彦根城博物館:** テーマ展「井伊家の家紋」（12-12 頃から）。会期未確定。
- **安土城考古博物館:** 第68回企画展と、秋季特別展「天下人の城下町～安土」の会期が未確認。
- **宝塚市立手塚治虫記念館:** 第99回企画展「吉田まゆみ☆ポップワールド」。会期不明で未登録。
- **高野山霊宝館:** 第46回大宝蔵展の会期が未確認。
- **京都文化博物館:** 追加した2件の出典は特別展スケジュールのページで、個別ページは未特定。
- **和歌山県立紀伊風土記の丘:** 「休館記念冬期特別展」や工事の記述があり、長期休館の可能性。確定したら `src/data-wakayama.js` の該当館に `closure` を書く。
- **臨時休館のお知らせ（データには未記入）:** 比叡山延暦寺 国宝殿（10/8 付の告知、期間不明）、京都伝統産業ミュージアム（10月、日程不明）、大和文華館（10/19〜23 展示替え）、神宮美術館（11/6・12/11）、滋賀県立美術館（11/24〜12/8、12/17〜21、12/28〜1/4）。期間が決まったものを載せるなら、館データの `closedRanges` と `notice` を使う（`closure` は長期休館専用）。

### 4. 公開ページを実際のブラウザで確認する

クラウドからは GitHub Pages を開けなかったので、公開版を実機で一度も見ていない。Mac の Chrome とスマホで次を確かめる。

- 地図タブで地図タイル（OpenStreetMap）が出て、点を押すとポップアップが開くか。
- 展覧会タブの「タイムライン」「館ごと」「リスト」の表示と、展覧会名のリンク先。
- 「今日開いている館」の判定が祝日・休館日で正しいか。

### 5. 展覧会が未登録の46館

定期タスクが毎回最大25館を順に調べているが、検索で見つからない館が多い。Mac なら公式サイトを直接読めるので、まとめて調べると早い。

### 6. 古い定期タスク2件の削除

上の3節の2件。claude.ai の定期タスクの画面か、定期タスクを操作できるツールがあるセッションから削除する。

## 5. これまでに分かっている注意点

- **リンクの法則:** 公式の個別ページ（official）＞ 公式のお知らせ（news）＞ 情報サイトの個別ページ（listing）＞ 公式 PDF（pdf）＞ 館の一覧ページ（index）。URL は推測で作らない。一覧ページ内に展覧会ごとの id がある館はアンカー付き URL を使う（例: https://www.sci-museum.jp/event/#pl29139 ）。artagenda や museum.or.jp の「館ページ」は展覧会ページではない（`apply-added.js` も拒否する）。
- **`closure` は長期休館専用:** 設定した時点でその館は「休館中」と表示され、定期タスクの調査対象からも外れる。期間の決まった休館は `closedRanges`（`[["YYYY-MM-DD","YYYY-MM-DD"]]`）と `notice` に書く。
- **`added:true`** は三重県の初期データの目印。新しい行には付けない。
- **`update-links.js` を手元で実行するとデータを書き換える。** 普段は Actions に任せる。手元で試すときは差分を確かめてからコミットする。テスト用に `KMT_FIXTURES=<dir>` で一覧ページの代わりにローカルの HTML を読ませられる。Node 18 以上が必要。
- **自動リンクの誤り対策:** 一覧ページの汎用アンカー（`#pan`, `#menu`, `#pannavi` など）は `update-links.js` の `GENERIC_ID` で除外している。新しい誤りを見つけたらここに足す。
- **main への push が重なる時間:** 月・木の 06:40〜08:00 は Actions と定期タスクが main に push する。この時間に手で push するときは先に `git pull --rebase origin main`。
- **Artifact 版への反映:** Mac でデータを直して push すれば、次の定期実行（月・木 07:40）が最新の main から Artifact を publish し直す。すぐに反映したいときだけ手で publish する（`node build.js --artifact` で `artifact.html` を作り、Artifact ツールで同じ URL に publish。同じ会話で一度 read してからでないと拒否される）。
- **クラウドの制約（参考）:** クラウドのセッションからは館の公式サイトと github.io が開けず、WebSearch だけで調べている。Mac ではこの制約はない。
- **失われる一時ファイル:** 地図の拡大縮小などを確かめた Playwright のテストスクリプトは、クラウドの一時フォルダにしかなく、リポジトリには入っていない。必要なら作り直す。

## 6. Mac での Codex と Gemini の使い方

他のセッションで実際に使っていた形:

```bash
# Codex（読み取り専用でレビューさせる）
codex exec -C <作業フォルダ> --skip-git-repo-check -s read-only "（日本語の指示）"

# Gemini（agy コマンド経由）
agy -p "（指示）" --mode plan --model gemini-3.1-pro-high
```

- macOS には `timeout` コマンドが無い（使うなら coreutils の `gtimeout`）。
- 外部 AI に渡してよいのは公開情報だけ（クライアント名・金額・個人情報は渡さない）。このプロジェクトのデータは公開情報なので問題ない。使ったら、どの AI に何をさせたかを一行残す。
