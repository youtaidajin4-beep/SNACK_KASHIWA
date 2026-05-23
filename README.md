# スナックかしわ 集客LP

熊本・下通周辺のスナック「かしわ」向けの静的ランディングページです。HTML / CSS / JavaScript のみで動作します。

## Snack CRM（`crm/`）

店内用のお客様メモ（顧客管理）MVPです。**集客LPとは別フォルダ**で動きます。データはブラウザの **localStorage** に保存されます（端末・ブラウザを変えると共有されません）。

### 開き方

1. **Finder から（おすすめ）**  
   [`crm/open-with-local-server.command`](crm/open-with-local-server.command) をダブルクリックする。初回だけ「開いてもよいか」と出たら「開く」を選ぶ。ターミナルが開き、ブラウザで `http://127.0.0.1:8765/crm/index.html` が表示される（**日本語フォルダ名でも確実**）。ウィンドウを閉じるとサーバーが止まる。
2. **手動**  
   [`crm/index.html`](crm/index.html) をブラウザにドラッグするか、プロジェクト直下で `python3 -m http.server 8080` を実行して `http://localhost:8080/crm/index.html` を開く。
3. 初回はサンプルのお客様5名が入ります。**顧客**は一覧にプロフィール写真（**情報を編集**で登録・端末内のみ・大きい画像は自動縮小）、詳細では「かんたん記入」でメモ・来店・ボトル。来店履歴の**編集**からその日の記録を更新すると、履歴・売上集計に反映されます。

Google Fonts を読み込むため、オフラインではフォントが近似になります。

### 主な画面（ヘッダーで「現場／経営」を切替）

| モード | 下部タブの例 | 内容 |
|--------|----------------|------|
| **現場** | 今夜 / 顧客 / ボトル / LINE | **今夜**：経営で設定した**今日・今月の売上目標**と実績（確定ベース）、客単価の目安からの不足目安（台帳がある日は**組**ベース）、**今夜の来店予定リスト**。その下に従来のノート・サマリー等。売上目標・データのやり直しは**経営モードの「設定」**のみ。 |
| **経営** | 売上 / 分析 / 設定 | **売上**・**売上分析**・**売上目標**・**台帳**（日付・金額・**組数**・セグメント）。経営からボトル一覧タブは廃止（ボトルは現場タブで確認）。 |

経営の「売上」は [freee](https://secure.freee.co.jp/) のダッシュのような **明るいカード＋進捗感** を意識したレイアウトです（会計データの連携はありません）。

**確定売上のルール**：ある日に**手入力の台帳が1件でもある**と、その日の売上は**台帳の金額の合計**だけを使います（来店の金額はその日の集計から外れます）。**同日に台帳が複数行**ある場合は、**金額と組数をそれぞれ合算**し、その日の客単価は **合計金額÷合計組数** です。台帳がない日は、来店に入れた**円の数値**を合算します。経営の売上ゲージ・月次グラフはこの確定ベースです。

**Chart.js（CDN）** は経営モードの「分析」タブでのみ使用します。オフライン時は案内文のみ表示されます。

**AI 分析**：「売上分析」タブで **Markdown 下書き** と **完全 JSON** をコピーして ChatGPT / Gemini に渡せます（APIキーはフロントに埋め込みません）。JSON の顧客ラベルは外部共有に注意してください。

### 注意

- バックアップや同期はまだありません。消去前に必要なら画面のメモを別途控えてください。
- 経営の数値は **その端末の来店記録と売上台帳** に限ります。
- 現場「今夜」の**来店予定リスト**は、端末の日付が変わると自動で空になります（その日のメモ用）。
- 将来は Firebase 連携・LINE 公式連携などを想定した構成です。

---

見出しは **Shippori Mincho**、本文は **Noto Sans JP**（Google Fonts）を読み込みます。オフライン閲覧時はシステムフォントに近い見え方になります。

## ローカルでの表示

`index.html` をブラウザで開いてください。Snack CRM は [`crm/index.html`](crm/index.html) を開いてください（簡易サーバー利用時は `http://localhost:8080/crm/` など）。

- **Google マップ**: `file://` で直接開くと、環境によっては埋め込み地図が表示されないことがあります。**簡易サーバー経由**（下記）または本番の **HTTPS** で確認してください。
- 簡易サーバー例: プロジェクト直下で `python3 -m http.server 8080` を実行し、`http://localhost:8080/` にアクセス。

## 編集のしかた

### 電話・Instagram・住所・地図・画像

[`js/site-config.js`](js/site-config.js) を編集します。

- `telDisplay` / `telHref` … 表示と `tel:` リンク
- `instagramUrl` … Instagram（[@kumamoto_kashiwa](https://www.instagram.com/kumamoto_kashiwa/)）
- `images.logo` … ヘッダー・フッター・ヒーロー下部帯用ロゴ（既定: `assets/images/logo.png`）
- `images.heroPortrait` … ファーストビュー縦長写真（既定: `assets/images/hero-portrait.png`）。空にすると写真なしの同レイアウト
- `addressLine` … 住所（1ブロックで表示・JSON-LDにも使用）
- `mapEmbedSrc` … 地図 iframe の `src`。現在は住所を `encodeURIComponent` した **Google Maps の `output=embed` 形式**です。ピン位置を微調整したい場合は、Google マップの「共有 → 地図を埋め込む」で得た URL に差し替えてください。
- `geo.latitude` / `geo.longitude` … 任意。JSON-LD の `GeoCoordinates` に反映されます。
- `canonicalUrl` / `ogImageUrl` … SEO・SNSシェア用（OG 画像は絶対URL推奨）。**本番では `index.html` の初期 canonical / og と同じ URLに揃える**と安全です。
- `seoDescription` … `<meta name="description">` と JSON-LD の説明（`main.js` が上書き反映）
- `ogDescription` … OGP / Twitter の説明文。空なら `seoDescription` を流用
- `images.heroPortrait` / `hero` / `counter` / `atmosphere` / `entrance` / **`logo`** … [`assets/images/`](assets/images/) への相対パス。`heroPortrait` はファーストビュー縦長写真。カウンターは **`counter-mobile.jpg`（縦）** と **`-960.jpg`** を同梱運用（詳細は `assets/images/README.md`）。`images.narrowPortraitOnPhone: false` で縦JPEGを使わない。`images.responsive: false` で `<picture>` をオフ

### 料金・ドリンクメニュー

[`js/site-config.js`](js/site-config.js) 内の次のキーを編集します（[`js/main.js`](js/main.js) の `renderMenu()` が `#menu-root` に描画します）。

- `otherCharges` … セット・チャージ・カラオケ・TAX など（左ラベル・右説明の表）
- `bottleSections` … カテゴリごとの `{ title, rows: [{ name, price }] }`
- `freeDrink` … `title` / `intro` / `groups: [{ subtitle, lines: [] }]`

### 文章（キャッチコピーや各セクションの本文）

[`index.html`](index.html) を直接編集します。見出しは `h1` が1つ、各ブロックは `h2` で揃えています。

検索結果・OGP 用の **短い説明文**は [`js/site-config.js`](js/site-config.js) の `seoDescription` / `ogDescription` を編集すると、`main.js` が `<meta name="description">` と OGP / Twitter に反映します（`index.html` の初期 meta とも揃えることを推奨）。

## 公開前チェックリスト

- [ ] `site-config.js` の電話・Instagram URLが正しい
- [ ] 住所・地図（`mapEmbedSrc`）が意図どおり表示されるか確認した
- [ ] メニュー・価格の内容が最新か確認した
- [ ] `canonicalUrl` と `ogImageUrl` を本番ドメインに更新した（`index.html` の canonical / og:url / og:image 初期値も同じにした）
- [ ] `seoDescription` / `ogDescription` を意図どおりにした
- [ ] 画像を差し替え、`images.*` のパスを更新した（あわせて各スロットの **`-960.jpg`** を `sips` 等で再生成した、または `responsive: false` にした）

## ファイル構成

- `index.html` … ページ本体（LP）
- `crm/index.html` … Snack CRM 本体
- `crm/style.css` … CRM 用スタイル
- `crm/app.js` … CRM 用スクリプト（状態・localStorage）
- `css/tokens.css` … 色・余白などのトークン
- `css/base.css` … リセットと基本タイポ
- `css/main.css` … レイアウト・コンポーネント（メニュー `.menu-*` 含む）
- `js/site-config.js` … 店舗データ（主にここを編集）
- `js/main.js` … 設定の反映・メニュー描画・地図の遅延読み込み・JSON-LD・reveal・ヒーロー背景の弱いパララックス
- `AGENT.md` … 制作方針メモ
