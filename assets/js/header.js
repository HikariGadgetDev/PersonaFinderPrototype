// ==========================================
// header.js - BEM対応版（リファクタ / 本番想定）
//
// 機能:
//  - .header 要素内にグローバルヘッダーを動的挿入
//  - ドロップダウンメニュー（認知機能リンク）
//  - スクロール時のヘッダーエフェクト
//  - モバイルハンバーガーメニュー
//  - 現在ページのナビリンクに aria-current="page" を付与
//
// 依存:
//  - header.css（BEM: .header__*）
//  - <div class="header"></div> が index.html 側に存在すること
// ==========================================

(function () {
  'use strict';

  // ==========================================
  // 設定
  // ==========================================
  const CONFIG = {
    enableDropdown: true,
    enableScrollEffect: true,
    scrollThreshold: 60,

    // デバッグ: ローカルホスト or ?headerDebug=true のときのみ true
    debug: (function () {
      try {
        const host = location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return true;
        const params = new URLSearchParams(location.search);
        if (params.get('headerDebug') === 'true') return true;
      } catch (e) {
        // ignore
      }
      return false;
    })()
  };

  // デバッグログ
  function log(message, level) {
    if (!CONFIG.debug) return;
    const prefix = '[Header]';
    const lvl = level || 'info';
    const logger = console[lvl] || console.log;
    logger(prefix + ' ' + message);
  }

  // ==========================================
  // ページ情報の判定（現在地ハイライト用）
  // ==========================================
  function getCurrentPageId() {
    const path = location.pathname || '';
    const search = location.search || '';

    // シンプルな判定: 末尾ファイル名 + パラメータで分岐
    if (path.endsWith('/index.html') || path === '/' || path === '') {
      return 'home';
    }
    if (path.endsWith('/finder') || path.endsWith('/finder.html')) {
      return 'finder';
    }
    if (path.endsWith('/function') || path.endsWith('/function.html')) {
      return 'function';
    }
    if (path.endsWith('/types') || path.endsWith('/types.html')) {
      return 'types';
    }
    if (path.endsWith('/personality.html')) {
      return 'personality';
    }

    // 例: function.html?code=ni など
    if (search.indexOf('code=') !== -1 && path.indexOf('function') !== -1) {
      return 'function';
    }

    return 'unknown';
  }

  // aria-label 用
  function getHeaderAriaLabel() {
    const pageId = getCurrentPageId();

    switch (pageId) {
      case 'home':
        return 'Persona Finder トップページ';
      case 'finder':
        return 'Persona Finder 診断ページ';
      case 'function':
        return 'Persona Finder 認知機能詳細ページ';
      case 'types':
        return 'Persona Finder タイプ一覧ページ';
      case 'personality':
        return 'Persona Finder 性格類型詳細ページ';
      default:
        return 'Persona Finder ナビゲーション';
    }
  }

  // ==========================================
  // ヘッダーHTMLテンプレート
  // ==========================================
  function getHeaderTemplate() {
    const ariaLabel = getHeaderAriaLabel();

    return (
      '<div class="header__container">' +
        // ロゴ
        '<a href="index.html" class="header__logo" aria-label="' + ariaLabel + '">' +
          '<div class="header__logo-icon" aria-hidden="true">Ψ</div>' +
          '<span class="header__logo-text">Persona Finder</span>' +
        '</a>' +

        // ナビゲーション
        '<nav' +
          ' class="header__nav"' +
          ' id="global-nav"' +
          ' role="navigation"' +
          ' aria-label="グローバルナビゲーション"' +
        '>' +
          '<a href="index.html" class="header__nav-link" data-nav="home">Home</a>' +

          // 認知機能ドロップダウン
          '<div class="header__dropdown">' +
            '<span' +
              ' class="header__dropdown-trigger"' +
              ' role="button"' +
              ' tabindex="0"' +
              ' aria-haspopup="true"' +
              ' aria-expanded="false"' +
              ' aria-controls="header-cog-menu"' +
            '>' +
              '認知機能' +
            '</span>' +
            '<div' +
              ' class="header__dropdown-menu"' +
              ' id="header-cog-menu"' +
              ' role="menu"' +
            '>' +
              '<a href="function.html?code=ni" class="header__dropdown-link" role="menuitem">Ni（内向的直観）</a>' +
              '<a href="function.html?code=ne" class="header__dropdown-link" role="menuitem">Ne（外向的直観）</a>' +
              '<a href="function.html?code=si" class="header__dropdown-link" role="menuitem">Si（内向的感覚）</a>' +
              '<a href="function.html?code=se" class="header__dropdown-link" role="menuitem">Se（外向的感覚）</a>' +
              '<a href="function.html?code=ti" class="header__dropdown-link" role="menuitem">Ti（内向的思考）</a>' +
              '<a href="function.html?code=te" class="header__dropdown-link" role="menuitem">Te（外向的思考）</a>' +
              '<a href="function.html?code=fi" class="header__dropdown-link" role="menuitem">Fi（内向的感情）</a>' +
              '<a href="function.html?code=fe" class="header__dropdown-link" role="menuitem">Fe（外向的感情）</a>' +
            '</div>' +
          '</div>' +

          '<a href="types.html" class="header__nav-link" data-nav="types">タイプ一覧</a>' +
        '</nav>' +

        // ハンバーガーメニュー
        '<button' +
          ' class="header__hamburger"' +
          ' aria-label="メニューを開く"' +
          ' aria-expanded="false"' +
          ' aria-controls="global-nav"' +
        '>' +
          '<span class="header__hamburger-line"></span>' +
          '<span class="header__hamburger-line"></span>' +
          '<span class="header__hamburger-line"></span>' +
        '</button>' +
      '</div>'
    );
  }

  // フォールバックHTML（最低限）
  function getFallbackTemplate() {
    return (
      '<div class="header__container">' +
        '<a href="index.html" class="header__logo" aria-label="ホームに戻る">' +
          '<span class="header__logo-text">Persona Finder</span>' +
        '</a>' +
        '<nav' +
          ' class="header__nav"' +
          ' role="navigation"' +
          ' aria-label="グローバルナビゲーション"' +
        '>' +
          '<a href="index.html" class="header__nav-link" data-nav="home">Home</a>' +
        '</nav>' +
      '</div>'
    );
  }

  // ==========================================
  // 現在ページのナビリンクに aria-current 付与
  // ==========================================
  function markCurrentNavLink(headerElement) {
    if (!headerElement) return;
    var pageId = getCurrentPageId();

    try {
      var nav = headerElement.querySelector('.header__nav');
      if (!nav) return;

      var links = nav.querySelectorAll('.header__nav-link');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var navId = link.getAttribute('data-nav');

        // シンプルに home/types のみ対象（必要なら拡張）
        var isCurrent = false;
        if (pageId === 'home' && navId === 'home') isCurrent = true;
        if (pageId === 'types' && navId === 'types') isCurrent = true;

        if (isCurrent) {
          link.setAttribute('aria-current', 'page');
          link.classList.add('header__nav-link--current');
        } else {
          link.removeAttribute('aria-current');
          link.classList.remove('header__nav-link--current');
        }
      }
    } catch (e) {
      log('Failed to mark current nav link: ' + e.message, 'warn');
    }
  }

  // ==========================================
  // ドロップダウン初期化（A11y対応）
  // ==========================================
  function initializeDropdown() {
    var dropdown = document.querySelector('.header__dropdown');
    if (!dropdown) {
      log('Dropdown element not found', 'warn');
      return;
    }

    var trigger = dropdown.querySelector('.header__dropdown-trigger');
    var menu = dropdown.querySelector('.header__dropdown-menu');

    if (!trigger || !menu) {
      log('Dropdown trigger or menu not found', 'warn');
      return;
    }

    var menuItems = menu.querySelectorAll('.header__dropdown-link');

    function openDropdown() {
      dropdown.classList.add('header__dropdown--open');
      trigger.setAttribute('aria-expanded', 'true');
    }

    function closeDropdown() {
      dropdown.classList.remove('header__dropdown--open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function toggleDropdown() {
      if (dropdown.classList.contains('header__dropdown--open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    }

    // クリックでトグル
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDropdown();
    });

    // トリガーのキーボード操作
    trigger.addEventListener('keydown', function (e) {
      var key = e.key;

      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        toggleDropdown();
      } else if (key === 'Escape') {
        e.preventDefault();
        closeDropdown();
        trigger.focus();
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (!dropdown.classList.contains('header__dropdown--open')) {
          openDropdown();
        }
        if (menuItems.length > 0) {
          menuItems[0].focus();
        }
      }
    });

    // メニュー内で Escape
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
        trigger.focus();
      }
    });

    // 外側クリックで閉じる
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) {
        if (dropdown.classList.contains('header__dropdown--open')) {
          closeDropdown();
        }
      }
    });

    log('Dropdown initialized');
  }

  // ==========================================
  // スクロールハンドラー初期化
  // ==========================================
  function initializeScrollHandler() {
    var header = document.querySelector('.header');
    if (!header) {
      log('Header element not found for scroll handler', 'warn');
      return;
    }

    var ticking = false;

    function updateHeader() {
      var scrollY = window.scrollY || window.pageYOffset || 0;

      if (scrollY > CONFIG.scrollThreshold) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    });

    log('Scroll handler initialized');
  }

  // ==========================================
  // モバイルメニュー初期化
  // ==========================================
  function initializeMobileMenu() {
    var hamburger = document.querySelector('.header__hamburger');
    var nav = document.querySelector('.header__nav');

    if (!hamburger || !nav) {
      log('Mobile menu elements not found', 'warn');
      return;
    }

    function openMenu() {
      hamburger.classList.add('header__hamburger--active');
      nav.classList.add('header__nav--active');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.setAttribute('aria-label', 'メニューを閉じる');
      log('Mobile menu opened');
    }

    function closeMenu() {
      hamburger.classList.remove('header__hamburger--active');
      nav.classList.remove('header__nav--active');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'メニューを開く');
      log('Mobile menu closed');
    }

    function toggleMenu() {
      var isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    // クリックでトグル
    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    // メニュー外クリックで閉じる
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !nav.contains(e.target)) {
        if (nav.classList.contains('header__nav--active')) {
          closeMenu();
        }
      }
    });

    // Escapeキーで閉じる
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' &&
          nav.classList.contains('header__nav--active')) {
        closeMenu();
        hamburger.focus();
      }
    });

    log('Mobile menu initialized');
  }

  // ==========================================
  // メイン初期化処理
  // ==========================================
  function initializeHeader() {
    log('Initialization started');

    var header = document.querySelector('.header');
    if (!header) {
      log('.header element not found', 'error');
      return false;
    }

    try {
      header.innerHTML = getHeaderTemplate();
      log('HTML injected successfully');

      // 現在ページのナビリンクをマーク
      markCurrentNavLink(header);

      if (CONFIG.enableDropdown) {
        initializeDropdown();
      }

      if (CONFIG.enableScrollEffect) {
        initializeScrollHandler();
      }

      initializeMobileMenu();

      log('Initialization completed');
      return true;
    } catch (error) {
      log('Initialization failed: ' + error.message, 'error');

      try {
        header.innerHTML = getFallbackTemplate();
        log('Fallback template applied', 'warn');
        markCurrentNavLink(header);
        return true;
      } catch (fallbackError) {
        log('Fallback failed: ' + fallbackError.message, 'error');
        return false;
      }
    }
  }

  // ==========================================
  // 実行
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      var success = initializeHeader();
      if (!success) {
        log('Header failed to initialize', 'error');
      }
    });
  } else {
    var success = initializeHeader();
    if (!success) {
      log('Header failed to initialize', 'error');
    }
  }
})();
