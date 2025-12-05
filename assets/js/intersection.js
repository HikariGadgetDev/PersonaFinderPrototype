// ==========================================
// intersection.js
// セクションのフェードイン制御（IntersectionObserver版）
//
// 機能:
//  - main > section をまとめて監視
//  - ビューポートに入ったらクラスを付与してアニメーション開始
//  - data-section-anim でクラス名を差し替え可能
//    例: <section data-section-anim="section--fade-up">...</section>
//    → デフォルトは "section--visible"
//  - IntersectionObserver 非対応 / prefers-reduced-motion の場合は
//    全セクションに即時クラス付与（フェードなし）
//
// 使い方（HTML 側）:
//  <section class="hero" data-section-anim="section--fade-up">...</section>
//  <section class="types">...</section> <!-- デフォルト: section--visible -->
//
// 使い方（CSS 側の例）:
//  .section--visible   { opacity: 1; transform: none; transition: ...; }
//  .section--fade-up   { opacity: 1; transform: translateY(0); ... }
// ==========================================

(function () {
  'use strict';

  var DEBUG =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    new URLSearchParams(location.search).get('intersectionDebug') === 'true';

  function log(msg, level) {
    if (!DEBUG) return;
    var prefix = '[Intersection]';
    var lvl = level || 'info';
    var logger = console[lvl] || console.log;
    logger(prefix + ' ' + msg);
  }

  /**
   * セクションにアニメーションクラスを付与する
   * @param {HTMLElement} section
   */
  function activateSection(section) {
    if (!section) return;
    // section--visible / section--fade-up などを data 属性で切り替え
    var animClass = section.getAttribute('data-section-anim') || 'section--visible';
    section.classList.add(animClass);
  }

  /**
   * 古いブラウザ / reduced-motion 環境用フォールバック
   * すべてのセクションを即時表示状態にする
   * @param {NodeListOf<HTMLElement>} sections
   */
  function activateAllImmediately(sections) {
    sections.forEach(function (section) {
      activateSection(section);
    });
    log('Fallback: all sections activated immediately');
  }

  function setupIntersection() {
    var main = document.querySelector('main');
    if (!main) {
      log('main element not found, abort', 'warn');
      return;
    }

    // 対象: main 直下 / 配下の section を一括監視
    /** @type {NodeListOf<HTMLElement>} */
    var sections = main.querySelectorAll('section');
    if (!sections.length) {
      log('no <section> under <main>, nothing to observe', 'info');
      return;
    }

    // ユーザーがモーション軽減を希望している場合は、即時表示
    var prefersReducedMotion = false;
    try {
      prefersReducedMotion =
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      // ignore
    }

    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      log(
        !('IntersectionObserver' in window)
          ? 'IntersectionObserver not supported, using fallback'
          : 'prefers-reduced-motion detected, skip animation'
      );
      activateAllImmediately(sections);
      return;
    }

    // IntersectionObserver 対応ブラウザ: 実際に監視する
    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          var target = entry.target;
          activateSection(target);
          obs.unobserve(target); // 一度表示したら監視解除
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px', // 少し早めに発火させる
        threshold: 0.15
      }
    );

    sections.forEach(function (section) {
      // すでにクラスが付与されているセクションはスキップしてもよいが、
      // ここでは一旦そのまま監視に回す（CSS 側で制御可能）。
      observer.observe(section);
    });

    log('IntersectionObserver initialized for ' + sections.length + ' sections');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupIntersection);
  } else {
    setupIntersection();
  }
})();
