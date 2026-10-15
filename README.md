# 関西ミュージアム手帖

関西2府5県（大阪・京都・兵庫・奈良・滋賀・和歌山・三重）の美術館・博物館 132館を、編集部の視点でキュレーションする単一ファイルのWebアプリです。ビルド不要で `index.html` を開くだけで動きます。

## できること

- **館をさがす** — 府県・種類（美術館／歴史・考古／自然・科学／工芸・陶磁／テーマ・専門／寺社宝物館）・特徴タグ・キーワードで絞り込み。「今日開いている館だけ」「会期中の展覧会がある館だけ」の切り替え。
- **本日開館の自動判定** — 休館曜日と祝日（祝日は開館・翌日休館）の一般則、季節開館、長期休館、展示替え休館を反映。年末年始は「要確認」表示。
- **展覧会** — 「今なにをやっているか」をひと目で。今日の位置を示す**タイムライン**、府県・館ごとにまとめた**館ごと**、会期終了が近い順の**リスト**の3表示。会期中・まもなく終了（14日以内）・開催予定で絞り込み。各件に会期の出典リンク。
- **特集** — 「中之島ミュージアム・ウォーク」「安藤忠雄の建築をめぐる」「国宝に会いに行く」など12本のめぐり方。
- **地図** — OpenStreetMap の地図（Leaflet）に全館をプロット。点をクリックすると館の情報と「詳細」「Googleマップ」へのリンク。京阪神・奈良・滋賀・和歌山・三重へのズーム。地図タイルを読み込めない環境（claude.ai の Artifact など）では、都道府県の輪郭を描いた概略図に自動で切り替わります。どちらの地図もピンチ・ドラッグ・ホイール・＋－ボタンで拡大縮小と移動ができます。
- **展覧会のリンク** — 展覧会名をタップすると、その展覧会の公式ページ（見つからない館は展覧会一覧ページ）が開きます。
- **行きたい** — ♡で保存（ブラウザの localStorage）。
- ライト／ダークテーマ、スマートフォン幅に対応。

## 構成

```
kansai-museums/
├── index.html          生成物（これだけで動く）
├── build.js            src/ を結合して index.html を生成
└── src/
    ├── data-osaka.js … data-mie.js        館データ（府県ごと）
    ├── data-collections.js                特集
    ├── data-exhibitions.js                展覧会（館IDで紐づけ。page はその展覧会のページ、EX_INDEX_URLS は館の展覧会一覧ページ）
    ├── data-geo.js                        概略図用の都道府県輪郭（dataofjapan/land の japan.geojson を簡略化）
    ├── leaflet.css                        Leaflet 1.9.4 の CSS（単体版に同梱）
    ├── styles.css / markup.html / app.js  画面とロジック
```

## データの更新

1. `src/data-*.js` を編集する（展覧会は `data-exhibitions.js`、館IDは各館データの `id`）。
2. `node build.js` を実行して `index.html` を再生成する（`--artifact` を付けると claude.ai 用の `artifact.html` も出力）。

単体版の地図は Leaflet 1.9.4 を cdnjs から読み込み、OpenStreetMap のタイルを表示します（© OpenStreetMap contributors）。

館データの主なフィールド: `closedDays`（休館曜日 0=日〜6=土）、`holidayRule`（祝日は開館）、`closure`（長期休館の説明）、`closedRanges`（臨時休館の期間）、`seasons` / `seasonMonths`（季節開館）、`pick`（1〜3、3は編集部おすすめ）。

## 自動更新（毎週 月・木）

1. **GitHub Actions**（`.github/workflows/kansai-museums-update.yml`、月・木 07:25 JST）が `scripts/update-links.js` を実行します。
   - 個別ページが未設定の展覧会について、館の展覧会一覧ページ（`EX_INDEX_URLS`）を取得し、タイトルが一致するリンク、または一覧ページ内の id 付き見出しへのアンカー（例: `https://www.sci-museum.jp/event/#pl29139`）を `page` に設定します。
   - 公式ページのリンク切れ（404）を確認し、切れていれば一覧ページに戻します。
   - 会期終了から 90 日以上たった展覧会を削除します。
   - 一覧ページ上でまだデータにない展覧会らしきリンクを `research/candidates.json` に書き出します。
   - `index.html` を再生成し、変更があれば main に push します（GitHub Pages が自動で再デプロイ）。
2. **Claude の定期タスク**（月・木 07:40 JST）が、会期が近く終わる館や展覧会データのない館を中心に、公式サイトの検索結果から新しい展覧会・会期・休館情報を調べて `data-exhibitions.js` に追加し、再ビルドして push します。あわせて `node build.js --artifact` で生成した `artifact.html` を claude.ai の Artifact（https://claude.ai/artifact/NQRBtUq2Qfs2Q6hfkNwqzv ）に publish して、Artifact 版も最新にします（`artifact.html` は .gitignore 済み）。

手動で実行する場合: `cd kansai-museums && node scripts/update-links.js`（インターネット接続が必要）。

## データについて

- 基準日: 2026年10月15日。展覧会の会期は各館の公式サイトや美術館情報サイトで確認したものですが、変更されることがあります。
- 開館時間・休館日・料金は変わることがあります。お出かけ前に各館の公式サイトでご確認ください。
