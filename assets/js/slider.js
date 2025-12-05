// ==========================================
// assets/js/slider.js
// モバイル専用・無限ループ横スクロール (再利用性高め版)
//
// 役割:
//  - 横スクロール要素を「前後にクローンを付けた3ブロック構成」に変換
//  - 左右端に到達したとき、中央ブロックにシームレスにワープさせる
//  - スクロールイベントにスロットリング、リサイズにデバウンスを適用
//  - destroy() でクリーンアップ可能なユーティリティとして提供
//
// 設計ポイント:
//  - initInfiniteScroll(target, options) を「中核のユーティリティ」として定義
//  - ページごとのプリセット初期化関数：
//      - initModeSelectorSlider(options?)
//      - initCognitiveSlider(options?)
//      - initTypesSliders(options?)  // 複数 .types__grid 対応
//  - IIFE (function(global){ ... })(window) 形式で、footer.js と統一。
//  - 外部から global.initInfiniteScroll などを直接呼ぶことを想定。
// ==========================================

(function (global) {
  'use strict';

  // ===========================
  // 型定義 (JSDoc)
  // ===========================

  /**
   * @typedef {Object} SliderOptions
   * @property {number} [mobileBreakpoint] - モバイルと判定する幅(px)。これより大きい幅では無効（デフォルト: 768）
   * @property {number} [scrollThrottle] - スクロールイベントのスロットル間隔(ms)
   * @property {number} [resizeDebounce] - リサイズイベントのデバウンス間隔(ms)
   * @property {number} [leftBoundaryFactor] - 左端判定の閾値 (baseWidth * factor)
   * @property {number} [rightBoundaryFactor] - 右端判定の閾値 (baseWidth * factor)
   * @property {boolean} [enableOnDesktop] - true の場合、デスクトップでも有効化（デフォルト: false）
   * @property {boolean|string} [debug] - デバッグモード。true またはラベル文字列ならログ出力
   */

  /**
   * @typedef {Partial<SliderOptions>} SliderInitOptions
   * SliderOptions の全プロパティをオプショナル扱いする「外部公開用の初期化オプション」。
   * プリセット関数 (initModeSelectorSlider など) から受け取るのは常にこちら。
   */

  // ===========================
  // デフォルト設定
  // ===========================

  /**
   * SliderOptions を生成する小さなファクトリ関数。
   *
   * @param {SliderInitOptions} [overrides]
   * @returns {SliderOptions}
   */
  function createDefaultSliderOptions(overrides) {
    const base = overrides || {};
    return {
      mobileBreakpoint:
        typeof base.mobileBreakpoint === 'number'
          ? base.mobileBreakpoint
          : 768,
      scrollThrottle:
        typeof base.scrollThrottle === 'number' ? base.scrollThrottle : 50,
      resizeDebounce:
        typeof base.resizeDebounce === 'number' ? base.resizeDebounce : 200,
      leftBoundaryFactor:
        typeof base.leftBoundaryFactor === 'number'
          ? base.leftBoundaryFactor
          : 0.4,
      rightBoundaryFactor:
        typeof base.rightBoundaryFactor === 'number'
          ? base.rightBoundaryFactor
          : 1.6,
      enableOnDesktop:
        typeof base.enableOnDesktop === 'boolean'
          ? base.enableOnDesktop
          : false,
      debug: base.debug || false
    };
  }

  // ===========================
  // 中核ユーティリティ:
  // initInfiniteScroll
  // ===========================

  /**
   * 無限ループ横スクロールのコア実装。
   *
   * @param {HTMLElement|string} target - コンテナ要素 or セレクタ文字列
   * @param {SliderInitOptions} [options] - 初期化オプション (Partial<SliderOptions>)
   * @returns {(function(): void)|null} destroy 関数 or 無効な場合は null
   */
  function initInfiniteScroll(target, options) {
    const config = createDefaultSliderOptions(options);

    // デバッグログ
    function log(message, level) {
      if (!config.debug) return;
      const prefix = '[InfiniteScroll]';
      const tag =
        typeof config.debug === 'string' ? '[' + config.debug + '] ' : '';
      const logger = global.console[level] || global.console.log;
      logger(prefix + ' ' + tag + message);
    }

    // コンテナ要素の取得
    /** @type {HTMLElement|null} */
    const container =
      typeof target === 'string'
        ? global.document.querySelector(target)
        : target;

    if (!container) {
      log('Container not found: ' + String(target), 'warn');
      return null;
    }

    // モバイル幅チェック（デフォルトでは PC では無効）
    if (!config.enableOnDesktop && global.innerWidth > config.mobileBreakpoint) {
      log('Skipped (desktop): ' + String(target), 'info');
      return null;
    }

    const originalItems = Array.from(container.children);

    // アイテムが1つ以下の場合はスキップ
    if (originalItems.length <= 1) {
      log('Skipped (insufficient items): ' + String(target), 'warn');
      return null;
    }

    try {
      container.classList.add('pf-slider');

      // --- 1. 前後にクローンを配置 ---
      const beforeFragment = global.document.createDocumentFragment();
      const afterFragment = global.document.createDocumentFragment();

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

      log(
        'Initialized with ' +
          originalItems.length +
          ' items (' +
          allItems.length +
          ' total)',
        'info'
      );

      // --- 2. スクロール制御の状態管理 ---
      let baseWidth = 0;
      let adjusting = false;
      /** @type {number|null} */
      let scrollTimeout = null;
      /** @type {number|null} */
      let resizeTimeout = null;

      // ベース幅の計算
      function computeBaseWidth() {
        const newBaseWidth = container.scrollWidth / 3;
        if (newBaseWidth !== baseWidth) {
          baseWidth = newBaseWidth;
          log('Base width computed: ' + baseWidth + 'px', 'info');
        }
        return baseWidth;
      }

      // 中央ブロックへの瞬間移動
      function jumpToMiddleBlock(offsetFactor) {
        adjusting = true;

        const factor = typeof offsetFactor === 'number' ? offsetFactor : 0;
        const targetScroll = baseWidth * (1 + factor);

        container.scrollTo({
          left: targetScroll,
          // 'auto' は instant 相当。ブラウザ依存の 'instant' は使わない。
          behavior: 'auto'
        });

        log('Jumped to middle block (offset: ' + factor + ')', 'info');

        // 調整フラグを次フレームでリセット
        global.requestAnimationFrame(function () {
          adjusting = false;
        });
      }

      // スクロール位置の調整処理（スロットル付き）
      function handleScrollWithThrottle() {
        if (scrollTimeout !== null) return;

        scrollTimeout = global.setTimeout(function () {
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
              behavior: 'auto'
            });

            log(
              'Jumped from left clone (' + x + 'px → ' + newPosition + 'px)',
              'info'
            );

            global.requestAnimationFrame(function () {
              adjusting = false;
            });
          }
          // 右端クローンに入り込んだ → 本体ブロックの同じ位置にワープ
          else if (x > rightBoundary) {
            adjusting = true;
            const newPosition = x - baseWidth;

            container.scrollTo({
              left: newPosition,
              behavior: 'auto'
            });

            log(
              'Jumped from right clone (' + x + 'px → ' + newPosition + 'px)',
              'info'
            );

            global.requestAnimationFrame(function () {
              adjusting = false;
            });
          }
        }, config.scrollThrottle);
      }

      // リサイズ処理（デバウンス付き）
      function handleResizeWithDebounce() {
        // 途中でデスクトップ幅に広がった場合、ここでは単に再配置だけ行う。
        if (!config.enableOnDesktop && global.innerWidth > config.mobileBreakpoint) {
          log('Resize: now desktop width, keeping layout as-is', 'info');
        }

        if (resizeTimeout !== null) {
          global.clearTimeout(resizeTimeout);
        }

        resizeTimeout = global.setTimeout(function () {
          computeBaseWidth();
          // リサイズ後は中央に再配置
          jumpToMiddleBlock(0);
          log('Repositioned after resize', 'info');
        }, config.resizeDebounce);
      }

      // --- 3. 初期化 ---
      global.requestAnimationFrame(function () {
        computeBaseWidth();
        jumpToMiddleBlock(0);
      });

      // --- 4. イベントリスナー登録 ---
      container.addEventListener('scroll', handleScrollWithThrottle, {
        passive: true
      });
      global.addEventListener('resize', handleResizeWithDebounce);

      log('Slider initialized successfully: ' + String(target), 'info');

      // --- 5. クリーンアップ関数を返す ---
      return function destroy() {
        container.removeEventListener('scroll', handleScrollWithThrottle);
        global.removeEventListener('resize', handleResizeWithDebounce);

        if (scrollTimeout !== null) {
          global.clearTimeout(scrollTimeout);
          scrollTimeout = null;
        }
        if (resizeTimeout !== null) {
          global.clearTimeout(resizeTimeout);
          resizeTimeout = null;
        }

        // クローンを削除して元の状態に戻す
        const clones = container.querySelectorAll('.pf-slider__clone');
        clones.forEach(function (clone) {
          if (clone.parentNode) {
            clone.parentNode.removeChild(clone);
          }
        });

        container.classList.remove('pf-slider');

        allItems.forEach(function (item) {
          item.classList.remove('pf-slider__item');
        });

        log('Slider destroyed: ' + String(target), 'info');
      };
    } catch (error) {
      log('Initialization failed: ' + error.message, 'error');
      global.console.error('[InfiniteScroll] Error:', error);
      return null;
    }
  }

  // ===========================
  // プリセット初期化関数
  // ===========================

  /**
   * モード選択カード (.mode-selector) 用プリセット
   *
   * @param {SliderInitOptions} [baseOptions]
   * @returns {(function(): void)|null}
   */
  function initModeSelectorSlider(baseOptions) {
    const options = createDefaultSliderOptions(baseOptions);
    return initInfiniteScroll('.mode-selector', options);
  }

  /**
   * 認知機能グリッド (.cognitive__grid) 用プリセット
   *
   * @param {SliderInitOptions} [baseOptions]
   * @returns {(function(): void)|null}
   */
  function initCognitiveSlider(baseOptions) {
    const options = createDefaultSliderOptions(baseOptions);
    return initInfiniteScroll('.cognitive__grid', options);
  }

  /**
   * 16タイプカードグリッド (.types__grid, 複数想定) 用プリセット
   *
   * @param {SliderInitOptions} [baseOptions]
   * @returns {Array<function(): void>} destroy 関数の配列
   */
  function initTypesSliders(baseOptions) {
    const options = createDefaultSliderOptions(baseOptions);
    const destroys = [];

    const grids = global.document.querySelectorAll('.types__grid');
    grids.forEach(function (grid, index) {
      // debug が true のときだけラベルを細かく分ける
      /** @type {SliderInitOptions} */
      var localizedOptions = options;
      if (options.debug) {
        localizedOptions = {
          ...options,
          debug: typeof options.debug === 'string'
            ? options.debug + ':types__grid[' + index + ']'
            : 'types__grid[' + index + ']'
        };
      }

      const destroy = initInfiniteScroll(grid, localizedOptions);
      if (typeof destroy === 'function') {
        destroys.push(destroy);
      }
    });

    return destroys;
  }

  // ===========================
  // DOMContentLoaded での自動初期化
  // ===========================

  (function setupAutoInit() {
    /**
     * 内部で保持する destroy 関数のスタック。
     * window.destroyAllSliders() から一括破棄できるようにする。
     * @type {Array<function(): void>}
     */
    const destroyFunctions = [];

    // グローバル公開: debug 時に外からも clear できるように
    function registerGlobalDestroyAll() {
      global.destroyAllSliders = function () {
        destroyFunctions.forEach(function (destroy) {
          try {
            destroy();
          } catch (error) {
            const prefix = '[InfiniteScroll]';
            const logger = global.console.error || global.console.log;
            logger(prefix + ' Destroy failed: ' + error.message);
          }
        });
        destroyFunctions.length = 0;
        if (global.console && global.console.log) {
          global.console.log('[InfiniteScroll] All sliders destroyed');
        }
      };
    }

    function initAllSliders() {
      // ここでの log 用（config に依存しない簡易ログ）
      function log(message, level) {
        const prefix = '[InfiniteScroll:init]';
        const logger = (global.console && global.console[level]) || global.console.log;
        logger(prefix + ' ' + message);
      }

      // デバッグモードの判定（開発時は ?debug=true をURLに追加）
      var debugMode = false;
      try {
        const urlParams = new global.URLSearchParams(global.location.search);
        debugMode = urlParams.get('debug') === 'true';
      } catch (e) {
        // ignore
      }

      /** @type {SliderInitOptions} */
      const baseOptions = {
        debug: debugMode,
        scrollThrottle: 50,
        resizeDebounce: 200
        // 他のオプション (mobileBreakpoint など) は createDefaultSliderOptions に任せる
      };

      try {
        // モード選択
        const modeDestroy = initModeSelectorSlider(baseOptions);
        if (typeof modeDestroy === 'function') {
          destroyFunctions.push(modeDestroy);
        }

        // 認知機能
        const cognitiveDestroy = initCognitiveSlider(baseOptions);
        if (typeof cognitiveDestroy === 'function') {
          destroyFunctions.push(cognitiveDestroy);
        }

        // 16タイプ（複数）
        const typeDestroys = initTypesSliders(baseOptions);
        typeDestroys.forEach(function (destroy) {
          destroyFunctions.push(destroy);
        });

        log('All sliders initialized (' + destroyFunctions.length + ' total)', 'info');
      } catch (error) {
        log('Failed to initialize sliders: ' + error.message, 'error');
        if (global.console && global.console.error) {
          global.console.error('[InfiniteScroll] Initialization error:', error);
        }
      }

      registerGlobalDestroyAll();
    }

    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', initAllSliders);
    } else {
      initAllSliders();
    }
  })();

  // ===========================
  // グローバル公開 (ライブラリとして再利用可能に)
  // ===========================
  global.initInfiniteScroll = initInfiniteScroll;
  global.initModeSelectorSlider = initModeSelectorSlider;
  global.initCognitiveSlider = initCognitiveSlider;
  global.initTypesSliders = initTypesSliders;
})(window);
