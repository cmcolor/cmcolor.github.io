// Shared rendering helpers for the static catalog site.
// Pure vanilla JS, no build step - new products are added by editing the JSON files only.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// Free counter service (abacus.jasoncameron.dev) - counts total page loads across the
// whole site, not unique visitors. Stays hidden if the third-party service is unreachable.
function renderVisitorCounter(container) {
  fetch("https://abacus.jasoncameron.dev/hit/qunmei-cmcolor-website/pageviews")
    .then((res) => res.json())
    .then((data) => {
      container.textContent = `👁️ 累計瀏覽 ${Number(data.value).toLocaleString()} 次`;
      container.hidden = false;
    })
    .catch(() => {});
}

function renderPriceTable(rows, tbodyEl) {
  rows.forEach((row) => {
    const tr = el("tr");
    tr.appendChild(el("td", "col-size", row.size || ""));
    tr.appendChild(el("td", "col-dimensions", row.dimensions ? `${row.dimensions}cm` : ""));
    tr.appendChild(el("td", "col-note", row.note || ""));
    tr.appendChild(el("td", "col-price", row.price ? `$${row.price}` : "價格洽詢"));
    tbodyEl.appendChild(tr);
  });
}

function renderSpecTable(rows, tbodyEl) {
  rows.forEach((row) => {
    const tr = el("tr");
    tr.appendChild(el("td", "col-size", row.type || ""));
    tr.appendChild(el("td", "col-dimensions", row.size || ""));
    tr.appendChild(el("td", "col-note", row.note || ""));
    tbodyEl.appendChild(tr);
  });
}

function renderTopNav(categories, container, basePath) {
  const sorted = [...categories].sort((a, b) => (a.number || 0) - (b.number || 0));
  sorted.forEach((cat) => {
    const href = cat.status === "available"
      ? `${basePath}${cat.href}`
      : `${basePath}index.html#cat-${cat.slug}`;
    const link = el("a", "top-nav-link", cat.title);
    link.href = href;
    container.appendChild(link);
  });
}

function scrollToHash() {
  if (!location.hash) return;
  const target = document.querySelector(location.hash);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderCategoryGrid(categories, container) {
  categories.forEach((cat) => {
    const isAvailable = cat.status === "available";
    const card = el(isAvailable ? "a" : "div", `category-card ${isAvailable ? "is-available" : "is-soon"}`);
    if (isAvailable) card.href = cat.href;
    card.id = `cat-${cat.slug}`;

    if (cat.number) card.appendChild(el("div", "category-number", String(cat.number)));

    card.appendChild(el("div", "icon", cat.icon || "🔹"));
    card.appendChild(el("div", "title", cat.title));
    card.appendChild(el("div", "desc", cat.description || ""));

    if (cat.tag) card.appendChild(el("div", "service-tag", `＋ ${cat.tag}`));

    const statusRow = el("div", "status-row");
    const statusEl = el("span", "status", isAvailable ? "查看型錄" : "敬請期待");
    statusRow.appendChild(statusEl);

    if (isAvailable && cat.countSource) {
      loadJson(cat.countSource)
        .then((data) => statusEl.appendChild(el("span", "count-badge", `共 ${data.length} 款`)))
        .catch(() => {});
    }

    card.appendChild(statusRow);

    if (!isAvailable) {
      const inquiry = el("p", "inquiry-line");
      inquiry.appendChild(document.createTextNode("型錄建置中，如需選購請先"));
      const callLink = el("a", "inquiry-link", "來電");
      callLink.href = "tel:0492357301";
      inquiry.appendChild(callLink);
      inquiry.appendChild(document.createTextNode("或加 "));
      const lineLink = el("a", "inquiry-link", "LINE");
      lineLink.href = "https://line.me/ti/p/~02357301";
      lineLink.target = "_blank";
      lineLink.rel = "noopener";
      inquiry.appendChild(lineLink);
      inquiry.appendChild(document.createTextNode(" 詢問"));
      card.appendChild(inquiry);
    }

    container.appendChild(card);
  });
}

function isSoldOut(record) {
  return (record.note || "").indexOf("售完") !== -1;
}

function renderProductCard(record, imageBasePath) {
  const card = el("div", "product-card");

  const thumbWrap = el("div", "thumb-wrap");
  if (record.image) {
    const img = el("img");
    img.src = `${imageBasePath}${record.image}`;
    img.alt = record.name || record.id;
    img.loading = "lazy";
    thumbWrap.appendChild(img);
  } else {
    thumbWrap.appendChild(el("div", "no-image", "圖片準備中"));
  }
  card.appendChild(thumbWrap);

  if (isSoldOut(record)) {
    card.appendChild(el("div", "badge-soldout", "已售完"));
  }
  if (record.giftBag) {
    card.appendChild(el("div", "badge-gift", "🎁 送可愛包"));
  }

  const info = el("div", "info");
  const nameRow = el("p", "name");
  nameRow.appendChild(document.createTextNode(record.name || "未命名款式"));
  if (record.id) nameRow.appendChild(el("span", "id-tag", ` #${record.id}`));
  info.appendChild(nameRow);

  const metaParts = [];
  if (record.size) metaParts.push(record.size);
  if (record.dimensions) metaParts.push(`${record.dimensions}cm`);
  if (record.sheetCount) metaParts.push(`共${record.sheetCount}小張`);
  info.appendChild(el("p", "meta", metaParts.join(" · ")));

  info.appendChild(el("p", "price", record.price ? `$${record.price}` : "價格洽詢"));
  card.appendChild(info);

  card.addEventListener("click", () => openProductModal(record, imageBasePath));

  return card;
}

let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;

  modalEl = el("div", "modal-overlay");
  modalEl.hidden = true;

  const box = el("div", "modal-box");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");

  const closeBtn = el("button", "modal-close", "×");
  closeBtn.setAttribute("aria-label", "關閉");
  closeBtn.addEventListener("click", closeProductModal);
  box.appendChild(closeBtn);

  box.appendChild(el("div", "modal-images"));
  box.appendChild(el("div", "modal-info"));

  modalEl.appendChild(box);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeProductModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProductModal();
  });

  document.body.appendChild(modalEl);
  return modalEl;
}

function closeProductModal() {
  if (modalEl) modalEl.hidden = true;
}

function openProductModal(record, imageBasePath) {
  const modal = ensureModal();
  const imagesEl = modal.querySelector(".modal-images");
  const infoEl = modal.querySelector(".modal-info");
  imagesEl.innerHTML = "";
  infoEl.innerHTML = "";

  const mainBlock = el("div", "modal-image-block");
  if (record.image) {
    const img = el("img", "modal-img");
    img.src = `${imageBasePath}${record.image}`;
    img.alt = record.name || record.id;
    mainBlock.appendChild(img);
  } else {
    mainBlock.appendChild(el("div", "no-image", "圖片準備中"));
  }
  mainBlock.appendChild(el("p", "modal-image-caption", "貼紙款式"));
  imagesEl.appendChild(mainBlock);

  if (record.giftBag && record.giftImage) {
    const giftBlock = el("div", "modal-image-block");
    const giftImg = el("img", "modal-img");
    giftImg.src = `${imageBasePath}${record.giftImage}`;
    giftImg.alt = "贈品：可愛包";
    giftBlock.appendChild(giftImg);
    giftBlock.appendChild(el("p", "modal-image-caption", "🎁 贈品：可愛包（送完為止）"));
    imagesEl.appendChild(giftBlock);
  }

  const nameRow = el("h3", "modal-name");
  nameRow.appendChild(document.createTextNode(record.name || "未命名款式"));
  if (record.id) nameRow.appendChild(el("span", "id-tag", ` #${record.id}`));
  infoEl.appendChild(nameRow);

  const metaParts = [];
  if (record.size) metaParts.push(record.size);
  if (record.dimensions) metaParts.push(`${record.dimensions}cm`);
  if (record.sheetCount) metaParts.push(`共${record.sheetCount}小張`);
  infoEl.appendChild(el("p", "modal-meta", metaParts.join(" · ")));

  infoEl.appendChild(el("p", "modal-price", record.price ? `$${record.price}` : "價格洽詢"));

  if (isSoldOut(record)) {
    infoEl.appendChild(el("p", "modal-soldout", "已售完"));
  }

  modal.hidden = false;
}

function setupCatalogPage({ dataPath, imageBasePath, gridEl, filterBarEl, searchEl, countEl, comingSoonCategories = [] }) {
  let allRecords = [];
  let activeCategory = "全部";

  function applyFilters() {
    if (comingSoonCategories.includes(activeCategory)) {
      gridEl.innerHTML = "";
      countEl.textContent = "";
      gridEl.appendChild(el("div", "empty-state", `「${activeCategory}」即將推出，敬請期待`));
      return;
    }

    const keyword = (searchEl.value || "").trim().toLowerCase();
    const filtered = allRecords.filter((r) => {
      const matchesCategory = activeCategory === "全部" || r.category === activeCategory;
      const matchesKeyword = !keyword
        || (r.name && r.name.toLowerCase().includes(keyword))
        || (r.id && r.id.includes(keyword));
      return matchesCategory && matchesKeyword;
    });

    gridEl.innerHTML = "";
    countEl.textContent = `共 ${filtered.length} 款`;

    if (filtered.length === 0) {
      gridEl.appendChild(el("div", "empty-state", "找不到符合的款式，試試其他關鍵字或分類"));
      return;
    }

    filtered.forEach((r) => gridEl.appendChild(renderProductCard(r, imageBasePath)));
  }

  function addChip(cat, isComingSoon) {
    const chip = el("button", "filter-chip", isComingSoon ? `${cat}（敬請期待）` : cat);
    if (isComingSoon) chip.classList.add("is-coming-soon");
    if (cat === activeCategory) chip.classList.add("is-active");
    chip.addEventListener("click", () => {
      activeCategory = cat;
      filterBarEl.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      applyFilters();
    });
    filterBarEl.appendChild(chip);
  }

  loadJson(dataPath).then((records) => {
    allRecords = records;
    const categories = ["全部", ...new Set(records.map((r) => r.category).filter(Boolean))];

    categories.forEach((cat) => addChip(cat, false));
    comingSoonCategories.forEach((cat) => addChip(cat, true));

    searchEl.addEventListener("input", applyFilters);
    applyFilters();
  }).catch((err) => {
    gridEl.innerHTML = "";
    gridEl.appendChild(el("div", "empty-state", "商品資料載入失敗，請稍後再試"));
    console.error(err);
  });
}