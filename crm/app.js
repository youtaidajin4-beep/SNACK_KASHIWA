/**
 * Snack CRM MVP — localStorage 保存・単一ページ
 */
(function () {
  "use strict";

  const STORAGE_KEY = "snackCrmV1";

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  const VIBE_TYPES = [
    "静かに飲みたい",
    "誰かと話したい",
    "盛り上がりたい",
    "仕事帰り",
    "出張客",
    "2軒目",
    "初めて",
    "常連",
  ];

  const STATUS_OPTIONS = [
    "初回来店",
    "たまに来る",
    "常連",
    "VIP",
    "しばらく来店なし",
  ];

  const MOOD_TAGS = [
    "楽しそう",
    "疲れていた",
    "静かだった",
    "盛り上がった",
    "仕事の話",
    "恋愛の話",
    "接待",
    "出張",
  ];

  const BOTTLE_REMAINING = [
    "100%",
    "75%",
    "50%",
    "25%",
    "残り少し",
    "空",
  ];

  const PRESET_TAGS = [
    "ゴルフ好き",
    "カラオケ好き",
    "仕事帰り",
    "出張",
    "静かめ",
    "よく飲む",
    "紹介多い",
    "誕生日近い",
  ];

  const AGE_BANDS = ["", "20代", "30代", "40代", "50代", "60代以上"];

  const LINE_PATTERNS = [
    { id: "thanks", label: "来店後のお礼" },
    { id: "miss_you", label: "最近来ていない方へ" },
    { id: "birthday", label: "誕生日メッセージ" },
    { id: "bottle", label: "ボトル期限の連絡" },
    { id: "quiet_tonight", label: "今日静かです案内" },
  ];

  /** 手入力売上のセグメント候補（設定で追記可） */
  const DEFAULT_SALES_SEGMENTS = ["全体", "カウンター", "ボックス", "団体", "宴会", "その他"];

  /** @type {{ customers: object[], salesLedger: object[], tonightPlan: object[], settings: object }} */
  let data = {
    customers: [],
    salesLedger: [],
    tonightPlan: [],
    settings: { todayMemo: "", customTags: [], appMode: "staff", monthlySalesTargetYen: 0, dailySalesTargetYen: 0 },
  };

  /** @type {{ tab: string, custView: string, custId: string|null, search: string, tagFilter: string, lineCustId: string|null, analyticsSalesYM: string, salesEditId: string|null, visitEditId: string|null, listChip: string }} */
  let ui = {
    tab: "home",
    custView: "list",
    custId: null,
    search: "",
    tagFilter: "",
    lineSearch: "",
    lineCustId: null,
    /** 経営・売上分析で参照する月 YYYY-MM（空なら当月） */
    analyticsSalesYM: "",
    /** 売上台帳の編集対象 id */
    salesEditId: null,
    /** 顧客詳細で編集中の来店 id */
    visitEditId: null,
    /** @type {"all"|"regular"|"first"|"follow"|"bottle"|"bday"} */
    listChip: "all",
  };

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  function customerNameInitial(name) {
    const n = String(name || "").trim();
    return n ? n[0] : "?";
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("read"));
      fr.readAsDataURL(file);
    });
  }

  function resizeImageDataUrl(dataUrl, maxEdge, quality) {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith("data:image")) {
        resolve(dataUrl || "");
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const w0 = img.naturalWidth || 1;
          const h0 = img.naturalHeight || 1;
          const scale = Math.min(1, maxEdge / Math.max(w0, h0));
          const tw = Math.max(1, Math.round(w0 * scale));
          const th = Math.max(1, Math.round(h0 * scale));
          const canvas = document.createElement("canvas");
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(0, 0, tw, th);
          ctx.drawImage(img, 0, 0, tw, th);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = dataUrl;
    });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function parseISO(s) {
    if (!s) return null;
    const d = new Date(s + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  /** 日付 a から b までの暦日差（a<=b 想定で非負） */
  function daysBetweenISO(aISO, bISO) {
    const a = parseISO(aISO);
    const b = parseISO(bISO);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function daysSince(iso) {
    if (!iso) return null;
    return daysBetweenISO(iso, todayISO());
  }

  /** 次の誕生日までの日数（当日なら0） */
  function daysUntilNextBirthday(birthdayISO) {
    if (!birthdayISO || birthdayISO.length < 10) return null;
    const parts = birthdayISO.slice(5, 10).split("-");
    const mm = Number(parts[0]);
    const dd = Number(parts[1]);
    if (!mm || !dd) return null;
    const now = new Date();
    const y = now.getFullYear();
    let next = new Date(y, mm - 1, dd, 12, 0, 0);
    if (next < now) next = new Date(y + 1, mm - 1, dd, 12, 0, 0);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    return Math.round((next - start) / 86400000);
  }

  function daysUntilDeadline(deadlineISO) {
    if (!deadlineISO) return null;
    return daysBetweenISO(todayISO(), deadlineISO);
  }

  /** 来店の金額を円の数値に正規化（文字列・カンマ・円表記を許容） */
  function parseVisitAmountYen(raw) {
    if (raw === "" || raw == null) return null;
    if (typeof raw === "number") {
      return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
    }
    const s = String(raw)
      .replace(/[,，]/g, "")
      .replace(/\s/g, "")
      .replace(/円/g, "");
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function formatYen(n) {
    if (n == null || n === "" || !Number.isFinite(Number(n))) return "";
    return Number(n).toLocaleString("ja-JP") + "円";
  }

  function normalizeSettingsAfterLoad() {
    if (!data.settings) data.settings = { todayMemo: "", customTags: [], appMode: "staff", monthlySalesTargetYen: 0, dailySalesTargetYen: 0 };
    if (!Array.isArray(data.settings.customTags)) data.settings.customTags = [];
    if (data.settings.appMode !== "owner" && data.settings.appMode !== "staff") {
      data.settings.appMode = "staff";
    }
    const m = Number(data.settings.monthlySalesTargetYen);
    data.settings.monthlySalesTargetYen = Number.isFinite(m) && m >= 0 ? Math.round(m) : 0;
    const d = Number(data.settings.dailySalesTargetYen);
    data.settings.dailySalesTargetYen = Number.isFinite(d) && d >= 0 ? Math.round(d) : 0;
    if (!Array.isArray(data.settings.salesSegments)) data.settings.salesSegments = [];
    data.settings.salesSegments = data.settings.salesSegments
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 24);
  }

  function ensureSalesLedger() {
    if (!Array.isArray(data.salesLedger)) data.salesLedger = [];
  }

  function normalizeSalesLedgerOnLoad() {
    ensureSalesLedger();
    for (const e of data.salesLedger) {
      const n = Math.round(Number(e.amountYen) || 0);
      e.amountYen = Number.isFinite(n) && n >= 0 ? n : 0;
      e.segment = (e.segment != null ? String(e.segment) : "全体").trim() || "全体";
      e.memo = e.memo != null ? String(e.memo) : "";
      const p = Math.round(Number(e.partyCount));
      e.partyCount = Number.isFinite(p) && p >= 0 ? p : 0;
      if (e.partyCount === 0 && n > 0) e.partyCount = 1;
      if (!e.id) e.id = uid();
      const ds = String(e.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) e.date = todayISO();
      else e.date = ds;
    }
  }

  function ensureTonightPlanArray() {
    if (!Array.isArray(data.tonightPlan)) data.tonightPlan = [];
  }

  function normalizeTonightPlanOnLoad() {
    ensureTonightPlanArray();
    data.tonightPlan = data.tonightPlan.filter((e) => {
      if (!e || typeof e !== "object") return false;
      const gid = String(e.customerId || "").trim();
      const gl = String(e.guestLabel || "").trim();
      return Boolean(gid || gl);
    });
    for (const e of data.tonightPlan) {
      if (!e.id) e.id = uid();
      if (e.customerId) e.customerId = String(e.customerId).trim();
      if (e.guestLabel) e.guestLabel = String(e.guestLabel).trim();
    }
  }

  /** 日付が変わったら今夜の予定リストをリセット（true なら保存が必要） */
  function syncTonightPlanToNewDay() {
    const today = todayISO();
    if (!data.settings.tonightPlanForDate || typeof data.settings.tonightPlanForDate !== "string") {
      data.settings.tonightPlanForDate = today;
    }
    if (data.settings.tonightPlanForDate !== today) {
      data.tonightPlan = [];
      data.settings.tonightPlanForDate = today;
      return true;
    }
    return false;
  }

  /** 既存データの amount を数値または null にマイグレーション */
  function migrateVisitAmountsOnLoad() {
    let changed = false;
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (v.amount === "" || v.amount === undefined) {
          if (v.amount !== null) {
            v.amount = null;
            changed = true;
          }
          continue;
        }
        if (typeof v.amount === "number") {
          if (!Number.isFinite(v.amount) || v.amount < 0) {
            v.amount = null;
            changed = true;
          }
          continue;
        }
        v.amount = parseVisitAmountYen(v.amount);
        changed = true;
      }
    }
    return changed;
  }

  function getAppMode() {
    return data.settings && data.settings.appMode === "owner" ? "owner" : "staff";
  }

  function currentTabs() {
    return getAppMode() === "owner" ? TABS_OWNER : TABS_STAFF;
  }

  function defaultTabForMode(mode) {
    return mode === "owner" ? "overview" : "home";
  }

  function ensureValidTab() {
    const ids = new Set(currentTabs().map((t) => t.id));
    if (!ids.has(ui.tab)) ui.tab = defaultTabForMode(getAppMode());
  }

  function displaySurname(name) {
    const n = String(name || "").trim();
    if (!n) return "お客様";
    return n.endsWith("さん") ? n : n + "さん";
  }

  function customerById(id) {
    return data.customers.find((c) => c.id === id) || null;
  }

  function syncVisitDerivedFields(c) {
    const hist = c.visitHistory || [];
    if (!hist.length) {
      c.lastVisit = "";
      c.visitCount = 0;
      return;
    }
    const dates = hist.map((v) => v.date).filter(Boolean);
    if (!dates.length) {
      c.visitCount = hist.length;
      return;
    }
    dates.sort();
    c.lastVisit = dates[dates.length - 1];
    c.visitCount = hist.length;
  }

  function defaultCustomer() {
    return {
      id: uid(),
      name: "",
      nickname: "",
      gender: "",
      ageBand: "",
      phone: "",
      lineName: "",
      instagram: "",
      birthday: "",
      firstVisit: "",
      lastVisit: "",
      visitCount: 0,
      favoriteDrink: "",
      dislikeDrink: "",
      usualWeekdays: [],
      usualTimeSlot: "",
      vibeType: "",
      conversationMemo: "",
      ngTopics: "",
      referrer: "",
      status: "初回来店",
      tags: [],
      visitHistory: [],
      bottles: [],
      photoDataUrl: "",
    };
  }

  function buildSeedCustomers() {
    const wd = new Date().getDay();
    const iso = addDaysISO;

    const birthdaySoon = addDaysISO(5);
    const bdMonth = birthdaySoon.slice(5, 7);
    const bdDay = birthdaySoon.slice(8, 10);

    const bottleDeadline = addDaysISO(7);

    const mkVisit = (id, date, opts = {}) => ({
      id: id || uid(),
      date,
      partySize: opts.partySize ?? 1,
      amount: opts.amount !== undefined ? opts.amount : null,
      drinks: opts.drinks ?? "",
      memo: opts.memo ?? "",
      nextTopic: opts.nextTopic ?? "",
      moodTags: opts.moodTags || [],
    });

    return [
      {
        ...defaultCustomer(),
        id: uid(),
        name: "山田",
        nickname: "ヤマちゃん",
        gender: "男性",
        ageBand: "50代",
        lineName: "yamada_snack",
        birthday: "1972-03-12",
        firstVisit: iso(-400),
        lastVisit: iso(-32),
        visitCount: 0,
        favoriteDrink: "麦焼酎 水割り",
        dislikeDrink: "甘いカクテル",
        usualWeekdays: [5, 6],
        usualTimeSlot: "21時〜",
        vibeType: "静かに飲みたい",
        conversationMemo: "ゴルフの話が弾む。奥様の話は深掘りしない方がよさそう。",
        ngTopics: "政治",
        referrer: "常連の紹介",
        status: "しばらく来店なし",
        tags: ["ゴルフ好き", "静かめ"],
        visitHistory: [
          mkVisit(
            uid(),
            iso(-32),
            {
              drinks: "麦焼酎",
              memo: "来週のコンペの話。少し疲れ気味。",
              moodTags: ["疲れていた", "仕事の話"],
              partySize: 2,
              amount: 9800,
            }
          ),
          mkVisit(
            uid(),
            iso(-70),
            {
              drinks: "ハイボール",
              memo: "静かにニュース談義。",
              moodTags: ["静かだった"],
              amount: 6200,
            }
          ),
        ],
        bottles: [],
      },
      {
        ...defaultCustomer(),
        id: uid(),
        name: "佐藤",
        nickname: "さっちゃん",
        gender: "女性",
        ageBand: "40代",
        birthday: `1984-${bdMonth}-${bdDay}`,
        firstVisit: iso(-120),
        lastVisit: iso(-5),
        visitCount: 0,
        favoriteDrink: "白ワイン",
        dislikeDrink: "",
        usualWeekdays: [3, 4],
        usualTimeSlot: "20時前後",
        vibeType: "誰かと話したい",
        conversationMemo: "カラオケ好き。最近転職したばかり。",
        ngTopics: "",
        referrer: "",
        status: "たまに来る",
        tags: ["カラオケ好き", "誕生日近い"],
        visitHistory: [
          mkVisit(
            uid(),
            iso(-5),
            {
              drinks: "白ワイン",
              memo: "新しい職場の話で盛り上がった。",
              moodTags: ["楽しそう", "仕事の話"],
              partySize: 3,
              amount: 15400,
            }
          ),
          mkVisit(uid(), iso(-40), {
            drinks: "スパークリング",
            moodTags: ["盛り上がった"],
            amount: 11000,
          }),
        ],
        bottles: [],
      },
      {
        ...defaultCustomer(),
        id: uid(),
        name: "田中",
        nickname: "タナさん",
        gender: "男性",
        ageBand: "40代",
        birthday: "1980-11-02",
        firstVisit: iso(-200),
        lastVisit: iso(-3),
        visitCount: 0,
        favoriteDrink: "芋焼酎",
        usualWeekdays: [4],
        usualTimeSlot: "22時〜",
        vibeType: "常連",
        conversationMemo: "黒霧島キープ。出張が多い熊本担当。",
        status: "常連",
        tags: ["出張", "よく飲む"],
        visitHistory: [
          mkVisit(
            uid(),
            iso(-3),
            {
              drinks: "黒霧島 お湯割り",
              memo: "来月も熊本に来る予定。",
              moodTags: ["出張"],
              amount: 13200,
            }
          ),
          mkVisit(uid(), iso(-25), { drinks: "芋焼酎", moodTags: ["静かだった"], amount: 8900 }),
        ],
        bottles: [
          {
            id: uid(),
            name: "黒霧島",
            kind: "芋焼酎",
            remaining: "50%",
            keepStart: iso(-60),
            keepDeadline: bottleDeadline,
            memo: "お湯割り派",
          },
        ],
      },
      {
        ...defaultCustomer(),
        id: uid(),
        name: "中村",
        nickname: "ナカさん",
        gender: "男性",
        ageBand: "30代",
        firstVisit: iso(-90),
        lastVisit: iso(-10),
        visitCount: 0,
        favoriteDrink: "ハイボール",
        usualWeekdays: [wd],
        usualTimeSlot: "21時半〜",
        vibeType: "仕事帰り",
        conversationMemo: "広告関係。木曜か金曜に来ることが多い（今日の曜日に合わせた例）。",
        status: "常連",
        tags: ["仕事帰り"],
        visitHistory: [
          mkVisit(uid(), iso(-10), { moodTags: ["疲れていた"], partySize: 2, amount: 7200 }),
          mkVisit(uid(), iso(-17), { moodTags: ["仕事の話"], amount: 6800 }),
        ],
        bottles: [],
      },
      {
        ...defaultCustomer(),
        id: uid(),
        name: "高橋",
        nickname: "タカさん",
        gender: "男性",
        ageBand: "60代以上",
        firstVisit: iso(-500),
        lastVisit: iso(-1),
        visitCount: 0,
        favoriteDrink: "日本酒（辛口）",
        usualWeekdays: [5],
        usualTimeSlot: "20時〜",
        vibeType: "常連",
        conversationMemo: "VIP席希望。紹介が多い。誕生日には必ず一言。",
        status: "VIP",
        tags: ["紹介多い", "よく飲む"],
        visitHistory: [
          mkVisit(uid(), iso(-1), { moodTags: ["楽しそう"], partySize: 4, amount: 28000 }),
          mkVisit(uid(), iso(-8), { moodTags: ["接待"], partySize: 5, amount: 42000 }),
          mkVisit(uid(), iso(-20), { moodTags: ["盛り上がった"], amount: 19500 }),
        ],
        bottles: [
          {
            id: uid(),
            name: "久保田 萬寿",
            kind: "日本酒",
            remaining: "25%",
            keepStart: iso(-45),
            keepDeadline: addDaysISO(20),
            memo: "次回は冷酒で",
          },
        ],
      },
    ].map((c) => {
      syncVisitDerivedFields(c);
      return c;
    });
  }

  function seedIfEmpty() {
    if (data.customers.length) return;
    data.customers = buildSeedCustomers();
    if (!data.settings) data.settings = { todayMemo: "", customTags: [], appMode: "staff", monthlySalesTargetYen: 0, dailySalesTargetYen: 0 };
    normalizeSettingsAfterLoad();
    data.settings.todayMemo =
      "今日のメモ例：カウンター席のみ空きあり。黒霧島キープの田中さん、来週熊本出張予定。";
    save();
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        data = { customers: [], salesLedger: [], tonightPlan: [], settings: { todayMemo: "", customTags: [], appMode: "staff", monthlySalesTargetYen: 0, dailySalesTargetYen: 0 } };
        seedIfEmpty();
        for (const c of data.customers) {
          if (typeof c.photoDataUrl !== "string") c.photoDataUrl = "";
        }
        return;
      }
      const parsed = JSON.parse(raw);
      data.customers = Array.isArray(parsed.customers) ? parsed.customers : [];
      data.salesLedger = Array.isArray(parsed.salesLedger) ? parsed.salesLedger : [];
      data.tonightPlan = Array.isArray(parsed.tonightPlan) ? parsed.tonightPlan : [];
      data.settings = parsed.settings || {
        todayMemo: "",
        customTags: [],
        appMode: "staff",
        monthlySalesTargetYen: 0,
        dailySalesTargetYen: 0,
      };
      normalizeSettingsAfterLoad();
      if (!data.settings.customTags) data.settings.customTags = [];
      normalizeSalesLedgerOnLoad();
      normalizeTonightPlanOnLoad();
      if (syncTonightPlanToNewDay()) save();
      if (migrateVisitAmountsOnLoad()) save();
      seedIfEmpty();
      for (const c of data.customers) {
        if (typeof c.photoDataUrl !== "string") c.photoDataUrl = "";
      }
    } catch (e) {
      console.error(e);
      data = { customers: [], salesLedger: [], tonightPlan: [], settings: { todayMemo: "", customTags: [], appMode: "staff", monthlySalesTargetYen: 0, dailySalesTargetYen: 0 } };
      normalizeSalesLedgerOnLoad();
      normalizeTonightPlanOnLoad();
      if (syncTonightPlanToNewDay()) save();
      seedIfEmpty();
      for (const c of data.customers) {
        if (typeof c.photoDataUrl !== "string") c.photoDataUrl = "";
      }
    }
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        customers: data.customers,
        salesLedger: data.salesLedger || [],
        tonightPlan: data.tonightPlan || [],
        settings: data.settings,
      })
    );
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.hidden = true;
    }, 2200);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast("コピーしました");
        return;
      }
    } catch (_) {
      /* fallthrough */
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("コピーしました");
    } catch {
      toast("コピーに失敗しました");
    }
    document.body.removeChild(ta);
  }

  /* ---------- LINE 文面 ---------- */

  function nearestBottle(c) {
    const bottles = c.bottles || [];
    if (!bottles.length) return null;
    const future = bottles
      .filter((b) => b.keepDeadline)
      .sort((a, b) => a.keepDeadline.localeCompare(b.keepDeadline));
    return future[0] || bottles[0];
  }

  function lineContext(c) {
    const name = displaySurname(c.name);
    const nick = (c.nickname || "").trim();
    const since = daysSince(c.lastVisit);
    const bd = daysUntilNextBirthday(c.birthday);
    const bottle = nearestBottle(c);
    const bDays = bottle ? daysUntilDeadline(bottle.keepDeadline) : null;
    return { c, name, nick, since, bd, bottle, bDays };
  }

  function generateLineText(patternId, c) {
    const { name, nick, since, bd, bottle, bDays } = lineContext(c);
    const call = nick ? `${name}（${nick}）` : name;

    switch (patternId) {
      case "thanks":
        return `${call}\n昨日はありがとうございました。ゆっくりお話できて嬉しかったです。またお時間ある時に、ふらっと寄ってくださいね。`;
      case "miss_you":
        return `${call}\nお元気ですか？最近お会いできていなくて、ちょっと気になっていました。無理のない範囲で、また顔を見せに来てもらえると嬉しいです。`;
      case "birthday":
        if (bd != null && bd <= 7) {
          return `${call}\nもうすぐお誕生日ですね。いつもありがとうございます。お時間合えば、お祝いの席をご用意してお待ちしています。`;
        }
        return `${call}\nお誕生日、おめでとうございます。いつもありがとうございます。今日はゆっくり、お祝いさせてくださいね。`;
      case "bottle":
        if (bottle && bottle.name) {
          const left =
            bDays == null
              ? "そろそろ"
              : bDays < 0
                ? "キープの期限を過ぎてしまっているのですが"
                : bDays === 0
                  ? "今日がキープの期限なのですが"
                  : `あと${bDays}日ほどでキープの期限なのですが`;
          return `${call}\n${left}、「${bottle.name}」の件でご連絡です。ご都合のよいタイミングで、またお越しくださいね。`;
        }
        return `${call}\nキープのお酒の件でご連絡です。またお時間ある時に、ふらっと寄ってもらえると嬉しいです。`;
      case "quiet_tonight":
        return `${call}\n今日は少し静かな夜になりそうなので、よかったらふらっとどうぞ。無理のない範囲で、お待ちしています。`;
      default:
        return "";
    }
  }

  /* ---------- ダッシュボード集計 ---------- */

  function monthlyVisitCount() {
    const t = todayISO().slice(0, 7);
    let n = 0;
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (v.date && v.date.startsWith(t)) n++;
      }
    }
    return n;
  }

  /** 指定月の来店記録ベース売上（当日より未来の日付は含めない） */
  function monthlyRevenueFromVisitsYenForMonth(ym) {
    const today = todayISO();
    let s = 0;
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (!v.date || !v.date.startsWith(ym)) continue;
        if (v.date > today) continue;
        if (typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0) s += v.amount;
      }
    }
    return s;
  }

  /** 当月の来店記録ベース売上 */
  function monthlyRevenueYen() {
    return monthlyRevenueFromVisitsYenForMonth(todayISO().slice(0, 7));
  }

  /** 来店の amount のみ合算（1日） */
  function visitRevenueOnDate(iso) {
    let s = 0;
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (v.date !== iso) continue;
        if (typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0) s += v.amount;
      }
    }
    return s;
  }

  /** 今日（端末日付）の売上合計（来店の amount 合計） */
  function revenueTodayYen() {
    return visitRevenueOnDate(todayISO());
  }

  function ledgerEntriesOnDate(iso) {
    ensureSalesLedger();
    return data.salesLedger.filter((e) => e.date === iso);
  }

  function hasLedgerOnDate(iso) {
    return ledgerEntriesOnDate(iso).length > 0;
  }

  function ledgerTotalOnDate(iso) {
    return ledgerEntriesOnDate(iso).reduce((sum, e) => sum + (Number(e.amountYen) || 0), 0);
  }

  /** 同日台帳行の組数の合計 */
  function ledgerPartyTotalOnDate(iso) {
    return ledgerEntriesOnDate(iso).reduce((sum, e) => sum + (Number(e.partyCount) || 0), 0);
  }

  /** 台帳がある日: 合計金額÷合計組数（組数>0のとき） */
  function ledgerDailyAvgCheckYen(iso) {
    if (!hasLedgerOnDate(iso)) return null;
    const parties = ledgerPartyTotalOnDate(iso);
    const amt = ledgerTotalOnDate(iso);
    if (!parties || parties <= 0 || !amt) return null;
    return Math.round(amt / parties);
  }

  /** 当月台帳の金額合計・組数合計 */
  function ledgerPartyAndAmountForMonth(ym) {
    ensureSalesLedger();
    let amount = 0;
    let parties = 0;
    for (const e of data.salesLedger) {
      if (!e.date || !e.date.startsWith(ym)) continue;
      amount += Number(e.amountYen) || 0;
      parties += Number(e.partyCount) || 0;
    }
    return { amount, parties };
  }

  /** 今月台帳ベース客単価（全行の金額合÷組数合） */
  function ledgerAvgCheckMonthYen(ym) {
    const { amount, parties } = ledgerPartyAndAmountForMonth(ym);
    if (!parties || parties <= 0 || !amount) return null;
    return Math.round(amount / parties);
  }

  /** その日は手入力が1件でもあれば台帳合計を採用。なければ来店記録の合計。 */
  function resolvedRevenueOnDate(iso) {
    return hasLedgerOnDate(iso) ? ledgerTotalOnDate(iso) : visitRevenueOnDate(iso);
  }

  function eachDateInMonth(ym) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const dates = [];
    for (let day = 1; day <= last; day++) {
      dates.push(`${ym}-${String(day).padStart(2, "0")}`);
    }
    return dates;
  }

  /** 指定月の確定ベース売上（当日より未来日は含めない。日ごとに resolved を合算） */
  function monthlyResolvedRevenueYen(ym) {
    const today = todayISO();
    let s = 0;
    for (const d of eachDateInMonth(ym)) {
      if (d > today) break;
      s += resolvedRevenueOnDate(d);
    }
    return s;
  }

  function revenueTodayResolved() {
    return resolvedRevenueOnDate(todayISO());
  }

  function hasLedgerInMonth(ym) {
    ensureSalesLedger();
    return data.salesLedger.some((e) => e.date && e.date.startsWith(ym));
  }

  function aggregateLedgerSegmentsForMonth(ym) {
    ensureSalesLedger();
    const map = {};
    for (const e of data.salesLedger) {
      if (!e.date || !e.date.startsWith(ym)) continue;
      const seg = (e.segment || "全体").trim() || "全体";
      map[seg] = (map[seg] || 0) + (Number(e.amountYen) || 0);
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }

  function customerRevenueFromVisitsForMonth(ym, limit = 12) {
    const today = todayISO();
    const rows = [];
    for (const c of data.customers) {
      let s = 0;
      for (const v of c.visitHistory || []) {
        if (!v.date || !v.date.startsWith(ym)) continue;
        if (v.date > today) continue;
        if (typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0) s += v.amount;
      }
      if (s > 0) rows.push({ c, yen: s });
    }
    rows.sort((a, b) => b.yen - a.yen);
    return rows.slice(0, limit);
  }

  function dailyResolvedSeriesForMonth(ym) {
    const today = todayISO();
    const labels = [];
    const values = [];
    for (const d of eachDateInMonth(ym)) {
      if (d > today) break;
      labels.push(Number(d.slice(8, 10)) + "日");
      values.push(resolvedRevenueOnDate(d));
    }
    return { labels, values };
  }

  function yearlyResolvedRevenueYen(year) {
    const today = todayISO();
    const yStr = String(year);
    let total = 0;
    for (let month = 1; month <= 12; month++) {
      const ym = `${yStr}-${String(month).padStart(2, "0")}`;
      if (ym > today.slice(0, 7)) break;
      total += monthlyResolvedRevenueYen(ym);
    }
    return total;
  }

  function lastNYearsDescending(n) {
    const y = new Date().getFullYear();
    return Array.from({ length: n }, (_, i) => y - i);
  }

  function getSalesSegmentOptions() {
    const out = [...DEFAULT_SALES_SEGMENTS];
    for (const s of data.settings.salesSegments || []) {
      const t = String(s || "").trim();
      if (t && !out.includes(t)) out.push(t);
    }
    for (const e of data.salesLedger || []) {
      const t = String(e.segment || "").trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  }

  function analyticsMonthSelectOptions() {
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 24; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ ym, label: formatJaMonthLabel(ym) });
    }
    return opts;
  }

  /** 今月の「今日までの暦日」メタ（目標のペース感に使用） */
  function monthCalendarProgress() {
    const iso = todayISO();
    const y = Number(iso.slice(0, 4));
    const mo = Number(iso.slice(5, 7));
    const day = Number(iso.slice(8, 10));
    const daysInMonth = new Date(y, mo, 0).getDate();
    const remainingIncludingToday = daysInMonth - day + 1;
    return { dayOfMonth: day, daysInMonth, remainingIncludingToday };
  }

  function computeMonthTargetGamification(rev, targetYen) {
    if (!targetYen || targetYen <= 0) {
      return {
        hasTarget: false,
        pct: 0,
        pctClamped: 0,
        shortfall: null,
        over: null,
        badge: "目標未設定",
        badgeClass: "target-badge--muted",
        title: "今月の売上",
        body: "設定タブで月次目標を入れると、達成度・不足額・ペースの目安が表示されます。",
        paceLine: "",
      };
    }
    const ratio = rev / targetYen;
    const pct = ratio * 100;
    const shortfall = Math.max(0, Math.round(targetYen - rev));
    const over = Math.max(0, Math.round(rev - targetYen));
    let badge = "チャレンジ中";
    let badgeClass = "target-badge--info";
    let body = "";
    if (ratio >= 1) {
      badge = "目標達成";
      badgeClass = "target-badge--success";
      body = over > 0 ? `目標を ${formatYen(over)} 上回っています。記録のペースが良いです。` : "目標ラインに到達しました。お疲れさまです。";
    } else if (ratio >= 0.9) {
      badge = "ラストスパート";
      badgeClass = "target-badge--warn";
      body = `あと ${formatYen(shortfall)} でクリアです。`;
    } else if (ratio >= 0.6) {
      badge = "順調寄り";
      badgeClass = "target-badge--info";
      body = `残り ${formatYen(shortfall)}。ペースを崩さなければ射程圏内です。`;
    } else {
      badge = "巻き返しゾーン";
      badgeClass = "target-badge--danger";
      body = `あと ${formatYen(shortfall)}。数字を見て今夜の打ち手を考えるチャンスです。`;
    }
    const meta = monthCalendarProgress();
    const expected = Math.round((targetYen * meta.dayOfMonth) / meta.daysInMonth);
    const paceDelta = rev - expected;
    let paceLine = "";
    if (ratio < 1 && meta.remainingIncludingToday > 0 && shortfall > 0) {
      const needPerDay = Math.ceil(shortfall / meta.remainingIncludingToday);
      const paceCmp =
        paceDelta >= 0
          ? `カレンダー的中ペースより ${formatYen(paceDelta)} 上振れ`
          : `カレンダー的中ペースより ${formatYen(-paceDelta)} 下振れ`;
      paceLine = `${paceCmp}。このままなら残り${meta.remainingIncludingToday}日で平均 ${formatYen(needPerDay)}/日 が目安です。`;
    }
    return {
      hasTarget: true,
      pct,
      pctClamped: Math.min(100, pct),
      shortfall,
      over,
      badge,
      badgeClass,
      title: "今月の売上 vs 目標",
      body,
      paceLine,
      expected,
    };
  }

  function computeDailyTargetGamification(todayRev, dailyYen) {
    if (!dailyYen || dailyYen <= 0) {
      return {
        hasTarget: false,
        pct: 0,
        pctClamped: 0,
        shortfall: null,
        badge: "未設定",
        badgeClass: "target-badge--muted",
        title: "本日の売上",
        body: "日次目標を設定すると、1日のゴールに対する達成度が分かります。",
      };
    }
    const ratio = todayRev / dailyYen;
    const pct = ratio * 100;
    const shortfall = Math.max(0, Math.round(dailyYen - todayRev));
    let badge = "今日の一戦";
    let badgeClass = "target-badge--info";
    if (ratio >= 1) {
      badge = "本日クリア";
      badgeClass = "target-badge--success";
    } else if (ratio >= 0.5) {
      badge = "佳境";
      badgeClass = "target-badge--warn";
    } else {
      badge = "スタート";
      badgeClass = "target-badge--danger";
    }
    return {
      hasTarget: true,
      pct,
      pctClamped: Math.min(100, pct),
      shortfall,
      badge,
      badgeClass,
      title: "今日の売上 vs 日次目標",
      body: shortfall > 0 ? `あと ${formatYen(shortfall)} で今日のラインです。` : "今日のラインをクリアしました。",
    };
  }

  function monthlyVisitsWithAmountCount() {
    const t = todayISO().slice(0, 7);
    let n = 0;
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (!v.date || !v.date.startsWith(t)) continue;
        if (typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0) n++;
      }
    }
    return n;
  }

  function avgCheckThisMonthYen() {
    const n = monthlyVisitsWithAmountCount();
    if (!n) return null;
    return Math.round(monthlyRevenueYen() / n);
  }

  /** 来店に金額がある全期間の平均単価（今夜の人数目安のフォールバック） */
  function avgCheckAllTimeYen() {
    let s = 0;
    let n = 0;
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0) {
          s += v.amount;
          n++;
        }
      }
    }
    return n ? Math.round(s / n) : null;
  }

  function customerLtvYen(c) {
    let s = 0;
    for (const v of c.visitHistory || []) {
      if (typeof v.amount === "number" && Number.isFinite(v.amount) && v.amount > 0) s += v.amount;
    }
    return s;
  }

  function topLtvCustomers(limit = 5) {
    return data.customers
      .map((c) => ({ c, ltv: customerLtvYen(c) }))
      .filter((x) => x.ltv > 0)
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, limit);
  }

  function customerPartyStats(c) {
    const sizes = (c.visitHistory || [])
      .map((v) => Number(v.partySize))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!sizes.length) return null;
    const max = Math.max(...sizes);
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    return { avg: Math.round(avg * 10) / 10, max };
  }

  function aggregateVisitsByWeekday() {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (!v.date) continue;
        const d = parseISO(v.date);
        if (!d) continue;
        counts[d.getDay()]++;
      }
    }
    return counts.map((count, i) => ({ weekday: i, label: WEEKDAY_LABELS[i], count }));
  }

  function aggregateMoodTagsThisMonth(limit = 12) {
    const monthPrefix = todayISO().slice(0, 7);
    const map = {};
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (!v.date || !v.date.startsWith(monthPrefix)) continue;
        for (const m of v.moodTags || []) {
          map[m] = (map[m] || 0) + 1;
        }
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function buildSalesAIDataset() {
    const ym = ui.analyticsSalesYM || todayISO().slice(0, 7);
    const ymPrevDate = new Date(`${ym}-01T12:00:00`);
    ymPrevDate.setMonth(ymPrevDate.getMonth() - 1);
    const prevYm = `${ymPrevDate.getFullYear()}-${String(ymPrevDate.getMonth() + 1).padStart(2, "0")}`;
    const resolvedMonth = monthlyResolvedRevenueYen(ym);
    const visitMonth = monthlyRevenueFromVisitsYenForMonth(ym);
    const prevResolved = monthlyResolvedRevenueYen(prevYm);
    const mom =
      prevResolved > 0 ? Math.round(((resolvedMonth - prevResolved) / prevResolved) * 10000) / 100 : null;
    const daily = dailyResolvedSeriesForMonth(ym);
    let bestIdx = -1;
    let worstIdx = -1;
    let bestV = -1;
    let worstV = Infinity;
    daily.values.forEach((v, i) => {
      if (v > bestV) {
        bestV = v;
        bestIdx = i;
      }
      if (v < worstV) {
        worstV = v;
        worstIdx = i;
      }
    });
    ensureSalesLedger();
    const ledgerMonthRows = data.salesLedger.filter((e) => e.date.startsWith(ym));
    const { parties: ledgerPartySumMonth } = ledgerPartyAndAmountForMonth(ym);
    const ledgerAvgParty = ledgerAvgCheckMonthYen(ym);
    const ledgerSummary = ledgerMonthRows.map((e) => ({
      id: e.id,
      date: e.date,
      amountYen: e.amountYen,
      partyCount: e.partyCount ?? 1,
      segment: e.segment,
      memo: e.memo,
    }));
    const segments = aggregateLedgerSegmentsForMonth(ym);
    const topCust = customerRevenueFromVisitsForMonth(ym, 10).map(({ c, yen }, i) => ({
      rank: i + 1,
      displayLabel: displaySurname(c.name),
      customerInternalId: c.id,
      revenueYenFromVisits: yen,
    }));
    const months12 = monthKeysBack(12).map((k) => ({
      month: k,
      resolvedYen: monthlyResolvedRevenueYen(k),
      visitsRevenueYen: monthlyRevenueFromVisitsYenForMonth(k),
    }));
    const yearsChrono = lastNYearsDescending(5).slice().reverse();
    const years5 = yearsChrono.map((y) => ({ year: y, resolvedYen: yearlyResolvedRevenueYen(y) }));
    return {
      focusMonth: ym,
      resolvedRevenueThisMonthYen: resolvedMonth,
      visitRecordedRevenueThisMonthYen: visitMonth,
      previousMonthResolvedYen: prevResolved,
      monthOverMonthResolvedPct: mom,
      dailyResolvedInFocusMonth: daily.labels.map((lab, i) => ({ dayLabel: lab, yen: daily.values[i] })),
      bestDayInMonth: bestIdx >= 0 ? { dayLabel: daily.labels[bestIdx], yen: daily.values[bestIdx] } : null,
      worstDayInMonth:
        worstIdx >= 0 && daily.values.length
          ? { dayLabel: daily.labels[worstIdx], yen: daily.values[worstIdx] }
          : null,
      ledgerLinesThisMonth: ledgerSummary,
      ledgerPartyCountSumThisMonth: ledgerPartySumMonth,
      ledgerAvgCheckByPartyThisMonthYen: ledgerAvgParty,
      segmentTotalsThisMonth: Object.fromEntries(segments),
      topCustomersByVisitRevenueThisMonth: topCust,
      monthlyResolvedSeriesLast12: months12,
      yearlyResolvedLast5: years5,
      monthlyTargetYen: data.settings.monthlySalesTargetYen || 0,
      dailyTargetYen: data.settings.dailySalesTargetYen || 0,
      salesResolutionRule:
        "各日: 手入力台帳が1件以上あればその日は台帳の合計のみを採用。なければ来店の金額合計。同日に複数台帳行がある場合は金額・組数をそれぞれ合算し、客単価は合計金額÷合計組数。月合計は当日までの暦日のみ加算。",
    };
  }

  function buildAISalesReportMarkdown() {
    const d = buildSalesAIDataset();
    const lines = [];
    lines.push("# スナック売上レポート（自動下書き）");
    lines.push(`- 生成: ${new Date().toLocaleString("ja-JP")}`);
    lines.push(`- 分析対象月: ${formatJaMonthLabel(d.focusMonth)}`);
    lines.push("");
    lines.push("## 1. 要約");
    lines.push(
      `- 当月（確定ベース・今日まで）売上: **${formatYen(d.resolvedRevenueThisMonthYen)}**（来店記録のみの合計: ${formatYen(d.visitRecordedRevenueThisMonthYen)}）`
    );
    if (d.ledgerAvgCheckByPartyThisMonthYen != null) {
      lines.push(
        `- 当月の台帳ベース客単価（金額合÷組数合）: **${formatYen(d.ledgerAvgCheckByPartyThisMonthYen)}**（台帳の組数合計: ${d.ledgerPartyCountSumThisMonth}組）`
      );
    }
    if (d.monthlyTargetYen > 0) {
      const p = Math.round((d.resolvedRevenueThisMonthYen / d.monthlyTargetYen) * 1000) / 10;
      lines.push(`- 月次目標: **${formatYen(d.monthlyTargetYen)}**（達成率およそ **${p}%**）`);
    }
    if (d.monthOverMonthResolvedPct != null) {
      lines.push(
        `- 前月比（確定ベース）: **${d.monthOverMonthResolvedPct}%**（前月 ${formatYen(d.previousMonthResolvedYen)} → 当月 ${formatYen(d.resolvedRevenueThisMonthYen)}）`
      );
    }
    lines.push("");
    lines.push("## 2. 日次の動き（選択月・今日まで）");
    if (d.bestDayInMonth) lines.push(`- もっとも高い日: ${d.bestDayInMonth.dayLabel}（${formatYen(d.bestDayInMonth.yen)}）`);
    if (d.worstDayInMonth) lines.push(`- もっとも低い日: ${d.worstDayInMonth.dayLabel}（${formatYen(d.worstDayInMonth.yen)}）`);
    lines.push("");
    lines.push("## 3. セグメント（手入力台帳のみ）");
    const seg = d.segmentTotalsThisMonth;
    if (Object.keys(seg).length) {
      for (const [k, v] of Object.entries(seg)) lines.push(`- ${k}: ${formatYen(v)}`);
    } else lines.push("- 当月の手入力セグメント集計はまだありません。");
    lines.push("");
    lines.push("## 4. 顧客別（来店に金額があるもの・選択月）");
    d.topCustomersByVisitRevenueThisMonth.forEach((r) => {
      lines.push(`- ${r.rank}. ${r.displayLabel}: ${formatYen(r.revenueYenFromVisits)}`);
    });
    if (!d.topCustomersByVisitRevenueThisMonth.length) lines.push("- 該当なし");
    lines.push("");
    lines.push("## 5. AI に深掘りしてほしい観点（例）");
    lines.push("- セグメント構成から見た席・スタッフ配置やセットの打ち手");
    lines.push("- 日次ブレの要因（曜日・イベント・天候）の切り分け");
    lines.push("- 上位顧客のリピート施策の具体化");
    lines.push("");
    lines.push("## 集計ルール");
    lines.push(d.salesResolutionRule);
    return lines.join("\n");
  }

  function buildExportInsightsPayload() {
    const cal = monthCalendarProgress();
    const ym = todayISO().slice(0, 7);
    const sales = buildSalesAIDataset();
    return {
      generatedAt: new Date().toISOString(),
      note: "salesAnalysis.topCustomersByVisitRevenueThisMonth に表示用ラベルがあります。外部共有時はマスクしてください。crmOps は来店・ボトル等の集計のみです。",
      salesAnalysis: sales,
      aiReportMarkdownDraft: buildAISalesReportMarkdown(),
      crmOps: {
        customerCount: data.customers.length,
        monthlyVisitCount: monthlyVisitCount(),
        monthlyRevenueFromVisitsYen: monthlyRevenueYen(),
        monthlyResolvedRevenueYen: monthlyResolvedRevenueYen(ym),
        revenueTodayResolvedYen: revenueTodayResolved(),
        revenueTodayFromVisitsYen: revenueTodayYen(),
        monthlySalesTargetYen: data.settings.monthlySalesTargetYen || 0,
        dailySalesTargetYen: data.settings.dailySalesTargetYen || 0,
        monthProgress: cal,
        avgCheckThisMonthYen: avgCheckThisMonthYen(),
        avgCheckAllTimeYen: avgCheckAllTimeYen(),
        ledgerAvgCheckMonthYen: ledgerAvgCheckMonthYen(ym),
        ledgerDailyAvgCheckTodayYen: ledgerDailyAvgCheckYen(todayISO()),
        moodTagsThisMonth: Object.fromEntries(aggregateMoodTagsThisMonth(30)),
        visitsByWeekday: aggregateVisitsByWeekday().map((x) => ({ day: x.label, count: x.count })),
        statusCounts: Object.fromEntries(aggregateStatusCounts()),
        bottleRemaining: Object.fromEntries(
          aggregateBottleRemainingCounts().map((x) => [x.remaining, x.count])
        ),
      },
    };
  }

  function inactiveCustomers(limit = 8) {
    return data.customers
      .map((c) => ({ c, d: daysSince(c.lastVisit) }))
      .filter((x) => x.d != null && x.d > 30)
      .sort((a, b) => b.d - a.d)
      .slice(0, limit);
  }

  function upcomingBirthdays(days = 30, limit = 8) {
    return data.customers
      .map((c) => ({ c, d: daysUntilNextBirthday(c.birthday) }))
      .filter((x) => x.d != null && x.d >= 0 && x.d <= days)
      .sort((a, b) => a.d - b.d)
      .slice(0, limit);
  }

  function upcomingBottles(days = 14, limit = 8) {
    const rows = [];
    for (const c of data.customers) {
      for (const b of c.bottles || []) {
        if (!b.keepDeadline) continue;
        const until = daysUntilDeadline(b.keepDeadline);
        if (until == null) continue;
        if (until <= days) rows.push({ c, b, until });
      }
    }
    rows.sort((a, b) => a.until - b.until);
    return rows.slice(0, limit);
  }

  function likelyTodayCustomers(limit = 12) {
    const wd = new Date().getDay();
    return data.customers
      .filter((c) => (c.usualWeekdays || []).map(Number).includes(wd))
      .slice(0, limit);
  }

  const CHART_WARM = ["#d4af37", "#c45b6a", "#5b9bd5", "#8b7ec8", "#3db39a", "#f0c75e"];
  const CHART_TICK = "#94a3b8";
  const CHART_CANVAS_IDS = [
    "chartSalesByMonth",
    "chartSalesByDay",
    "chartSalesYear",
    "chartSalesSegment",
    "chartSalesCustomers",
  ];

  function customerHasBottleDueSoon(c, days = 14) {
    for (const b of c.bottles || []) {
      if (!b.keepDeadline) continue;
      const u = daysUntilDeadline(b.keepDeadline);
      if (u != null && u <= days) return true;
    }
    return false;
  }

  function needsFollowUp(c) {
    const d = daysSince(c.lastVisit);
    if (d != null && d > 30) return true;
    const bd = daysUntilNextBirthday(c.birthday);
    if (bd != null && bd >= 0 && bd <= 30) return true;
    if (customerHasBottleDueSoon(c, 14)) return true;
    return false;
  }

  function countFollowUpCustomers() {
    const set = new Set();
    for (const c of data.customers) {
      if (needsFollowUp(c)) set.add(c.id);
    }
    return set.size;
  }

  function countRegularCustomers() {
    return data.customers.filter((c) => c.status === "常連" || c.status === "VIP").length;
  }

  function monthKeysBack(n) {
    const keys = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      keys.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
  }

  function aggregateStatusCounts() {
    const map = {};
    for (const s of STATUS_OPTIONS) map[s] = 0;
    for (const c of data.customers) {
      const s = c.status || "初回来店";
      if (map[s] === undefined) map[s] = 0;
      map[s]++;
    }
    return Object.entries(map).filter(([, n]) => n > 0);
  }

  function aggregateBottleRemainingCounts() {
    const order = BOTTLE_REMAINING;
    const map = {};
    order.forEach((r) => {
      map[r] = 0;
    });
    for (const c of data.customers) {
      for (const b of c.bottles || []) {
        const r = b.remaining || "100%";
        if (map[r] !== undefined) map[r]++;
        else map[r] = 1;
      }
    }
    return order.map((r) => ({ remaining: r, count: map[r] || 0 }));
  }

  function flattenRecentVisits(limit) {
    const rows = [];
    for (const c of data.customers) {
      for (const v of c.visitHistory || []) {
        if (!v.date) continue;
        rows.push({
          date: v.date,
          customerId: c.id,
          name: displaySurname(c.name),
          memo: v.memo || "",
          drinks: v.drinks || "",
        });
      }
    }
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows.slice(0, limit);
  }

  function formatJaMonthLabel(ym) {
    const [y, m] = ym.split("-");
    return `${Number(y)}年${Number(m)}月`;
  }

  function destroyAllCharts() {
    CHART_CANVAS_IDS.forEach((id) => {
      const canvas = document.getElementById(id);
      if (!canvas || typeof Chart === "undefined" || !Chart.getChart) return;
      const ch = Chart.getChart(canvas);
      if (ch) ch.destroy();
    });
  }

  function initOwnerAnalyticsCharts() {
    if (ui.tab !== "analytics" || getAppMode() !== "owner" || typeof Chart === "undefined") return;
    document.querySelectorAll("[data-pending-chart-msg]").forEach((el) => el.remove());
    const warm = CHART_WARM;
    const tick = CHART_TICK;
    const ym = ui.analyticsSalesYM || todayISO().slice(0, 7);

    const c1 = document.getElementById("chartSalesByMonth");
    const c2 = document.getElementById("chartSalesByDay");
    const c3 = document.getElementById("chartSalesYear");
    const c4 = document.getElementById("chartSalesSegment");
    const c5 = document.getElementById("chartSalesCustomers");
    if (!c1 || !c2 || !c3 || !c4 || !c5) return;

    const monthKeys = monthKeysBack(12);
    new Chart(c1, {
      type: "line",
      data: {
        labels: monthKeys.map((k) => formatJaMonthLabel(k)),
        datasets: [
          {
            label: "確定ベース売上",
            data: monthKeys.map((k) => monthlyResolvedRevenueYen(k)),
            borderColor: warm[0],
            backgroundColor: "rgba(212, 175, 55, 0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: tick } } },
        scales: {
          x: { ticks: { color: tick, maxRotation: 45 } },
          y: { beginAtZero: true, ticks: { color: tick } },
        },
      },
    });

    const daily = dailyResolvedSeriesForMonth(ym);
    new Chart(c2, {
      type: "bar",
      data: {
        labels: daily.labels,
        datasets: [
          {
            label: `${formatJaMonthLabel(ym)} 日次`,
            data: daily.values,
            backgroundColor: daily.values.map((_, i) => warm[i % warm.length]),
            borderRadius: 4,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } },
          y: { beginAtZero: true, ticks: { color: tick } },
        },
      },
    });

    const yearsChrono = lastNYearsDescending(5).slice().reverse();
    new Chart(c3, {
      type: "bar",
      data: {
        labels: yearsChrono.map((y) => `${y}年`),
        datasets: [
          {
            label: "年間（確定ベース・進行中の年は今日まで）",
            data: yearsChrono.map((y) => yearlyResolvedRevenueYen(y)),
            backgroundColor: yearsChrono.map((_, i) => warm[i % warm.length]),
            borderRadius: 6,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tick } },
          y: { beginAtZero: true, ticks: { color: tick } },
        },
      },
    });

    const seg = aggregateLedgerSegmentsForMonth(ym);
    const segLabels = seg.length ? seg.map(([k]) => k) : ["（手入力なし）"];
    const segData = seg.length ? seg.map(([, v]) => v) : [1];
    new Chart(c4, {
      type: "doughnut",
      data: {
        labels: segLabels,
        datasets: [
          {
            data: segData,
            backgroundColor: segLabels.map((_, i) => warm[i % warm.length]),
            borderColor: "#1e2433",
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { color: tick, boxWidth: 10, font: { size: 10 } } },
        },
      },
    });

    const top = customerRevenueFromVisitsForMonth(ym, 10);
    const topLabels = top.length ? top.map(({ c }) => displaySurname(c.name)) : ["（データなし）"];
    const topData = top.length ? top.map((x) => x.yen) : [0];
    new Chart(c5, {
      type: "bar",
      data: {
        labels: topLabels,
        datasets: [
          {
            label: "来店金額",
            data: topData,
            backgroundColor: topLabels.map((_, i) => warm[i % warm.length]),
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: tick } },
          y: { ticks: { color: tick } },
        },
      },
    });
  }

  function initChartsForCurrentTab() {
    if (typeof Chart === "undefined") return;
    if (ui.tab === "analytics" && getAppMode() === "owner") initOwnerAnalyticsCharts();
  }

  /* ---------- 描画 ---------- */

  const TABS_STAFF = [
    { id: "home", label: "今夜" },
    { id: "customers", label: "顧客" },
    { id: "bottles", label: "ボトル" },
    { id: "line", label: "LINE" },
  ];

  const TABS_OWNER = [
    { id: "overview", label: "売上" },
    { id: "analytics", label: "分析" },
    { id: "settings", label: "設定" },
  ];

  function headerTitle() {
    if (ui.tab === "overview") return "売上ダッシュボード";
    if (ui.tab === "analytics") return "売上分析";
    if (ui.tab === "customers") {
      if (ui.custView === "detail" && ui.custId) {
        const c = customerById(ui.custId);
        return c ? displaySurname(c.name) : "顧客";
      }
      if (ui.custView === "edit" && ui.custId) return "情報を編集";
      if (ui.custView === "new") return "新しいお客様";
      return "顧客一覧";
    }
    if (ui.tab === "bottles") return "ボトル一覧";
    if (ui.tab === "line") return "LINE";
    if (ui.tab === "settings") return "設定";
    if (ui.tab === "home") return "今夜のノート";
    return "Snack CRM";
  }

  function renderHeader() {
    let actions = "";
    if (ui.tab === "customers" && ui.custView === "list") {
      actions = `<button type="button" class="btn btn--ghost btn--small" data-action="cust-new">＋ 登録</button>`;
    } else if (ui.tab === "customers" && ui.custView === "detail" && ui.custId) {
      actions = `
        <button type="button" class="btn btn--ghost btn--small" data-action="line-open" data-id="${escAttr(ui.custId)}">LINE</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="cust-edit" data-id="${escAttr(ui.custId)}">編集</button>`;
    } else if (ui.tab === "customers" && (ui.custView === "edit" || ui.custView === "new")) {
      actions = `<button type="button" class="btn btn--ghost btn--small" data-action="cust-cancel">戻る</button>`;
    }
    return `
      <header class="app-header">
        <div class="app-header__left">
          <div class="mode-switch" role="group" aria-label="利用モード">
            <button type="button" class="mode-switch__btn ${getAppMode() === "staff" ? "is-active" : ""}" data-action="set-app-mode" data-mode="staff">現場</button>
            <button type="button" class="mode-switch__btn ${getAppMode() === "owner" ? "is-active" : ""}" data-action="set-app-mode" data-mode="owner">経営</button>
          </div>
          <h1 class="app-header__title">${esc(headerTitle())}</h1>
        </div>
        <div class="app-header__actions">${actions}</div>
      </header>`;
  }

  function renderTabBar() {
    return `
      <nav class="tab-bar" aria-label="メインメニュー">
        ${currentTabs().map(
          (t) => `
          <button type="button" class="tab-bar__btn" data-tab="${escAttr(t.id)}" ${ui.tab === t.id ? 'aria-current="page"' : ""}>
            <span class="tab-bar__label">${esc(t.label)}</span>
          </button>`
        ).join("")}
      </nav>`;
  }

  function renderOwnerOverview() {
    const total = data.customers.length;
    const monthVisits = monthlyVisitCount();
    const curYm = todayISO().slice(0, 7);
    const rev = monthlyResolvedRevenueYen(curYm);
    const visitRevMonth = monthlyRevenueYen();
    const withAmt = monthlyVisitsWithAmountCount();
    const visitAvg = avgCheckThisMonthYen();
    const ledgerAvg = ledgerAvgCheckMonthYen(curYm);
    const avgDisplay = ledgerAvg ?? visitAvg;
    const avgHintLedger =
      ledgerAvg != null
        ? `台帳ベース（今月の金額÷組数の合算）${visitAvg != null ? `／来店記録: ${formatYen(visitAvg)}` : ""}`
        : "";
    const avgHintVisitOnly = visitAvg != null ? `${String(withAmt)}件の来店金額から算出` : "金額入力で算出";
    const top = topLtvCustomers(5);
    const mt = data.settings.monthlySalesTargetYen || 0;
    const dt = data.settings.dailySalesTargetYen || 0;
    const todayR = revenueTodayResolved();
    const mg = computeMonthTargetGamification(rev, mt);
    const dg = computeDailyTargetGamification(todayR, dt);
    const cal = monthCalendarProgress();
    const monthPct = mg.hasTarget ? mg.pctClamped : 0;
    const dayPct = dg.hasTarget ? dg.pctClamped : 0;
    const monthCenter =
      !mg.hasTarget ? "—" : mg.pct >= 100 ? "達成" : `${Math.round(Math.min(100, mg.pct))}%`;
    const dayCenter =
      !dg.hasTarget ? "—" : dg.pct >= 100 ? "クリア" : `${Math.round(Math.min(100, dg.pct))}%`;

    let monthCardHint = "";
    if (hasLedgerInMonth(curYm)) {
      monthCardHint = `<p class="owner-target-card__hint">一部の日で手入力台帳を使用しています。来店のみ集計の今月: ${esc(formatYen(visitRevMonth))}。</p>`;
    } else if (rev === 0 && !withAmt) {
      monthCardHint = `<p class="owner-target-card__hint">今月の売上データがありません。来店に金額を入れるか、「分析」の台帳で締めを入力してください。</p>`;
    }

    const topHtml = top.length
      ? top
          .map(
            ({ c, ltv }) =>
              `<li><button type="button" class="btn-link" data-action="open-cust-staff" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button> · 累計 ${formatYen(ltv)} <span class="mini-list__sub">（現場の顧客へ）</span></li>`
          )
          .join("")
      : "<li>金額が記録された来店がありません</li>";

    return `
      <div class="owner-dash">
        <p class="owner-dash__lead">月次目標の進捗は<strong>確定ベース</strong>（その日に手入力台帳があれば台帳優先、なければ来店の金額合計）で計算します。詳細は「売上分析」で台帳入力とグラフを確認できます。</p>
        <div class="owner-target-grid">
          <section class="owner-target-card" aria-labelledby="owner-month-title">
            <header class="owner-target-card__head">
              <h2 id="owner-month-title" class="owner-target-card__title">${esc(mg.title)}</h2>
              <span class="target-badge ${esc(mg.badgeClass)}">${esc(mg.badge)}</span>
            </header>
            <div class="owner-target-card__row">
              <div class="gauge" style="--pct:${monthPct}" role="img" aria-label="今月の達成率 ${esc(monthCenter)}">
                <div class="gauge__inner">
                  <span class="gauge__value">${esc(monthCenter)}</span>
                  <span class="gauge__sub">進捗</span>
                </div>
              </div>
              <div class="owner-target-card__stats">
                <p class="owner-stat-line">
                  <span class="owner-stat-line__label">実績</span>
                  <strong class="owner-stat-line__num">${esc(formatYen(rev))}</strong>
                </p>
                <p class="owner-stat-line">
                  <span class="owner-stat-line__label">目標</span>
                  <span class="owner-stat-line__num">${mg.hasTarget ? esc(formatYen(mt)) : "未設定"}</span>
                </p>
                ${
                  mg.hasTarget && mg.shortfall != null && mg.shortfall > 0
                    ? `<p class="owner-stat-line owner-stat-line--alert"><span class="owner-stat-line__label">不足</span><strong class="owner-stat-line__num">${esc(formatYen(mg.shortfall))}</strong></p>`
                    : mg.hasTarget && mg.over != null && mg.over > 0
                      ? `<p class="owner-stat-line owner-stat-line--ok"><span class="owner-stat-line__label">超過</span><strong class="owner-stat-line__num">+${esc(formatYen(mg.over))}</strong></p>`
                      : ""
                }
                <p class="owner-target-card__copy">${esc(mg.body)}</p>
                ${mg.paceLine ? `<p class="owner-target-card__pace">${esc(mg.paceLine)}</p>` : ""}
                ${monthCardHint}
              </div>
            </div>
          </section>
          <section class="owner-target-card owner-target-card--compact" aria-labelledby="owner-day-title">
            <header class="owner-target-card__head">
              <h2 id="owner-day-title" class="owner-target-card__title">${esc(dg.title)}</h2>
              <span class="target-badge ${esc(dg.badgeClass)}">${esc(dg.badge)}</span>
            </header>
            <div class="owner-target-card__row">
              <div class="gauge gauge--sm" style="--pct:${dayPct}" role="img" aria-label="本日の達成率 ${esc(dayCenter)}">
                <div class="gauge__inner">
                  <span class="gauge__value">${esc(dayCenter)}</span>
                  <span class="gauge__sub">今日</span>
                </div>
              </div>
              <div class="owner-target-card__stats">
                <p class="owner-stat-line">
                  <span class="owner-stat-line__label">本日</span>
                  <strong class="owner-stat-line__num">${esc(formatYen(todayR))}</strong>
                </p>
                <p class="owner-stat-line">
                  <span class="owner-stat-line__label">1日の目標</span>
                  <span class="owner-stat-line__num">${dg.hasTarget ? esc(formatYen(dt)) : "未設定"}</span>
                </p>
                <p class="owner-target-card__copy">${esc(dg.body)}</p>
              </div>
            </div>
          </section>
        </div>

        <div class="summary-grid summary-grid--tight">
          <div class="summary-card summary-card--accent">
            <p class="summary-card__label">登録顧客</p>
            <p class="summary-card__value">${total}</p>
          </div>
          <div class="summary-card">
            <p class="summary-card__label">今月の来店</p>
            <p class="summary-card__value">${monthVisits}<span class="summary-card__unit">回</span></p>
          </div>
          <div class="summary-card">
            <p class="summary-card__label">今月の客単価</p>
            <p class="summary-card__value">${avgDisplay != null ? esc(formatYen(avgDisplay)) : "—"}</p>
            <p class="summary-card__hint">${ledgerAvg != null ? esc(avgHintLedger) : esc(avgHintVisitOnly)}</p>
          </div>
          <div class="summary-card">
            <p class="summary-card__label">今月の暦</p>
            <p class="summary-card__value">${cal.dayOfMonth}<span class="summary-card__unit">日目</span></p>
            <p class="summary-card__hint">全${cal.daysInMonth}日・残り${cal.remainingIncludingToday}日</p>
          </div>
        </div>

        <section class="panel">
          <h2 class="panel__title">累計売上（記録）が多いお客様</h2>
          <ul class="mini-list">${topHtml}</ul>
        </section>
        <div class="btn-row">
          <button type="button" class="btn btn--primary btn--small" data-action="goto-tab" data-tab="analytics">分析へ</button>
          <button type="button" class="btn btn--surface btn--small" data-action="goto-tab" data-tab="settings">目標を編集</button>
        </div>
      </div>`;
  }

  function renderOwnerAnalytics() {
    const chartAwaitMsg =
      typeof Chart === "undefined"
        ? `<p class="chart-fallback" data-pending-chart-msg>グラフは Chart.js を読み込めたあとに表示されます。</p>`
        : "";
    const ym = ui.analyticsSalesYM || todayISO().slice(0, 7);
    const monthOpts = analyticsMonthSelectOptions()
      .map((o) => `<option value="${escAttr(o.ym)}" ${o.ym === ym ? "selected" : ""}>${esc(o.label)}</option>`)
      .join("");
    ensureSalesLedger();
    const editEntry = ui.salesEditId ? data.salesLedger.find((x) => x.id === ui.salesEditId) : null;
    const formDate = editEntry ? editEntry.date : todayISO();
    const formAmount = editEntry ? String(editEntry.amountYen) : "";
    const formSeg = editEntry ? editEntry.segment : "全体";
    const formMemo = editEntry ? editEntry.memo : "";
    const formParty = editEntry ? String(editEntry.partyCount ?? 1) : "1";
    const segDatalist = getSalesSegmentOptions()
      .map((s) => `<option value="${escAttr(s)}"></option>`)
      .join("");
    const ledgerRows = [...data.salesLedger].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
    const ledgerTbody = ledgerRows.length
      ? ledgerRows
          .map(
            (e) => `<tr>
            <td data-label="日付">${esc(e.date)}</td>
            <td data-label="金額">${esc(formatYen(e.amountYen))}</td>
            <td data-label="組数">${esc(String(e.partyCount ?? 1))}</td>
            <td data-label="セグメント">${esc(e.segment || "—")}</td>
            <td data-label="メモ">${esc(e.memo || "—")}</td>
            <td data-label="操作">
              <button type="button" class="btn btn--surface btn--small" data-action="sales-edit" data-id="${escAttr(e.id)}">編集</button>
              <button type="button" class="btn btn--danger btn--small" data-action="sales-del" data-id="${escAttr(e.id)}">削除</button>
            </td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="6" style="padding:0.65rem;text-align:center">台帳に行がありません。下のフォームから追加できます。</td></tr>`;

    const aiMd = buildAISalesReportMarkdown();
    const aiJson = JSON.stringify(buildExportInsightsPayload(), null, 2);

    return `
      <p class="lead">確定売上は<strong>手入力台帳優先</strong>です。その日に台帳が1件でもあると、その日は来店の金額は集計から外れ、台帳の<strong>金額合計</strong>がその日の売上になります。同日に複数行があるときは<strong>組数も合算</strong>し、客単価は「金額合÷組数合」です。</p>

      <div class="analytics-toolbar">
        <label class="analytics-toolbar__label" for="analyticsMonthSelect">表示月</label>
        <select id="analyticsMonthSelect" class="select select--inline">${monthOpts}</select>
        <span class="analytics-toolbar__meta">${esc(formatJaMonthLabel(ym))} 確定: <strong>${esc(formatYen(monthlyResolvedRevenueYen(ym)))}</strong> ／ 来店のみ: ${esc(
      formatYen(monthlyRevenueFromVisitsYenForMonth(ym))
    )}</span>
      </div>

      <div class="charts-grid">
        ${chartAwaitMsg}
        <div class="chart-box chart-box--wide">
          <h3 class="chart-box__title">月次・売上の推移（12か月・確定ベース）</h3>
          <div class="chart-canvas-wrap"><canvas id="chartSalesByMonth" aria-label="月次売上"></canvas></div>
        </div>
        <div class="chart-box chart-box--wide">
          <h3 class="chart-box__title">日次・売上（選択月・今日まで）</h3>
          <div class="chart-canvas-wrap chart-canvas-wrap--short"><canvas id="chartSalesByDay" aria-label="日次売上"></canvas></div>
        </div>
        <div class="chart-box">
          <h3 class="chart-box__title">年次・売上（直近5年）</h3>
          <div class="chart-canvas-wrap chart-canvas-wrap--short"><canvas id="chartSalesYear" aria-label="年次売上"></canvas></div>
        </div>
        <div class="chart-box">
          <h3 class="chart-box__title">セグメント別（手入力台帳のみ）</h3>
          <div class="chart-canvas-wrap chart-canvas-wrap--short"><canvas id="chartSalesSegment" aria-label="セグメント"></canvas></div>
        </div>
        <div class="chart-box chart-box--wide">
          <h3 class="chart-box__title">顧客別・来店金額（選択月）</h3>
          <div class="chart-canvas-wrap chart-canvas-wrap--short"><canvas id="chartSalesCustomers" aria-label="顧客別売上"></canvas></div>
        </div>
      </div>

      <section class="panel">
        <h2 class="panel__title">実績売上の台帳（追加・編集・削除）</h2>
        <p class="panel__help panel__help--compact">日付ごとに締めの金額と<strong>組数</strong>を登録します。同日に複数行があるときは<strong>金額・組数をそれぞれ合算</strong>し、その日の客単価は「合計金額÷合計組数」です。過去分はいつでも編集・削除して実績を合わせ直せます。</p>
        <form class="sales-ledger-form" data-form="sales-ledger">
          <input type="hidden" name="entryId" value="${escAttr(editEntry ? editEntry.id : "")}" />
          <div class="sales-ledger-form__grid">
            <div class="field"><label for="salesFormDate">日付</label><input id="salesFormDate" class="input" type="date" name="date" required value="${escAttr(formDate)}" /></div>
            <div class="field"><label for="salesFormAmount">金額（円）</label><input id="salesFormAmount" class="input" type="number" name="amount" min="0" step="1" required placeholder="例 185000" value="${escAttr(formAmount)}" /></div>
            <div class="field"><label for="salesFormParty">組数</label><input id="salesFormParty" class="input" type="number" name="partyCount" min="1" step="1" required placeholder="例 3" value="${escAttr(formParty)}" /></div>
            <div class="field">
              <label for="salesFormSegment">セグメント</label>
              <input id="salesFormSegment" class="input" name="segment" list="salesSegList" value="${escAttr(formSeg)}" autocomplete="off" />
              <datalist id="salesSegList">${segDatalist}</datalist>
            </div>
          </div>
          <div class="field"><label for="salesFormMemo">メモ（任意）</label><input id="salesFormMemo" class="input" name="memo" value="${escAttr(formMemo)}" placeholder="宴会・キャンペーン名など" /></div>
          <div class="btn-row">
            <button type="submit" class="btn btn--primary btn--small">${editEntry ? "台帳を更新" : "台帳に追加"}</button>
            ${editEntry ? `<button type="button" class="btn btn--surface btn--small" data-action="sales-cancel-edit">編集をやめる</button>` : ""}
          </div>
        </form>
        <div class="data-table-wrap" style="margin-top:0.75rem">
          <table class="data-table">
            <thead><tr><th>日付</th><th>金額</th><th>組数</th><th>セグメント</th><th>メモ</th><th>操作</th></tr></thead>
            <tbody>${ledgerTbody}</tbody>
          </table>
        </div>
      </section>

      <section class="panel panel--muted">
        <h2 class="panel__title">AI 分析レポート（画面を開くたびに更新）</h2>
        <p class="panel__help panel__help--compact">Markdown はそのまま ChatGPT / Gemini に貼ると講評・施策案を書きやすい構成です。JSON には台帳明細とグラフ用の集計が入ります（外部共有時は個人名に注意）。</p>
        <p class="label">Markdown 下書き</p>
        <textarea id="aiSalesMarkdown" class="textarea" readonly rows="14">${esc(aiMd)}</textarea>
        <div class="btn-row">
          <button type="button" class="btn btn--primary btn--small" data-action="copy-ai-sales-md">Markdownをコピー</button>
        </div>
        <p class="label" style="margin-top:0.75rem">完全な JSON</p>
        <textarea id="insightsExport" class="textarea" readonly rows="10">${esc(aiJson)}</textarea>
        <div class="btn-row">
          <button type="button" class="btn btn--primary btn--small" data-action="copy-insights-json">JSONをコピー</button>
        </div>
      </section>`;
  }

  function tonightPlanDisplayRows() {
    ensureTonightPlanArray();
    return data.tonightPlan.map((e) => {
      if (e.customerId) {
        const c = customerById(e.customerId);
        return {
          id: e.id,
          kind: "customer",
          customerId: e.customerId,
          label: c ? displaySurname(c.name) : "（不明な顧客）",
        };
      }
      return { id: e.id, kind: "guest", customerId: "", label: e.guestLabel || "仮予定" };
    });
  }

  /** 今夜トップ用の目標・実績・人数目安 */
  function staffTonightSalesStrip() {
    const curYm = todayISO().slice(0, 7);
    const t = todayISO();
    const dayT = data.settings.dailySalesTargetYen || 0;
    const monthT = data.settings.monthlySalesTargetYen || 0;
    const todayR = revenueTodayResolved();
    const monthR = monthlyResolvedRevenueYen(curYm);
    const shortDay = dayT > 0 ? Math.max(0, dayT - todayR) : null;
    const shortMonth = monthT > 0 ? Math.max(0, monthT - monthR) : null;
    const todayLedgerAvg = ledgerDailyAvgCheckYen(t);
    const visitAvgMonth = avgCheckThisMonthYen();
    const histAvg = avgCheckAllTimeYen();
    const avgForHint = todayLedgerAvg ?? visitAvgMonth ?? histAvg;
    const avgSource =
      todayLedgerAvg != null ? "ledger-today" : visitAvgMonth != null ? "visit-month" : histAvg != null ? "visit-all" : "none";
    const extraGuestsUnit = avgSource === "ledger-today" ? "組" : "名分";
    let extraGuestsHint = null;
    if (shortDay != null && shortDay > 0 && avgForHint != null && avgForHint > 0) {
      extraGuestsHint = Math.ceil(shortDay / avgForHint);
    }
    ensureTonightPlanArray();
    const planN = data.tonightPlan.length;
    const needVsPlan = extraGuestsHint != null ? Math.max(0, extraGuestsHint - planN) : null;
    let guestHintMeterPct = null;
    if (extraGuestsHint != null && extraGuestsHint > 0 && extraGuestsUnit !== "組") {
      guestHintMeterPct = Math.min(100, Math.round((planN / extraGuestsHint) * 1000) / 10);
    } else if (dayT > 0 && shortDay != null && shortDay <= 0) {
      guestHintMeterPct = 100;
    }
    const dayPctBar = dayT > 0 ? Math.min(100, Math.round((todayR / dayT) * 1000) / 10) : 0;
    const monthPctBar = monthT > 0 ? Math.min(100, Math.round((monthR / monthT) * 1000) / 10) : 0;
    return {
      curYm,
      dayT,
      monthT,
      todayR,
      monthR,
      shortDay,
      shortMonth,
      avg: avgForHint,
      todayLedgerAvg,
      visitAvgMonth,
      histAvg,
      avgSource,
      extraGuestsUnit,
      extraGuestsHint,
      planN,
      needVsPlan,
      guestHintMeterPct,
      dayPctBar,
      monthPctBar,
    };
  }

  function renderHome() {
    if (syncTonightPlanToNewDay()) save();
    const st = staffTonightSalesStrip();
    const planRows = tonightPlanDisplayRows();
    const inactiveFull = inactiveCustomers(100);
    const inactiveShort = inactiveCustomers(5);
    const bdays = upcomingBirthdays(30);
    const bdaysShort = bdays.slice(0, 5);
    const bottles = upcomingBottles(14);
    const bottlesShort = bottles.slice(0, 5);
    const likely = likelyTodayCustomers();
    const likelyShort = likely.slice(0, 5);
    const total = data.customers.length;
    const monthVisits = monthlyVisitCount();
    const regularN = countRegularCustomers();
    const followN = countFollowUpCustomers();

    const longDate = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date());

    function actionListHtml(arr, mapLine) {
      if (!arr.length) return "<li>該当なし</li>";
      return arr.map(mapLine).join("");
    }

    const inactiveRows = inactiveFull.length
      ? inactiveFull
          .map(({ c, d }) => {
            return `<tr>
            <td data-label="名前"><button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button></td>
            <td data-label="最終来店">${esc(c.lastVisit || "—")}</td>
            <td data-label="経過日数">${d != null ? esc(String(d)) + "日" : "—"}</td>
            <td data-label="好きなお酒">${esc(c.favoriteDrink || "—")}</td>
            <td data-label="LINE"><button type="button" class="btn btn--primary btn--small" data-action="line-open" data-id="${escAttr(c.id)}">文面</button></td>
          </tr>`;
          })
          .join("")
      : `<tr><td colspan="5" style="padding:0.75rem;text-align:center">該当する方はいません</td></tr>`;

    const recentVisits = flattenRecentVisits(12);
    const timelineHtml = recentVisits.length
      ? `<ul class="timeline">${recentVisits
          .map(
            (r) => `<li class="timeline__item">
          <p class="timeline__date">${esc(r.date)}</p>
          <p class="timeline__who"><button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(r.customerId)}">${esc(r.name)}</button></p>
          <p class="timeline__body">${r.drinks ? esc(r.drinks) + "／" : ""}${esc(r.memo || "（メモなし）")}</p>
        </li>`
          )
          .join("")}</ul>`
      : `<p class="panel__help" style="margin:0">まだ来店履歴がありません</p>`;

    const planListHtml = planRows.length
      ? planRows
          .map((r) => {
            const nameCell =
              r.kind === "customer"
                ? `<button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(r.customerId)}">${esc(r.label)}</button>`
                : `<span class="tonight-plan__guest">${esc(r.label)}</span>`;
            return `<li class="tonight-plan__item">
            <span class="tonight-plan__cell">${nameCell}<span class="tonight-plan__chip">${r.kind === "customer" ? "顧客" : "仮"}</span></span>
            <button type="button" class="btn btn--ghost btn--small" data-action="tonight-remove-plan" data-id="${escAttr(r.id)}">外す</button>
          </li>`;
          })
          .join("")
      : `<li class="tonight-plan__empty">まだいません。下から追加できます。</li>`;

    const avgUsedLabel =
      st.todayLedgerAvg != null ? "今日の台帳客単価" : st.visitAvgMonth != null ? "今月の来店平均" : st.histAvg != null ? "来店の過去平均" : "";

    const avgStackLines = [];
    if (st.todayLedgerAvg != null) avgStackLines.push(`今日の台帳: ${formatYen(st.todayLedgerAvg)}（金額合÷組数合）`);
    if (st.visitAvgMonth != null) avgStackLines.push(`今月の来店: ${formatYen(st.visitAvgMonth)}`);
    if (st.histAvg != null && st.visitAvgMonth == null) avgStackLines.push(`来店の過去平均: ${formatYen(st.histAvg)}`);
    const avgStackHtml = avgStackLines.length
      ? `<div class="tonight-kpi__stack">${avgStackLines.map((t) => `<p class="tonight-kpi__stack-line">${esc(t)}</p>`).join("")}</div>`
      : "";

    const avgFine =
      st.avg != null && avgUsedLabel
        ? `<p class="tonight-kpi__fine">不足の按分には<strong>${esc(avgUsedLabel)}</strong>（<strong>${esc(formatYen(st.avg))}</strong>）を使っています。</p>`
        : `<p class="tonight-kpi__fine">経営の「売上分析」で台帳の組数、または来店の金額を入れると客単価が出ます。</p>`;

    let gapLabel = "単価ベースであと必要（概算）";
    let gapBig = "—";
    let gapSub = "";
    let gapMeter = "";
    let gapCardClass = "tonight-kpi tonight-kpi--gap";

    if (st.dayT <= 0) {
      gapLabel = "日次目標";
      gapBig = "未設定";
      gapSub = "経営モードの「設定」で入力すると、ここに不足の人数目安が出ます。";
    } else if (st.shortDay != null && st.shortDay <= 0) {
      gapLabel = "本日の不足";
      gapBig = "なし";
      gapSub = "日次目標に対して不足はありません。";
      gapCardClass += " tonight-kpi--ok";
      gapMeter = `<div class="tonight-meter tonight-meter--ok" style="--pct:100" role="img" aria-label="達成100パーセント"></div>`;
    } else if (st.avg == null || st.extraGuestsHint == null) {
      gapSub =
        st.shortDay != null && st.shortDay > 0
          ? `不足 ${esc(formatYen(st.shortDay))} ・ 客単価が算出できないため、人数目安は出せません。`
          : "";
    } else if (st.extraGuestsUnit === "組") {
      gapLabel = "台帳ベースの目安";
      gapBig = `${esc(String(st.extraGuestsHint))}<span class="tonight-kpi__unit">組</span>`;
      gapSub = `不足 ${esc(formatYen(st.shortDay))} を今日の台帳客単価で按分した目安です。`;
      gapMeter = `<p class="tonight-kpi__fine" style="margin-top:0.35rem">今夜の予定は<strong>${esc(String(st.planN))}名</strong>（人数と組は別単位です）。</p>`;
    } else {
      gapBig = `${esc(String(st.needVsPlan != null ? st.needVsPlan : 0))}<span class="tonight-kpi__unit">名</span>`;
      gapSub = `不足 ${esc(formatYen(st.shortDay))} → 約<strong>${esc(String(st.extraGuestsHint))}名分</strong>のうち、予定<strong>${esc(String(st.planN))}名</strong>。`;
      if (st.needVsPlan != null && st.needVsPlan > 0) gapCardClass += " tonight-kpi--attention";
      if (st.needVsPlan === 0) {
        gapCardClass += " tonight-kpi--ok";
        gapSub = `不足 ${esc(formatYen(st.shortDay))} → 約 ${esc(String(st.extraGuestsHint))}名分を予定でカバーできる見込みです。`;
      }
      if (st.guestHintMeterPct != null) {
        gapMeter = `<div class="tonight-meter" style="--pct:${esc(String(st.guestHintMeterPct))}" role="img" aria-label="予定が目安に対して${esc(String(Math.round(st.guestHintMeterPct)))}パーセント"><span class="tonight-meter__bar"></span></div><p class="tonight-kpi__meter-cap">予定 ÷ 単価按分の目安（${esc(String(Math.round(st.guestHintMeterPct)))}%）</p>`;
      }
    }

    const targetAlert =
      st.dayT <= 0
        ? `<div class="tonight-alert" role="status"><strong>日次目標が未設定</strong>です。経営モードの「設定」から入力してください（現場の設定にはありません）。</div>`
        : "";

    const tonightGuestDashHtml = `
      <div class="tonight-board__guest" role="region" aria-labelledby="tonightGuestDashTitle">
        <h3 id="tonightGuestDashTitle" class="tonight-board__subhead">来客予定と客単価の目安</h3>
        ${targetAlert}
        <div class="tonight-board__kpis tonight-board__kpis--triple">
          <div class="tonight-kpi tonight-kpi--avg">
            <p class="tonight-kpi__label">客単価の目安</p>
            <p class="tonight-kpi__big">${st.avg != null ? esc(formatYen(st.avg)) : "—"}</p>
            ${avgStackHtml}
            ${avgFine}
          </div>
          <div class="tonight-kpi tonight-kpi--plan">
            <p class="tonight-kpi__label">今夜の来客予定</p>
            <p class="tonight-kpi__big">${esc(String(st.planN))}<span class="tonight-kpi__unit">名</span></p>
            <p class="tonight-kpi__sub">今夜のリストに入っている人数です。</p>
          </div>
          <div class="${gapCardClass}">
            <p class="tonight-kpi__label">${esc(gapLabel)}</p>
            <p class="tonight-kpi__big">${gapBig}</p>
            ${gapSub ? `<p class="tonight-kpi__sub">${gapSub}</p>` : ""}
            ${gapMeter}
          </div>
        </div>
        <p class="tonight-board__fine-print">表示はすべて概算です。会計の確定値ではありません。</p>
      </div>`;

    return `
      <section class="tonight-board" aria-labelledby="tonightBoardTitle">
        <div class="tonight-board__head">
          <h2 id="tonightBoardTitle" class="tonight-board__title">今夜の売上・予定</h2>
        </div>
        <div class="tonight-board__kpis">
          <div class="tonight-kpi">
            <p class="tonight-kpi__label">今日の目標</p>
            <p class="tonight-kpi__big">${st.dayT > 0 ? esc(formatYen(st.dayT)) : "未設定"}</p>
            <p class="tonight-kpi__sub">いま ${esc(formatYen(st.todayR))} ／ あと ${st.shortDay != null ? esc(formatYen(st.shortDay)) : "—"}</p>
            <div class="tonight-meter" style="--pct:${st.dayPctBar}"><span class="tonight-meter__bar"></span></div>
          </div>
          <div class="tonight-kpi">
            <p class="tonight-kpi__label">今月の目標</p>
            <p class="tonight-kpi__big">${st.monthT > 0 ? esc(formatYen(st.monthT)) : "未設定"}</p>
            <p class="tonight-kpi__sub">いま ${esc(formatYen(st.monthR))} ／ あと ${st.shortMonth != null ? esc(formatYen(st.shortMonth)) : "—"}</p>
            <div class="tonight-meter" style="--pct:${st.monthPctBar}"><span class="tonight-meter__bar"></span></div>
          </div>
        </div>
        ${tonightGuestDashHtml}
        <div class="tonight-plan-block">
          <div class="tonight-plan-block__head">
            <h3 class="tonight-plan-block__title">今夜の来店予定</h3>
            <div class="btn-row">
              <button type="button" class="btn btn--primary btn--small" data-action="tonight-modal-customer">顧客から追加</button>
              <button type="button" class="btn btn--surface btn--small" data-action="tonight-modal-guest">仮予定を追加</button>
            </div>
          </div>
          <ul class="tonight-plan__list">${planListHtml}</ul>
        </div>
      </section>

      <div class="notebook-hero">
        <h2 class="notebook-hero__title">今日のお客様ノート</h2>
        <p class="notebook-hero__date">${esc(longDate)}</p>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <p class="summary-card__label">総顧客数</p>
          <p class="summary-card__value">${total}</p>
        </div>
        <div class="summary-card">
          <p class="summary-card__label">今月の来店</p>
          <p class="summary-card__value">${monthVisits}<span style="font-size:0.72rem;font-weight:600">回</span></p>
        </div>
        <div class="summary-card">
          <p class="summary-card__label">常連数</p>
          <p class="summary-card__value">${regularN}</p>
        </div>
        <div class="summary-card">
          <p class="summary-card__label">要フォロー</p>
          <p class="summary-card__value">${followN}</p>
        </div>
      </div>

      <div class="action-scroll">
        <div class="action-card">
          <h3 class="action-card__title">最近来ていない方</h3>
          <ul class="action-card__list">
            ${actionListHtml(
              inactiveShort,
              ({ c, d }) =>
                `<li><button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button> · ${d}日</li>`
            )}
          </ul>
          <div class="action-card__more"><button type="button" class="btn-link" data-action="goto-customers">顧客へ</button></div>
        </div>
        <div class="action-card">
          <h3 class="action-card__title">誕生日が近い方</h3>
          <ul class="action-card__list">
            ${actionListHtml(
              bdaysShort,
              ({ c, d }) =>
                `<li><button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button> · あと${d === 0 ? "今日" : d + "日"}</li>`
            )}
          </ul>
          <div class="action-card__more"><button type="button" class="btn-link" data-action="goto-customers">顧客へ</button></div>
        </div>
        <div class="action-card">
          <h3 class="action-card__title">ボトル期限が近い方</h3>
          <ul class="action-card__list">
            ${actionListHtml(
              bottlesShort,
              ({ c, b, until }) =>
                `<li><button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button> · ${esc(b.name)} · あと${until < 0 ? "要確認" : until + "日"}</li>`
            )}
          </ul>
          <div class="action-card__more"><button type="button" class="btn-link" data-action="goto-tab" data-tab="bottles">ボトルへ</button></div>
        </div>
        <div class="action-card">
          <h3 class="action-card__title">今日来そうな方</h3>
          <ul class="action-card__list">
            ${actionListHtml(
              likelyShort,
              (c) => {
                const ps = customerPartyStats(c);
                const hint = ps ? ` · 平均${ps.avg}名・多いとき${ps.max}名` : "";
                return `<li><button type="button" class="btn-link" data-action="cust-open" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button><span class="action-card__hint">${esc(hint)}</span></li>`;
              }
            )}
          </ul>
          <div class="action-card__more"><button type="button" class="btn-link" data-action="goto-customers">顧客へ</button></div>
        </div>
      </div>

      <section class="panel">
        <h2 class="panel__title">最近来ていない方</h2>
        <p class="panel__help panel__help--compact">LINE文面は行のボタンから。</p>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>名前</th><th>最終来店</th><th>経過日数</th><th>好きなお酒</th><th>LINE</th></tr></thead>
            <tbody>${inactiveRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">最近の来店</h2>
        <p class="panel__help panel__help--compact">新しい順・全員分。</p>
        ${timelineHtml}
      </section>

      <section class="panel">
        <h2 class="panel__title">今夜のメモ</h2>
        <textarea id="todayMemo" class="textarea" data-field="todayMemo" rows="3" placeholder="カウンター・予定・共有メモ…">${esc(data.settings.todayMemo || "")}</textarea>
        <div class="btn-row" style="margin-bottom:0">
          <button type="button" class="btn btn--primary btn--small" data-action="save-today-memo">保存</button>
        </div>
      </section>

      <div class="btn-row">
        <button type="button" class="btn btn--surface btn--small" data-action="goto-customers">顧客一覧を開く</button>
      </div>
    `;
  }

  function filterCustomers() {
    let list = data.customers.slice();
    switch (ui.listChip) {
      case "regular":
        list = list.filter((c) => c.status === "常連" || c.status === "VIP");
        break;
      case "first":
        list = list.filter((c) => c.status === "初回来店");
        break;
      case "follow":
        list = list.filter((c) => needsFollowUp(c));
        break;
      case "bottle":
        list = list.filter((c) => (c.bottles || []).length > 0);
        break;
      case "bday": {
        list = list.filter((c) => {
          const d = daysUntilNextBirthday(c.birthday);
          return d != null && d >= 0 && d <= 30;
        });
        break;
      }
      default:
        break;
    }
    const q = ui.search.trim().toLowerCase();
    const tag = ui.tagFilter;
    return list.filter((c) => {
      if (tag && !(c.tags || []).includes(tag)) return false;
      if (!q) return true;
      const hay = [
        c.name,
        c.nickname,
        c.favoriteDrink,
        c.conversationMemo,
        (c.tags || []).join(" "),
      ]
        .join("\n")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function allTagsInUse() {
    const set = new Set(PRESET_TAGS);
    for (const c of data.customers) for (const t of c.tags || []) set.add(t);
    for (const t of data.settings.customTags || []) set.add(t);
    return Array.from(set);
  }

  function renderChipBar() {
    const chips = [
      { id: "all", label: "全員" },
      { id: "regular", label: "常連" },
      { id: "first", label: "初回" },
      { id: "follow", label: "要フォロー" },
      { id: "bottle", label: "ボトルあり" },
      { id: "bday", label: "誕生日近い" },
    ];
    return `<div class="chip-toolbar" role="toolbar" aria-label="絞り込み">
      ${chips
        .map(
          (ch) => `
        <button type="button" class="chip" data-action="list-chip" data-chip="${escAttr(ch.id)}" aria-pressed="${ui.listChip === ch.id ? "true" : "false"}">${esc(ch.label)}</button>`
        )
        .join("")}
    </div>`;
  }

  function renderCustomerList() {
    const list = filterCustomers();
    const tags = allTagsInUse();

    const tagOptions =
      `<option value="">タグ</option>` +
      tags.map((t) => `<option value="${escAttr(t)}" ${ui.tagFilter === t ? "selected" : ""}>${esc(t)}</option>`).join("");

    const memoShort = (c) => {
      const m = (c.conversationMemo || "").trim();
      if (!m) return "";
      const line = m.split("\n")[0];
      return line.length > 72 ? line.slice(0, 72) + "…" : line;
    };

    const cards = list.length
      ? `<div class="card-grid">` +
        list
          .map((c) => {
            const tagsHtml = (c.tags || [])
              .slice(0, 4)
              .map((t) => `<span class="tag">${esc(t)}</span>`)
              .join("");
            const bottleTxt = (c.bottles || []).length ? "ボトルあり" : "ボトルなし";
            const memo = memoShort(c);
            const avatarInner = c.photoDataUrl
              ? `<img class="card__avatar" src="${escAttr(c.photoDataUrl)}" alt="" loading="lazy" />`
              : `<span class="card__avatar--placeholder" aria-hidden="true">${esc(customerNameInitial(c.name))}</span>`;
            return `
            <article class="card card--click card--with-avatar" data-action="cust-open" data-id="${escAttr(c.id)}">
              <div class="card__avatar-wrap">${avatarInner}</div>
              <div class="card__body">
              <span class="status-badge">${esc(c.status || "—")}</span>
              <h2 class="card__title">${esc(displaySurname(c.name))}${c.nickname ? ` <span class="card__nick">${esc(c.nickname)}</span>` : ""}</h2>
              <p class="card__meta">最終 ${esc(c.lastVisit || "—")} · ${c.visitCount || 0}回 · ${esc(c.favoriteDrink || "—")}</p>
              <p class="card__meta">${esc(c.vibeType || "—")} · ${bottleTxt}</p>
              ${memo ? `<p class="card__line">${esc(memo)}</p>` : ""}
              ${tagsHtml ? `<div class="tag-row">${tagsHtml}</div>` : ""}
              </div>
            </article>`;
          })
          .join("") +
        `</div>`
      : `<div class="empty">該当するお客様がいません</div>`;

    return `
      <p class="lead">タップで詳細</p>
      <div class="toolbar">
        <input type="search" class="input" placeholder="名前・お酒・メモで検索" data-field="search" value="${escAttr(ui.search)}" />
        <select class="select" data-field="tagFilter" style="max-width:9rem" aria-label="タグで絞る">${tagOptions}</select>
      </div>
      ${renderChipBar()}
      ${cards}
    `;
  }

  /** 顧客詳細内の来店フォーム（新規 or visitEditId に一致する行の更新） */
  function buildVisitSaveFormHtml(c) {
    const ev = ui.visitEditId ? (c.visitHistory || []).find((x) => x.id === ui.visitEditId) || null : null;
    const dateVal = ev && /^\d{4}-\d{2}-\d{2}$/.test(String(ev.date || "")) ? ev.date : todayISO();
    const partySize = Math.max(1, Math.round(Number(ev?.partySize)) || 1);
    const amtStr =
      ev && ev.amount != null && Number.isFinite(Number(ev.amount)) && Number(ev.amount) >= 0
        ? String(Math.round(Number(ev.amount)))
        : "";
    const drinks = String(ev?.drinks ?? "");
    const memo = String(ev?.memo ?? "");
    const nextTopic = String(ev?.nextTopic ?? "");
    const moods = (ev && ev.moodTags) || [];
    const moodBoxes = MOOD_TAGS.map(
      (m) =>
        `<label class="chk"><input type="checkbox" name="mood" value="${escAttr(m)}"${moods.includes(m) ? " checked" : ""} /> ${esc(m)}</label>`
    ).join("");
    const visitIdH = ev ? escAttr(ev.id) : "";
    const heading = ev ? "来店記録を更新" : "新しい来店を記録";
    const helpTxt = ev
      ? `日付「${esc(dateVal)}」の来店行を上書きします。保存するとこの一覧・売上集計に反映されます。`
      : "来店日・会計・メモを残すと、来店回数・最終来店日が自動で更新されます。";
    const btnLabel = ev ? "この内容で更新" : "来店を保存";

    return `
          <p class="visit-form-title">${esc(heading)}</p>
          <p class="panel__help" style="margin-top:0;margin-bottom:0.55rem;font-size:0.76rem;line-height:1.45">${helpTxt}</p>
          <form data-form="visit-save">
            <input type="hidden" name="visitId" value="${visitIdH}" />
            <div class="field">
              <label>来店日 <span class="req-star">*</span></label>
              <input class="input" name="date" type="date" required value="${escAttr(dateVal)}" />
            </div>
            <div class="field">
              <label>人数</label>
              <input class="input" name="partySize" type="number" min="1" value="${escAttr(String(partySize))}" />
            </div>
            <div class="field">
              <label>会計（円・任意）</label>
              <input class="input" name="amount" type="number" min="0" step="1" placeholder="例：12000" value="${escAttr(amtStr)}" />
            </div>
            <div class="field">
              <label>飲んだもの</label>
              <input class="input" name="drinks" placeholder="例：ハイボール" value="${escAttr(drinks)}" />
            </div>
            <div class="field">
              <label>その日のメモ</label>
              <textarea class="textarea" name="memo" rows="2">${esc(memo)}</textarea>
            </div>
            <div class="field">
              <label>次に話したいこと</label>
              <input class="input" name="nextTopic" placeholder="例：旅行の続きを聞く" value="${escAttr(nextTopic)}" />
            </div>
            <div class="field">
              <span class="label">気分（複数可）</span>
              <div class="chk-grid">${moodBoxes}</div>
            </div>
            <div class="btn-row" style="margin-top:0">
              <button type="submit" class="btn btn--primary btn--small">${esc(btnLabel)}</button>
              ${ev ? `<button type="button" class="btn btn--surface btn--small" data-action="visit-edit-cancel">編集をやめる</button>` : ""}
            </div>
          </form>`;
  }

  function renderCustomerDetail() {
    const c = customerById(ui.custId);
    if (!c) {
      ui.custView = "list";
      ui.custId = null;
      return renderCustomerList();
    }

    const tagsHtml = (c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");

    const visits = [...(c.visitHistory || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const visitTimeline =
      visits.length > 0
        ? `<ul class="timeline">${visits
            .map(
              (v) => `<li class="timeline__item">
          <p class="timeline__date">${esc(v.date || "")} · ${esc(String(v.partySize || ""))}名${v.amount != null && Number.isFinite(Number(v.amount)) ? " · " + esc(formatYen(v.amount)) : ""}</p>
          ${(v.moodTags || []).length ? `<p class="timeline__body">${(v.moodTags || []).map((m) => `<span class="tag tag--muted">${esc(m)}</span>`).join(" ")}</p>` : ""}
          ${v.drinks ? `<p class="timeline__body">${esc(v.drinks)}</p>` : ""}
          ${v.memo ? `<p class="timeline__body">${esc(v.memo)}</p>` : ""}
          ${v.nextTopic ? `<p class="timeline__body">次の話題：${esc(v.nextTopic)}</p>` : ""}
          <div class="timeline__actions">
            <button type="button" class="btn btn--surface btn--small" data-action="visit-edit" data-vid="${escAttr(v.id)}">編集</button>
            <button type="button" class="btn btn--danger btn--small" data-action="visit-del" data-vid="${escAttr(v.id)}">削除</button>
          </div>
        </li>`
            )
            .join("")}</ul>`
        : `<p class="panel__help" style="margin:0">まだ来店の記録がありません</p>`;

    const bottleRows =
      (c.bottles || []).length > 0
        ? c.bottles
            .map(
              (b) => {
                const u = daysUntilDeadline(b.keepDeadline);
                const uTxt =
                  u == null ? "—" : u < 0 ? "期限超過" : `あと${u}日`;
                return `<tr>
            <td data-label="お酒">${esc(b.name || "—")}</td>
            <td data-label="種類">${esc(b.kind || "—")}</td>
            <td data-label="残量">${esc(b.remaining || "—")}</td>
            <td data-label="期限">${esc(b.keepDeadline || "—")}</td>
            <td data-label="あと">${uTxt}</td>
            <td data-label=""><button type="button" class="btn btn--danger btn--small" data-action="bottle-del" data-bid="${escAttr(b.id)}">削除</button></td>
          </tr>`;
              }
            )
            .join("")
        : `<tr><td colspan="6" style="padding:0.65rem;text-align:center">登録されたボトルはありません</td></tr>`;

    const vibeLine = c.vibeType
      ? `「${esc(c.vibeType)}」のタイプの方です。`
      : "";
    const tagLine =
      (c.tags || []).length > 0
        ? (c.tags || []).map((t) => `「${esc(t)}」`).join(" ") + "のタグがあります。"
        : "";

    return `
      <button type="button" class="btn btn--ghost btn--small" style="margin-bottom:0.5rem" data-action="cust-back">← 一覧へ</button>

      <section class="panel">
        <h2 class="panel__title">プロフィール</h2>
        <div class="detail-hero">
          <div class="detail-avatar">
            ${
              c.photoDataUrl
                ? `<img src="${escAttr(c.photoDataUrl)}" alt="" />`
                : `<span class="detail-avatar__ph" aria-hidden="true">${esc(customerNameInitial(c.name))}</span>`
            }
          </div>
          <div class="detail-hero__text">
            <span class="status-badge">${esc(c.status || "—")}</span>
            <h2 class="detail-name" style="margin-top:0.35rem">${esc(displaySurname(c.name))}</h2>
          </div>
        </div>
        <dl class="dl-simple">
          <dt>呼び名</dt><dd>${esc(c.nickname || "—")}</dd>
          <dt>電話</dt><dd>${esc(c.phone || "—")}</dd>
          <dt>LINE</dt><dd>${esc(c.lineName || "—")}</dd>
          <dt>Instagram</dt><dd>${esc(c.instagram || "—")}</dd>
          <dt>誕生日</dt><dd>${esc(c.birthday || "—")}</dd>
          <dt>お酒</dt><dd>好き：${esc(c.favoriteDrink || "—")}／苦手：${esc(c.dislikeDrink || "—")}</dd>
          <dt>紹介</dt><dd>${esc(c.referrer || "—")}</dd>
          <dt>NG話題</dt><dd>${esc(c.ngTopics || "—")}</dd>
        </dl>
      </section>

      <section class="panel" style="padding:0;border:none;background:transparent;box-shadow:none">
        <h2 class="panel__title panel__title--on-dark">接客メモ</h2>
        <div class="service-note">
          ${vibeLine ? `<p class="service-note__line">${vibeLine}</p>` : ""}
          ${tagLine ? `<p class="service-note__line">${tagLine}</p>` : ""}
          <p class="service-note__memo">${esc(c.conversationMemo || "（会話メモはまだありません。下の「かんたん記入」や情報編集から足せます）")}</p>
          ${tagsHtml ? `<div class="tag-row">${tagsHtml}</div>` : ""}
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">LINE文面</h2>
        <p class="panel__help">やさしいトーンの文を選んでコピーできます。</p>
        <button type="button" class="btn btn--primary btn--small" data-action="line-open" data-id="${escAttr(c.id)}">文面を作る</button>
      </section>

      <section class="panel cust-quick-panel">
        <h2 class="panel__title">かんたん記入</h2>
        <p class="panel__help" style="margin-top:0.2rem;margin-bottom:0.65rem">会話の追記・来店の記録・ボトル登録。来店は履歴の<strong>編集</strong>から、その日の内容を更新できます（保存で全体に反映）。</p>
        <div class="cust-action-grid">
          <div class="cust-action-card">
            <div class="cust-action-card__head">
              <span class="cust-action-card__icon cust-action-card__icon--memo" aria-hidden="true">📝</span>
              <div>
                <h3 class="cust-action-card__title">すぐメモ</h3>
                <p class="cust-action-card__desc">会話メモに追記（接客メモ欄へ）</p>
              </div>
            </div>
            <form data-form="memo-append">
              <div class="field" style="margin-bottom:0.4rem">
                <label class="label" for="memoQuickLine">追記内容</label>
                <input id="memoQuickLine" class="input" name="line" placeholder="例：前回、仕事が忙しいと言っていた" autocomplete="off" />
              </div>
              <button type="submit" class="btn btn--primary btn--small" style="width:100%">追記する</button>
            </form>
          </div>

          <div class="cust-action-card">
            <div class="cust-action-card__head">
              <span class="cust-action-card__icon cust-action-card__icon--visit" aria-hidden="true">📅</span>
              <div>
                <h3 class="cust-action-card__title">来店を記録</h3>
                <p class="cust-action-card__desc">新規追加／下の履歴から「編集」で更新</p>
              </div>
            </div>
            ${buildVisitSaveFormHtml(c)}
          </div>

          <div class="cust-action-card">
            <div class="cust-action-card__head">
              <span class="cust-action-card__icon cust-action-card__icon--bottle" aria-hidden="true">🍾</span>
              <div>
                <h3 class="cust-action-card__title">ボトルを登録</h3>
                <p class="cust-action-card__desc">キープ酒を追加（一覧は下に表示）</p>
              </div>
            </div>
            <form data-form="bottle-add">
              <div class="field">
                <label>お酒の名前</label>
                <input class="input" name="name" required placeholder="例：黒霧島" />
              </div>
              <div class="field">
                <label>種類</label>
                <input class="input" name="kind" placeholder="芋焼酎 など" />
              </div>
              <div class="field">
                <label>残量</label>
                <select class="select" name="remaining">
                  ${BOTTLE_REMAINING.map((r) => `<option>${esc(r)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label>キープ開始</label>
                <input class="input" name="keepStart" type="date" />
              </div>
              <div class="field">
                <label>キープ期限</label>
                <input class="input" name="keepDeadline" type="date" />
              </div>
              <div class="field">
                <label>メモ</label>
                <textarea class="textarea" name="memo" rows="2" placeholder="席番・担当メモなど"></textarea>
              </div>
              <button type="submit" class="btn btn--primary btn--small" style="width:100%">ボトルを登録</button>
            </form>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">来店履歴</h2>
        ${visitTimeline}
      </section>

      <section class="panel">
        <h2 class="panel__title">ボトル一覧</h2>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>お酒</th><th>種類</th><th>残量</th><th>期限</th><th>残日</th><th></th></tr></thead>
            <tbody>${bottleRows}</tbody>
          </table>
        </div>
      </section>

      <div class="btn-row">
        <button type="button" class="btn btn--ghost btn--small" data-action="cust-edit" data-id="${escAttr(c.id)}">情報を編集</button>
        <button type="button" class="btn btn--danger btn--small" data-action="cust-delete" data-id="${escAttr(c.id)}">このお客様を削除</button>
      </div>
    `;
  }

  function renderCustomerForm(isNew) {
    const c = isNew ? null : customerById(ui.custId);
    if (!isNew && !c) {
      ui.custView = "list";
      ui.custId = null;
      return renderCustomerList();
    }
    const e = isNew ? defaultCustomer() : c;

    const wdChecks = WEEKDAY_LABELS.map(
      (label, i) => `
      <label class="chk"><input type="checkbox" name="usualWeekdays" value="${i}" ${(e.usualWeekdays || []).map(Number).includes(i) ? "checked" : ""} /> ${label}</label>`
    ).join("");

    return `
      <form class="panel" style="padding:1rem" data-form="cust-save" data-new="${isNew ? "1" : ""}">
        <div class="field cust-photo-field">
          <label>プロフィール写真</label>
          <input type="hidden" name="photoDataUrl" value="${escAttr(e.photoDataUrl || "")}" />
          <div class="cust-photo-editor">
            <div class="cust-photo-preview" data-cust-photo-preview>${
              e.photoDataUrl
                ? `<img class="cust-photo-preview__img" src="${escAttr(e.photoDataUrl)}" alt="" />`
                : `<span class="cust-photo-preview__ph">${esc(customerNameInitial(e.name))}</span>`
            }</div>
            <div class="cust-photo-editor__actions">
              <label class="btn btn--surface btn--small" style="margin:0;cursor:pointer">
                画像を選ぶ
                <input type="file" accept="image/*" class="visually-hidden" data-field="cust-photo" />
              </label>
              <button type="button" class="btn btn--ghost btn--small" data-action="cust-photo-clear">写真を消す</button>
            </div>
          </div>
          <p class="hint" style="margin:0.35rem 0 0">一覧・詳細に表示されます（端末内のみ・大きい画像は自動で縮小）。</p>
        </div>
        <div class="field"><label>名前</label><input class="input" name="name" required value="${escAttr(e.name)}" /></div>
        <div class="field"><label>ニックネーム</label><input class="input" name="nickname" value="${escAttr(e.nickname)}" /></div>
        <div class="field"><label>性別</label><select class="select" name="gender"><option value="" ${!e.gender ? "selected" : ""}>未選択</option>${["男性", "女性", "その他", "未回答"].map((g) => `<option value="${escAttr(g)}" ${e.gender === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
        <div class="field"><label>年代</label><select class="select" name="ageBand">${AGE_BANDS.map((a) => `<option value="${escAttr(a)}" ${e.ageBand === a ? "selected" : ""}>${esc(a || "未選択")}</option>`).join("")}</select></div>
        <div class="field"><label>電話番号</label><input class="input" name="phone" value="${escAttr(e.phone)}" /></div>
        <div class="field"><label>LINE名</label><input class="input" name="lineName" value="${escAttr(e.lineName)}" /></div>
        <div class="field"><label>Instagram</label><input class="input" name="instagram" value="${escAttr(e.instagram)}" /></div>
        <div class="field"><label>誕生日</label><input class="input" name="birthday" type="date" value="${escAttr(e.birthday)}" /></div>
        <div class="field"><label>初回来店日</label><input class="input" name="firstVisit" type="date" value="${escAttr(e.firstVisit)}" /></div>
        <div class="field"><label>最終来店日</label><input class="input" name="lastVisit" type="date" value="${escAttr(e.lastVisit)}" /></div>
        <div class="field"><label>来店回数</label><input class="input" name="visitCount" type="number" min="0" value="${escAttr(String(e.visitCount ?? 0))}" /></div>
        <div class="field"><label>好きなお酒</label><input class="input" name="favoriteDrink" value="${escAttr(e.favoriteDrink)}" /></div>
        <div class="field"><label>苦手なお酒</label><input class="input" name="dislikeDrink" value="${escAttr(e.dislikeDrink)}" /></div>
        <div class="field"><span class="label">よく来る曜日</span><div class="chk-grid">${wdChecks}</div></div>
        <div class="field"><label>よく来る時間帯</label><input class="input" name="usualTimeSlot" value="${escAttr(e.usualTimeSlot)}" placeholder="例：21時〜" /></div>
        <div class="field"><label>空気タイプ</label><select class="select" name="vibeType">${VIBE_TYPES.map((v) => `<option value="${escAttr(v)}" ${e.vibeType === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="field"><label>会話メモ</label><textarea class="textarea" name="conversationMemo" rows="3">${esc(e.conversationMemo || "")}</textarea></div>
        <div class="field"><label>NG話題</label><input class="input" name="ngTopics" value="${escAttr(e.ngTopics)}" /></div>
        <div class="field"><label>紹介者</label><input class="input" name="referrer" value="${escAttr(e.referrer)}" /></div>
        <div class="field"><label>ステータス</label><select class="select" name="status">${STATUS_OPTIONS.map((s) => `<option value="${escAttr(s)}" ${e.status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>

        <h3 class="subsection-title">タグ</h3>
        <div class="field">
          <div class="tag-row" id="tag-chips-edit">
            ${(e.tags || [])
              .map(
                (t) => `<span class="tag" data-tag="${escAttr(t)}">${esc(t)} <button type="button" data-action="tag-remove" data-tag="${escAttr(t)}" style="border:none;background:transparent;cursor:pointer;padding:0 0 0 0.2rem">×</button></span>`
              )
              .join("")}
          </div>
          <input type="hidden" name="tagsJoined" value="${escAttr((e.tags || []).join("|||"))}" data-tags-field />
          <div class="toolbar" style="margin-top:0.5rem">
            <input class="input" id="tagInput" placeholder="タグを追加" />
            <button type="button" class="btn btn--surface btn--small" data-action="tag-add-field">追加</button>
          </div>
          <p class="hint" style="margin:0">候補</p>
          <div class="tag-row">
            ${PRESET_TAGS.map(
              (t) =>
                `<button type="button" class="tag tag--muted" data-action="tag-add-preset" data-tag="${escAttr(t)}">${esc(t)}</button>`
            ).join("")}
          </div>
        </div>

        <div class="btn-row">
          <button type="submit" class="btn btn--primary">保存</button>
          <button type="button" class="btn btn--surface" data-action="cust-cancel">キャンセル</button>
        </div>
      </form>
    `;
  }

  function renderBottlesTab() {
    const rows = [];
    for (const c of data.customers) {
      for (const b of c.bottles || []) {
        const until = daysUntilDeadline(b.keepDeadline);
        rows.push({ c, b, until });
      }
    }
    rows.sort((a, b) => {
      const au = a.until != null ? a.until : 9999;
      const bu = b.until != null ? b.until : 9999;
      return au - bu;
    });

    const openCust = getAppMode() === "owner" ? "open-cust-staff" : "cust-open";

    const tbody = rows.length
      ? rows
          .map(({ c, b, until }) => {
            const u =
              until == null
                ? "—"
                : until < 0
                  ? "期限超過"
                  : `あと${until}日`;
            return `<tr data-action="${openCust}" data-id="${escAttr(c.id)}" style="cursor:pointer">
            <td data-label="お客様"><button type="button" class="btn-link" data-action="${openCust}" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button></td>
            <td data-label="ボトル">${esc(b.name || "—")}</td>
            <td data-label="種類">${esc(b.kind || "—")}</td>
            <td data-label="残量">${esc(b.remaining || "—")}</td>
            <td data-label="期限">${esc(b.keepDeadline || "—")}</td>
            <td data-label="残日数">${esc(u)}</td>
          </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" style="padding:0.75rem;text-align:center">登録されたボトルがありません</td></tr>`;

    return `
      <p class="lead">期限が近い順です。行をタップするとお客様の画面へ移ります。</p>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>お客様</th><th>ボトル</th><th>種類</th><th>残量</th><th>期限</th><th>残日数</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    `;
  }

  function renderLineTab() {
    const list = data.customers;
    const q = ui.lineSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) =>
          [c.name, c.nickname, c.lineName].join(" ").toLowerCase().includes(q)
        )
      : list;

    const cards = filtered
      .map(
        (c) => `
      <article class="card card--click" data-action="line-pick" data-id="${escAttr(c.id)}">
        <h2 class="card__title">${esc(displaySurname(c.name))}</h2>
        <p class="card__meta">${esc(c.nickname || "")}</p>
      </article>`
      )
      .join("");

    const body =
      list.length === 0
        ? `<div class="empty">お客様がいません</div>`
        : filtered.length === 0
          ? `<div class="empty">該当するお客様がいません</div>`
          : cards;

    return `
      <p class="lead">お客様を選ぶと、送る文のパターンを選べます。</p>
      <div class="toolbar">
        <input type="search" class="input" placeholder="名前で検索" data-field="line-search" value="${escAttr(ui.lineSearch)}" />
      </div>
      ${body}
    `;
  }

  function renderSettings() {
    const salesTargets = `
      <section class="panel panel--owner-settings">
        <h2 class="panel__title">売上目標（月次・日次）</h2>
        <p class="panel__help panel__help--compact">現場の「今夜」でも同じ目標を表示します。経営の「売上」ゲージ・不足額にも使います。実績の締めは経営モードの「売上分析」<strong>台帳</strong>から入力できます。会計ソフト（例: <a href="https://secure.freee.co.jp/" target="_blank" rel="noopener noreferrer">freee</a>）の数字を手で合わせても構いません。</p>
        <div class="field"><label for="setMonthTarget">今月の売上目標（円）</label><input type="number" min="0" step="1" class="input" id="setMonthTarget" value="${escAttr(String(data.settings.monthlySalesTargetYen ?? 0))}" /></div>
        <div class="field"><label for="setDayTarget">1日あたりの売上目標（円）</label><input type="number" min="0" step="1" class="input" id="setDayTarget" value="${escAttr(String(data.settings.dailySalesTargetYen ?? 0))}" /></div>
        <div class="btn-row" style="margin-top:0">
          <button type="button" class="btn btn--primary btn--small" data-action="save-sales-targets">目標を保存</button>
        </div>
      </section>`;
    return `
      ${salesTargets}
      <section class="panel">
        <h2 class="panel__title">データの保存場所</h2>
        <p class="panel__help panel__help--compact">経営の数値・グラフはこの端末に入力されたデータのみです。</p>
      </section>
      <section class="panel">
        <h2 class="panel__title">データをやり直す</h2>
        <div class="btn-row" style="margin-top:0">
          <button type="button" class="btn btn--surface btn--small" data-action="seed-reset">サンプル5人を入れ直す</button>
          <button type="button" class="btn btn--danger btn--small" data-action="clear-all">すべて消す</button>
        </div>
        <p class="panel__help" style="margin-bottom:0;margin-top:0.5rem">消すと確認のあと、中身が空になります（その後サンプルが出ます）。</p>
      </section>
      <p class="hint" style="text-align:center;margin-top:1rem">Snack CRM</p>
    `;
  }

  function renderMain() {
    if (ui.tab === "overview") return renderOwnerOverview();
    if (ui.tab === "analytics") return renderOwnerAnalytics();
    if (ui.tab === "home") return renderHome();
    if (ui.tab === "bottles") return renderBottlesTab();
    if (ui.tab === "line") return renderLineTab();
    if (ui.tab === "settings") return renderSettings();
    if (ui.tab === "customers") {
      if (ui.custView === "detail") return renderCustomerDetail();
      if (ui.custView === "edit") return renderCustomerForm(false);
      if (ui.custView === "new") return renderCustomerForm(true);
      return renderCustomerList();
    }
    return "";
  }

  function renderApp() {
    const app = document.getElementById("app");
    if (!app) return;
    ensureValidTab();
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.appMode = getAppMode();
    }
    destroyAllCharts();
    app.innerHTML = `
      ${renderHeader()}
      <main id="main" class="app-main">${renderMain()}</main>
      ${renderTabBar()}
    `;
    requestAnimationFrame(() => {
      initChartsForCurrentTab();
    });
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }

  function openLineModal(customerId) {
    const c = customerById(customerId);
    if (!c) return;
    const root = document.getElementById("modal-root");
    if (!root) return;
    const patternsHtml = LINE_PATTERNS.map(
      (p, i) => `
      <label class="pattern-item">
        <input type="radio" name="linePattern" value="${escAttr(p.id)}" ${i === 0 ? "checked" : ""} />
        <span>${esc(p.label)}</span>
      </label>`
    ).join("");

    const initial = generateLineText(LINE_PATTERNS[0].id, c);

    root.innerHTML = `
      <div class="modal-backdrop" data-action="modal-close"></div>
      <div class="modal-panel modal-panel--sheet" role="dialog" aria-modal="true" aria-labelledby="lineModalTitle">
        <h2 id="lineModalTitle" class="modal-title">送る文を選ぶ</h2>
        <p class="hint" style="margin:-0.35rem 0 0.65rem">${esc(displaySurname(c.name))}</p>
        <input type="hidden" data-line-cust value="${escAttr(customerId)}" />
        <div class="pattern-list">${patternsHtml}</div>
        <p class="label">プレビュー</p>
        <div class="line-preview" data-line-preview>${esc(initial)}</div>
        <div class="btn-row">
          <button type="button" class="btn btn--primary" data-action="line-copy">コピーする</button>
          <button type="button" class="btn btn--surface" data-action="modal-close">閉じる</button>
        </div>
      </div>`;

    root.querySelectorAll('input[name="linePattern"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const id = root.querySelector('input[name="linePattern"]:checked')?.value;
        const custId = root.querySelector("[data-line-cust]")?.value;
        const cust = customerById(custId);
        const prev = root.querySelector("[data-line-preview]");
        if (cust && prev && id) prev.textContent = generateLineText(id, cust);
      });
    });
  }

  function openTonightCustomerModal() {
    const root = document.getElementById("modal-root");
    if (!root) return;
    ensureTonightPlanArray();
    const inPlan = new Set(data.tonightPlan.map((e) => e.customerId).filter(Boolean));
    const rows = data.customers
      .map((c) => ({ c, label: displaySurname(c.name) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ja"));
    function renderList(q) {
      const qq = String(q || "")
        .trim()
        .toLowerCase();
      const filtered = rows.filter(({ c, label }) => {
        if (inPlan.has(c.id)) return false;
        if (!qq) return true;
        return (
          label.toLowerCase().includes(qq) ||
          String(c.phone || "")
            .toLowerCase()
            .includes(qq)
        );
      });
      return filtered
        .slice(0, 50)
        .map(
          ({ c }) =>
            `<button type="button" class="btn btn--surface btn--small tonight-cust-pick" style="width:100%;text-align:left;margin-bottom:0.3rem" data-action="tonight-pick-customer" data-id="${escAttr(c.id)}">${esc(displaySurname(c.name))}</button>`
        )
        .join("");
    }
    const initialList = renderList("");
    root.innerHTML = `
      <div class="modal-backdrop" data-action="modal-close"></div>
      <div class="modal-panel modal-panel--sheet" role="dialog" aria-modal="true" aria-labelledby="tonightCustModalTitle">
        <h2 id="tonightCustModalTitle" class="modal-title">今夜の予定に追加</h2>
        <p class="hint" style="margin:-0.25rem 0 0.6rem">顧客を選ぶとリストに入ります（重複は追加できません）。</p>
        <input type="search" class="input" id="tonightCustSearch" placeholder="名前・電話で絞り込み" autocomplete="off" />
        <div id="tonightCustList" class="tonight-cust-list">${initialList || "<p class='hint'>該当なし／すべて登録済み</p>"}</div>
        <div class="btn-row">
          <button type="button" class="btn btn--surface" data-action="modal-close">閉じる</button>
        </div>
      </div>`;
    const inp = root.querySelector("#tonightCustSearch");
    const listEl = root.querySelector("#tonightCustList");
    if (inp && listEl) {
      inp.addEventListener("input", () => {
        const html = renderList(inp.value);
        listEl.innerHTML = html || "<p class='hint'>該当なし／すべて登録済み</p>";
      });
    }
  }

  function openTonightGuestModal() {
    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = `
      <div class="modal-backdrop" data-action="modal-close"></div>
      <div class="modal-panel modal-panel--sheet" role="dialog" aria-modal="true" aria-labelledby="tonightGuestModalTitle">
        <h2 id="tonightGuestModalTitle" class="modal-title">仮予定を追加</h2>
        <p class="hint" style="margin:-0.25rem 0 0.6rem">まだ顧客登録がない方・紹介のお名前など。</p>
        <form data-form="tonight-guest-add">
          <div class="field">
            <label for="tonightGuestName">表示名</label>
            <input id="tonightGuestName" class="input" name="guestLabel" required maxlength="40" placeholder="例：佐藤様（紹介）" />
          </div>
          <div class="btn-row">
            <button type="submit" class="btn btn--primary">追加</button>
            <button type="button" class="btn btn--surface" data-action="modal-close">キャンセル</button>
          </div>
        </form>
      </div>`;
  }

  function getTagsFromForm(form) {
    const hidden = form.querySelector("[data-tags-field]");
    if (!hidden || !hidden.value) return [];
    return hidden.value.split("|||").filter(Boolean);
  }

  function setTagsOnForm(form, tags) {
    const hidden = form.querySelector("[data-tags-field]");
    if (hidden) hidden.value = tags.join("|||");
  }

  function refreshTagChips(form) {
    const tags = getTagsFromForm(form);
    const chipRow = form.querySelector("#tag-chips-edit");
    if (!chipRow) return;
    chipRow.innerHTML = tags
      .map(
        (tag) =>
          `<span class="tag" data-tag="${escAttr(tag)}">${esc(tag)} <button type="button" data-action="tag-remove" data-tag="${escAttr(tag)}" style="border:none;background:transparent;cursor:pointer;padding:0 0 0 0.2rem" aria-label="タグを削除">×</button></span>`
      )
      .join("");
  }

  /* ---------- イベント ---------- */

  function onTab(id) {
    const wasAnalytics = ui.tab === "analytics";
    ui.tab = id;
    if (wasAnalytics && id !== "analytics") ui.salesEditId = null;
    if (id !== "customers") {
      ui.custView = "list";
      ui.custId = null;
      ui.listChip = "all";
      ui.visitEditId = null;
    }
    if (id !== "line") ui.lineSearch = "";
    if (id !== "line" && id !== "customers") ui.search = "";
    renderApp();
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    const id = t.getAttribute("data-id");

    if (action === "modal-close") {
      closeModal();
      return;
    }
    if (action === "goto-customers") {
      onTab("customers");
      return;
    }
    if (action === "list-chip") {
      const chip = t.getAttribute("data-chip");
      if (!chip) return;
      ui.listChip = chip;
      renderApp();
      return;
    }
    if (action === "goto-tab") {
      const tab = t.getAttribute("data-tab");
      if (tab && currentTabs().some((x) => x.id === tab)) onTab(tab);
      return;
    }
    if (action === "set-app-mode") {
      const mode = t.getAttribute("data-mode");
      if (mode !== "staff" && mode !== "owner") return;
      data.settings.appMode = mode;
      ui.tab = defaultTabForMode(mode);
      ui.custView = "list";
      ui.custId = null;
      ui.listChip = "all";
      ui.salesEditId = null;
      ui.visitEditId = null;
      save();
      renderApp();
      return;
    }
    if (action === "open-cust-staff" && id) {
      data.settings.appMode = "staff";
      ui.tab = "customers";
      ui.custView = "detail";
      ui.custId = id;
      ui.visitEditId = null;
      save();
      renderApp();
      return;
    }
    if (action === "save-sales-targets") {
      if (getAppMode() !== "owner" || ui.tab !== "settings") return;
      const mEl = document.getElementById("setMonthTarget");
      const dEl = document.getElementById("setDayTarget");
      const m = Number(mEl && mEl.value);
      const d = Number(dEl && dEl.value);
      data.settings.monthlySalesTargetYen = Number.isFinite(m) && m >= 0 ? Math.round(m) : 0;
      data.settings.dailySalesTargetYen = Number.isFinite(d) && d >= 0 ? Math.round(d) : 0;
      normalizeSettingsAfterLoad();
      save();
      toast("売上目標を保存しました");
      renderApp();
      return;
    }
    if (action === "copy-insights-json") {
      copyText(JSON.stringify(buildExportInsightsPayload(), null, 2));
      return;
    }
    if (action === "copy-ai-sales-md") {
      copyText(buildAISalesReportMarkdown());
      return;
    }
    if (action === "sales-cancel-edit") {
      ui.salesEditId = null;
      renderApp();
      return;
    }
    if (action === "sales-edit" && id) {
      ui.salesEditId = id;
      renderApp();
      return;
    }
    if (action === "sales-del" && id) {
      if (!confirm("この台帳行を削除しますか？")) return;
      ensureSalesLedger();
      data.salesLedger = data.salesLedger.filter((e) => e.id !== id);
      if (ui.salesEditId === id) ui.salesEditId = null;
      save();
      toast("削除しました");
      renderApp();
      return;
    }
    if (action === "tonight-modal-customer") {
      openTonightCustomerModal();
      return;
    }
    if (action === "tonight-modal-guest") {
      openTonightGuestModal();
      return;
    }
    if (action === "tonight-pick-customer" && id) {
      ensureTonightPlanArray();
      if (data.tonightPlan.some((e) => e.customerId === id)) {
        toast("すでに予定に入っています");
      } else {
        data.tonightPlan.push({ id: uid(), customerId: id });
        normalizeTonightPlanOnLoad();
        save();
        toast("今夜の予定に追加しました");
      }
      closeModal();
      renderApp();
      return;
    }
    if (action === "tonight-remove-plan" && id) {
      ensureTonightPlanArray();
      data.tonightPlan = data.tonightPlan.filter((e) => e.id !== id);
      save();
      toast("予定から外しました");
      renderApp();
      return;
    }
    if (action === "cust-new") {
      ui.custView = "new";
      ui.custId = null;
      ui.visitEditId = null;
      renderApp();
      return;
    }
    if (action === "cust-back" || action === "cust-cancel") {
      ui.custView = "list";
      ui.custId = null;
      ui.visitEditId = null;
      renderApp();
      return;
    }
    if (action === "cust-open" && id) {
      ui.tab = "customers";
      ui.custView = "detail";
      ui.custId = id;
      ui.visitEditId = null;
      renderApp();
      return;
    }
    if (action === "cust-edit" && id) {
      ui.custView = "edit";
      ui.custId = id;
      ui.visitEditId = null;
      renderApp();
      return;
    }
    if (action === "line-open" && id) {
      openLineModal(id);
      return;
    }
    if (action === "line-pick" && id) {
      openLineModal(id);
      return;
    }
    if (action === "save-today-memo") {
      const ta = document.getElementById("todayMemo");
      data.settings.todayMemo = ta ? ta.value : "";
      save();
      toast("保存しました");
      return;
    }
    if (action === "visit-del") {
      const vid = t.getAttribute("data-vid");
      const c = customerById(ui.custId);
      if (!c || !vid) return;
      c.visitHistory = (c.visitHistory || []).filter((v) => v.id !== vid);
      if (ui.visitEditId === vid) ui.visitEditId = null;
      syncVisitDerivedFields(c);
      save();
      renderApp();
      return;
    }
    if (action === "visit-edit") {
      const vid = t.getAttribute("data-vid");
      if (!vid) return;
      ui.visitEditId = vid;
      renderApp();
      return;
    }
    if (action === "visit-edit-cancel") {
      ui.visitEditId = null;
      renderApp();
      return;
    }
    if (action === "cust-photo-clear") {
      const form = t.closest("form[data-form='cust-save']");
      if (!form) return;
      const hid = form.querySelector('input[name="photoDataUrl"]');
      if (hid) hid.value = "";
      const prev = form.querySelector("[data-cust-photo-preview]");
      const nameInp = form.querySelector("input[name='name']");
      const ph = customerNameInitial(nameInp ? nameInp.value : "");
      if (prev) {
        prev.innerHTML = "";
        const sp = document.createElement("span");
        sp.className = "cust-photo-preview__ph";
        sp.textContent = ph;
        prev.appendChild(sp);
      }
      return;
    }
    if (action === "bottle-del") {
      const bid = t.getAttribute("data-bid");
      const c = customerById(ui.custId);
      if (!c || !bid) return;
      c.bottles = (c.bottles || []).filter((b) => b.id !== bid);
      save();
      renderApp();
      return;
    }
    if (action === "cust-delete" && id) {
      if (!confirm("このお客様を削除しますか？元に戻せません。")) return;
      data.customers = data.customers.filter((c) => c.id !== id);
      ui.custView = "list";
      ui.custId = null;
      save();
      renderApp();
      return;
    }
    if (action === "tag-remove") {
      ev.preventDefault();
      const tag = t.getAttribute("data-tag");
      const form = t.closest("form[data-form='cust-save']");
      if (!form || !tag) return;
      const tags = getTagsFromForm(form).filter((x) => x !== tag);
      setTagsOnForm(form, tags);
      refreshTagChips(form);
      return;
    }
    if (action === "tag-add-field") {
      const form = t.closest("form[data-form='cust-save']");
      const inp = document.getElementById("tagInput");
      if (!form || !inp || !inp.value.trim()) return;
      const tags = getTagsFromForm(form);
      tags.push(inp.value.trim());
      setTagsOnForm(form, tags);
      inp.value = "";
      refreshTagChips(form);
      return;
    }
    if (action === "tag-add-preset") {
      const tag = t.getAttribute("data-tag");
      const form = t.closest("form[data-form='cust-save']");
      if (!form || !tag) return;
      const tags = getTagsFromForm(form);
      if (!tags.includes(tag)) tags.push(tag);
      setTagsOnForm(form, tags);
      refreshTagChips(form);
      return;
    }
    if (action === "line-copy") {
      const root = document.getElementById("modal-root");
      const prev = root?.querySelector("[data-line-preview]");
      if (prev) copyText(prev.textContent);
      return;
    }
    if (action === "seed-reset") {
      if (!confirm("サンプル5名で上書きします。よろしいですか？")) return;
      data.customers = buildSeedCustomers();
      data.settings.todayMemo = data.settings.todayMemo || "";
      save();
      toast("サンプルを再投入しました");
      renderApp();
      return;
    }
    if (action === "clear-all") {
      if (!confirm("すべてのデータを消します。よろしいですか？")) return;
      localStorage.removeItem(STORAGE_KEY);
      data = { customers: [], salesLedger: [], tonightPlan: [], settings: { todayMemo: "", customTags: [], appMode: "staff", monthlySalesTargetYen: 0, dailySalesTargetYen: 0 } };
      seedIfEmpty();
      toast("消去しました（サンプルを再表示）");
      ui.tab = "home";
      renderApp();
      return;
    }
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.matches("[data-tab]")) return;
    if (el.matches("[data-field='search']")) {
      ui.search = el.value;
      if (ui.tab === "customers" && ui.custView === "list") renderApp();
      return;
    }
    if (el.matches("[data-field='tagFilter']")) {
      ui.tagFilter = el.value;
      if (ui.tab === "customers" && ui.custView === "list") renderApp();
      return;
    }
    if (el.matches("[data-field='line-search']")) {
      ui.lineSearch = el.value;
      if (ui.tab === "line") renderApp();
      return;
    }
    if (el.id === "analyticsMonthSelect") {
      const v = (el.value || "").trim();
      ui.analyticsSalesYM = /^\d{4}-\d{2}$/.test(v) ? v : todayISO().slice(0, 7);
      ui.salesEditId = null;
      if (ui.tab === "analytics" && getAppMode() === "owner") renderApp();
      return;
    }
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.matches("[data-field='search']")) {
      ui.search = el.value;
      if (ui.tab === "customers" && ui.custView === "list") renderApp();
    }
    if (el.matches("[data-field='line-search']")) {
      ui.lineSearch = el.value;
      if (ui.tab === "line") renderApp();
    }
  });

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-tab]");
    if (!btn) return;
    onTab(btn.getAttribute("data-tab"));
  });

  document.addEventListener("submit", (ev) => {
    const form = ev.target;
    if (form.matches("[data-form='memo-append']")) {
      ev.preventDefault();
      const c = customerById(ui.custId);
      if (!c) return;
      const fd = new FormData(form);
      const line = (fd.get("line") || "").trim();
      if (!line) {
        toast("メモを入力してください");
        return;
      }
      const stamp = todayISO();
      const prev = (c.conversationMemo || "").trim();
      c.conversationMemo = prev ? prev + "\n" + stamp + " — " + line : stamp + " — " + line;
      save();
      toast("メモに追記しました");
      renderApp();
      return;
    }
    if (form.matches("[data-form='tonight-guest-add']")) {
      ev.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("guestLabel") || "").trim();
      if (!name) {
        toast("名前を入力してください");
        return;
      }
      ensureTonightPlanArray();
      data.tonightPlan.push({ id: uid(), guestLabel: name });
      normalizeTonightPlanOnLoad();
      save();
      closeModal();
      toast("仮予定を追加しました");
      renderApp();
      return;
    }
    if (form.matches("[data-form='sales-ledger']")) {
      ev.preventDefault();
      if (getAppMode() !== "owner") return;
      const fd = new FormData(form);
      const entryId = String(fd.get("entryId") || "").trim();
      const date = String(fd.get("date") || "").slice(0, 10);
      const amount = Math.round(Number(fd.get("amount")));
      const segment = String(fd.get("segment") || "全体").trim() || "全体";
      const memo = String(fd.get("memo") || "").trim();
      const partyCount = Math.round(Number(fd.get("partyCount")));
      if (!Number.isFinite(partyCount) || partyCount < 1) {
        toast("組数は1以上の整数で入力してください");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        toast("日付を選んでください");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        toast("金額は1円以上を入力してください");
        return;
      }
      ensureSalesLedger();
      if (entryId) {
        const e = data.salesLedger.find((x) => x.id === entryId);
        if (!e) {
          toast("対象の行が見つかりません");
          return;
        }
        e.date = date;
        e.amountYen = amount;
        e.segment = segment;
        e.memo = memo;
        e.partyCount = partyCount;
      } else {
        data.salesLedger.push({ id: uid(), date, amountYen: amount, segment, memo, partyCount });
      }
      normalizeSalesLedgerOnLoad();
      save();
      ui.salesEditId = null;
      toast(entryId ? "台帳を更新しました" : "台帳に追加しました");
      renderApp();
      return;
    }
    if (form.matches("[data-form='visit-save']")) {
      ev.preventDefault();
      const c = customerById(ui.custId);
      if (!c) return;
      const fd = new FormData(form);
      const visitId = String(fd.get("visitId") || "").trim();
      const mood = fd.getAll("mood");
      const date = String(fd.get("date") || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        toast("来店日を選んでください");
        return;
      }
      const partySize = Math.max(1, Math.round(Number(fd.get("partySize"))) || 1);
      const amtRaw = fd.get("amount");
      const amountParsed =
        amtRaw === "" || amtRaw == null
          ? null
          : (() => {
              const n = parseInt(String(amtRaw), 10);
              return Number.isFinite(n) && n >= 0 ? n : null;
            })();
      const visitPayload = {
        date,
        partySize,
        amount: amountParsed,
        drinks: String(fd.get("drinks") || "").trim(),
        memo: String(fd.get("memo") || "").trim(),
        nextTopic: String(fd.get("nextTopic") || "").trim(),
        moodTags: mood,
      };
      c.visitHistory = c.visitHistory || [];
      if (visitId) {
        const idx = c.visitHistory.findIndex((x) => x.id === visitId);
        if (idx < 0) {
          toast("更新対象の来店が見つかりません");
          return;
        }
        c.visitHistory[idx] = { ...c.visitHistory[idx], ...visitPayload };
      } else {
        c.visitHistory.push({ id: uid(), ...visitPayload });
      }
      syncVisitDerivedFields(c);
      save();
      ui.visitEditId = null;
      toast(visitId ? "来店を更新しました" : "来店を記録しました");
      renderApp();
      return;
    }
    if (form.matches("[data-form='bottle-add']")) {
      ev.preventDefault();
      const c = customerById(ui.custId);
      if (!c) return;
      const fd = new FormData(form);
      const b = {
        id: uid(),
        name: fd.get("name"),
        kind: fd.get("kind") || "",
        remaining: fd.get("remaining") || "100%",
        keepStart: fd.get("keepStart") || "",
        keepDeadline: fd.get("keepDeadline") || "",
        memo: fd.get("memo") || "",
      };
      c.bottles = c.bottles || [];
      c.bottles.push(b);
      save();
      toast("ボトルを追加しました");
      renderApp();
      return;
    }
    if (form.matches("[data-form='cust-save']")) {
      ev.preventDefault();
      const isNew = form.getAttribute("data-new") === "1";
      const fd = new FormData(form);
      const weekdays = fd.getAll("usualWeekdays").map(Number);
      const tags = getTagsFromForm(form);

      const fields = {
        name: fd.get("name"),
        nickname: fd.get("nickname") || "",
        gender: fd.get("gender") || "",
        ageBand: fd.get("ageBand") || "",
        phone: fd.get("phone") || "",
        lineName: fd.get("lineName") || "",
        instagram: fd.get("instagram") || "",
        birthday: fd.get("birthday") || "",
        firstVisit: fd.get("firstVisit") || "",
        lastVisit: fd.get("lastVisit") || "",
        visitCount: Number(fd.get("visitCount") || 0),
        favoriteDrink: fd.get("favoriteDrink") || "",
        dislikeDrink: fd.get("dislikeDrink") || "",
        usualWeekdays: weekdays,
        usualTimeSlot: fd.get("usualTimeSlot") || "",
        vibeType: fd.get("vibeType") || "",
        conversationMemo: fd.get("conversationMemo") || "",
        ngTopics: fd.get("ngTopics") || "",
        referrer: fd.get("referrer") || "",
        status: fd.get("status") || "初回来店",
        tags,
        photoDataUrl: String(fd.get("photoDataUrl") || "").trim(),
      };

      if (isNew) {
        const nc = { ...defaultCustomer(), ...fields, visitHistory: [], bottles: [] };
        if (!nc.photoDataUrl) nc.photoDataUrl = "";
        data.customers.push(nc);
        ui.custId = nc.id;
      } else {
        const c = customerById(ui.custId);
        if (!c) return;
        Object.assign(c, fields);
        if (!c.photoDataUrl) c.photoDataUrl = "";
      }
      save();
      toast("保存しました");
      ui.custView = "detail";
      renderApp();
    }
  });

  document.addEventListener("change", async (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.matches("input[data-field='cust-photo']")) return;
    const file = t.files && t.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("画像ファイルを選んでください");
      t.value = "";
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("12MB以下の写真を選んでください");
      t.value = "";
      return;
    }
    try {
      const raw = await readFileAsDataURL(file);
      const small = await resizeImageDataUrl(raw, 400, 0.86);
      if (!small) {
        toast("画像の変換に失敗しました");
        t.value = "";
        return;
      }
      if (small.length > 1100000) {
        toast("縮小後も大きすぎます。別の画像を試してください");
        t.value = "";
        return;
      }
      const form = t.closest("form[data-form='cust-save']");
      const hid = form && form.querySelector('input[name="photoDataUrl"]');
      if (hid) hid.value = small;
      const prev = form && form.querySelector("[data-cust-photo-preview]");
      if (prev) {
        prev.innerHTML = "";
        const im = document.createElement("img");
        im.className = "cust-photo-preview__img";
        im.alt = "";
        im.src = small;
        prev.appendChild(im);
      }
      toast("プレビューを更新しました（保存で確定）");
    } catch (err) {
      toast("読み込めませんでした");
    }
    t.value = "";
  });

  load();
  renderApp();

  /** Chart CDN が app より遅い場合でも、読み込み完了後にホームのグラフだけ描き直す */
  window.addEventListener("load", () => {
    destroyAllCharts();
    initChartsForCurrentTab();
  });
})();
