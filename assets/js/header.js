// ==========================================
// header.js - BEM対応版（安定化）
// ==========================================

(function() {
  'use strict';

  // ==========================================
  // 設定
  // ==========================================
  const CONFIG = {
    enableDropdown: true,
    enableScrollEffect: true,
    scrollThreshold: 60,
    debug: true // 開発時はtrue、本番はfalse
  };

  // デバッグログ
  function log(message, level = 'info') {
    if (!CONFIG.debug) return;
    const prefix = '[Header]';
    console[level](`${prefix} ${message}`);
  }

  // ==========================================
  // ヘッダーHTMLテンプレート（BEM版）
  // ==========================================
  function getHeaderTemplate() {
    // ページ別の aria-label
    let ariaLabel = "ペルソナファインダー インデックスページ"; 
    const pathname = location.pathname;
    
    if (pathname.endsWith("function.html")) {
      ariaLabel = "ペルソナファインダー 詳細ページ";
    } else if (pathname.endsWith("personality.html")) {
      ariaLabel = "性格類型詳細ページ";
    }

    return `
      <div class="header__container">
        <a href="index.html" class="header__logo" aria-label="${ariaLabel}">
          <div class="header__logo-icon" aria-hidden="true">Ψ</div>
          <span class="header__logo-text">Persona Finder</span>
        </a>

        <nav class="header__nav">
          <a href="index.html" class="header__nav-link">Home</a>
          <div class="header__dropdown">
            <span class="header__dropdown-trigger">認知機能</span>
            <div class="header__dropdown-menu">
              <a href="function.html?code=ni" class="header__dropdown-link">Ni（内向的直観）</a>
              <a href="function.html?code=ne" class="header__dropdown-link">Ne（外向的直観）</a>
              <a href="function.html?code=si" class="header__dropdown-link">Si（内向的感覚）</a>
              <a href="function.html?code=se" class="header__dropdown-link">Se（外向的感覚）</a>
              <a href="function.html?code=ti" class="header__dropdown-link">Ti（内向的思考）</a>
              <a href="function.html?code=te" class="header__dropdown-link">Te（外向的思考）</a>
              <a href="function.html?code=fi" class="header__dropdown-link">Fi（内向的感情）</a>
              <a href="function.html?code=fe" class="header__dropdown-link">Fe（外向的感情）</a>
            </div>
          </div>
          <a href="types.html" class="header__nav-link">タイプ一覧</a>
        </nav>

        <!-- ハンバーガーメニューボタン（モバイル用） -->
        <button class="header__hamburger" aria-label="メニューを開く" aria-expanded="false">
          <span class="header__hamburger-line"></span>
          <span class="header__hamburger-line"></span>
          <span class="header__hamburger-line"></span>
        </button>
      </div>
    `;
  }

  // ==========================================
  // フォールバックHTML（最小限）
  // ==========================================
  function getFallbackTemplate() {
    return `
      <div class="header__container">
        <a href="index.html" class="header__logo" aria-label="ホームに戻る">
          <span class="header__logo-text">Persona Finder</span>
        </a>
        <nav class="header__nav">
          <a href="index.html" class="header__nav-link">Home</a>
        </nav>
      </div>
    `;
  }

  // ==========================================
  // メイン初期化処理
  // ==========================================
  function initializeHeader() {
    log('Initialization started');

    const header = document.querySelector(".header");
    
    // ヘッダー要素が存在しない場合
    if (!header) {
      log('.header element not found', 'error');
      return false;
    }

    try {
      // HTMLを挿入
      header.innerHTML = getHeaderTemplate();
      log('HTML injected successfully');

      // 各機能を初期化
      if (CONFIG.enableDropdown) {
        initializeDropdown();
      }

      if (CONFIG.enableScrollEffect) {
        initializeScrollHandler();
      }

      // モバイルメニュー初期化
      initializeMobileMenu();

      log('Initialization completed');
      return true;

    } catch (error) {
      log(`Initialization failed: ${error.message}`, 'error');
      
      // フォールバック処理
      try {
        header.innerHTML = getFallbackTemplate();
        log('Fallback template applied', 'warn');
        return true;
      } catch (fallbackError) {
        log(`Fallback failed: ${fallbackError.message}`, 'error');
        return false;
      }
    }
  }

  // ==========================================
  // ドロップダウン初期化
  // ==========================================
  function initializeDropdown() {
    const dropdown = document.querySelector(".header__dropdown");
    
    if (!dropdown) {
      log('Dropdown element not found', 'warn');
      return;
    }

    try {
      // クリックでトグル
      document.addEventListener("click", (e) => {
        if (dropdown.contains(e.target)) {
          dropdown.classList.toggle("header__dropdown--open");
          log('Dropdown toggled');
        } else {
          dropdown.classList.remove("header__dropdown--open");
        }
      });

      // キーボード対応（アクセシビリティ）
      const dropdownTrigger = dropdown.querySelector(".header__dropdown-trigger");
      if (dropdownTrigger) {
        dropdownTrigger.setAttribute('role', 'button');
        dropdownTrigger.setAttribute('tabindex', '0');
        
        dropdownTrigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle("header__dropdown--open");
          } else if (e.key === 'Escape') {
            dropdown.classList.remove("header__dropdown--open");
          }
        });
      }

      log('Dropdown initialized');

    } catch (error) {
      log(`Dropdown initialization failed: ${error.message}`, 'error');
    }
  }

  // ==========================================
  // スクロールハンドラー初期化
  // ==========================================
  function initializeScrollHandler() {
    const header = document.querySelector(".header");
    
    if (!header) {
      log('Header element not found for scroll handler', 'warn');
      return;
    }

    try {
      let lastScrollY = window.scrollY;
      let ticking = false;

      function updateHeader() {
        const scrollY = window.scrollY;
        
        if (scrollY > CONFIG.scrollThreshold) {
          header.classList.add("header--scrolled");
        } else {
          header.classList.remove("header--scrolled");
        }

        lastScrollY = scrollY;
        ticking = false;
      }

      // パフォーマンス最適化（requestAnimationFrame使用）
      window.addEventListener("scroll", () => {
        if (!ticking) {
          window.requestAnimationFrame(updateHeader);
          ticking = true;
        }
      });

      log('Scroll handler initialized');

    } catch (error) {
      log(`Scroll handler initialization failed: ${error.message}`, 'error');
    }
  }

  // ==========================================
  // モバイルメニュー初期化
  // ==========================================
  function initializeMobileMenu() {
    const hamburger = document.querySelector(".header__hamburger");
    const nav = document.querySelector(".header__nav");

    if (!hamburger || !nav) {
      log('Mobile menu elements not found', 'warn');
      return;
    }

    try {
      hamburger.addEventListener("click", () => {
        const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
        
        hamburger.classList.toggle("header__hamburger--active");
        nav.classList.toggle("header__nav--active");
        
        // アクセシビリティ属性更新
        hamburger.setAttribute('aria-expanded', !isExpanded);
        hamburger.setAttribute('aria-label', isExpanded ? 'メニューを開く' : 'メニューを閉じる');
        
        log(`Mobile menu ${isExpanded ? 'closed' : 'opened'}`);
      });

      // メニュー外をクリックしたら閉じる
      document.addEventListener("click", (e) => {
        if (!hamburger.contains(e.target) && !nav.contains(e.target)) {
          if (nav.classList.contains("header__nav--active")) {
            hamburger.classList.remove("header__hamburger--active");
            nav.classList.remove("header__nav--active");
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.setAttribute('aria-label', 'メニューを開く');
          }
        }
      });

      log('Mobile menu initialized');

    } catch (error) {
      log(`Mobile menu initialization failed: ${error.message}`, 'error');
    }
  }

  // ==========================================
  // 実行
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const success = initializeHeader();
      if (!success) {
        log('Header failed to initialize', 'error');
      }
    });
  } else {
    const success = initializeHeader();
    if (!success) {
      log('Header failed to initialize', 'error');
    }
  }

})();