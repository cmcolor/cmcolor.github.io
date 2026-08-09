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

function renderCategoryGrid(categories, container) {
  categories.forEach((cat) => {
    const isAvailable = cat.status === "available";
    const card = el(isAvailable ? "a" : "div", `category-card ${isAvailable ? "is-available" : "is-soon"}`);
    if (isAvailable) card.href = cat.href;

    card.appendChild(el("div", "icon", cat.icon || "🔹"));
    card.appendChild(el("div", "title", cat.title));
    card.appendChild(el("div", "desc", cat.description || ""));
    card.appendChild(el("div", "status", isAvailable ? "查看型錄" : "敬請期待"));

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
  info.appendChild(el("p", "meta", metaParts.join(" · ")));

  if (record.sheetCount) info.appendChild(el("p", "sheet-count", `張數：${record.sheetCount}張`));

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
  infoEl.appendChild(el("p", "modal-meta", metaParts.join(" · ")));

  if (record.sheetCount) infoEl.appendChild(el("p", "modal-meta", `張數：${record.sheetCount}張`));

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
