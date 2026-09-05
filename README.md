# Al_Barkat Trading LLC - Product & SKU Catalog Manager

A web-based application built for managing, searching, importing, and exporting products with all **13 required attributes**, live barcode rendering, dual image preview & uploads, and batch data processing for **Al_Barkat Trading LLC**.

---

## 💻 How to Share / Use on Another Computer

To use this application on any computer:
1. **Copy the entire folder** `product-catalog-app/` (including `index.html`, `initial-catalog.js`, `image-manifest.js`, `app.js`, `styles.css`, and `sku_images/`) to the other computer (via USB drive, network share, or zip).
2. Double-click [`launch.bat`](file:///C:/Users/sianc/.gemini/antigravity/scratch/product-catalog-app/launch.bat) or open [`index.html`](file:///C:/Users/sianc/.gemini/antigravity/scratch/product-catalog-app/index.html) in any web browser.
3. Whenever you add or edit products on one computer and want to permanently save them to the folder so they transfer everywhere, click the **"💾 Save to File"** button in the header bar and replace `initial-catalog.js` in the folder.

---

## 🌟 Key Features

### 1. Complete 13-Attribute Product Catalog
The application supports all 13 required fields:
1. **Brand Name** (`brand`)
2. **Category** (`category`)
3. **SKU** (`sku`) - Primary SKU
4. **Item Name** (`name`)
5. **Barcode** (`barcode`) - Live Code128 barcode rendering & verification
6. **Supplier Code** (`supplier_code`)
7. **Image 1** (`image1`) - Drag & drop file upload (Base64) or Image URL
8. **Image 2** (`image2`) - Drag & drop file upload (Base64) or Image URL
9. **Alternative SKU 1** (`alt_sku_1`)
10. **Alternative SKU 2** (`alt_sku_2`)
11. **Alternative SKU 3** (`alt_sku_3`)
12. **Saudi SKU** (`saudi_sku`) - KSA market identifier
13. **Supplier Name** (`supplier_name`)

### 2. Rich Data Exploration & Views
- **Data Table View**: Sortable columns, badge chips for Alternative SKUs and Saudi SKU, interactive barcode previews, quick copy buttons.
- **Card / Grid View**: Showcase view with dual-image carousel toggle, brand & Saudi SKU badges, and scannable barcodes.
- **Instant Search**: Real-time search across SKU, Name, Barcode, Alt SKUs, Saudi SKU, Brand, Supplier Code, and Supplier Name.
- **Multi-Factor Filters**: Filter by Brand, Category, and Supplier simultaneously.

### 3. Future Data Upload / Ingestion Interface
- **Multi-Format Ingestion**: Supports **CSV (`.csv`)**, **Microsoft Excel (`.xlsx`, `.xls`)**, and **JSON (`.json`)**.
- **Intelligent Auto-Mapping**: Automatically matches column headers (e.g. `Item Name`, `brand_name`, `Saudi SKU`, `Alternative SKU 1`).
- **Data Validation Wizard**:
  - Step 1: Upload file or download pre-formatted CSV/Excel template.
  - Step 2: Review and customize column mappings.
  - Step 3: Preview validated rows and choose duplicate SKU strategy (*Overwrite*, *Skip*, or *Append as new*).
  - Step 4: Instant ingestion summary.

### 4. Comprehensive Export Interface
- Export all or filtered items to **CSV**, **Microsoft Excel (.xlsx)**, or **JSON**.
- Column selection modal allowing custom export of all or selected attributes.
- UTF-8 with BOM support ensuring proper character formatting when opened in Microsoft Excel.

### 5. Barcode Label Generator & Printing
- Generates scannable barcode stickers with Brand, Item Name, SKU, and Saudi SKU.
- One-click print-ready sheet formatted for thermal label printers or A4 sticker sheets.

### 6. High-Capacity IndexedDB Storage & Auto-Save
- **Unlimited Capacity**: Uses HTML5 IndexedDB (`AlBarkatCatalogDB_v2`) eliminating the 5MB browser `localStorage` boundary and preventing out-of-memory/quota errors.
- **Real-Time Auto-Save**: Every addition, edit, duplicate, deletion, and import automatically and instantaneously persists to local browser storage with a live status indicator (`● All changes auto-saved`).
- **Pre-Configured Smart Lists**:
  - **Brand**: Quick-pick buttons and auto-suggestions for `Homecare`, `Redblossom`, `NeoOrbit`, plus dynamically added brands.
  - **Category**: Dynamic auto-suggestions populated from all categories in the catalog.
  - **Supplier**: Pre-configured with top suppliers (`DF IMPORT & EXPORT LTD`, `JIYANGSUYIFAN INTERNATIONAL TRADE CO. LTD`, `Beone Mart Trading LLC`, `Shenzhen Weichenyang CHINA`, `Guangzhou Huapan Cosmetics`, `Yuyao Artisans Commodity CO.,LTD`, `NINGBO HAWARD RAZOR CO.,LTD.`, `Dongguan Wontravel Electric Co., Ltd`) plus any newly created suppliers.
- **Client-Side Image Optimization**: Large photos are automatically resized to max 1200px and compressed before saving to ensure high performance.

---

## 🚀 How to Run the Application

### Option 1: Double-Click the Launcher
Simply double-click [`launch.bat`](file:///C:/Users/sianc/.gemini/antigravity/scratch/product-catalog-app/launch.bat) in the application folder.

### Option 2: Open in Any Browser
Open [`index.html`](file:///C:/Users/sianc/.gemini/antigravity/scratch/product-catalog-app/index.html) directly in Google Chrome, Microsoft Edge, or any modern web browser.

---

## 📁 Project Structure

```
product-catalog-app/
├── index.html          # Application UI layout, modals, and templates
├── styles.css          # Modern UI stylesheet with badges, responsive grids, and print rules
├── app.js              # Application state, CRUD, live barcode rendering, image handlers
├── import-export.js    # CSV/Excel/JSON parser, smart column mapper, template generator
├── launch.bat          # 1-click Windows launcher
└── README.md           # Documentation & usage guide
```
