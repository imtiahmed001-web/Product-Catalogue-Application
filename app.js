/**
 * Al_Barkat Trading LLC - Main Product Catalog Application Logic
 * Master dataset: Al Barakat 13-Attribute Catalog with SKU Images
 */

/**
 * Standard Brands required by business operations
 */
const STANDARD_BRANDS = [
  'Homecare',
  'Redblossom',
  'NeoOrbit'
];

/**
 * Standard Suppliers required by business operations
 */
const STANDARD_SUPPLIERS = [
  'DF IMPORT & EXPORT LTD',
  'JIYANGSUYIFAN INTERNATIONAL TRADE CO. LTD',
  'Beone Mart Trading LLC',
  'Shenzhen Weichenyang CHINA',
  'Guangzhou Huapan Cosmetics',
  'Yuyao Artisans Commodity CO.,LTD',
  'NINGBO HAWARD RAZOR CO.,LTD.',
  'Dongguan Wontravel Electric Co., Ltd'
];

/**
 * High-Capacity Persistent IndexedDB Catalog Database
 * Replaces the 5MB browser localStorage limit with multi-gigabyte local storage capacity.
 * Guarantees zero "no memory to save the record" errors and persistent auto-saving.
 */
const CatalogDB = {
  dbName: 'AlBarkatCatalogDB_v2',
  storeName: 'catalog_records',
  metaStoreName: 'catalog_metadata',
  db: null,

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(this.metaStoreName)) {
            db.createObjectStore(this.metaStoreName, { keyPath: 'key' });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = (e) => {
          console.warn('IndexedDB open error, falling back to memory:', req.error);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB not available:', err);
        resolve(null);
      }
    });
  },

  async getAllProducts() {
    const db = await this.init();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async saveAllProducts(products) {
    const db = await this.init();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([this.storeName, this.metaStoreName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        for (const p of products) {
          store.put(p);
        }
        const metaStore = tx.objectStore(this.metaStoreName);
        metaStore.put({ key: 'last_saved', timestamp: Date.now(), count: products.length });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => {
          console.error('CatalogDB saveAll error:', e);
          resolve(false);
        };
      } catch (e) {
        console.error('Transaction error in CatalogDB:', e);
        resolve(false);
      }
    });
  },

  async putProduct(product) {
    const db = await this.init();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([this.storeName], 'readwrite');
        tx.objectStore(this.storeName).put(product);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  async deleteProduct(id) {
    const db = await this.init();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([this.storeName], 'readwrite');
        tx.objectStore(this.storeName).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
};

/**
 * Persistent IndexedDB Image Cache
 */
const ImageStorageDB = {
  dbName: 'AlBarkatImageCache_v1',
  storeName: 'cached_images',
  db: null,

  async init() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  },

  async save(key, dataUrl) {
    if (!this.db) await this.init();
    if (!this.db || !key || !dataUrl) return;
    try {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      tx.objectStore(this.storeName).put(dataUrl, key.toLowerCase());
    } catch (e) {
      // Silently fall back to relative paths
    }
  },

  async get(key) {
    if (!this.db) await this.init();
    if (!this.db || !key) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], 'readonly');
        const req = tx.objectStore(this.storeName).get(key.toLowerCase());
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
};

/**
 * Intelligent Image Resolver for SKU Images
 */
const ImageResolver = {
  formatImageUrl(url) {
    if (!url) return '';
    // Discard revoked/dead blob URLs from past browser sessions
    if (url.startsWith('blob:')) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const clean = url.replace(/\\/g, '/');
    return encodeURI(clean);
  },

  findImagesForProduct(product, manifest = null) {
    const srcManifest = manifest || (typeof SKU_IMAGE_MANIFEST !== 'undefined' ? SKU_IMAGE_MANIFEST : {});
    if (!srcManifest || Object.keys(srcManifest).length === 0) return { image1: null, image2: null };

    const candidates = [
      product.sku,
      product.alt_sku_1,
      product.alt_sku_2,
      product.alt_sku_3,
      product.saudi_sku ? product.saudi_sku.replace(/^KSA-?/i, '') : null,
      product.barcode,
      product.name
    ].filter(Boolean);

    for (let c of candidates) {
      let key = String(c).trim().toLowerCase();
      if (srcManifest[key]) {
        return {
          image1: srcManifest[key].img1 || srcManifest[key].image1 || null,
          image2: srcManifest[key].img2 || srcManifest[key].image2 || null
        };
      }
      let keyNoDash = key.replace(/-1$/i, '');
      if (srcManifest[keyNoDash]) {
        return {
          image1: srcManifest[keyNoDash].img1 || srcManifest[keyNoDash].image1 || null,
          image2: srcManifest[keyNoDash].img2 || srcManifest[keyNoDash].image2 || null
        };
      }
      let keyWithDash = key + '-1';
      if (srcManifest[keyWithDash]) {
        return {
          image1: srcManifest[keyWithDash].img1 || srcManifest[keyWithDash].image1 || null,
          image2: srcManifest[keyWithDash].img2 || srcManifest[keyWithDash].image2 || null
        };
      }
    }

    // Fuzzy matching on clean alphanumeric SKU
    const manifestKeys = Object.keys(srcManifest);
    if (product.sku) {
      const cleanSku = product.sku.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = manifestKeys.find(k => k.replace(/[^a-z0-9]/g, '') === cleanSku);
      if (found) {
        return {
          image1: srcManifest[found].img1 || srcManifest[found].image1 || null,
          image2: srcManifest[found].img2 || srcManifest[found].image2 || null
        };
      }
    }

    // NOSKU Title matching
    if (product.name) {
      const cleanTitle = product.name.toLowerCase();
      const noskuKey = manifestKeys.find(k => {
        if (!k.startsWith('nosku')) return false;
        const sub = k.replace(/^nosku_?/, '').replace(/-1$/, '').trim();
        return sub.length >= 4 && cleanTitle.includes(sub);
      });
      if (noskuKey) {
        return {
          image1: srcManifest[noskuKey].img1 || srcManifest[noskuKey].image1 || null,
          image2: srcManifest[noskuKey].img2 || srcManifest[noskuKey].image2 || null
        };
      }
    }

    return { image1: null, image2: null };
  },

  autoLinkAll(products, overwrite = false, manifest = null) {
    let linkedCount = 0;
    products.forEach(p => {
      // If current image is dead blob or placeholder, allow overwriting
      const isDead1 = !p.image1 || p.image1.startsWith('blob:') || p.image1.includes('placehold.co') || p.image1.includes('unsplash.com');
      const isDead2 = !p.image2 || p.image2.startsWith('blob:') || p.image2.includes('placehold.co') || p.image2.includes('unsplash.com');

      const { image1, image2 } = this.findImagesForProduct(p, manifest);
      let updated = false;

      if (image1 && (overwrite || isDead1)) {
        p.image1 = image1;
        updated = true;
      }
      if (image2 && (overwrite || isDead2)) {
        p.image2 = image2;
        updated = true;
      }
      if (updated) linkedCount++;
    });
    return linkedCount;
  }
};

class AppState {
  constructor() {
    this.products = [];
    this.activeView = 'table'; // 'table' or 'grid'
    this.searchQuery = '';
    this.filterBrand = 'all';
    this.filterCategory = 'all';
    this.filterSupplier = 'all';
    this.sortColumn = 'name';
    this.sortDirection = 'asc';
    this.currentPage = 1;
    this.pageSize = 10;
    this.selectedIds = new Set();
    
    // Active modal states
    this.currentEditingId = null;
    this.currentViewingId = null;
    this.wizardData = null; // for import wizard
    this.autoLinkPending = []; // for auto link modal
  }

  async loadFromStorage() {
    try {
      const masterData = (typeof ALBARAKAT_CATALOG_DATA !== 'undefined' && Array.isArray(ALBARAKAT_CATALOG_DATA))
        ? ALBARAKAT_CATALOG_DATA
        : [];

      // 1. Try to load from high-capacity IndexedDB first (no 5MB limit!)
      const dbProducts = await CatalogDB.getAllProducts();
      if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
        this.products = dbProducts;

        // Auto-merge: If master catalog contains new products not yet in local DB, import them
        if (masterData.length > 0) {
          const existingIdSet = new Set(this.products.map(p => p.id));
          const newMasterItems = masterData.filter(p => !existingIdSet.has(p.id));
          if (newMasterItems.length > 0) {
            this.products = [...this.products, ...newMasterItems];
            await CatalogDB.saveAllProducts(this.products);
          }
        }

        // Clean up any dead blob URLs from older browser sessions
        this.products.forEach(p => {
          if (p.image1 && p.image1.startsWith('blob:')) p.image1 = '';
          if (p.image2 && p.image2.startsWith('blob:')) p.image2 = '';
        });
        ImageResolver.autoLinkAll(this.products, false);
        return;
      }

      // 2. Check localStorage for any existing user-saved data to migrate
      let migrated = false;
      const stored = localStorage.getItem('albarakat_catalog_v2');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const isDemo = parsed.some(p => p.sku === 'APL-IP15PM-256' || p.sku === 'SAM-S24U-512');
          if (!isDemo && parsed.length > 0) {
            this.products = parsed;
            migrated = true;
          }
        } catch (e) {}
      }

      if (!migrated) {
        const legacyStored = localStorage.getItem('catalog_products_v1');
        if (legacyStored) {
          try {
            const legacyParsed = JSON.parse(legacyStored);
            const isDemo = legacyParsed.some(p => p.sku === 'APL-IP15PM-256' || p.sku === 'SAM-S24U-512');
            if (!isDemo && legacyParsed.length > 10) {
              this.products = legacyParsed;
              migrated = true;
            }
          } catch (e) {}
        }
      }

      // 3. Fallback: Load Master Catalog from initial-catalog.js (846 products)
      if (!migrated) {
        this.products = JSON.parse(JSON.stringify(masterData));
        ImageResolver.autoLinkAll(this.products, true);
      }

      // Sanitize blobs
      this.products.forEach(p => {
        if (p.image1 && p.image1.startsWith('blob:')) p.image1 = '';
        if (p.image2 && p.image2.startsWith('blob:')) p.image2 = '';
      });

      // Save directly to high-capacity IndexedDB!
      await CatalogDB.saveAllProducts(this.products);

      // Clean out bloated localStorage keys to avoid future quota errors
      try {
        localStorage.removeItem('albarakat_catalog_v2');
        localStorage.removeItem('catalog_products_v1');
      } catch (e) {}

    } catch (e) {
      console.error('Failed to load from storage:', e);
      if (typeof ALBARAKAT_CATALOG_DATA !== 'undefined') {
        this.products = JSON.parse(JSON.stringify(ALBARAKAT_CATALOG_DATA));
      } else {
        this.products = [];
      }
    }
  }

  saveToStorage() {
    // Real-time asynchronous auto-save to IndexedDB with visual indicator
    AppUI.updateSaveStatus('saving');
    CatalogDB.saveAllProducts(this.products).then(success => {
      if (success) {
        AppUI.updateSaveStatus('saved');
      } else {
        AppUI.updateSaveStatus('error');
      }
    }).catch(err => {
      console.error('Auto-save error:', err);
      AppUI.updateSaveStatus('error');
    });
  }

  async clearAllProducts() {
    this.products = [];
    await CatalogDB.saveAllProducts([]);
    this.saveToStorage();
    this.selectedIds.clear();
    this.currentPage = 1;
  }

  getFilteredProducts() {
    const q = this.searchQuery.trim().toLowerCase();

    return this.products.filter(p => {
      // Search matching across all 13 fields
      if (q) {
        const match =
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.supplier_code && p.supplier_code.toLowerCase().includes(q)) ||
          (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
          (p.saudi_sku && p.saudi_sku.toLowerCase().includes(q)) ||
          (p.alt_sku_1 && p.alt_sku_1.toLowerCase().includes(q)) ||
          (p.alt_sku_2 && p.alt_sku_2.toLowerCase().includes(q)) ||
          (p.alt_sku_3 && p.alt_sku_3.toLowerCase().includes(q));

        if (!match) return false;
      }

      // Brand filter
      if (this.filterBrand !== 'all' && p.brand !== this.filterBrand) {
        return false;
      }

      // Category filter
      if (this.filterCategory !== 'all' && p.category !== this.filterCategory) {
        return false;
      }

      // Supplier filter
      if (this.filterSupplier !== 'all' && p.supplier_name !== this.filterSupplier) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = (a[this.sortColumn] || '').toString().toLowerCase();
      let valB = (b[this.sortColumn] || '').toString().toLowerCase();

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getPaginatedProducts() {
    const filtered = this.getFilteredProducts();
    const totalPages = Math.ceil(filtered.length / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    const items = filtered.slice(start, start + this.pageSize);

    return {
      items,
      totalCount: filtered.length,
      totalPages,
      currentPage: this.currentPage
    };
  }

  getUniqueBrands() {
    const list = [...STANDARD_BRANDS, ...this.products.map(p => p.brand).filter(Boolean)];
    const set = new Set(list.map(s => String(s).trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  getUniqueCategories() {
    const set = new Set(this.products.map(p => String(p.category || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  getUniqueSuppliers() {
    const list = [...STANDARD_SUPPLIERS, ...this.products.map(p => p.supplier_name).filter(Boolean)];
    const set = new Set(list.map(s => String(s).trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
}

const state = new AppState();

/**
 * Barcode Drawing Helper
 */
const BarcodeHelper = {
  renderBarcodeToSvg(svgElement, value, format = 'CODE128') {
    if (!svgElement) return;
    const cleanVal = String(value || '').trim();
    if (!cleanVal) {
      svgElement.innerHTML = '';
      return;
    }

    if (typeof JsBarcode !== 'undefined') {
      try {
        JsBarcode(svgElement, cleanVal, {
          format: 'CODE128',
          lineColor: '#1e293b',
          width: 1.5,
          height: 38,
          displayValue: true,
          fontSize: 12,
          margin: 4
        });
        return;
      } catch (e) {
        // Fall through to fallback renderer
      }
    }

    // Pure SVG fallback renderer if JsBarcode is offline/error
    this.renderFallbackBarcodeSvg(svgElement, cleanVal);
  },

  renderFallbackBarcodeSvg(svgElement, value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash << 5) - hash + value.charCodeAt(i);
    
    let barsHtml = '';
    let x = 10;
    for (let i = 0; i < 35; i++) {
      const bit = Math.abs(hash ^ (i * 1337)) % 3;
      if (bit > 0) {
        barsHtml += `<rect x="${x}" y="5" width="${bit * 1.5}" height="28" fill="#1e293b" />`;
      }
      x += (bit > 0 ? bit * 1.5 : 2) + 2;
    }

    svgElement.setAttribute('viewBox', `0 0 ${x + 10} 48`);
    svgElement.innerHTML = `
      ${barsHtml}
      <text x="${(x + 10) / 2}" y="44" text-anchor="middle" font-family="monospace" font-size="10" fill="#475569">${AppUI.escapeHtml(value)}</text>
    `;
  }
};

/**
 * UI Renderer and Event Controller
 */
const AppUI = {
  _suggestedImages: null,

  async init() {
    ImageStorageDB.init();
    await state.loadFromStorage();
    this.bindEvents();
    this.render();
    this.updateSaveStatus('saved');
  },

  updateSaveStatus(status = 'saved') {
    const indicator = document.getElementById('autoSaveIndicator');
    const text = document.getElementById('autoSaveText');
    if (!indicator || !text) return;

    if (status === 'saving') {
      indicator.className = 'autosave-badge saving';
      indicator.title = 'Saving data to IndexedDB...';
      text.textContent = 'Auto-saving...';
    } else if (status === 'error') {
      indicator.className = 'autosave-badge error';
      indicator.title = 'Failed to auto-save to browser storage';
      text.textContent = 'Auto-save error';
    } else {
      indicator.className = 'autosave-badge';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      indicator.title = `All records permanently saved in browser IndexedDB (Last auto-saved: ${timeStr})`;
      text.textContent = `All changes auto-saved (${timeStr})`;
    }
  },

  populateFormSuggestions(selectedBrand = '', selectedCategory = '', selectedSupplier = '') {
    // 1. Brand Suggestions and Quick Chips
    const brandDatalist = document.getElementById('brandSuggestionsList');
    const brandQuickPicks = document.getElementById('brandQuickPicks');
    const brandInput = document.getElementById('formBrand');
    const allBrands = state.getUniqueBrands();

    if (brandDatalist) {
      brandDatalist.innerHTML = allBrands.map(b => `<option value="${this.escapeHtml(b)}"></option>`).join('');
    }

    if (brandQuickPicks && brandInput) {
      const displayBrands = ['Homecare', 'Redblossom', 'NeoOrbit', ...allBrands.filter(b => !STANDARD_BRANDS.includes(b))].slice(0, 6);
      brandQuickPicks.innerHTML = displayBrands.map(b => {
        const isActive = (selectedBrand && selectedBrand.toLowerCase() === b.toLowerCase());
        return `<button type="button" class="quick-chip-btn ${isActive ? 'active' : ''}" data-brand="${this.escapeHtml(b)}">${this.escapeHtml(b)}</button>`;
      }).join('');

      brandQuickPicks.querySelectorAll('.quick-chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const val = btn.getAttribute('data-brand');
          brandInput.value = val;
          brandQuickPicks.querySelectorAll('.quick-chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      brandInput.oninput = () => {
        const val = brandInput.value.trim().toLowerCase();
        brandQuickPicks.querySelectorAll('.quick-chip-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-brand').toLowerCase() === val);
        });
      };
    }

    // 2. Category Suggestions and Quick Chips
    const catDatalist = document.getElementById('categorySuggestionsList');
    const catQuickPicks = document.getElementById('categoryQuickPicks');
    const catInput = document.getElementById('formCategory');
    const allCategories = state.getUniqueCategories();

    if (catDatalist) {
      catDatalist.innerHTML = allCategories.map(c => `<option value="${this.escapeHtml(c)}"></option>`).join('');
    }

    if (catQuickPicks && catInput) {
      const displayCategories = allCategories.slice(0, 6);
      catQuickPicks.innerHTML = displayCategories.map(c => {
        const isActive = (selectedCategory && selectedCategory.toLowerCase() === c.toLowerCase());
        return `<button type="button" class="quick-chip-btn ${isActive ? 'active' : ''}" data-cat="${this.escapeHtml(c)}">${this.escapeHtml(c)}</button>`;
      }).join('');

      catQuickPicks.querySelectorAll('.quick-chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const val = btn.getAttribute('data-cat');
          catInput.value = val;
          catQuickPicks.querySelectorAll('.quick-chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      catInput.oninput = () => {
        const val = catInput.value.trim().toLowerCase();
        catQuickPicks.querySelectorAll('.quick-chip-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-cat').toLowerCase() === val);
        });
      };
    }

    // 3. Supplier Suggestions and Quick Chips
    const suppDatalist = document.getElementById('supplierSuggestionsList');
    const suppQuickPicks = document.getElementById('supplierQuickPicks');
    const suppInput = document.getElementById('formSupplierName');
    const allSuppliers = state.getUniqueSuppliers();

    if (suppDatalist) {
      suppDatalist.innerHTML = allSuppliers.map(s => `<option value="${this.escapeHtml(s)}"></option>`).join('');
    }

    if (suppQuickPicks && suppInput) {
      const displaySuppliers = STANDARD_SUPPLIERS.slice(0, 5);
      suppQuickPicks.innerHTML = displaySuppliers.map(s => {
        const isActive = (selectedSupplier && selectedSupplier.toLowerCase() === s.toLowerCase());
        const shortName = s.length > 25 ? s.substring(0, 22) + '...' : s;
        return `<button type="button" class="quick-chip-btn ${isActive ? 'active' : ''}" data-supplier="${this.escapeHtml(s)}" title="${this.escapeHtml(s)}">${this.escapeHtml(shortName)}</button>`;
      }).join('');

      suppQuickPicks.querySelectorAll('.quick-chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const val = btn.getAttribute('data-supplier');
          suppInput.value = val;
          suppQuickPicks.querySelectorAll('.quick-chip-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      suppInput.oninput = () => {
        const val = suppInput.value.trim().toLowerCase();
        suppQuickPicks.querySelectorAll('.quick-chip-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-supplier').toLowerCase() === val);
        });
      };
    }
  },

  bindEvents() {
    // Search input with instant reactivity
    const searchInput = document.getElementById('globalSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        state.currentPage = 1;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
        this.renderCatalog();
        this.renderStats();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        state.currentPage = 1;
        this.renderCatalog();
        this.renderStats();
      });
    }

    // Filter selectors
    const filterBrand = document.getElementById('filterBrand');
    if (filterBrand) {
      filterBrand.addEventListener('change', (e) => {
        state.filterBrand = e.target.value;
        state.currentPage = 1;
        this.renderCatalog();
        this.renderActiveFilterChips();
      });
    }

    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
      filterCategory.addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        state.currentPage = 1;
        this.renderCatalog();
        this.renderActiveFilterChips();
      });
    }

    const filterSupplier = document.getElementById('filterSupplier');
    if (filterSupplier) {
      filterSupplier.addEventListener('change', (e) => {
        state.filterSupplier = e.target.value;
        state.currentPage = 1;
        this.renderCatalog();
        this.renderActiveFilterChips();
      });
    }

    // View toggles
    document.getElementById('viewTableBtn')?.addEventListener('click', () => this.switchView('table'));
    document.getElementById('viewGridBtn')?.addEventListener('click', () => this.switchView('grid'));

    // Top action buttons
    document.getElementById('btnNewProduct')?.addEventListener('click', () => this.openProductModal());
    document.getElementById('btnImportModal')?.addEventListener('click', () => this.openImportModal());
    document.getElementById('btnExportModal')?.addEventListener('click', () => this.openExportModal());
    document.getElementById('btnPrintBarcodes')?.addEventListener('click', () => this.openBarcodePrintModal());
    document.getElementById('btnAutoLinkImages')?.addEventListener('click', () => this.openAutoLinkModal());
    document.getElementById('btnSaveCatalogFile')?.addEventListener('click', () => this.downloadUpdatedCatalogFile());

    // Bulk folder input listener for auto linking
    this.setupBulkFolderPicker();

    // Product Modal form events
    document.getElementById('productForm')?.addEventListener('submit', (e) => this.handleProductFormSubmit(e));
    document.getElementById('formBarcode')?.addEventListener('input', (e) => {
      BarcodeHelper.renderBarcodeToSvg(document.getElementById('formLiveBarcode'), e.target.value || 'SAMPLE-BARCODE');
    });

    document.getElementById('formSku')?.addEventListener('input', (e) => {
      this.checkSkuImageSuggestions(e.target.value);
    });

    // Image upload handlers in Product form
    this.setupImageUploader('image1');
    this.setupImageUploader('image2');

    // Import Wizard file dropzone
    this.setupImportDropzone();

    // Close buttons on all modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) modal.classList.remove('show');
      });
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.show').forEach(m => m.classList.remove('show'));
      }
    });

    // Select all rows checkbox
    document.getElementById('selectAllRows')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const { items } = state.getPaginatedProducts();
      items.forEach(p => {
        if (isChecked) state.selectedIds.add(p.id);
        else state.selectedIds.delete(p.id);
      });
      this.renderCatalog();
    });
  },

  /**
   * Auto-Link Images Manager
   */
  openAutoLinkModal() {
    const modal = document.getElementById('autoLinkImagesModal');
    if (!modal) return;

    document.getElementById('autoLinkStatsBar').style.display = 'none';
    document.getElementById('autoLinkPreviewContainer').style.display = 'none';
    document.getElementById('btnApplyAutoLink').style.display = 'none';
    state.autoLinkPending = [];

    modal.classList.add('show');
  },

  setupBulkFolderPicker() {
    const fileInput = document.getElementById('bulkFolderInput');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|gif|svg)$/i));
      if (files.length === 0) {
        this.showToast('No image files found in selected folder.', 'warning');
        return;
      }

      this.processSelectedImageFiles(files);
    });
  },

  processSelectedImageFiles(files) {
    const fileMap = {};

    // Index selected files and cache them permanently
    files.forEach(f => {
      const name = f.name;
      const base = name.substring(0, name.lastIndexOf('.')) || name;
      const isImg2 = name.includes('_img2');
      const cleanKey = base.toLowerCase().replace(/_img[12]/g, '').replace(/-1$/g, '').trim();

      // Permanent relative path
      const permanentPath = `sku_images/${name}`;

      // Cache file data into IndexedDB for persistent offline retrieval
      const reader = new FileReader();
      reader.onload = (e) => {
        ImageStorageDB.save(permanentPath, e.target.result);
        ImageStorageDB.save(name, e.target.result);
      };
      reader.readAsDataURL(f);

      if (!fileMap[cleanKey]) {
        fileMap[cleanKey] = { img1: null, img2: null, name1: null, name2: null };
      }

      if (isImg2) {
        fileMap[cleanKey].img2 = permanentPath;
        fileMap[cleanKey].name2 = name;
      } else {
        fileMap[cleanKey].img1 = permanentPath;
        fileMap[cleanKey].name1 = name;
      }
    });

    // Run matching against catalog
    let matchedProducts = 0;
    let matchedImg1 = 0;
    let matchedImg2 = 0;
    const matchedList = [];

    state.products.forEach(p => {
      const cleanSku = p.sku.toLowerCase().replace(/-1$/g, '').trim();
      const candidates = [
        cleanSku,
        p.sku.toLowerCase(),
        p.alt_sku_1 ? p.alt_sku_1.toLowerCase().replace(/-1$/g, '') : null,
        p.alt_sku_2 ? p.alt_sku_2.toLowerCase().replace(/-1$/g, '') : null,
        p.alt_sku_3 ? p.alt_sku_3.toLowerCase().replace(/-1$/g, '') : null,
        p.saudi_sku ? p.saudi_sku.toLowerCase().replace(/^ksa-?/i, '').replace(/-1$/g, '') : null,
        p.barcode ? p.barcode.trim().toLowerCase() : null
      ].filter(Boolean);

      let found = null;
      for (let c of candidates) {
        if (fileMap[c]) {
          found = fileMap[c];
          break;
        }
      }

      // Try title match for NOSKU
      if (!found && p.name) {
        const cleanTitle = p.name.toLowerCase();
        for (let k in fileMap) {
          if (k.startsWith('nosku') && cleanTitle.includes(k.replace(/^nosku_?/, ''))) {
            found = fileMap[k];
            break;
          }
        }
      }

      if (found && (found.img1 || found.img2)) {
        matchedProducts++;
        if (found.img1) matchedImg1++;
        if (found.img2) matchedImg2++;

        matchedList.push({
          product: p,
          img1: found.img1,
          img2: found.img2,
          name1: found.name1,
          name2: found.name2
        });
      }
    });

    state.autoLinkPending = matchedList;

    // Display Stats
    document.getElementById('statFilesScanned').textContent = files.length;
    document.getElementById('statProductsMatched').textContent = matchedProducts;
    document.getElementById('statImage1Matched').textContent = matchedImg1;
    document.getElementById('statImage2Matched').textContent = matchedImg2;
    document.getElementById('autoLinkStatsBar').style.display = 'grid';

    // Render Preview
    const tbody = document.getElementById('autoLinkPreviewBody');
    if (tbody) {
      tbody.innerHTML = matchedList.slice(0, 10).map(m => `
        <tr>
          <td>
            <div class="w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
              <img src="${ImageResolver.formatImageUrl(m.img1 || m.img2)}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/50x50?text=IMG'" />
            </div>
          </td>
          <td class="font-mono font-bold">${this.escapeHtml(m.product.sku)}</td>
          <td class="truncate max-w-[180px]">${this.escapeHtml(m.product.name)}</td>
          <td class="text-slate-500 font-mono">${this.escapeHtml(m.name1 || '—')}</td>
          <td class="text-slate-500 font-mono">${this.escapeHtml(m.name2 || '—')}</td>
        </tr>
      `).join('');
    }

    document.getElementById('autoLinkPreviewContainer').style.display = 'block';
    const applyBtn = document.getElementById('btnApplyAutoLink');
    if (applyBtn) {
      applyBtn.textContent = `✓ Apply Images to Catalog (${matchedProducts} Items)`;
      applyBtn.style.display = 'inline-flex';
    }

    this.showToast(`Found matching photos for ${matchedProducts} catalog products!`, 'success');
  },

  runManifestAutoMatch() {
    const manifest = (typeof SKU_IMAGE_MANIFEST !== 'undefined') ? SKU_IMAGE_MANIFEST : {};
    const totalManifestKeys = Object.keys(manifest).length;

    let matchedProducts = 0;
    let matchedImg1 = 0;
    let matchedImg2 = 0;
    const matchedList = [];

    state.products.forEach(p => {
      const imgs = ImageResolver.findImagesForProduct(p, manifest);
      if (imgs.image1 || imgs.image2) {
        matchedProducts++;
        if (imgs.image1) matchedImg1++;
        if (imgs.image2) matchedImg2++;

        matchedList.push({
          product: p,
          img1: imgs.image1,
          img2: imgs.image2,
          name1: imgs.image1 ? imgs.image1.split('/').pop() : '',
          name2: imgs.image2 ? imgs.image2.split('/').pop() : ''
        });
      }
    });

    state.autoLinkPending = matchedList;

    document.getElementById('statFilesScanned').textContent = totalManifestKeys;
    document.getElementById('statProductsMatched').textContent = matchedProducts;
    document.getElementById('statImage1Matched').textContent = matchedImg1;
    document.getElementById('statImage2Matched').textContent = matchedImg2;
    document.getElementById('autoLinkStatsBar').style.display = 'grid';

    const tbody = document.getElementById('autoLinkPreviewBody');
    if (tbody) {
      tbody.innerHTML = matchedList.slice(0, 10).map(m => `
        <tr>
          <td>
            <div class="w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center">
              <img src="${ImageResolver.formatImageUrl(m.img1 || m.img2)}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/50x50?text=IMG'" />
            </div>
          </td>
          <td class="font-mono font-bold">${this.escapeHtml(m.product.sku)}</td>
          <td class="truncate max-w-[180px]">${this.escapeHtml(m.product.name)}</td>
          <td class="text-slate-500 font-mono">${this.escapeHtml(m.name1 || '—')}</td>
          <td class="text-slate-500 font-mono">${this.escapeHtml(m.name2 || '—')}</td>
        </tr>
      `).join('');
    }

    document.getElementById('autoLinkPreviewContainer').style.display = 'block';
    const applyBtn = document.getElementById('btnApplyAutoLink');
    if (applyBtn) {
      applyBtn.textContent = `✓ Apply Images to Catalog (${matchedProducts} Items)`;
      applyBtn.style.display = 'inline-flex';
    }

    this.showToast(`Scanned built-in directory: ${matchedProducts} products matched!`, 'info');
  },

  applyAutoLinkResults() {
    if (!state.autoLinkPending || state.autoLinkPending.length === 0) {
      this.showToast('No matching image results to apply.', 'warning');
      return;
    }

    const overwrite = document.getElementById('chkOverwriteImages')?.checked ?? true;
    let appliedCount = 0;

    state.autoLinkPending.forEach(m => {
      const idx = state.products.findIndex(p => p.id === m.product.id);
      if (idx !== -1) {
        // ALWAYS store permanent relative paths (sku_images/...), NEVER temporary blob URLs
        if (m.img1 && (overwrite || !state.products[idx].image1 || state.products[idx].image1.startsWith('blob:'))) {
          state.products[idx].image1 = m.img1;
        }
        if (m.img2 && (overwrite || !state.products[idx].image2 || state.products[idx].image2.startsWith('blob:'))) {
          state.products[idx].image2 = m.img2;
        }
        appliedCount++;
      }
    });

    state.saveToStorage();
    this.render();

    document.getElementById('autoLinkImagesModal')?.classList.remove('show');
    this.showToast(`⚡ Successfully linked and permanently saved images for ${appliedCount} products!`, 'success');
  },

  downloadUpdatedCatalogFile() {
    const jsonStr = JSON.stringify(state.products, null, 2);
    const jsContent = `/** Preloaded Al Barakat Catalog with all 13 fields and image paths **/\nconst ALBARAKAT_CATALOG_DATA = ${jsonStr};\n`;
    ImportExportManager.downloadBlob(
      new Blob([jsContent], { type: 'text/javascript;charset=utf-8;' }),
      'initial-catalog.js'
    );
    this.showToast('Downloaded "initial-catalog.js"! Your records are already auto-saved in this browser, and this file lets you sync to any computer.', 'success');
  },

  render() {
    this.renderStats();
    this.renderFilterDropdowns();
    this.renderActiveFilterChips();
    this.renderCatalog();
  },

  renderStats() {
    const totalItems = state.products.length;
    const totalBrands = state.getUniqueBrands().length;
    const totalCategories = state.getUniqueCategories().length;
    const totalSuppliers = state.getUniqueSuppliers().length;

    document.getElementById('statTotalItems').textContent = totalItems.toLocaleString();
    document.getElementById('statTotalBrands').textContent = totalBrands.toLocaleString();
    document.getElementById('statTotalCategories').textContent = totalCategories.toLocaleString();
    document.getElementById('statTotalSuppliers').textContent = totalSuppliers.toLocaleString();
  },

  renderFilterDropdowns() {
    const brandSelect = document.getElementById('filterBrand');
    const catSelect = document.getElementById('filterCategory');
    const suppSelect = document.getElementById('filterSupplier');

    if (brandSelect) {
      const current = state.filterBrand;
      brandSelect.innerHTML = '<option value="all">All Brands</option>' +
        state.getUniqueBrands().map(b => `<option value="${this.escapeHtml(b)}" ${b === current ? 'selected' : ''}>${this.escapeHtml(b)}</option>`).join('');
    }

    if (catSelect) {
      const current = state.filterCategory;
      catSelect.innerHTML = '<option value="all">All Categories</option>' +
        state.getUniqueCategories().map(c => `<option value="${this.escapeHtml(c)}" ${c === current ? 'selected' : ''}>${this.escapeHtml(c)}</option>`).join('');
    }

    if (suppSelect) {
      const current = state.filterSupplier;
      suppSelect.innerHTML = '<option value="all">All Suppliers</option>' +
        state.getUniqueSuppliers().map(s => `<option value="${this.escapeHtml(s)}" ${s === current ? 'selected' : ''}>${this.escapeHtml(s)}</option>`).join('');
    }
  },

  renderActiveFilterChips() {
    const container = document.getElementById('activeFilterChips');
    if (!container) return;

    let chips = [];
    if (state.filterBrand !== 'all') {
      chips.push({ label: `Brand: ${state.filterBrand}`, key: 'brand' });
    }
    if (state.filterCategory !== 'all') {
      chips.push({ label: `Category: ${state.filterCategory}`, key: 'category' });
    }
    if (state.filterSupplier !== 'all') {
      chips.push({ label: `Supplier: ${state.filterSupplier}`, key: 'supplier' });
    }

    if (chips.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = '<span class="text-xs text-slate-500 font-semibold mr-1">Active Filters:</span>' +
      chips.map(c => `
        <span class="filter-chip">
          ${this.escapeHtml(c.label)}
          <button onclick="AppUI.clearFilter('${c.key}')" title="Remove filter">&times;</button>
        </span>
      `).join('') +
      `<button class="text-xs text-blue-600 hover:underline ml-2 cursor-pointer font-medium" onclick="AppUI.clearAllFilters()">Reset All</button>`;
  },

  clearFilter(key) {
    if (key === 'brand') state.filterBrand = 'all';
    if (key === 'category') state.filterCategory = 'all';
    if (key === 'supplier') state.filterSupplier = 'all';
    this.renderFilterDropdowns();
    this.renderActiveFilterChips();
    this.renderCatalog();
  },

  clearAllFilters() {
    state.filterBrand = 'all';
    state.filterCategory = 'all';
    state.filterSupplier = 'all';
    state.searchQuery = '';
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    this.renderFilterDropdowns();
    this.renderActiveFilterChips();
    this.renderCatalog();
  },

  switchView(viewMode) {
    state.activeView = viewMode;
    document.getElementById('viewTableBtn')?.classList.toggle('active', viewMode === 'table');
    document.getElementById('viewGridBtn')?.classList.toggle('active', viewMode === 'grid');
    this.renderCatalog();
  },

  renderCatalog() {
    const { items, totalCount, totalPages, currentPage } = state.getPaginatedProducts();
    const tableWrapper = document.getElementById('tableWrapper');
    const gridWrapper = document.getElementById('gridWrapper');
    const emptyState = document.getElementById('catalogEmptyState');
    const paginationContainer = document.getElementById('paginationControls');
    const paginationInfo = document.getElementById('paginationInfo');

    if (totalCount === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (gridWrapper) gridWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 items';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    if (state.activeView === 'table') {
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (gridWrapper) gridWrapper.style.display = 'none';
      this.renderTableRows(items);
    } else {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (gridWrapper) gridWrapper.style.display = 'grid';
      this.renderGridCards(items);
    }

    // Render Pagination
    const startNum = (currentPage - 1) * state.pageSize + 1;
    const endNum = Math.min(currentPage * state.pageSize, totalCount);
    if (paginationInfo) {
      paginationInfo.innerHTML = `Showing <b>${startNum} - ${endNum}</b> of <b>${totalCount}</b> products`;
    }

    if (paginationContainer) {
      let pageHtml = `
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="AppUI.goToPage(${currentPage - 1})" title="Previous Page">
          &lt;
        </button>
      `;
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
          pageHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="AppUI.goToPage(${p})">${p}</button>`;
        } else if (p === currentPage - 3 || p === currentPage + 3) {
          pageHtml += `<span class="px-1 text-slate-400">...</span>`;
        }
      }
      pageHtml += `
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="AppUI.goToPage(${currentPage + 1})" title="Next Page">
          &gt;
        </button>
      `;
      paginationContainer.innerHTML = pageHtml;
    }
  },

  renderTableRows(items) {
    const tbody = document.getElementById('catalogTableBody');
    if (!tbody) return;

    tbody.innerHTML = items.map(p => {
      const isSelected = state.selectedIds.has(p.id);
      const rawImg = p.image1 || p.image2;
      const imgUrl = rawImg ? ImageResolver.formatImageUrl(rawImg) : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="%23cbd5e1" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
      const imgCount = (p.image1 ? 1 : 0) + (p.image2 ? 1 : 0);
      const altSkus = [p.alt_sku_1, p.alt_sku_2, p.alt_sku_3].filter(Boolean);

      return `
        <tr class="${isSelected ? 'bg-blue-50/50' : ''}">
          <td style="width: 40px; text-align: center;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="AppUI.toggleRowSelect('${p.id}', this.checked)" />
          </td>
          <td style="width: 64px;">
            <div class="thumb-box" onclick="AppUI.openProductView('${p.id}')" title="Click to view details">
              <img src="${imgUrl}" alt="${this.escapeHtml(p.name)}" onerror="this.src='https://placehold.co/100x100?text=No+Image'" />
              ${imgCount > 1 ? `<span class="thumb-count-badge">2 img</span>` : ''}
            </div>
          </td>
          <td>
            <div class="item-main-info">
              <span class="item-main-name cursor-pointer hover:text-blue-600" onclick="AppUI.openProductView('${p.id}')">${this.escapeHtml(p.name)}</span>
              <div class="item-brand-cat">
                <span class="badge badge-brand">${this.escapeHtml(p.brand || 'Al Barakat')}</span>
                <span class="badge badge-category">${this.escapeHtml(p.category || 'General')}</span>
              </div>
            </div>
          </td>
          <td>
            <div class="sku-group">
              <div class="sku-primary">
                <span class="badge badge-sku">${this.escapeHtml(p.sku)}</span>
                <button class="copy-icon-btn" onclick="AppUI.copyText('${this.escapeHtml(p.sku)}', 'SKU copied!')" title="Copy SKU">
                  📋
                </button>
              </div>
              ${p.saudi_sku ? `
                <div class="flex items-center gap-1 mt-1">
                  <span class="badge badge-saudi" title="Saudi SKU">🇸🇦 ${this.escapeHtml(p.saudi_sku)}</span>
                </div>
              ` : ''}
            </div>
          </td>
          <td>
            ${altSkus.length > 0 ? `
              <div class="alt-skus-container">
                ${altSkus.map((alt, i) => `<span class="badge badge-alt" title="Alt SKU ${i+1}">${this.escapeHtml(alt)}</span>`).join('')}
              </div>
            ` : `<span class="text-xs text-slate-400">—</span>`}
          </td>
          <td>
            ${p.barcode ? `
              <div class="barcode-preview-box" title="Barcode: ${this.escapeHtml(p.barcode)}">
                <svg id="barcode-table-${p.id}" class="barcode-svg-mini"></svg>
                <div class="flex items-center gap-1">
                  <span class="text-xs font-mono text-slate-600">${this.escapeHtml(p.barcode)}</span>
                  <button class="copy-icon-btn" onclick="AppUI.copyText('${this.escapeHtml(p.barcode)}', 'Barcode copied!')" title="Copy Barcode">📋</button>
                </div>
              </div>
            ` : `<span class="text-xs text-slate-400">—</span>`}
          </td>
          <td>
            <div>
              <div class="font-medium text-slate-800 text-xs">${this.escapeHtml(p.supplier_name || 'AL BARAKAT TRADING LLC')}</div>
              ${p.supplier_code ? `<span class="badge badge-supplier mt-1 font-mono">${this.escapeHtml(p.supplier_code)}</span>` : ''}
            </div>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" onclick="AppUI.openProductView('${p.id}')" title="View Details">👁</button>
              <button class="btn-icon" onclick="AppUI.openProductModal('${p.id}')" title="Edit Product">✏</button>
              <button class="btn-icon" onclick="AppUI.duplicateProduct('${p.id}')" title="Duplicate">📑</button>
              <button class="btn-icon text-red-500 hover:text-red-700" onclick="AppUI.deleteProduct('${p.id}')" title="Delete">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Trigger barcode SVGs rendering in table
    items.forEach(p => {
      if (p.barcode) {
        BarcodeHelper.renderBarcodeToSvg(document.getElementById(`barcode-table-${p.id}`), p.barcode);
      }
    });
  },

  renderGridCards(items) {
    const grid = document.getElementById('gridWrapper');
    if (!grid) return;

    grid.innerHTML = items.map(p => {
      const img1 = p.image1 ? ImageResolver.formatImageUrl(p.image1) : 'https://placehold.co/400x300?text=No+Image+1';
      const img2 = p.image2 ? ImageResolver.formatImageUrl(p.image2) : '';
      const altSkus = [p.alt_sku_1, p.alt_sku_2, p.alt_sku_3].filter(Boolean);

      return `
        <div class="product-card" id="card-${p.id}">
          <div class="card-image-area">
            <img id="card-img-${p.id}" src="${img1}" alt="${this.escapeHtml(p.name)}" onerror="this.src='https://placehold.co/400x300?text=Image+Error'" />
            <span class="badge badge-brand card-brand-badge">${this.escapeHtml(p.brand || 'Al Barakat')}</span>
            ${p.saudi_sku ? `<span class="badge badge-saudi card-saudi-badge">🇸🇦 ${this.escapeHtml(p.saudi_sku)}</span>` : ''}
            
            ${img2 ? `
              <div class="card-img-switcher">
                <span class="card-img-dot active" onclick="AppUI.switchCardImg('${p.id}', '${img1}', 0)" title="Image 1"></span>
                <span class="card-img-dot" onclick="AppUI.switchCardImg('${p.id}', '${img2}', 1)" title="Image 2"></span>
              </div>
            ` : ''}
          </div>

          <div class="card-body">
            <span class="badge badge-category w-fit">${this.escapeHtml(p.category || 'General')}</span>
            <h3 class="card-title cursor-pointer hover:text-blue-600" onclick="AppUI.openProductView('${p.id}')">${this.escapeHtml(p.name)}</h3>
            
            <div class="card-sku-row">
              <span class="text-xs text-slate-500 font-medium">SKU:</span>
              <div class="flex items-center gap-1">
                <span class="badge badge-sku">${this.escapeHtml(p.sku)}</span>
                <button class="copy-icon-btn" onclick="AppUI.copyText('${this.escapeHtml(p.sku)}', 'SKU copied!')">📋</button>
              </div>
            </div>

            ${altSkus.length > 0 ? `
              <div>
                <div class="text-xs text-slate-400 mb-1 font-medium">Alternative SKUs:</div>
                <div class="card-alt-skus">
                  ${altSkus.map(a => `<span class="badge badge-alt">${this.escapeHtml(a)}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${p.barcode ? `
              <div class="card-barcode-wrap">
                <svg id="barcode-card-${p.id}"></svg>
              </div>
            ` : ''}

            <div class="text-xs text-slate-600 flex justify-between items-center mt-auto pt-2 border-t border-slate-100">
              <span class="font-medium truncate" title="Supplier">${this.escapeHtml(p.supplier_name || 'AL BARAKAT TRADING LLC')}</span>
              ${p.supplier_code ? `<span class="badge badge-supplier font-mono">${this.escapeHtml(p.supplier_code)}</span>` : ''}
            </div>
          </div>

          <div class="card-footer">
            <button class="btn btn-secondary btn-sm" onclick="AppUI.openProductView('${p.id}')">View Details</button>
            <div class="flex gap-1">
              <button class="btn-icon" onclick="AppUI.openProductModal('${p.id}')" title="Edit">✏</button>
              <button class="btn-icon" onclick="AppUI.duplicateProduct('${p.id}')" title="Duplicate">📑</button>
              <button class="btn-icon text-red-500 hover:text-red-700" onclick="AppUI.deleteProduct('${p.id}')" title="Delete">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Trigger barcodes rendering in grid cards
    items.forEach(p => {
      if (p.barcode) {
        BarcodeHelper.renderBarcodeToSvg(document.getElementById(`barcode-card-${p.id}`), p.barcode);
      }
    });
  },

  switchCardImg(productId, src, index) {
    const img = document.getElementById(`card-img-${productId}`);
    if (img) img.src = src;
    const card = document.getElementById(`card-${productId}`);
    if (card) {
      const dots = card.querySelectorAll('.card-img-dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    }
  },

  goToPage(page) {
    state.currentPage = page;
    this.renderCatalog();
    window.scrollTo({ top: 180, behavior: 'smooth' });
  },

  toggleRowSelect(id, isSelected) {
    if (isSelected) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
  },

  /**
   * Product Modal Create/Edit
   */
  openProductModal(productId = null) {
    state.currentEditingId = productId;
    const modal = document.getElementById('productFormModal');
    const form = document.getElementById('productForm');
    const modalTitle = document.getElementById('productModalTitle');
    const suggestionBox = document.getElementById('formImageSuggestionBox');
    if (!modal || !form) return;

    form.reset();
    if (suggestionBox) suggestionBox.style.display = 'none';
    this._suggestedImages = null;
    this.resetImageUploader('image1');
    this.resetImageUploader('image2');

    if (productId) {
      const product = state.products.find(p => p.id === productId);
      if (!product) return;

      modalTitle.textContent = 'Edit Product';
      document.getElementById('formBrand').value = product.brand || '';
      document.getElementById('formCategory').value = product.category || '';
      document.getElementById('formSku').value = product.sku || '';
      document.getElementById('formName').value = product.name || '';
      document.getElementById('formBarcode').value = product.barcode || '';
      document.getElementById('formSupplierCode').value = product.supplier_code || '';
      document.getElementById('formAltSku1').value = product.alt_sku_1 || '';
      document.getElementById('formAltSku2').value = product.alt_sku_2 || '';
      document.getElementById('formAltSku3').value = product.alt_sku_3 || '';
      document.getElementById('formSaudiSku').value = product.saudi_sku || '';
      document.getElementById('formSupplierName').value = product.supplier_name || '';

      // Populate Images
      this.setImageUploaderValue('image1', product.image1 || '');
      this.setImageUploaderValue('image2', product.image2 || '');

      BarcodeHelper.renderBarcodeToSvg(document.getElementById('formLiveBarcode'), product.barcode || 'SAMPLE-BARCODE');
      this.populateFormSuggestions(product.brand || '', product.category || '', product.supplier_name || '');
    } else {
      modalTitle.textContent = 'Create New Product';
      BarcodeHelper.renderBarcodeToSvg(document.getElementById('formLiveBarcode'), 'SAMPLE-BARCODE');
      this.populateFormSuggestions('', '', '');
    }

    modal.classList.add('show');
  },

  checkSkuImageSuggestions(sku) {
    const box = document.getElementById('formImageSuggestionBox');
    const text = document.getElementById('formImageSuggestionText');
    if (!box || !sku) {
      if (box) box.style.display = 'none';
      return;
    }
    const imgs = ImageResolver.findImagesForProduct({ sku });
    if (imgs.image1 || imgs.image2) {
      this._suggestedImages = imgs;
      const names = [imgs.image1, imgs.image2].filter(Boolean).map(p => p.split('/').pop()).join(', ');
      text.textContent = `Found in sku_images: ${names}`;
      box.style.display = 'flex';
    } else {
      this._suggestedImages = null;
      box.style.display = 'none';
    }
  },

  applySuggestedImages() {
    if (!this._suggestedImages) return;
    if (this._suggestedImages.image1) this.setImageUploaderValue('image1', this._suggestedImages.image1);
    if (this._suggestedImages.image2) this.setImageUploaderValue('image2', this._suggestedImages.image2);
    const box = document.getElementById('formImageSuggestionBox');
    if (box) box.style.display = 'none';
    this.showToast('Applied matched images from sku_images/', 'success');
  },

  handleProductFormSubmit(e) {
    e.preventDefault();
    const sku = document.getElementById('formSku').value.trim();
    const name = document.getElementById('formName').value.trim();
    const brand = document.getElementById('formBrand').value.trim();
    const category = document.getElementById('formCategory').value.trim();
    const barcode = document.getElementById('formBarcode').value.trim();
    const supplier_code = document.getElementById('formSupplierCode').value.trim();
    const alt_sku_1 = document.getElementById('formAltSku1').value.trim();
    const alt_sku_2 = document.getElementById('formAltSku2').value.trim();
    const alt_sku_3 = document.getElementById('formAltSku3').value.trim();
    const saudi_sku = document.getElementById('formSaudiSku').value.trim();
    const supplier_name = document.getElementById('formSupplierName').value.trim();
    let image1 = this.getImageUploaderValue('image1');
    let image2 = this.getImageUploaderValue('image2');

    if (!sku || !name || !brand || !category) {
      this.showToast('Please fill in all required fields (Brand, Category, SKU, Item Name).', 'danger');
      return;
    }

    // Auto-link image if left blank and available in sku_images
    if (!image1 && !image2) {
      const autoImgs = ImageResolver.findImagesForProduct({ sku, alt_sku_1, alt_sku_2, alt_sku_3, saudi_sku, barcode, name });
      if (autoImgs.image1) image1 = autoImgs.image1;
      if (autoImgs.image2) image2 = autoImgs.image2;
    }

    // Check duplicate SKU if new or SKU changed
    const existingIndex = state.products.findIndex(p => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== state.currentEditingId);
    if (existingIndex !== -1) {
      if (!confirm(`A product with SKU "${sku}" already exists. Do you want to proceed and keep this SKU?`)) {
        return;
      }
    }

    if (state.currentEditingId) {
      // Update
      const idx = state.products.findIndex(p => p.id === state.currentEditingId);
      if (idx !== -1) {
        state.products[idx] = {
          ...state.products[idx],
          brand, category, sku, name, barcode, supplier_code,
          image1, image2, alt_sku_1, alt_sku_2, alt_sku_3,
          saudi_sku, supplier_name,
          updated_at: new Date().toISOString()
        };
        this.showToast('Product updated and auto-saved to database!', 'success');
      }
    } else {
      // Create new
      const newProduct = {
        id: 'alb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        brand, category, sku, name, barcode, supplier_code,
        image1, image2, alt_sku_1, alt_sku_2, alt_sku_3,
        saudi_sku, supplier_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      state.products.unshift(newProduct);
      this.showToast('New product added and auto-saved to database!', 'success');
    }

    state.saveToStorage();
    document.getElementById('productFormModal')?.classList.remove('show');
    this.render();
  },

  duplicateProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const copy = {
      ...product,
      id: 'alb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      sku: product.sku + '-COPY',
      name: product.name + ' (Copy)',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    state.products.unshift(copy);
    state.saveToStorage();
    this.showToast(`Product duplicated as "${copy.sku}"`, 'success');
    this.render();
  },

  deleteProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (confirm(`Are you sure you want to delete "${product.name}" (${product.sku})?`)) {
      state.products = state.products.filter(p => p.id !== productId);
      state.selectedIds.delete(productId);
      state.saveToStorage();
      this.showToast('Product deleted from catalog.', 'success');
      this.render();
    }
  },

  /**
   * Product Details Drawer / View Modal
   */
  openProductView(productId) {
    state.currentViewingId = productId;
    const p = state.products.find(item => item.id === productId);
    if (!p) return;

    const modal = document.getElementById('productDetailModal');
    const container = document.getElementById('productDetailContent');
    if (!modal || !container) return;

    const img1 = p.image1 ? ImageResolver.formatImageUrl(p.image1) : 'https://placehold.co/500x400?text=No+Image+1';
    const img2 = p.image2 ? ImageResolver.formatImageUrl(p.image2) : '';

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Gallery Column -->
        <div class="flex flex-col gap-3">
          <div class="w-full h-72 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
            <img id="detailMainImg" src="${img1}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/500x400?text=No+Image'" />
          </div>
          ${img2 ? `
            <div class="flex gap-2">
              <button class="w-16 h-16 rounded-lg border-2 border-blue-500 overflow-hidden cursor-pointer" onclick="document.getElementById('detailMainImg').src='${img1}'">
                <img src="${img1}" class="w-full h-full object-cover" />
              </button>
              <button class="w-16 h-16 rounded-lg border border-slate-300 hover:border-blue-500 overflow-hidden cursor-pointer" onclick="document.getElementById('detailMainImg').src='${img2}'">
                <img src="${img2}" class="w-full h-full object-cover" />
              </button>
            </div>
          ` : ''}

          <!-- Barcode Area -->
          ${p.barcode ? `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
              <span class="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Scannable Barcode</span>
              <svg id="detailBarcodeSvg"></svg>
              <div class="flex items-center gap-2 mt-2">
                <span class="font-mono text-sm font-bold text-slate-800">${this.escapeHtml(p.barcode)}</span>
                <button class="copy-icon-btn" onclick="AppUI.copyText('${this.escapeHtml(p.barcode)}', 'Barcode copied!')">📋</button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Details Info Column -->
        <div class="flex flex-col gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge badge-brand text-sm">${this.escapeHtml(p.brand || 'Al Barakat')}</span>
              <span class="badge badge-category text-sm">${this.escapeHtml(p.category || 'General')}</span>
            </div>
            <h2 class="text-xl font-bold text-slate-900">${this.escapeHtml(p.name)}</h2>
          </div>

          <!-- SKU Information Card -->
          <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5">
            <div class="flex justify-between items-center pb-2 border-b border-slate-200">
              <span class="text-xs text-slate-500 font-semibold">Primary SKU</span>
              <div class="flex items-center gap-1.5">
                <span class="badge badge-sku text-sm font-bold">${this.escapeHtml(p.sku)}</span>
                <button class="copy-icon-btn" onclick="AppUI.copyText('${this.escapeHtml(p.sku)}', 'SKU copied!')">📋</button>
              </div>
            </div>

            <div class="flex justify-between items-center pb-2 border-b border-slate-200">
              <span class="text-xs text-slate-500 font-semibold">Saudi SKU</span>
              <div>
                ${p.saudi_sku ? `<span class="badge badge-saudi text-sm font-bold">🇸🇦 ${this.escapeHtml(p.saudi_sku)}</span>` : `<span class="text-xs text-slate-400">Not Assigned</span>`}
              </div>
            </div>

            <div>
              <span class="text-xs text-slate-500 font-semibold block mb-1">Alternative SKUs</span>
              <div class="flex flex-wrap gap-1.5">
                ${p.alt_sku_1 ? `<span class="badge badge-alt">Alt 1: ${this.escapeHtml(p.alt_sku_1)}</span>` : ''}
                ${p.alt_sku_2 ? `<span class="badge badge-alt">Alt 2: ${this.escapeHtml(p.alt_sku_2)}</span>` : ''}
                ${p.alt_sku_3 ? `<span class="badge badge-alt">Alt 3: ${this.escapeHtml(p.alt_sku_3)}</span>` : ''}
                ${!p.alt_sku_1 && !p.alt_sku_2 && !p.alt_sku_3 ? `<span class="text-xs text-slate-400">None specified</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Supplier Information Card -->
          <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-500 font-semibold">Supplier Name</span>
              <span class="text-sm font-medium text-slate-800">${this.escapeHtml(p.supplier_name || 'AL BARAKAT TRADING LLC')}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-500 font-semibold">Supplier Code</span>
              <span class="badge badge-supplier font-mono">${this.escapeHtml(p.supplier_code || '45453')}</span>
            </div>
          </div>

          <div class="flex gap-2 mt-auto pt-2">
            <button class="btn btn-primary flex-1" onclick="AppUI.openProductModal('${p.id}'); document.getElementById('productDetailModal').classList.remove('show');">Edit Product</button>
            <button class="btn btn-secondary" onclick="AppUI.printSingleBarcode('${p.id}')">🖨 Print Label</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('show');

    if (p.barcode) {
      setTimeout(() => {
        BarcodeHelper.renderBarcodeToSvg(document.getElementById('detailBarcodeSvg'), p.barcode);
      }, 50);
    }
  },

  /**
   * Image Uploader & Drag-Drop Helpers
   */
  setupImageUploader(fieldPrefix) {
    const dropzone = document.getElementById(`${fieldPrefix}Dropzone`);
    const fileInput = document.getElementById(`${fieldPrefix}FileInput`);
    const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
    const removeBtn = document.getElementById(`${fieldPrefix}RemoveBtn`);

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== removeBtn && !e.target.closest('button')) {
        fileInput.click();
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleImageFile(e.dataTransfer.files[0], fieldPrefix);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleImageFile(e.target.files[0], fieldPrefix);
      }
    });

    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        this.setImageUploaderPreview(fieldPrefix, url);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetImageUploader(fieldPrefix);
      });
    }
  },

  handleImageFile(file, fieldPrefix) {
    if (!file.type.startsWith('image/')) {
      this.showToast('Please upload a valid image file (PNG, JPG, WEBP).', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let optimizedDataUrl = canvas.toDataURL('image/webp', 0.85);
          if (!optimizedDataUrl.startsWith('data:image/webp')) {
            optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }

          const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
          if (urlInput) urlInput.value = optimizedDataUrl;
          this.setImageUploaderPreview(fieldPrefix, optimizedDataUrl);
        } catch (err) {
          const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
          if (urlInput) urlInput.value = originalDataUrl;
          this.setImageUploaderPreview(fieldPrefix, originalDataUrl);
        }
      };
      img.onerror = () => {
        const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
        if (urlInput) urlInput.value = originalDataUrl;
        this.setImageUploaderPreview(fieldPrefix, originalDataUrl);
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  },

  setImageUploaderValue(fieldPrefix, val) {
    const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
    if (urlInput) urlInput.value = val;
    this.setImageUploaderPreview(fieldPrefix, val);
  },

  getImageUploaderValue(fieldPrefix) {
    const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
    return urlInput ? urlInput.value.trim() : '';
  },

  setImageUploaderPreview(fieldPrefix, src) {
    const placeholder = document.getElementById(`${fieldPrefix}Placeholder`);
    const previewImg = document.getElementById(`${fieldPrefix}PreviewImg`);
    const overlay = document.getElementById(`${fieldPrefix}Overlay`);

    if (src) {
      const formatted = ImageResolver.formatImageUrl(src);
      if (previewImg) {
        previewImg.src = formatted;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (overlay) overlay.style.display = 'flex';
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'flex';
      if (overlay) overlay.style.display = 'none';
    }
  },

  resetImageUploader(fieldPrefix) {
    const fileInput = document.getElementById(`${fieldPrefix}FileInput`);
    const urlInput = document.getElementById(`${fieldPrefix}UrlInput`);
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    this.setImageUploaderPreview(fieldPrefix, '');
  },

  /**
   * Import Wizard Manager
   */
  openImportModal() {
    state.wizardData = {
      step: 1,
      file: null,
      rawRows: [],
      headers: [],
      autoMap: {},
      validatedRows: [],
      strategy: 'overwrite' // 'overwrite' | 'skip' | 'append'
    };

    const modal = document.getElementById('importWizardModal');
    if (!modal) return;

    this.renderWizardStep(1);
    modal.classList.add('show');
  },

  setupImportDropzone() {
    const dropzone = document.getElementById('importDropzone');
    const fileInput = document.getElementById('importFileInput');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processImportFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processImportFile(e.target.files[0]);
      }
    });
  },

  async processImportFile(file) {
    try {
      this.showToast(`Reading ${file.name}...`, 'info');
      const { headers, rawRows, autoMap } = await ImportExportManager.parseFile(file);

      state.wizardData.file = file;
      state.wizardData.headers = headers;
      state.wizardData.rawRows = rawRows;
      state.wizardData.autoMap = autoMap;

      this.renderWizardStep(2);
    } catch (e) {
      this.showToast(e.message, 'danger');
    }
  },

  renderWizardStep(stepNum) {
    state.wizardData.step = stepNum;

    // Update Step Indicators
    for (let s = 1; s <= 4; s++) {
      const stepItem = document.getElementById(`wizardStep${s}`);
      const stepPanel = document.getElementById(`wizardPanel${s}`);
      if (stepItem) {
        stepItem.classList.toggle('active', s === stepNum);
        stepItem.classList.toggle('completed', s < stepNum);
      }
      if (stepPanel) {
        stepPanel.style.display = s === stepNum ? 'block' : 'none';
      }
    }

    if (stepNum === 2) {
      this.renderWizardMappingTable();
    } else if (stepNum === 3) {
      this.renderWizardPreviewTable();
    }
  },

  renderWizardMappingTable() {
    const tableBody = document.getElementById('wizardMappingBody');
    if (!tableBody) return;

    const headers = state.wizardData.headers;
    const autoMap = state.wizardData.autoMap;

    tableBody.innerHTML = FIELD_DEFINITIONS.map(field => {
      const selectedHeader = autoMap[field.key] || '';
      return `
        <tr>
          <td class="font-medium text-slate-800">
            ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
          </td>
          <td>
            <select class="form-select text-xs py-1" onchange="AppUI.updateColumnMapping('${field.key}', this.value)">
              <option value="">-- Do Not Import / Leave Blank --</option>
              ${headers.map(h => `<option value="${AppUI.escapeHtml(h)}" ${h === selectedHeader ? 'selected' : ''}>${AppUI.escapeHtml(h)}</option>`).join('')}
            </select>
          </td>
          <td>
            <span class="text-xs ${selectedHeader ? 'text-green-600 font-medium' : (field.required ? 'text-amber-600 font-semibold' : 'text-slate-400')}">
              ${selectedHeader ? '✓ Mapped' : (field.required ? '⚠ Required' : 'Optional')}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateColumnMapping(fieldKey, headerValue) {
    state.wizardData.autoMap[fieldKey] = headerValue;
  },

  goToWizardPreview() {
    const transformed = ImportExportManager.transformRows(state.wizardData.rawRows, state.wizardData.autoMap);
    // Auto-link any matching images from sku_images/
    ImageResolver.autoLinkAll(transformed, true);

    const existingSkus = new Set(state.products.map(p => p.sku.toLowerCase()));
    state.wizardData.validatedRows = ImportExportManager.validateProducts(transformed, existingSkus);

    this.renderWizardStep(3);
  },

  renderWizardPreviewTable() {
    const validated = state.wizardData.validatedRows;
    const totalCount = validated.length;
    const validCount = validated.filter(r => r.isValid).length;
    const errorCount = totalCount - validCount;

    document.getElementById('importTotalCount').textContent = totalCount;
    document.getElementById('importValidCount').textContent = validCount;
    document.getElementById('importErrorCount').textContent = errorCount;

    const previewTbody = document.getElementById('wizardPreviewBody');
    if (!previewTbody) return;

    // Show first 8 rows
    previewTbody.innerHTML = validated.slice(0, 8).map(r => {
      const p = r.product;
      return `
        <tr class="${r.isValid ? '' : 'bg-red-50/60'}">
          <td class="font-bold text-xs">${r.rowNumber}</td>
          <td><span class="badge ${r.isValid ? 'badge-sku' : 'bg-red-100 text-red-700'}">${this.escapeHtml(p.sku || 'MISSING')}</span></td>
          <td class="text-xs truncate max-w-[160px]">${this.escapeHtml(p.name || 'MISSING')}</td>
          <td class="text-xs">${this.escapeHtml(p.brand || '—')}</td>
          <td class="text-xs">${this.escapeHtml(p.category || '—')}</td>
          <td class="text-xs font-mono">${this.escapeHtml(p.saudi_sku || '—')}</td>
          <td>
            ${r.errors.length > 0 ? `
              <span class="text-xs text-red-600 font-semibold">${r.errors.join(', ')}</span>
            ` : (r.warnings.length > 0 ? `
              <span class="text-xs text-amber-600 font-medium">${r.warnings[0]}</span>
            ` : `<span class="text-xs text-green-600 font-semibold">✓ Valid</span>`)}
          </td>
        </tr>
      `;
    }).join('');
  },

  executeImport() {
    const strategy = document.querySelector('input[name="importStrategy"]:checked')?.value || 'overwrite';
    const validated = state.wizardData.validatedRows;
    const validItems = validated.filter(r => r.isValid).map(r => r.product);

    if (validItems.length === 0) {
      this.showToast('No valid records to import.', 'danger');
      return;
    }

    // Auto-link SKU images for newly imported products
    ImageResolver.autoLinkAll(validItems, true);

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    validItems.forEach(item => {
      const existingIdx = state.products.findIndex(p => p.sku.toLowerCase() === item.sku.toLowerCase());

      if (existingIdx !== -1) {
        if (strategy === 'overwrite') {
          state.products[existingIdx] = {
            ...state.products[existingIdx],
            ...item,
            id: state.products[existingIdx].id,
            updated_at: new Date().toISOString()
          };
          updatedCount++;
        } else if (strategy === 'skip') {
          skippedCount++;
        } else {
          // Append as new
          item.sku = item.sku + '-NEW';
          state.products.push(item);
          addedCount++;
        }
      } else {
        state.products.push(item);
        addedCount++;
      }
    });

    state.saveToStorage();
    this.render();

    // Show Step 4 (Success summary)
    document.getElementById('importSummaryAdded').textContent = addedCount;
    document.getElementById('importSummaryUpdated').textContent = updatedCount;
    document.getElementById('importSummarySkipped').textContent = skippedCount;
    this.renderWizardStep(4);
    this.showToast(`Successfully imported ${addedCount + updatedCount} products with matched images!`, 'success');
  },

  /**
   * Export Modal & Actions
   */
  openExportModal() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;

    const totalCount = state.products.length;
    const filteredCount = state.getFilteredProducts().length;
    const selectedCount = state.selectedIds.size;

    document.getElementById('exportCountAll').textContent = `(${totalCount} items)`;
    document.getElementById('exportCountFiltered').textContent = `(${filteredCount} items)`;
    document.getElementById('exportCountSelected').textContent = `(${selectedCount} items)`;

    const selectedRadio = document.getElementById('exportScopeSelected');
    if (selectedRadio) {
      selectedRadio.disabled = selectedCount === 0;
    }

    modal.classList.add('show');
  },

  executeExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'csv';
    const scope = document.querySelector('input[name="exportScope"]:checked')?.value || 'all';

    let exportList = [];
    if (scope === 'all') {
      exportList = state.products;
    } else if (scope === 'filtered') {
      exportList = state.getFilteredProducts();
    } else if (scope === 'selected') {
      exportList = state.products.filter(p => state.selectedIds.has(p.id));
    }

    if (exportList.length === 0) {
      this.showToast('No products selected for export.', 'warning');
      return;
    }

    // Selected columns
    const selectedFields = [];
    document.querySelectorAll('.export-column-cb:checked').forEach(cb => {
      selectedFields.push(cb.value);
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `catalog_export_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;

    if (format === 'csv') {
      ImportExportManager.exportToCSV(exportList, selectedFields, filename);
    } else if (format === 'excel') {
      ImportExportManager.exportToExcel(exportList, selectedFields, filename);
    } else if (format === 'json') {
      ImportExportManager.exportToJSON(exportList, selectedFields, filename);
    }

    document.getElementById('exportModal')?.classList.remove('show');
    this.showToast(`Exported ${exportList.length} products to ${filename}`, 'success');
  },

  toggleAllExportColumns(selectAll) {
    document.querySelectorAll('.export-column-cb').forEach(cb => {
      cb.checked = selectAll;
    });
  },

  /**
   * Barcode Printable Sheet
   */
  openBarcodePrintModal() {
    const modal = document.getElementById('barcodePrintModal');
    if (!modal) return;

    const itemsToPrint = state.selectedIds.size > 0
      ? state.products.filter(p => state.selectedIds.has(p.id))
      : state.getFilteredProducts();

    const sheet = document.getElementById('printBarcodeSheet');
    if (sheet) {
      sheet.innerHTML = itemsToPrint.filter(p => p.barcode).map(p => `
        <div class="barcode-sticker">
          <div class="sticker-brand">${this.escapeHtml(p.brand || '')}</div>
          <div class="sticker-name">${this.escapeHtml(p.name)}</div>
          <svg id="print-bc-${p.id}"></svg>
          <div class="sticker-sku">SKU: ${this.escapeHtml(p.sku)} ${p.saudi_sku ? `| KSA: ${this.escapeHtml(p.saudi_sku)}` : ''}</div>
        </div>
      `).join('');

      itemsToPrint.filter(p => p.barcode).forEach(p => {
        BarcodeHelper.renderBarcodeToSvg(document.getElementById(`print-bc-${p.id}`), p.barcode);
      });
    }

    modal.classList.add('show');
  },

  printSingleBarcode(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.barcode) {
      this.showToast('Product has no barcode to print.', 'warning');
      return;
    }

    const sheet = document.getElementById('printBarcodeSheet');
    if (sheet) {
      sheet.innerHTML = `
        <div class="barcode-sticker" style="grid-column: 1 / -1; max-width: 320px; margin: 0 auto;">
          <div class="sticker-brand">${this.escapeHtml(product.brand || '')}</div>
          <div class="sticker-name">${this.escapeHtml(product.name)}</div>
          <svg id="print-bc-single"></svg>
          <div class="sticker-sku">SKU: ${this.escapeHtml(product.sku)} ${product.saudi_sku ? `| KSA: ${this.escapeHtml(product.saudi_sku)}` : ''}</div>
        </div>
      `;
      BarcodeHelper.renderBarcodeToSvg(document.getElementById('print-bc-single'), product.barcode);
    }

    window.print();
  },

  triggerBrowserPrint() {
    window.print();
  },

  copyText(text, successMessage = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(successMessage, 'info');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast(successMessage, 'info');
    });
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ';
    if (type === 'success') icon = '✓';
    if (type === 'danger') icon = '⚠';
    if (type === 'warning') icon = '⚡';

    toast.innerHTML = `
      <span class="font-bold text-base">${icon}</span>
      <span class="flex-1">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  AppUI.init();
});
