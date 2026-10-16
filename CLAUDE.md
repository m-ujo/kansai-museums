# 関西ミュージアム手帖

関西2府5県（大阪・京都・兵庫・奈良・滋賀・和歌山・三重）の美術館・博物館と展覧会の案内サイト。仕組みの詳細は `README.md`、経緯と注意点は `HANDOFF.md`。

## 場所

| 項目 | 内容 |
|---|---|
| リポジトリ | https://github.com/m-ujo/kansai-museums （main を GitHub Pages が配信。ブランチや PR は作らない） |
| 公開ページ | https://m-ujo.github.io/kansai-museums/ |
| 旧 URL | https://m-ujo.github.io/bid-monitor/kansai-museums/ は新 URL へ転送するだけのページ（bid-monitor 側。触らない） |
| Artifact 版 | https://claude.ai/artifact/NQRBtUq2Qfs2Q6hfkNwqzv （定期タスクが publish する） |

## 入札案件（bid-monitor）とは別物

2026-10-16 に bid-monitor リポジトリから独立した。入札案件の画像・設定・スクリプト・文言を持ち込まない。手帖のものはこのリポジトリの中だけで完結させる。

## 作り方と確かめ方

- `src/` を編集して `node build.js` で `index.html` を作り直す。`src/` と `index.html` を一緒にコミットする。
- 表示の確認は Chrome headless で行う（承認の要るブラウザペインは使わない）。自動チェックは `OUT=<scratchpad> KMT_URL=file://$HOME/kansai-museums/index.html node ~/kmt-test/check-public.mjs`（18項目）。push 後は `KMT_URL` を外して公開ページでも走らせる。
- 見た目を変えるときは、試作をスクリーンショットで見せ、変更対象の表を出して承認を取ってから反映する。

## 自動で動くもの

| 時刻（JST） | 仕組み | 内容 |
|---|---|---|
| 月・木 06:40 | `.github/workflows/update.yml` | 展覧会リンクの解決・リンク切れ確認・再ビルド・push |
| 月・木 07:40 | Claude の定期タスク `trig_01HqaiG5rcvQ5hxWfsQx1Nc1`（クラウドの専用セッション `session_01Vtg1kQpcXYW6VWwS4Xoa9G`） | 展覧会の調査・追加・push・Artifact 更新 |
| 月・木 09:30 | `.github/workflows/check.yml` | `DATA_ASOF` が当日でなければ失敗（通知メール） |

- 月・木の 06:40〜08:00 は自動の push と重なる。手で push する前に `git pull --rebase origin main`。`index.html` が衝突したら `src/` だけ直して作り直す。
- 定期タスクの設定や専用セッションは、頼まれない限り変えない。

## 役割分担

見た目・機能（`styles.css`・`app.js`・`markup.html`）と、データ（`src/data-*.js`・展覧会の調査）は、別々のセッションで進めてよい。同じ時間帯に両方を進めるときは、片方の push が終わってからもう片方を進める。
