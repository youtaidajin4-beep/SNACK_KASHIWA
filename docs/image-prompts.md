# ChatGPT（画像生成）用プロンプト集 — スナックかしわ LP

> **現状のファイル**: 店内のメインは **`counter.png`**（ChatGPT 等で書き出した横長）と、携帯向け **`counter-mobile.jpg`**（中央 9:16 クロップ）です。差し替えたら両方と **`counter-960.jpg`** を再生成してください。`og.jpg` は SNS プレビュー用です。

[AGENT.md](../AGENT.md) のブランド方針に沿って生成してください。**実在の店内・TM34ビルと同一視されない**よう、人物は出さない／特定ビル名の看板は出さないのが安全です。生成後は `assets/images/` に保存し、[js/site-config.js](../js/site-config.js) の `images` を更新します。

---

## 全スロット共通（マスター — 毎回末尾に貼る）

**ポジティブ（世界観）**

- 日本の熊本の夜のスナック／バーのような落ち着いた店内イメージ
- 静かなホテルラウンジ、ネオスナック、夜の雑誌のような上品さ
- 暖色の間接照明、木目のカウンター、深いブラウンと淡いクリーム／アイボリーの壁
- 柔らかいボケ、控えめなコントラスト、ノイズの少ない空気感
- 写真風フォトリアル、シネマティック、浅い被写界深度

**ネガティブ（禁止・避ける）**

- キャバクラ・クラブ風、ギラギラしたネオン、黒金の派手デザイン
- シャンパンタワー、派手なシャンパン訴求
- TikTok 的な演出、情報過多の合成、安っぽいフレーム
- 女性・キャストをメインにした構図、顔がはっきり写る人物
- ロゴ・店名「かしわ」の捏造テキスト（文字化けしやすいため）

**人物**

- 原則 **人物なし**。どうしても必要なら **背中のみ・シルエット・極小** で識別不能に。

**解像度の目安**

- 横長スロット: 幅 1600〜1920px 程度（16:9 〜 21:9）
- 縦スロット（入口）: 1200×1500px 前後（4:5）
- 書き出し後、500KB 前後を目安に WebP または JPEG で再圧縮推奨

---

## スロット 1: `counter`（第2章・カウンター）

**用途**: LP の「灯」セクション全幅背景。横長。

**プロンプト例（英語が安定しやすい場合）**

```text
Interior photograph of a small quiet Japanese snack bar at night, empty seats, wooden counter in foreground, warm indirect amber lighting, soft shadows, subtle reflections on glassware, no people, no text, no logos, cinematic shallow depth of field, calm boutique hotel lounge mood, photorealistic, high detail wood grain, muted palette deep brown and cream, 16:9 composition
```

**日本語例**

```text
夜の小さなスナックの店内、人物なし、手前に木目のカウンター、暖かい間接照明、グラスのかすかな反射、静かで上品、写真風、横長構図
```

**推奨ファイル名**: `counter.webp` または `counter.jpg`

---

## スロット 2: `atmosphere`（店内の全幅）

**用途**: About 直下の全幅写真。空気感・ソファ・氷・グラスなど。

**プロンプト例**

```text
Wide interior still life of a cozy Japanese bar at night, red or burgundy sofa softly lit, low tables, ice in a glass catching warm light, no people, no readable text, calm atmosphere, editorial magazine photography, 16:9, photorealistic, gentle film grain optional
```

**推奨ファイル名**: `atmosphere.webp` または `atmosphere.jpg`

---

## スロット 3: `entrance`（夜の入口・ビル周辺イメージ）

**用途**: アクセス章の縦長。来店のイメージ補助。**実在 TM34 と完全一致は不要**（誤認防止）。

**プロンプト例**

```text
Night street in a Japanese downtown shopping arcade, quiet mood, warm shop lights from a doorway, generic building facade without readable signs, no people, photorealistic, vertical 4:5, subtle rain or dry pavement reflections optional, not a famous landmark
```

**推奨ファイル名**: `entrance.webp` または `entrance.jpg`

**差し替え推奨**: 公開時は **実写の TM34・入口** に差し替えると信頼性が上がります。

---

## スロット 4: `hero`（任意）

**用途**: 1 画面目を「灯りのみ」から変える場合のみ。指定しないなら `site-config.js` で `hero: ""`。

**プロンプト例**

```text
Extremely subtle abstract warm bokeh lights in darkness, almost no detail, very dark background, gentle amber glows, no objects, no text, minimalist, 21:9 ultra wide, suitable as website hero under typography
```

**推奨ファイル名**: `hero.webp` または `hero.jpg`

---

## スロット 5: `og`（OGP / SNS 共有）

**用途**: `og:image`。正方形〜横長（1200×630px が一般的）。**本番 URL** は `site-config.js` の `ogImageUrl` に絶対パスで設定。

**プロンプト例**

```text
Minimal editorial graphic for a quiet Japanese bar in Kumamoto at night, warm amber light, wooden textures abstract, no text, no logos, calm luxury lounge mood, 1200x630, clean composition for social preview
```

**推奨ファイル名**: `og.jpg`（JPEG が互換性高め）

---

## レスポンシブ画像（`<picture>` + `-960.jpg`）

LP の [js/main.js](../js/main.js) は、`images.responsive` が `false` でない限り、カウンター・店内全幅・入口（および任意の `hero`）に **次のマークアップ**を出力します。

- **狭い画面**（幅 640px 未満）の既定: `元ファイル名-960.jpg`（JPEG・長辺 960px 程度）
- **カウンター章**（`images.narrowPortraitOnPhone !== false` かつ `pictureMarkup(..., "portrait-first")`）: 先に **`元-mobile.jpg`**（中央 9:16 の縦クロップ）を出し、無ければ `-960.jpg`、それも無ければフル画像

横長の元画像（例 1024×576）から縦クロップを作る例（macOS `sips`）:

```bash
cd assets/images
# 高576・幅324（9:16）を左から350pxの位置で切り出し → 長辺720に縮小 → JPEG
sips -c 576 324 counter.png --cropOffset 0 350 -o _crop.png
sips -Z 720 _crop.png -o _tmp.png
sips -s format jpeg _tmp.png -o counter-mobile.jpg
rm _crop.png _tmp.png
```

`counter.png` を差し替えたら **`counter-mobile.jpg` と `counter-960.jpg` を再生成**してください。

`<picture>` を使わない場合は `site-config.js` の `images.responsive` を `false` にしてください。

---

## 運用チェックリスト（ChatGPT Web）

1. 上記プロンプト＋マスターのネガティブを貼って生成
2. 気に入った結果を **ダウンロード**（PNG のままでも可）
3. ファイル名を推奨名にリネームし `assets/images/` に保存
4. 容量が大きい場合は WebP/JPEG に変換（目安 500KB 前後）
5. [js/site-config.js](../js/site-config.js) の `images.counter` 等をパスで更新
6. 本番公開後、`canonicalUrl` と `ogImageUrl` を実ドメインの絶対 URL に更新（`seoDescription` / `ogDescription` も必要に応じて編集）
7. `index.html` の `canonical` / `og:url` / `og:image` の**初期値**を `site-config.js` と同じ URL・文言に揃える（クローラや JS 無効時のフォールバック用）

---

## AI 画像に関する注記

LP に掲載する画像が **AI 生成のみ**の場合、実景と異なる可能性があります。可能であれば **カウンター・店内・入口は実写真**へ段階的に差し替えることを推奨します。
