// assets/js/slider.js
(function () {
  'use strict';

  /**
   * モバイル専用・無限ループ横スクロール
   * - レイアウトは CSS の flex / scroll-snap に完全依存
   * - JS は「両端にクローンを足す」＋「端に来たら中央ブロックへジャンプ」だけ
   * - 自動スクロールは一切なし（完全手動）
   *
   * @param {HTMLElement|string} target - コンテナ要素 or セレクタ文字列
   */
  function initInfiniteScroll(target) {
    const container =
      typeof target === 'string' ? document.querySelector(target) : target;

    if (!container) return;

    // モバイル幅だけ有効にする（PCレイアウトは素のまま）
    if (window.innerWidth > 768) return;

    const originalItems = Array.from(container.children);
    if (originalItems.length <= 1) return;

    container.classList.add('pf-slider');

    // --- 1. 前後にクローンを配置（[クローン前] [本体] [クローン後]）---

    const beforeFragment = document.createDocumentFragment();
    const afterFragment = document.createDocumentFragment();

    originalItems.forEach((item) => {
      const beforeClone = item.cloneNode(true);
      const afterClone = item.cloneNode(true);
      beforeClone.classList.add('pf-slider__clone');
      afterClone.classList.add('pf-slider__clone');
      beforeFragment.appendChild(beforeClone);
      afterFragment.appendChild(afterClone);
    });

    // DOM順を [前クローン][本体][後クローン] にする
    container.insertBefore(beforeFragment, container.firstChild);
    container.appendChild(afterFragment);

    // 本体＋クローンも含めた全カード
    const allItems = Array.from(container.children);
    allItems.forEach((el) => el.classList.add('pf-slider__item'));

    // --- 2. 中央ブロック（本体）の先頭位置に初期スクロール ---
    let baseWidth = 0;
    let adjusting = false;

    function computeBaseWidth() {
      // クローンを含めた全幅を 3 で割る = 1ブロック分の幅（前 / 本体 / 後）
      baseWidth = container.scrollWidth / 3;
    }

    function jumpToMiddleBlockWithoutAnimation(offsetFactor) {
      // offsetFactor: 0 = 本体の先頭, 1 = 1ブロック分ずらす etc.
      adjusting = true;
      container.scrollTo({
        left: baseWidth * (1 + offsetFactor), // 真ん中ブロック基準
        behavior: 'instant' in window ? 'instant' : 'auto',
      });
      // 1フレーム後にフラグ解除
      requestAnimationFrame(() => {
        adjusting = false;
      });
    }

    // 初期化時にベース幅と位置をセット
    requestAnimationFrame(() => {
      computeBaseWidth();
      // 真ん中の「本体ブロック」の先頭へ移動
      jumpToMiddleBlockWithoutAnimation(0);
    });

    // --- 3. スクロール時に「端を跨いだら中央へ戻す」処理 ---

    container.addEventListener('scroll', () => {
      if (adjusting || baseWidth === 0) return;

      const x = container.scrollLeft;
      const leftBoundary = baseWidth * 0.4; // 左側に寄りすぎ
      const rightBoundary = baseWidth * 1.6; // 右側に寄りすぎ

      // 左端クローン側に入り込んだ → 本体ブロックの同じ位置にワープ
      if (x < leftBoundary) {
        adjusting = true;
        container.scrollTo({
          left: x + baseWidth,
          behavior: 'auto',
        });
        requestAnimationFrame(() => {
          adjusting = false;
        });
      }
      // 右端クローン側に入り込んだ → 本体ブロックの同じ位置にワープ
      else if (x > rightBoundary) {
        adjusting = true;
        container.scrollTo({
          left: x - baseWidth,
          behavior: 'auto',
        });
        requestAnimationFrame(() => {
          adjusting = false;
        });
      }
    });

    // 念のためリサイズ時にもベース幅を更新（スマホ縦横切替など）
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) return;
      computeBaseWidth();
    });
  }

  // DOM 構築後に各セクションへ適用
  document.addEventListener('DOMContentLoaded', () => {
    // スマホ表示が前提。PCで確認するときは DevTools のレスポンシブモードにしてリロード。

    // 1つだけのコンテナたち
    initInfiniteScroll('.mode-selector');
    initInfiniteScroll('.cognitive__grid');

    // 16タイプは .types__grid が複数あるので全部に適用
    document.querySelectorAll('.types__grid').forEach((grid) => {
      initInfiniteScroll(grid);
    });
  });
})();
