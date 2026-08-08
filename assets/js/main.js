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
  if (record.dimensions) metaParts.push(record.dimensions);
  info.appendChild(el("p", "meta", metaParts.join(" · ")));

  info.appendChild(el("p", "price", record.price ? `$${record.price}` : "價格洽詢"));
  card.appendChild(info);

  return card;
}

function setupCatalogPage({ dataPath, imageBasePath, gridEl, filterBarEl, searchEl, countEl }) {
  let allRecords = [];
  let activeCategory = "全部";

  function applyFilters() {
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

  loadJson(dataPath).then((records) => {
    allRecords = records;
    const categories = ["全部", ...new Set(records.map((r) => r.category).filter(Boolean))];

    categories.forEach((cat) => {
      const chip = el("button", "filter-chip", cat);
      if (cat === activeCategory) chip.classList.add("is-active");
      chip.addEventListener("click", () => {
        activeCategory = cat;
        filterBarEl.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        applyFilters();
      });
      filterBarEl.appendChild(chip);
    });

    searchEl.addEventListener("input", applyFilters);
    applyFilters();
  }).catch((err) => {
    gridEl.innerHTML = "";
    gridEl.appendChild(el("div", "empty-state", "商品資料載入失敗，請稍後再試"));
    console.error(err);
  });
}
