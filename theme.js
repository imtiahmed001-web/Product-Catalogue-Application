/**
 * Al_Barkat Trading LLC - Theme & Appearance Manager
 * Manages 7 handcrafted elegant luxury color palettes with instant zero-flicker live switching & persistence.
 */
(function(window) {
  'use strict';

  const ThemeManager = {
    storageKey: 'albarkat_theme',
    themes: [
      {
        id: 'obsidian',
        name: 'Obsidian Onyx',
        tag: 'Classic Dark Luxury',
        desc: 'Deep midnight obsidian with electric sapphire accents and refined glassmorphic surfaces.',
        mode: 'dark',
        bg: '#06090f',
        surface: '#0e1422',
        accent: '#3b82f6',
        text: '#f8fafc'
      },
      {
        id: 'emerald',
        name: 'Emerald Velvet',
        tag: 'Imperial Jade',
        desc: 'Rich deep forest jade with luminous emerald and fresh mint highlights. Inspired by fine luxury jewelry.',
        mode: 'dark',
        bg: '#04100c',
        surface: '#0a1f18',
        accent: '#10b981',
        text: '#f0fdf4'
      },
      {
        id: 'amethyst',
        name: 'Midnight Amethyst',
        tag: 'Royal Violet',
        desc: 'Galactic twilight violet with electric orchid accents. Futuristic, regal, and visually striking.',
        mode: 'dark',
        bg: '#0c0717',
        surface: '#140d26',
        accent: '#a855f7',
        text: '#faf5ff'
      },
      {
        id: 'sapphire',
        name: 'Sapphire Oceanic',
        tag: 'Deep Cobalt',
        desc: 'Nautical maritime cobalt with radiant azure cyan. Ultra-clean, crisp, and high-tech.',
        mode: 'dark',
        bg: '#040d1a',
        surface: '#0a192e',
        accent: '#0ea5e9',
        text: '#f0f9ff'
      },
      {
        id: 'amber',
        name: 'Espresso Amber',
        tag: 'Cognac Gold',
        desc: 'Warm roasted espresso mocha paired with glowing champagne gold. Warm, prestigious boutique aesthetic.',
        mode: 'dark',
        bg: '#0f0a06',
        surface: '#1a130c',
        accent: '#f59e0b',
        text: '#fffbeb'
      },
      {
        id: 'crimson',
        name: 'Crimson Ruby',
        tag: 'Noir Bordeaux',
        desc: 'Deep wine burgundy noir with vivid ruby rose highlights. Sophisticated, bold, and high-contrast.',
        mode: 'dark',
        bg: '#110509',
        surface: '#1e0a11',
        accent: '#f43f5e',
        text: '#fff1f2'
      },
      {
        id: 'light',
        name: 'Executive Pearl',
        tag: 'Alabaster Light',
        desc: 'High-clarity daylight studio mode with pristine pearl surfaces and royal indigo accents. Perfect for bright offices.',
        mode: 'light',
        bg: '#f1f5f9',
        surface: '#ffffff',
        accent: '#2563eb',
        text: '#0f172a'
      }
    ],

    init() {
      const saved = this.getCurrentTheme();
      this.applyTheme(saved);
      this.bindModalEvents();
      this.bindButton();
    },

    getCurrentTheme() {
      try {
        return localStorage.getItem(this.storageKey) || 'obsidian';
      } catch (e) {
        return 'obsidian';
      }
    },

    setTheme(themeId, showToast = true) {
      const theme = this.themes.find(t => t.id === themeId);
      if (!theme) return;

      try {
        localStorage.setItem(this.storageKey, themeId);
      } catch (e) {}

      this.applyTheme(themeId);
      this.updateActiveCard(themeId);

      if (showToast && window.AppUI && typeof window.AppUI.showToast === 'function') {
        window.AppUI.showToast('Theme switched to ' + theme.name + ' ✨', 'info');
      }
    },

    applyTheme(themeId) {
      const theme = this.themes.find(t => t.id === themeId) || this.themes[0];
      document.documentElement.setAttribute('data-theme', theme.id);

      // Update mobile browser status bar
      const metaTheme = document.getElementById('metaThemeColor');
      if (metaTheme) {
        metaTheme.setAttribute('content', theme.bg);
      }

      // Update header indicator dot
      const headerDot = document.getElementById('headerThemeDot');
      if (headerDot) {
        headerDot.style.background = theme.accent;
        headerDot.style.boxShadow = '0 0 8px ' + theme.accent;
      }
    },

    openThemeModal() {
      const modal = document.getElementById('themeSettingsModal');
      if (!modal) {
        console.warn('themeSettingsModal not found in DOM');
        return;
      }
      this.renderThemeCards();
      modal.classList.add('show');
    },

    closeThemeModal() {
      const modal = document.getElementById('themeSettingsModal');
      if (modal) modal.classList.remove('show');
    },

    renderThemeCards() {
      const container = document.getElementById('themeGridContainer');
      if (!container) return;

      const current = this.getCurrentTheme();

      container.innerHTML = this.themes.map(t => {
        const isActive = (t.id === current);
        const isLight = (t.mode === 'light');
        const borderCol = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';
        const previewCardBg = isLight ? '#ffffff' : t.surface;
        const previewTextCol = isLight ? '#0f172a' : t.text;

        return `
          <div class="theme-card ${isActive ? 'active' : ''}" onclick="ThemeManager.setTheme('${t.id}')" data-theme-id="${t.id}">
            <div class="theme-active-check">✓</div>
            
            <div class="theme-card-preview" style="background: ${t.bg}; border-color: ${borderCol};">
              <div class="theme-preview-header">
                <div class="theme-preview-dots">
                  <span class="theme-preview-dot" style="background: ${t.accent};"></span>
                  <span class="theme-preview-dot" style="background: ${isLight ? '#94a3b8' : '#64748b'};"></span>
                  <span class="theme-preview-dot" style="background: ${isLight ? '#cbd5e1' : '#334155'};"></span>
                </div>
                <span class="theme-preview-badge" style="background: ${t.accent}25; color: ${t.accent}; border: 1px solid ${t.accent}40;">
                  ${t.mode.toUpperCase()}
                </span>
              </div>

              <div class="theme-preview-body">
                <div class="theme-preview-chip" style="background: ${previewCardBg}; color: ${previewTextCol}; border: 1px solid ${borderCol};">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${t.accent};margin-right:5px;"></span>
                  <span>${t.name}</span>
                </div>
                <div class="theme-preview-btn" style="background: ${t.accent};"></div>
              </div>
            </div>

            <div class="theme-card-info">
              <div class="theme-card-header">
                <span class="theme-card-title">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.accent};"></span>
                  ${t.name}
                </span>
                <span class="theme-card-tag" style="background: ${t.accent}20; color: ${t.accent};">
                  ${t.tag}
                </span>
              </div>
              <p class="theme-card-desc">${t.desc}</p>
            </div>
          </div>
        `;
      }).join('');
    },

    updateActiveCard(themeId) {
      document.querySelectorAll('.theme-card').forEach(card => {
        if (card.getAttribute('data-theme-id') === themeId) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    },

    bindModalEvents() {
      // Backdrop click closes modal
      const modal = document.getElementById('themeSettingsModal');
      if (modal && !modal._themeEventsBound) {
        modal._themeEventsBound = true;
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('show');
          }
        });
        // Close buttons inside modal
        modal.querySelectorAll('[data-close-modal]').forEach(btn => {
          btn.addEventListener('click', () => {
            modal.classList.remove('show');
          });
        });
      }
    },

    bindButton() {
      // Direct click listener on theme button
      const btn = document.getElementById('btnThemeSettings');
      if (btn && !btn._themeBound) {
        btn._themeBound = true;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openThemeModal();
        });
      }
    }
  };

  // Immediate pre-render theme application
  try {
    const saved = localStorage.getItem(ThemeManager.storageKey) || 'obsidian';
    document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}

  // Expose on window
  window.ThemeManager = ThemeManager;

  // Auto-init when DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
  } else {
    ThemeManager.init();
  }
})(window);
