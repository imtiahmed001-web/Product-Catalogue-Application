/**
 * Import and Export Manager for Product Catalog Application
 */

const FIELD_DEFINITIONS = [
  { key: 'brand', label: 'Brand Name', aliases: ['brand', 'brand name', 'brand_name', 'brandname', 'make', 'manufacturer'], required: true },
  { key: 'category', label: 'Category', aliases: ['category', 'cat', 'category name', 'category_name', 'department'], required: true },
  { key: 'sku', label: 'SKU', aliases: ['sku', 'primary sku', 'sku code', 'item sku', 'product sku', 'item code'], required: true },
  { key: 'name', label: 'Item Name', aliases: ['item name', 'name', 'product name', 'item_name', 'product_name', 'title'], required: true },
  { key: 'barcode', label: 'Barcode', aliases: ['barcode', 'upc', 'ean', 'bar code', 'bar_code', 'ean13', 'code128'], required: false },
  { key: 'supplier_code', label: 'Supplier Code', aliases: ['supplier code', 'supplier_code', 'supp code', 'supp_code', 'vendor code', 'vendor_sku'], required: false },
  { key: 'image1', label: 'Image 1', aliases: ['image 1', 'image1', 'image_1', 'img 1', 'photo 1', 'picture 1', 'image url 1'], required: false },
  { key: 'image2', label: 'Image 2', aliases: ['image 2', 'image2', 'image_2', 'img 2', 'photo 2', 'picture 2', 'image url 2'], required: false },
  { key: 'alt_sku_1', label: 'Alternative SKU 1', aliases: ['alternative sku 1', 'alt sku 1', 'alt_sku_1', 'alternative_sku_1', 'altsku1', 'alt 1', 'alt1'], required: false },
  { key: 'alt_sku_2', label: 'Alternative SKU 2', aliases: ['alternative sku 2', 'alt sku 2', 'alt_sku_2', 'alternative_sku_2', 'altsku2', 'alt 2', 'alt2'], required: false },
  { key: 'alt_sku_3', label: 'Alternative SKU 3', aliases: ['alternative sku 3', 'alt sku 3', 'alt_sku_3', 'alternative_sku_3', 'altsku3', 'alt 3', 'alt3'], required: false },
  { key: 'saudi_sku', label: 'Saudi SKU', aliases: ['saudi sku', 'saudi_sku', 'ksa sku', 'saudi code', 'saudisku', 'ksa_sku'], required: false },
  { key: 'supplier_name', label: 'Supplier Name', aliases: ['supplier name', 'supplier_name', 'supplier', 'vendor', 'vendor name', 'vendor_name'], required: false }
];

const ImportExportManager = {
  /**
   * Parse an uploaded file (CSV, XLSX, XLS, JSON)
   * @param {File} file
   * @returns {Promise<{ headers: string[], rawRows: any[], autoMap: Object }>}
   */
  async parseFile(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      return this.parseJSON(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return this.parseExcel(file);
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt') || fileName.endsWith('.tsv')) {
      return this.parseCSV(file);
    } else {
      throw new Error('Unsupported file format. Please upload CSV, Excel (.xlsx, .xls), or JSON file.');
    }
  },

  /**
   * Parse CSV File
   */
  async parseCSV(file) {
    const text = await file.text();
    const rows = this.csvToArray(text);
    if (!rows || rows.length < 1) {
      throw new Error('CSV file is empty or invalid.');
    }

    const headers = rows[0].map(h => (h || '').trim());
    const dataRows = rows.slice(1).filter(r => r.some(cell => cell && cell.trim() !== ''));

    const rawRows = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] !== undefined ? r[idx].trim() : '';
      });
      return obj;
    });

    const autoMap = this.generateAutoMapping(headers);
    return { headers, rawRows, autoMap };
  },

  /**
   * Robust CSV to Array parser supporting quoted cells and line breaks
   */
  csvToArray(text) {
    const p = '', row = [''], ret = [row];
    let i = 0, s = true, l = 0;
    
    // Auto-detect delimiter (, or ;)
    let delimiter = ',';
    const firstLine = text.split(/\r\n|\n/)[0];
    if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
      delimiter = ';';
    } else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) {
      delimiter = '\t';
    }

    for (let c of text) {
      if (c === '"') {
        if (s && c === p) row[l] += c;
        s = !s;
      } else if (c === delimiter && s) {
        c = '';
        row[++l] = '';
      } else if ((c === '\r' || c === '\n') && s) {
        if (c === '\r') continue;
        ret.push(row = ['']);
        l = 0;
      } else {
        row[l] += c;
      }
      p = c;
    }
    return ret;
  },

  /**
   * Parse Excel File using SheetJS (if loaded) or fallback
   */
  async parseExcel(file) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Excel parser library is still loading. Please try again or use CSV.');
    }

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!json || json.length < 1) {
      throw new Error('Excel worksheet is empty.');
    }

    const headers = json[0].map(h => String(h || '').trim());
    const dataRows = json.slice(1).filter(r => r.some(cell => String(cell || '').trim() !== ''));

    const rawRows = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] !== undefined ? String(r[idx]).trim() : '';
      });
      return obj;
    });

    const autoMap = this.generateAutoMapping(headers);
    return { headers, rawRows, autoMap };
  },

  /**
   * Parse JSON File
   */
  async parseJSON(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON format: ' + e.message);
    }

    let items = Array.isArray(data) ? data : (data.products || data.items || data.data || []);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('JSON does not contain a list of items/products.');
    }

    const headersSet = new Set();
    items.forEach(item => {
      Object.keys(item).forEach(k => headersSet.add(k));
    });

    const headers = Array.from(headersSet);
    const autoMap = this.generateAutoMapping(headers);

    return { headers, rawRows: items, autoMap };
  },

  /**
   * Automatically maps source headers to standard product fields
   */
  generateAutoMapping(headers) {
    const mapping = {};
    FIELD_DEFINITIONS.forEach(fieldDef => {
      const match = headers.find(h => {
        const clean = h.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        return fieldDef.aliases.some(alias => clean === alias || clean.includes(alias));
      });
      mapping[fieldDef.key] = match || '';
    });
    return mapping;
  },

  /**
   * Transform raw rows to standard Product objects using field mappings
   */
  transformRows(rawRows, columnMapping) {
    return rawRows.map((row, idx) => {
      const product = {
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) + '_' + idx,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      FIELD_DEFINITIONS.forEach(def => {
        const sourceHeader = columnMapping[def.key];
        let val = sourceHeader && row[sourceHeader] !== undefined ? String(row[sourceHeader]).trim() : '';
        product[def.key] = val;
      });

      return product;
    });
  },

  /**
   * Validate transformed products
   */
  validateProducts(products, existingSkus = new Set()) {
    const validated = [];
    const skuMap = new Map();

    products.forEach((p, index) => {
      const errors = [];
      const warnings = [];

      if (!p.sku) {
        errors.push('SKU is missing');
      } else {
        if (skuMap.has(p.sku.toLowerCase())) {
          warnings.push('Duplicate SKU in import batch (Row ' + (skuMap.get(p.sku.toLowerCase()) + 1) + ')');
        } else {
          skuMap.set(p.sku.toLowerCase(), index);
        }

        if (existingSkus.has(p.sku.toLowerCase())) {
          warnings.push('SKU already exists in catalog (Will overwrite or skip based on choice)');
        }
      }

      if (!p.name) {
        errors.push('Item Name is missing');
      }
      if (!p.brand) {
        warnings.push('Brand is empty');
      }
      if (!p.category) {
        warnings.push('Category is empty');
      }

      validated.push({
        rowNumber: index + 1,
        product: p,
        isValid: errors.length === 0,
        errors,
        warnings
      });
    });

    return validated;
  },

  /**
   * Export catalog to CSV
   */
  exportToCSV(products, selectedFields = null, filename = 'products_export.csv') {
    const fields = selectedFields && selectedFields.length > 0
      ? FIELD_DEFINITIONS.filter(f => selectedFields.includes(f.key))
      : FIELD_DEFINITIONS;

    const headers = fields.map(f => f.label);
    const rows = [headers];

    products.forEach(p => {
      const row = fields.map(f => {
        let val = p[f.key] || '';
        // Escape quotes
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      });
      rows.push(row);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
    this.downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
  },

  /**
   * Export catalog to Excel (.xlsx)
   */
  exportToExcel(products, selectedFields = null, filename = 'products_export.xlsx') {
    const fields = selectedFields && selectedFields.length > 0
      ? FIELD_DEFINITIONS.filter(f => selectedFields.includes(f.key))
      : FIELD_DEFINITIONS;

    const data = products.map(p => {
      const obj = {};
      fields.forEach(f => {
        obj[f.label] = p[f.key] || '';
      });
      return obj;
    });

    if (typeof XLSX !== 'undefined') {
      const worksheet = XLSX.utils.json_to_sheet(data);
      // Auto-fit column widths
      const colWidths = fields.map(f => {
        let max = f.label.length;
        products.forEach(p => {
          const l = String(p[f.key] || '').length;
          if (l > max) max = l;
        });
        return { wch: Math.min(Math.max(max + 2, 12), 40) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      XLSX.writeFile(workbook, filename);
    } else {
      // Fallback to CSV if XLSX library is unavailable
      this.exportToCSV(products, selectedFields, filename.replace('.xlsx', '.csv'));
    }
  },

  /**
   * Export catalog to JSON
   */
  exportToJSON(products, selectedFields = null, filename = 'products_export.json') {
    let exportData = products;
    if (selectedFields && selectedFields.length > 0) {
      exportData = products.map(p => {
        const obj = { id: p.id };
        selectedFields.forEach(k => {
          obj[k] = p[k] || '';
        });
        return obj;
      });
    }

    const jsonStr = JSON.stringify(exportData, null, 2);
    this.downloadBlob(new Blob([jsonStr], { type: 'application/json;charset=utf-8;' }), filename);
  },

  /**
   * Download Sample Template
   */
  downloadTemplate(format = 'csv') {
    const sampleProducts = [
      {
        brand: 'Apple',
        category: 'Smartphones',
        sku: 'APL-IP15P-256',
        name: 'iPhone 15 Pro Max 256GB Natural Titanium',
        barcode: '195949038291',
        supplier_code: 'SUP-APL-01',
        image1: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&auto=format&fit=crop&q=80',
        image2: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop&q=80',
        alt_sku_1: 'MU773ZP/A',
        alt_sku_2: 'A3106-NAT',
        alt_sku_3: 'IP15PM-256-NT',
        saudi_sku: 'KSA-APL-99201',
        supplier_name: 'Apex Global Distribution'
      },
      {
        brand: 'Samsung',
        category: 'Electronics',
        sku: 'SAM-S24U-512',
        name: 'Samsung Galaxy S24 Ultra 512GB Titanium Black',
        barcode: '8806095392011',
        supplier_code: 'SUP-SAM-88',
        image1: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&auto=format&fit=crop&q=80',
        image2: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500&auto=format&fit=crop&q=80',
        alt_sku_1: 'SM-S928B/DS',
        alt_sku_2: 'S24U-BLK-512G',
        alt_sku_3: 'GAL-S24U-TBLK',
        saudi_sku: 'KSA-SAM-77112',
        supplier_name: 'Gulf Electronics Trading LLC'
      },
      {
        brand: 'Sony',
        category: 'Audio',
        sku: 'SNY-WH1000XM5',
        name: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
        barcode: '027242924048',
        supplier_code: 'SUP-SNY-33',
        image1: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
        image2: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500&auto=format&fit=crop&q=80',
        alt_sku_1: 'WH1000XM5/B',
        alt_sku_2: 'SNY-NC5-BLK',
        alt_sku_3: 'XM5-HEADSET',
        saudi_sku: 'KSA-SNY-44029',
        supplier_name: 'Soundwave International'
      }
    ];

    if (format === 'excel' || format === 'xlsx') {
      this.exportToExcel(sampleProducts, null, 'product_catalog_import_template.xlsx');
    } else {
      this.exportToCSV(sampleProducts, null, 'product_catalog_import_template.csv');
    }
  },

  /**
   * Helper to trigger file download in browser
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
