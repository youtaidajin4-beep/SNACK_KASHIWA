# 画像フォルダ

`js/site-config.js` の `images` に **相対パス**（例: `assets/images/counter.jpg`）を入れると、LPに表示されます。ファイルを置くまでパスは空 `""` のままで問題ありません。

## ChatGPT（Web）で生成して取り込む

スロット別の**コピペ用プロンプト・NG制約・チェックリスト**は **[docs/image-prompts.md](../docs/image-prompts.md)** にまとめています。Cursor でプロンプトを整え、ChatGPT で画像を生成 → ここに保存 → `site-config.js` を更新、の流れです。

**注意**: AI 生成は実店舗と異なる場合があります。雰囲気用として使うか、公開時は **実写**（特に入口・ビル）へ差し替えると来店導線の信頼性が上がります。

**`-mobile.jpg` / `-960.jpg`**: 第2章カウンターは **携帯幅で縦クロップ**（`counter-mobile.jpg`）を最優先し、無い場合は `counter-960.jpg`、それも無ければフル画像を表示します。差し替え手順は [docs/image-prompts.md](../docs/image-prompts.md) を参照してください。

**`atmosphere` / `entrance`**: `site-config.js` で空にすると LP から非表示（全幅・アクセスの写真枠を出さない）にできます。

## 推奨ファイル名（この名前で保存すると設定しやすい）

| 用途 | 設定キー | 推奨ファイル名 | 比率・内容 |
|------|-----------|----------------|------------|
| ロゴ（ヘッダー・フッター） | `logo` | `logo.png` | 透過または黒地＋金のロゴ推奨 |
| ファーストビュー（縦長・エディトリアル） | `heroPortrait` | `hero-portrait.png` 等 | 約 9:16。文字焼き付けなしの店内写真推奨。空にすると写真なしの同レイアウト |
| 1画面目（旧・横長パララックス） | `hero` | 空 `""` または横長 | エディトリアル併用時は通常空のまま |
| 2画面目・カウンター章 | `counter` | `counter.png` 等 + **`counter-mobile.jpg`** + **`counter-960.jpg`** | 横長の店内。携帯は縦クロップ JPEG を優先（`images.narrowPortraitOnPhone`） |
| 店内の全幅 | `atmosphere` | 任意。パス指定時は `atmosphere-960.jpg` も | 空ならブロック非表示 |
| 入口・ビル | `entrance` | 任意。パス指定時は `entrance-960.jpg` も | 空なら非表示。TM34 実写推奨 |
| OGP 共有画像 | `ogImageUrl`（絶対URL） | `og.jpg` | 約 1200×630。本番の絶対 URL を `site-config.js` に記載 |

## TM34ビル（住所の目印）

店舗住所: **〒860-0807 熊本県熊本市中央区下通１丁目２−１１ TM34ビル 3階D号室**  
入口写真は「ビル名が分かる角度」「3階への動線が想像できる構図」があると来店がスムーズです。

## 形式

- JPG / WebP 推奨（容量 500KB 前後以下を目安）
- **ヒーロー背景**: `images.heroPortrait`（縦長エディトリアル）または `images.hero`（旧パララックス）。ChatGPT の共有 URL は使えないため、書き出したファイルを `assets/images/` に保存してパスを指定してください。
- OGP 用の共有画像は `site-config.js` の `ogImageUrl` に **本番の絶対URL** を設定（プレースホルダの `example.com` は公開前に必ず差し替え）
