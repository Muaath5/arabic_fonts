/* ============================================================
   خطوط — app.js
   Loads fonts.generated.json, injects @font-face rules for every
   typeface, renders the specimen list, and wires the Embed /
   Download popups. No frameworks, no build step needed.
   ============================================================ */

(function () {
  "use strict";

  const DATA_URL = "fonts.generated.json";
  const FONTS_BASE = "fonts/"; // relative to site root

  const state = {
    fonts: [],
  };

  const el = {
    input: document.getElementById("preview-input"),
    sizeRange: document.getElementById("size-range"),
    list: document.getElementById("specimen-list"),
    count: document.getElementById("result-count"),
    embedModal: document.getElementById("embed-modal"),
    embedCode: document.getElementById("embed-code"),
    embedCopy: document.getElementById("embed-copy"),
    downloadModal: document.getElementById("download-modal"),
    downloadAllLink: document.getElementById("download-all-link"),
    downloadAllCount: document.getElementById("download-all-count"),
    typefaceList: document.getElementById("typeface-list"),
  };

  // -- utilities --------------------------------------------------

  function fontFamilyName(font) {
    // Stable, collision-free CSS font-family identifier.
    return "af-" + font.id;
  }

  function resolveFontUrl(relPath) {
    return FONTS_BASE + relPath;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // -- @font-face injection ----------------------------------------

  function injectFontFaces(fonts) {
    const sheet = document.createElement("style");
    let css = "";
    for (const font of fonts) {
      const family = fontFamilyName(font);
      for (const tf of font.typefaces) {
        const url = resolveFontUrl(tf.file);
        const formatPart = tf.format ? ` format("${tf.format}")` : "";
        css += `
@font-face {
  font-family: "${family}";
  src: url("${url}")${formatPart};
  font-weight: ${tf.weight};
  font-style: ${tf.style};
  font-display: swap;
}`;
      }
    }
    sheet.textContent = css;
    document.head.appendChild(sheet);
  }

  // -- rendering ----------------------------------------------------

  function render() {
    const text = el.input.value.trim() || el.input.placeholder;
    const size = el.sizeRange.value;

    el.count.textContent = `${state.fonts.length} خط`;

    if (state.fonts.length === 0) {
      el.list.innerHTML = '<p class="empty-state">لا توجد خطوط بعد.</p>';
      return;
    }

    el.list.innerHTML = "";
    for (const font of state.fonts) {
      el.list.appendChild(renderSpecimen(font, text, size));
    }
  }

  function renderSpecimen(font, text, size) {
    const wrap = document.createElement("article");
    wrap.className = "specimen";

    const meta = document.createElement("div");
    meta.className = "specimen-meta";
    meta.innerHTML = `
      <span>
        <span class="specimen-name">${escapeHtml(font.name)}</span>
        ${font.creator ? `<span class="specimen-creator"> — ${escapeHtml(font.creator)}</span>` : ""}
      </span>
      ${font.category ? `<span class="specimen-category">${escapeHtml(font.category)}</span>` : ""}
    `;
    wrap.appendChild(meta);

    const sample = document.createElement("div");
    sample.className = "specimen-text";
    sample.style.fontFamily = `"${fontFamilyName(font)}"`;
    sample.style.fontSize = size + "px";
    sample.textContent = text;
    sample.title = "اضغط لتضمين هذا الخط";
    sample.addEventListener("click", () => openEmbedModal(font));
    wrap.appendChild(sample);

    const actions = document.createElement("div");
    actions.className = "specimen-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "btn";
    downloadBtn.textContent = "تنزيل";
    downloadBtn.addEventListener("click", () => openDownloadModal(font));
    actions.appendChild(downloadBtn);

    const embedBtn = document.createElement("button");
    embedBtn.type = "button";
    embedBtn.className = "btn";
    embedBtn.textContent = "تضمين";
    embedBtn.addEventListener("click", () => openEmbedModal(font));
    actions.appendChild(embedBtn);

    wrap.appendChild(actions);
    return wrap;
  }

  // -- embed modal ----------------------------------------------------

  function buildEmbedCss(font) {
    const family = fontFamilyName(font);
    let css = "";
    for (const tf of font.typefaces) {
      const url = resolveFontUrl(tf.file);
      const formatPart = tf.format ? ` format("${tf.format}")` : "";
      css += `@font-face {
  font-family: "${family}";
  src: url("${url}")${formatPart};
  font-weight: ${tf.weight};
  font-style: ${tf.style};
  font-display: swap;
}
`;
    }
    css += `
/* usage */
.your-element {
  font-family: "${family}", sans-serif;
}`;
    return css;
  }

  function openEmbedModal(font) {
    el.embedCode.textContent = buildEmbedCss(font);
    el.embedCopy.dataset.copied = "0";
    el.embedCopy.textContent = "نسخ الكود";
    showModal(el.embedModal);
  }

  el.embedCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.embedCode.textContent);
      el.embedCopy.textContent = "تم النسخ";
    } catch (e) {
      el.embedCopy.textContent = "تعذّر النسخ — انسخ يدويًا";
    }
  });

  // -- download modal ----------------------------------------------------

  function openDownloadModal(font) {
    if (font.zip) {
      el.downloadAllLink.href = resolveFontUrl(font.zip);
      el.downloadAllLink.hidden = false;
    } else {
      el.downloadAllLink.hidden = true;
    }
    el.downloadAllCount.textContent = `${font.typefaces.length} ملفات`;

    el.typefaceList.innerHTML = "";
    for (const tf of font.typefaces) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.className = "tf-name";
      link.href = resolveFontUrl(tf.file);
      link.setAttribute("download", "");
      link.textContent = tf.name;

      const weightLabel = document.createElement("span");
      weightLabel.className = "tf-weight";
      weightLabel.textContent = tf.weight;

      li.appendChild(link);
      li.appendChild(weightLabel);
      el.typefaceList.appendChild(li);
    }

    showModal(el.downloadModal);
  }

  // -- modal plumbing ----------------------------------------------------

  function showModal(modal) {
    modal.hidden = false;
    const closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function hideModal(modal) {
    modal.hidden = true;
  }

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      hideModal(e.target.closest(".modal-backdrop"));
    });
  });

  [el.embedModal, el.downloadModal].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal(modal);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      [el.embedModal, el.downloadModal].forEach((modal) => {
        if (!modal.hidden) hideModal(modal);
      });
    }
  });

  // -- events ----------------------------------------------------

  el.input.addEventListener("input", render);
  el.sizeRange.addEventListener("input", render);

  // -- boot ----------------------------------------------------

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.fonts = await res.json();
    } catch (err) {
      el.list.innerHTML = `<p class="empty-state">تعذّر تحميل قائمة الخطوط (${escapeHtml(err.message)}).</p>`;
      return;
    }

    injectFontFaces(state.fonts);
    render();
  }

  init();
})();
