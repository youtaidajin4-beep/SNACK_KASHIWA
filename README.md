# スナックかしわ 集客LP

熊本・下通周辺のスナック「かしわ」向けの静的ランディングページです。HTML / CSS / JavaScript のみで動作します。

見出しは **Shippori Mincho**、本文は **Noto Sans JP**（Google Fonts）を読み込みます。オフライン閲覧時はシステムフォントに近い見え方になります。

## ローカルでの表示

`index.html` をブラウザで開いてください。

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
- `css/tokens.css` … 色・余白などのトークン
- `css/base.css` … リセットと基本タイポ
- `css/main.css` … レイアウト・コンポーネント（メニュー `.menu-*` 含む）
- `js/site-config.js` … 店舗データ（主にここを編集）
- `js/main.js` … 設定の反映・メニュー描画・地図の遅延読み込み・JSON-LD・reveal・ヒーロー背景の弱いパララックス
- `AGENT.md` … 制作方針メモ
