// assets/js/slider.js
(function () {
  'use strict';

  /**
   * モバイル専用・無限ループ横スクロール (リファクタ版)
   *
   * 改善点:
   * - スクロールイベントにスロットリング追加 (パフォーマンス改善)
   * - デバッグログ機能追加
   * - エラーハンドリング強化
   * - リサイズ処理の最適化 (デバウンス)
   * - メモリリーク対策
   *
   * @param {HTMLElement|string} target - コンテナ要素 or セレクタ文字列
   * @param {Object} options - オプション設定
   */
  function initInfiniteScroll(target, options = {}) {
    // デフォルト設定
    const config = {
      mobileBreakpoint: 768,
      scrollThrottle: 50,       // スクロールイベントのスロットル間隔 (ms)
      resizeDebounce: 200,      // リサイズイベントのデバウンス間隔 (ms)
      leftBoundaryFactor: 0.4,  // 左端判定の閾値
      rightBoundaryFactor: 1.6, // 右端判定の閾値
      debug: false,             // デバッグモード（true or string ならログ出力）
      ...options,               // ← 上書き可能なオプション
    };

    // デバッグログ
    function log(message, level = 'info') {
      if (!config.debug) return;

      const prefix = '[InfiniteScroll]';
      const logMethod = console[level] || console.log;
      logMethod(`${prefix} ${typeof config.debug === 'string' ? `[${config.debug}] ` : ''}${message}`);
    }

    // コンテナ要素の取得
    const container =
      typeof target === 'string'
        ? document.querySelector(target)
        : target;

    if (!container) {
      log(`Container not found: ${target}`, 'warn');
      return null;
    }

    // モバイル幅チェック
    if (window.innerWidth > config.mobileBreakpoint) {
      log(`Skipped (desktop): ${target}`, 'info');
      return null;
    }

    const originalItems = Array.from(container.children);

    // アイテムが1つ以下の場合はスキップ
    if (originalItems.length <= 1) {
      log(`Skipped (insufficient items): ${target}`, 'warn');
      return null;
    }

    try {
      container.classList.add('pf-slider');

      // --- 1. 前後にクローンを配置 ---
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

      container.insertBefore(beforeFragment, container.firstChild);
      container.appendChild(afterFragment);

      const allItems = Array.from(container.children);
      allItems.forEach((el) => el.classList.add('pf-slider__item'));

      log(`Initialized with ${originalItems.length} items (${allItems.length} total)`, 'info');

      // --- 2. スクロール制御の状態管理 ---
      let baseWidth = 0;
      let adjusting = false;
      let scrollTimeout = null;
      let resizeTimeout = null;

      // ベース幅の計算
      function computeBaseWidth() {
        const newBaseWidth = container.scrollWidth / 3;
        if (newBaseWidth !== baseWidth) {
          baseWidth = newBaseWidth;
          log(`Base width computed: ${baseWidth}px`, 'info');
        }
        return baseWidth;
      }

      // 中央ブロックへの瞬間移動
      function jumpToMiddleBlock(offsetFactor = 0) {
        adjusting = true;

        const targetScroll = baseWidth * (1 + offsetFactor);

        container.scrollTo({
          left: targetScroll,
          behavior: 'instant' in window ? 'instant' : 'auto',
        });

        log(`Jumped to middle block (offset: ${offsetFactor})`, 'info');

        // 調整フラグをリセット
        requestAnimationFrame(() => {
          adjusting = false;
        });
      }

      // スクロール位置の調整処理（スロットル付き）
      function handleScrollWithThrottle() {
        if (scrollTimeout) return;

        scrollTimeout = setTimeout(() => {
          scrollTimeout = null;

          if (adjusting || baseWidth === 0) return;

          const x = container.scrollLeft;
          const leftBoundary = baseWidth * config.leftBoundaryFactor;
          const rightBoundary = baseWidth * config.rightBoundaryFactor;

          // 左端クローンに入り込んだ → 本体ブロックの同じ位置にワープ
          if (x < leftBoundary) {
            adjusting = true;
            const newPosition = x + baseWidth;

            container.scrollTo({
              left: newPosition,
              behavior: 'auto',
            });

            log(`Jumped from left clone (${x}px → ${newPosition}px)`, 'info');

            requestAnimationFrame(() => {
              adjusting = false;
            });
          }
          // 右端クローンに入り込んだ → 本体ブロックの同じ位置にワープ
          else if (x > rightBoundary) {
            adjusting = true;
            const newPosition = x - baseWidth;

            container.scrollTo({
              left: newPosition,
              behavior: 'auto',
            });

            log(`Jumped from right clone (${x}px → ${newPosition}px)`, 'info');

            requestAnimationFrame(() => {
              adjusting = false;
            });
          }
        }, config.scrollThrottle);
      }

      // リサイズ処理（デバウンス付き）
      function handleResizeWithDebounce() {
        if (window.innerWidth > config.mobileBreakpoint) {
          log('Disabled on desktop after resize', 'info');
          return;
        }

        clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(() => {
          computeBaseWidth();
          // リサイズ後は中央に再配置
          jumpToMiddleBlock(0);
          log('Repositioned after resize', 'info');
        }, config.resizeDebounce);
      }

      // --- 3. 初期化 ---
      requestAnimationFrame(() => {
        computeBaseWidth();
        jumpToMiddleBlock(0);
      });

      // --- 4. イベントリスナー登録 ---
      container.addEventListener('scroll', handleScrollWithThrottle, { passive: true });
      window.addEventListener('resize', handleResizeWithDebounce);

      log(`Slider initialized successfully: ${target}`, 'info');

      // --- 5. クリーンアップ関数を返す ---
      return function destroy() {
        container.removeEventListener('scroll', handleScrollWithThrottle);
        window.removeEventListener('resize', handleResizeWithDebounce);

        clearTimeout(scrollTimeout);
        clearTimeout(resizeTimeout);

        // クローンを削除して元の状態に戻す
        const clones = container.querySelectorAll('.pf-slider__clone');
        clones.forEach((clone) => clone.remove());

        container.classList.remove('pf-slider');

        allItems.forEach((item) => item.classList.remove('pf-slider__item'));

        log(`Slider destroyed: ${target}`, 'info');
      };
    } catch (error) {
      log(`Initialization failed: ${error.message}`, 'error');
      console.error('[InfiniteScroll] Error:', error);
      return null;
    }
  }

  // --- グローバルに公開（デバッグ用） ---
  window.initInfiniteScroll = initInfiniteScroll;

  // --- DOM 構築後に各セクションへ適用 ---
  document.addEventListener('DOMContentLoaded', () => {
    // ここでの log 用に簡易ラッパー
    function log(message, level = 'info') {
      const prefix = '[InfiniteScroll]';
      const logMethod = console[level] || console.log;
      logMethod(`${prefix} ${message}`);
    }

    log('Starting slider initialization.', 'info');

    const destroyFunctions = [];

    // デバッグモードの判定（開発時は ?debug=true をURLに追加）
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true';

    const sliderOptions = {
      debug: debugMode,
      scrollThrottle: 50,
      resizeDebounce: 200,
    };

    // 各スライダーを初期化
    try {
      // モード選択（3カード）
      const modeSelectorDestroy = initInfiniteScroll('.mode-selector', sliderOptions);
      if (modeSelectorDestroy) destroyFunctions.push(modeSelectorDestroy);

      // 認知機能グリッド
      const cognitiveDestroy = initInfiniteScroll('.cognitive__grid', sliderOptions);
      if (cognitiveDestroy) destroyFunctions.push(cognitiveDestroy);

      // 16タイプは .types__grid が複数あるので全部に適用
      document.querySelectorAll('.types__grid').forEach((grid, index) => {
        const typesDestroy = initInfiniteScroll(grid, {
          ...sliderOptions, // ← ここもスプレッドでマージ
          // 各グリッドを識別できるようにログに表示
          debug: debugMode ? `types__grid[${index}]` : false,
        });
        if (typesDestroy) destroyFunctions.push(typesDestroy);
      });

      log(`All sliders initialized (${destroyFunctions.length} total)`, 'info');
    } catch (error) {
      log(`Failed to initialize sliders: ${error.message}`, 'error');
      console.error('[InfiniteScroll] Initialization error:', error);
    }

    // クリーンアップ関数をグローバルに公開（デバッグ・テスト用）
    window.destroyAllSliders = function () {
      destroyFunctions.forEach((destroy) => {
        try {
          destroy();
        } catch (error) {
          const prefix = '[InfiniteScroll]';
          const logMethod = console.error || console.log;
          logMethod(`${prefix} Destroy failed: ${error.message}`);
        }
      });
      destroyFunctions.length = 0;
      log('All sliders destroyed', 'info');
    };
  });
})();
