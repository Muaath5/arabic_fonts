(function () {
  "use strict";

  const DATA_URL = "fonts.json";
  const FONTS_BASE = "fonts/";

  const FORMAT_MAP = {
    woff2: "woff2",
    woff: "woff",
    ttf: "truetype",
    otf: "opentype",
    eot: "embedded-opentype",
  };

  const state = { fonts: [] };

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

  function slugify(text) {
    return String(text)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function guessFormat(filePath) {
    const ext = filePath.split(".").pop().toLowerCase();
    return FORMAT_MAP[ext] || null;
  }

  // Normalizes a raw fonts.json entry into what the UI needs: a stable
  // id, a computed @font-face family name, and per-typeface format/zip
  // paths — mirroring what build.py validates server-side.
  function normalizeFont(raw) {
    const id = raw.id || slugify(raw.name_en || raw.name);
    const typefaces = (raw.typefaces || []).map((tf) => ({
      name: tf.name,
      file: tf.file,
      weight: tf.weight || 400,
      style: tf.style || "normal",
      format: guessFormat(tf.file),
    }));
    return {
      id,
      name: raw.name,
      creator: raw.creator || "",
      category: raw.category || "",
      typefaces,
      family: "af-" + id,
      zip: FONTS_BASE + id + "/" + id + "-all.zip",
    };
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

  function injectFontFaces(fonts) {
    const sheet = document.createElement("style");
    let css = "";
    for (const font of fonts) {
      for (const tf of font.typefaces) {
        const url = resolveFontUrl(tf.file);
        const formatPart = tf.format ? ` format("${tf.format}")` : "";
        css += `
@font-face {
  font-family: "${font.family}";
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

    const creatorHtml = font.creator
      ? `<span class="specimen-creator"> — ${escapeHtml(font.creator)}</span>`
      : "";

    const meta = document.createElement("div");
    meta.className = "specimen-meta";
    meta.innerHTML = `
      <span>
        <span class="specimen-name">${escapeHtml(font.name)}</span>
        ${creatorHtml}
      </span>
      ${font.category ? `<span class="specimen-category">${escapeHtml(font.category)}</span>` : ""}
    `;
    wrap.appendChild(meta);

    const sample = document.createElement("div");
    sample.className = "specimen-text";
    sample.style.fontFamily = `"${font.family}"`;
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

  function buildEmbedCss(font) {
    let css = "";
    for (const tf of font.typefaces) {
      const url = resolveFontUrl(tf.file);
      const formatPart = tf.format ? ` format("${tf.format}")` : "";
      css += `@font-face {
  font-family: "${font.family}";
  src: url("${url}")${formatPart};
  font-weight: ${tf.weight};
  font-style: ${tf.style};
  font-display: swap;
}
`;
    }
    css += `
/* الاستخدام */
.your-element {
  font-family: "${font.family}", sans-serif;
}`;
    return css;
  }

  function openEmbedModal(font) {
    el.embedCode.textContent = buildEmbedCss(font);
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

  function openDownloadModal(font) {
    el.downloadAllLink.href = resolveFontUrl(font.id + "/" + font.id + "-all.zip");
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

  el.input.addEventListener("input", render);
  el.sizeRange.addEventListener("input", render);

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      state.fonts = raw.map(normalizeFont);
    } catch (err) {
      el.list.innerHTML = `<p class="empty-state">تعذّر تحميل قائمة الخطوط (${escapeHtml(err.message)}).</p>`;
      return;
    }

    injectFontFaces(state.fonts);
    render();
  }

  init();
})();
