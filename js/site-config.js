/**
 * スナックかしわ LP — 編集用設定
 * 電話・SNS・地図・メニュー・画像パスなどはここを編集してください。
 */
var SITE = {
  shopName: "スナック かしわ",
  telDisplay: "096-321-7822",
  telHref: "tel:0963217822",
  /** 正規プロフィール（トラッキングパラメータは不要） */
  instagramUrl: "https://www.instagram.com/kumamoto_kashiwa/",
  addressLine:
    "〒860-0807 熊本県熊本市中央区下通１丁目２−１１ TM34ビル 3階D号室",
  mapEmbedSrc:
    "https://www.google.com/maps?q=" +
    encodeURIComponent(
      "〒860-0807 熊本県熊本市中央区下通1丁目2-11 TM34ビル 3階D号室"
    ) +
    "&output=embed",
  /**
   * 本番公開時: 実ドメインに差し替え。index.html の初期値も同じ URL にしておくとクローラ向けに安全。
   */
  canonicalUrl: "https://example.com/kashiwa/",
  /** SNSプレビュー用。空なら OGP/Twitter の画像タグは main.js で付けません。 */
  ogImageUrl: "",
  /**
   * main.js が <meta name="description"> を上書きします。index.html と揃えるか、こちらのみ編集してください。
   */
  seoDescription:
    "熊本・下通のスナックかしわ。初めてのスナック、一人飲み、女性のお一人様も。落ち着いて飲めるカウンター。TM34ビル3階D。明朗会計。熊本で静かな夜を過ごしたい方へ。",
  /** 未設定・空文字のときは seoDescription を OGP/Twitter 説明にも使います */
  ogDescription:
    "熊本の夜に、少しだけ話したい日がある。下通でふらっと立ち寄れる静かなスナックです。",

  /**
   * heroPortrait: ファーストビュー用の縦長写真（エディトリアル・ヒーロー）。空にすると写真なしの同レイアウト。
   * hero: 旧パララックス用（通常は空）。heroPortrait 併用時は未使用。
   * counter: 第2章のメイン写真。狭い画面では `counter-mobile.jpg`（縦）を優先。
   * atmosphere / entrance: 空ならブロック非表示。パスを入れたら `-960.jpg` / 任意で `-mobile.jpg` を生成。
   * counter が空のときは main.js が hero にフォールバック。
   * responsive: false で <picture> を使わず単一 img のみ。
   * narrowPortraitOnPhone: false なら狭い画面でも `-960.jpg` のみ（`-mobile.jpg` は使わない）。
   * 派生ファイル: `sips -s format jpeg -Z 960 foo.png --out foo-960.jpg` / 縦クロップ手順は docs/image-prompts.md
   */
  images: {
    /** 縦長・文字なし店内写真（エディトリアル・ヒーロー背景） */
    heroPortrait: "assets/images/hero-portrait.png",
    hero: "",
    /** 店内メインビジュアル（携帯は counter-mobile.jpg を優先。docs 参照） */
    counter: "",
    /** 全幅ブロックを出さないときは空 */
    atmosphere: "",
    /** アクセスの写真を出さないときは空（実写を置く場合のみパスを指定） */
    entrance: "",
    /** ヘッダー・フッター・ヒーロー帯用ロゴ（LP同梱の PNG） */
    logo: "assets/images/logo.png",
    responsive: true,
    /** 狭い画面で `-mobile.jpg`（縦クロップ）を優先するスロット用（カウンター章・hero 等） */
    narrowPortraitOnPhone: true,
  },

  geo: {
    latitude: "32.8035",
    longitude: "130.7098",
  },
  openingHours: "Mo-Su 20:00-02:00",

  /** セット・チャージ等（メニュー外の案内） */
  otherCharges: [
    { label: "セット", note: "店内にてご確認ください" },
    { label: "チャージ", note: "店内にてご確認ください" },
    { label: "カラオケ", note: "店内にてご確認ください" },
    { label: "TAX", note: "表示価格に準じます" },
  ],

  /** ドリンクは表ではなく、この注釈のみ表示（空文字で非表示） */
  drinkMenuNote:
    "ビール・焼酎・洋酒・カクテル・ソフトドリンクなど、カウンターにてご案内しています。ボトル・グラス・飲み放題の内容は店内でご確認ください。",

  /** ボトル等の詳細表。空配列のときは出しません */
  bottleSections: [],

  /** 飲み放題の詳細ブロック。null のときは出しません */
  freeDrink: null,

  /** 決済方法（料金セクション内・メニュー下に表示） */
  paymentMethods: {
    title: "決済方法",
    groups: [
      { title: "【電子決済】", items: ["au PAY", "PayPay"] },
      {
        title: "【クレジットカード】",
        items: ["JCB", "American Express", "VISA", "MasterCard"],
      },
    ],
    note:
      "※掲載している決済方法は、確認済みのもののみ表示しております。\nその他にもご利用可能な決済方法がある場合があります。",
  },
};
