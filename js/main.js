(function () {
  "use strict";

  if (typeof SITE === "undefined") {
    return;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (!el || !text) return;
    if (el.tagName === "IMG") {
      el.setAttribute("alt", text);
    } else {
      el.textContent = text;
    }
  }

  function setHref(id, href) {
    var el = document.getElementById(id);
    if (el && href) el.setAttribute("href", href);
  }

  function setMeta(name, content, isProperty) {
    if (!content) return;
    var selector = isProperty
      ? 'meta[property="' + name + '"]'
      : 'meta[name="' + name + '"]';
    var m = document.head.querySelector(selector);
    if (m) m.setAttribute("content", content);
  }

  function setMetaName(name, content) {
    setMeta(name, content, false);
  }

  function escAttr(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  /** メイン画像と同じベース名の `-960.jpg`（長辺960px程度）をモバイル向けに参照 */
  function responsiveMobilePath(src) {
    if (!src || typeof src !== "string") return "";
    var m = src.match(/^(.+)(\.[^./\\]+)$/);
    if (!m) return "";
    return m[1] + "-960.jpg";
  }

  /** 携帯向け縦クロップ JPEG（中央 9:16 想定） */
  function responsivePortraitPath(src) {
    if (!src || typeof src !== "string") return "";
    var m = src.match(/^(.+)(\.[^./\\]+)$/);
    if (!m) return "";
    return m[1] + "-mobile.jpg";
  }

  function useResponsivePictures() {
    var imgs = SITE.images || {};
    return imgs.responsive !== false;
  }

  /**
   * @param {string} fetchPriority "high" | "low" | ""
   * @param {string} narrowMode "" | "portrait-first"（狭い画面で -mobile.jpg を優先、その後 -960.jpg）
   */
  function pictureMarkup(src, alt, width, height, loading, fetchPriority, narrowMode) {
    var mobile960 = responsiveMobilePath(src);
    var mobilePortrait = responsivePortraitPath(src);
    var altE = escAttr(alt);
    var srcE = escAttr(src);
    var imgsCfg = SITE.images || {};
    var narrowParts = "";
    if (useResponsivePictures()) {
      if (narrowMode === "portrait-first" && imgsCfg.narrowPortraitOnPhone !== false) {
        if (mobilePortrait) {
          narrowParts +=
            '<source media="(max-width:39.999rem)" srcset="' +
            escAttr(mobilePortrait) +
            '" type="image/jpeg" />';
        } else if (mobile960) {
          narrowParts +=
            '<source media="(max-width:39.999rem)" srcset="' +
            escAttr(mobile960) +
            '" type="image/jpeg" />';
        }
      } else if (mobile960) {
        narrowParts +=
          '<source media="(max-width:39.999rem)" srcset="' +
          escAttr(mobile960) +
          '" type="image/jpeg" />';
      }
    }
    var loadingAttr = loading ? ' loading="' + loading + '"' : "";
    var fetchAttr =
      fetchPriority === "high"
        ? ' fetchpriority="high"'
        : fetchPriority === "low"
          ? ' fetchpriority="low"'
          : "";
    var imgCore =
      '<img src="' +
      srcE +
      '" alt="' +
      altE +
      '" width="' +
      width +
      '" height="' +
      height +
      '"' +
      loadingAttr +
      fetchAttr +
      ' decoding="async" sizes="100vw" />';
    if (!narrowParts) {
      return imgCore;
    }
    return "<picture>" + narrowParts + imgCore + "</picture>";
  }

  function applyHeroPortraitImage() {
    var img = document.getElementById("hero-portrait-img");
    var noPhoto = document.querySelector(".hero-editorial__no-photo");
    var hero = document.getElementById("hero");
    if (!hero || !hero.classList.contains("hero--editorial")) return;
    var src = SITE.images && SITE.images.heroPortrait;
    if (img && src) {
      img.setAttribute("src", src);
      img.setAttribute(
        "alt",
        (SITE.shopName || "スナックかしわ") + "の店内。暖かい照明のカウンター。"
      );
      img.hidden = false;
      document.body.classList.add("has-hero-portrait");
      if (noPhoto) noPhoto.setAttribute("hidden", "hidden");
    } else {
      if (img) {
        img.removeAttribute("src");
        img.hidden = true;
      }
      document.body.classList.remove("has-hero-portrait");
      if (noPhoto) noPhoto.removeAttribute("hidden");
    }
  }

  function applyHeroImage() {
    var inner = document.getElementById("hero-media");
    if (!inner) return;
    var shell = inner.closest(".hero__media");
    var src = SITE.images && SITE.images.hero;
    if (!src) return;
    if (shell) shell.classList.add("hero__media--has-image");
    inner.innerHTML = pictureMarkup(
      src,
      (SITE.shopName || "店内") + "の様子",
      1600,
      1000,
      "eager",
      "high",
      ""
    );
  }

  function applyCounterImage() {
    var inner = document.getElementById("counter-chapter-inner");
    if (!inner) return;
    var imgs = SITE.images || {};
    var src = imgs.counter || imgs.hero;
    if (!src) return;
    inner.innerHTML = pictureMarkup(
      src,
      "カウンターと間接照明",
      1600,
      1000,
      "lazy",
      "",
      "portrait-first"
    );
  }

  function applyFigureImage(id, src, alt, imgWidth, imgHeight) {
    var fig = document.getElementById(id);
    if (!fig) return;
    if (!src) {
      fig.innerHTML = "";
      return;
    }
    var w = imgWidth != null ? imgWidth : 1600;
    var h = imgHeight != null ? imgHeight : 900;
    fig.innerHTML = pictureMarkup(src, alt || "", w, h, "lazy", "", "");
  }

  function applyLogoSrc() {
    var src = SITE.images && SITE.images.logo;
    var text = document.getElementById("brand-text");
    var altText = (SITE.shopName || "スナック かしわ") + " ロゴ";
    ["brand-name", "hero-editorial-logo"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.tagName !== "IMG") return;
      if (src) {
        el.setAttribute("src", src);
        el.hidden = false;
        if (id === "brand-name") el.setAttribute("alt", altText);
        if (id === "hero-editorial-logo") el.setAttribute("alt", "");
      } else {
        el.removeAttribute("src");
        el.hidden = true;
        if (id === "brand-name") el.setAttribute("alt", "");
        if (id === "hero-editorial-logo") el.setAttribute("alt", "");
      }
    });
    if (text) text.hidden = !!src;
  }

  function renderMenu() {
    var root = document.getElementById("menu-root");
    if (!root) return;
    root.innerHTML = "";

    function appendTable(title, rows, priceColumn) {
      if (!rows || !rows.length) return;
      var article = document.createElement("article");
      article.className =
        "menu-category" + (priceColumn === false ? " menu-category--info" : "");
      var h3 = document.createElement("h3");
      h3.className = "menu-category__title";
      h3.textContent = title;
      article.appendChild(h3);
      var table = document.createElement("table");
      table.className = "menu-table";
      var tbody = document.createElement("tbody");
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        var th = document.createElement("th");
        th.className = "menu-th";
        th.textContent = row.name || row.label || "";
        var td = document.createElement("td");
        td.className = "menu-td";
        if (priceColumn !== false) td.classList.add("menu-td--price");
        td.textContent = row.price || row.note || "";
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      article.appendChild(table);
      root.appendChild(article);
    }

    if (SITE.otherCharges && SITE.otherCharges.length) {
      appendTable("ご利用について", SITE.otherCharges, false);
    }

    if (SITE.drinkMenuNote) {
      var noteArt = document.createElement("article");
      noteArt.className = "menu-category menu-category--drink-note";
      var h3d = document.createElement("h3");
      h3d.className = "menu-category__title";
      h3d.textContent = "ドリンクメニュー";
      noteArt.appendChild(h3d);
      var pd = document.createElement("p");
      pd.className = "menu-drink-note";
      pd.textContent = SITE.drinkMenuNote;
      noteArt.appendChild(pd);
      root.appendChild(noteArt);
    }

    if (SITE.bottleSections && SITE.bottleSections.length) {
      SITE.bottleSections.forEach(function (sec) {
        appendTable(sec.title, sec.rows, true);
      });
    }

    if (SITE.freeDrink) {
      var fd = SITE.freeDrink;
      var block = document.createElement("article");
      block.className = "menu-category menu-category--freedrink";
      var h3f = document.createElement("h3");
      h3f.className = "menu-category__title";
      h3f.textContent = fd.title || "FREE DRINK";
      block.appendChild(h3f);
      if (fd.intro) {
        var intro = document.createElement("p");
        intro.className = "menu-free__intro";
        intro.textContent = fd.intro;
        block.appendChild(intro);
      }
      if (fd.groups && fd.groups.length) {
        fd.groups.forEach(function (g) {
          var sub = document.createElement("div");
          sub.className = "menu-free__group";
          var h4 = document.createElement("h4");
          h4.className = "menu-free__subtitle";
          h4.textContent = g.subtitle || "";
          sub.appendChild(h4);
          var ul = document.createElement("ul");
          ul.className = "menu-free__list";
          (g.lines || []).forEach(function (line) {
            var li = document.createElement("li");
            li.textContent = line;
            ul.appendChild(li);
          });
          sub.appendChild(ul);
          block.appendChild(sub);
        });
      }
      root.appendChild(block);
    }
  }

  function renderPaymentMethods() {
    var root = document.getElementById("payment-root");
    if (!root) return;
    var pm = SITE.paymentMethods;
    if (!pm || !pm.title) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "payment-methods";
    var h3 = document.createElement("h3");
    h3.className = "payment-methods__title";
    h3.textContent = pm.title;
    wrap.appendChild(h3);
    (pm.groups || []).forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "payment-methods__group";
      var h4 = document.createElement("h4");
      h4.className = "payment-methods__group-title";
      h4.textContent = g.title || "";
      sec.appendChild(h4);
      var ul = document.createElement("ul");
      ul.className = "payment-methods__list";
      (g.items || []).forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      wrap.appendChild(sec);
    });
    if (pm.note) {
      var foot = document.createElement("p");
      foot.className = "payment-methods__note";
      foot.textContent = pm.note;
      wrap.appendChild(foot);
    }
    root.appendChild(wrap);
  }

  function mountMap() {
    var shell = document.getElementById("map-shell");
    var host = document.getElementById("map-host");
    var ph = document.getElementById("map-placeholder");
    if (!shell || !host || !SITE.mapEmbedSrc) return;

    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          obs.disconnect();
          var iframe = document.createElement("iframe");
          iframe.setAttribute("title", (SITE.shopName || "店舗") + "の地図");
          iframe.setAttribute("loading", "lazy");
          iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
          iframe.setAttribute("src", SITE.mapEmbedSrc);
          host.appendChild(iframe);
          if (ph) ph.style.display = "none";
        });
      },
      { rootMargin: "120px" }
    );
    io.observe(shell);
  }

  function injectJsonLd() {
    var ld = {
      "@context": "https://schema.org",
      "@type": "BarOrPub",
      name: SITE.shopName || "スナック かしわ",
      description:
        SITE.seoDescription ||
        "熊本・下通のスナック。初めてのスナック、一人飲み、女性のお一人様も歓迎。落ち着いて飲めるカウンター。明朗会計。熊本で静かな夜を過ごしたい方へ。",
    };

    if (SITE.canonicalUrl) ld.url = SITE.canonicalUrl;
    if (SITE.telDisplay) ld.telephone = SITE.telDisplay;
    if (SITE.ogImageUrl) ld.image = SITE.ogImageUrl;
    if (SITE.openingHours) ld.openingHours = SITE.openingHours;

    if (SITE.addressLine) {
      ld.address = {
        "@type": "PostalAddress",
        streetAddress: SITE.addressLine,
        addressLocality: "熊本市中央区",
        addressRegion: "熊本県",
        postalCode: "860-0807",
        addressCountry: "JP",
      };
    }

    if (SITE.geo && SITE.geo.latitude && SITE.geo.longitude) {
      ld.geo = {
        "@type": "GeoCoordinates",
        latitude: SITE.geo.latitude,
        longitude: SITE.geo.longitude,
      };
    }

    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  function initReveal() {
    var nodes = document.querySelectorAll(".reveal, .reveal-slow");
    if (!nodes.length) return;
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      nodes.forEach(function (n) {
        n.classList.add("is-visible");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  function initHeroParallax() {
    var layer = document.querySelector(".hero__media--has-image .hero__media-parallax");
    if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    var ticking = false;
    function tick() {
      ticking = false;
      var hero = document.getElementById("hero");
      if (!hero) return;
      var rect = hero.getBoundingClientRect();
      var total = rect.height + window.innerHeight;
      var p = 1 - Math.min(1, Math.max(0, rect.bottom / total));
      layer.style.transform =
        "translate3d(0," + (p * 14).toFixed(2) + "px,0) scale(1.03)";
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(tick);
        }
      },
      { passive: true }
    );
    tick();
  }

  function initChapterParallax() {
    var layer = document.querySelector(".chapter__parallax");
    if (!layer || !layer.querySelector("img")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var chapter = layer.closest(".chapter");
    if (!chapter) return;
    var ticking = false;
    function tick() {
      ticking = false;
      var rect = chapter.getBoundingClientRect();
      var total = rect.height + window.innerHeight * 0.85;
      var p = 1 - Math.min(1, Math.max(0, rect.bottom / total));
      layer.style.transform =
        "translate3d(0," + (p * 18).toFixed(2) + "px,0) scale(1.04)";
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(tick);
        }
      },
      { passive: true }
    );
    tick();
  }

  /* —— Apply —— */
  document.title = (SITE.shopName || "スナック かしわ") + "｜熊本・下通";

  var metaDesc = document.querySelector('meta[name="description"]');
  if (SITE.seoDescription && metaDesc) {
    metaDesc.setAttribute("content", SITE.seoDescription);
  }
  var descContent =
    SITE.seoDescription ||
    (metaDesc && metaDesc.getAttribute("content")) ||
    "";
  var ogDesc =
    SITE.ogDescription != null && SITE.ogDescription !== ""
      ? SITE.ogDescription
      : descContent;

  var canonical = document.getElementById("canonical-link");
  if (canonical && SITE.canonicalUrl) {
    canonical.setAttribute("href", SITE.canonicalUrl);
  }

  setMeta("og:title", document.title, true);
  setMeta("og:description", ogDesc, true);
  if (SITE.canonicalUrl) setMeta("og:url", SITE.canonicalUrl, true);
  if (SITE.ogImageUrl) setMeta("og:image", SITE.ogImageUrl, true);

  setMetaName("twitter:title", document.title);
  setMetaName("twitter:description", ogDesc);
  if (SITE.ogImageUrl) setMetaName("twitter:image", SITE.ogImageUrl);

  setText("brand-name", SITE.shopName);
  setText("footer-shop", SITE.shopName);
  setText("tel-display", SITE.telDisplay);
  setHref("tel-link", SITE.telHref);
  setHref("tel-link-2", SITE.telHref);
  setHref("tel-link-hero", SITE.telHref);
  setHref("ig-link", SITE.instagramUrl);
  setHref("ig-link-2", SITE.instagramUrl);
  setHref("ig-link-hero", SITE.instagramUrl);
  setText("address-block", SITE.addressLine);

  applyHeroPortraitImage();
  applyHeroImage();
  applyCounterImage();
  applyLogoSrc();
  applyFigureImage(
    "atmosphere-photo",
    SITE.images && SITE.images.atmosphere,
    "店内の空気感",
    1600,
    900
  );
  applyFigureImage(
    "entrance-photo",
    SITE.images && SITE.images.entrance,
    "店舗外観・ビル入口付近",
    1200,
    1500
  );

  renderMenu();
  renderPaymentMethods();
  mountMap();
  injectJsonLd();

  initReveal();
  initHeroParallax();
  initChapterParallax();
})();
