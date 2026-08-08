# 群美彩色攝影沖印社 商品型錄網站

純靜態網站（HTML + CSS + JS，無框架、無建置流程），部署在 GitHub Pages。

## 網站結構

```
website/
├── index.html                       # 首頁：店家資訊 + 產品分類導覽
├── products/
│   └── name-stickers.html           # 姓名貼紙型錄頁
├── assets/
│   ├── css/style.css                # 共用樣式
│   ├── js/main.js                   # 讀取 JSON、渲染卡片、篩選/搜尋
│   └── images/name-stickers/        # 壓縮後的商品圖
├── data/
│   ├── categories.json              # 首頁的產品分類清單
│   ├── name-stickers.json           # 姓名貼紙商品資料
│   └── qa-report.json               # 資料轉換時發現的待確認事項（見下方說明）
└── scripts/                         # 一次性資料處理工具（PowerShell，因本機無 Python/Node）
    ├── xlsx-to-json.ps1             # 把 Excel 目錄轉成 JSON
    ├── resize-images.ps1            # 壓縮商品圖片
    └── serve.ps1                    # 本機預覽用的簡易伺服器
```

## 如何新增一個產品分類（例如：洗相片、證件照）

1. 準備好該分類的照片，放進一個新資料夾，例如 `assets/images/photo-printing/`
2. 建立 `data/photo-printing.json`，格式比照 `data/name-stickers.json`（每筆至少要有 `name`、`price`、`image`）
3. 複製 `products/name-stickers.html` 成 `products/photo-printing.html`，把 `<script>` 區塊裡的 `dataPath` 和 `imageBasePath` 改成新分類的路徑
4. 打開 `data/categories.json`，把該分類的 `status` 從 `"coming-soon"` 改成 `"available"`，並加上 `"href": "products/photo-printing.html"`

不需要改動 `main.js` 或 CSS，畫面會自動用同一套邏輯渲染。

## 如何新增姓名貼紙的新款式

直接編輯 `data/name-stickers.json`，新增一筆物件（`id`、`category`、`name`、`size`、`dimensions`、`price`、`image` 等欄位），並把對應圖片放進 `assets/images/name-stickers/`（建議先用 `scripts/resize-images.ps1` 的邏輯壓縮到寬度約 800px，避免圖檔過大）。

## 待確認事項（`data/qa-report.json`）

從 Excel 目錄轉換時，有兩類資料沒有自動處理，需要人工確認：

- **`pendingFlags`**：Excel 裡「待確認」欄位原本就標記的疑慮列（例如編號可能算錯、新規格缺欄位），共 21 筆
- **`missingImages`**：目錄裡寫了圖片檔名，但 `姓名貼圖` 資料夾中找不到對應照片的款式，共 26 筆（其中 3 筆已自動比對到合併照片，其餘 26 筆目前顯示「圖片準備中」）

這些款式目前仍會顯示在網站上（價格、名稱都在），只是缺圖或編號待確認，不影響網站上線，但建議之後補拍照片或核對編號。

## 本機預覽

```
powershell -File scripts/serve.ps1
```

然後開瀏覽器連到 `http://localhost:8791`。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新的 public repository
2. 把整個 `website/` 資料夾內容 push 上去（`website/` 本身即為 repo 根目錄）
3. 到 repo 的 Settings → Pages，Source 選擇該分支的根目錄
4. 之後每次更新資料或新增分類，commit + push 即可自動更新網站
