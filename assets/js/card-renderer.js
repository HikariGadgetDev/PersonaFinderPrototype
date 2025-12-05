// assets/js/card-renderer.js
(function (global) {
  'use strict';

  /**
   * card-renderer.js
   * JSON 駆動のカード描画モジュール（ページ共通）
   *
   * 機能:
   *  - JSON フォールバックロード（assets → /assets → data → /data）
   *  - JSON キャッシュ
   *  - 8認知機能カードを index.html 構造でレンダリング
   *  - 16タイプカードをグループ別にレンダリング
   *  - function.html / type.html の単体描画（クエリパラメータで指定）
   *  - window.Cards に API を公開（どのページからでも呼べる）
   *
   * レイヤー構造:
   *  - Data Layer: JSON ロード・キャッシュ・補助 map（CardsData）
   *  - DOM Layer : createXXX / renderXXX 系（CardsDOM）
   */

  /* ============================================================
     設定（共通）
  ============================================================ */
  const CARDS_CONFIG = Object.freeze({
    cognitiveJsonCandidates: [
      'assets/data/cognitive-card.json',
      '/assets/data/cognitive-card.json',
      'data/cognitive-card.json',
      '/data/cognitive-card.json'
    ],
    typeJsonCandidates: [
      'assets/data/type-card.json',
      '/assets/data/type-card.json',
      'data/type-card.json',
      '/data/type-card.json'
    ],
    debug:
      global.location.hostname === 'localhost' ||
      global.location.hostname === '127.0.0.1' ||
      new URLSearchParams(global.location.search).get('cardsDebug') === 'true',
    logPrefix: '[Cards]'
  });

  /* ============================================================
     ロガー（共通）
  ============================================================ */
  function cardsLog(level, msg, extra) {
    if (!CARDS_CONFIG.debug) return;

    const prefix = CARDS_CONFIG.logPrefix;
    const base = `${prefix} ${msg}`;

    switch (level) {
      case 'warn':
        console.warn(base, extra || '');
        break;
      case 'error':
        console.error(base, extra || '');
        break;
      default:
        console.log(base, extra || '');
    }
  }

  /* ============================================================
     JSON ロード（フォールバック + キャッシュ）: 共通ユーティリティ
  ============================================================ */

  const jsonCache = new Map();

  /**
   * フォールバック付き JSON ロード
   * @param {string} cacheKey
   * @param {string[]} candidates
   */
  async function fetchJsonWithFallback(cacheKey, candidates) {
    if (jsonCache.has(cacheKey)) {
      return jsonCache.get(cacheKey);
    }

    let lastError = null;

    for (const raw of candidates) {
      try {
        const url = new URL(raw, document.baseURI).toString();
        cardsLog('info', `Try JSON: ${url}`);

        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        jsonCache.set(cacheKey, json);

        cardsLog('info', `Loaded ${cacheKey} from ${url}`);
        return json;
      } catch (err) {
        lastError = err;
        cardsLog('warn', `Failed: ${raw}`, err);
      }
    }

    const msg = `JSON fallback failed: ${cacheKey}`;
    cardsLog('error', msg, lastError);
    throw new Error(msg);
  }

  /* ============================================================
     Data Layer: JSON ロード & 補助関数
     （API: CardsData）
  ============================================================ */

  const CardsData = (function createCardsDataLayer() {
    /**
     * 認知機能 JSON ロード
     * @returns {Promise<Array>}
     */
    async function loadFunctions() {
      const json = await fetchJsonWithFallback(
        'functions',
        CARDS_CONFIG.cognitiveJsonCandidates
      );

      if (!json || !Array.isArray(json.functions)) {
        const msg = 'Invalid cognitive-card.json (functions missing)';
        cardsLog('error', msg, json);
        throw new Error(msg);
      }

      return json.functions;
    }

    /**
     * タイプ JSON ロード
     * @returns {Promise<Array>}
     */
    async function loadTypes() {
      const json = await fetchJsonWithFallback(
        'types',
        CARDS_CONFIG.typeJsonCandidates
      );

      if (!json || !Array.isArray(json.types)) {
        const msg = 'Invalid type-card.json (types missing)';
        cardsLog('error', msg, json);
        throw new Error(msg);
      }

      return json.types;
    }

    /**
     * 補助: 認知機能 map
     * @param {Array} functions
     * @returns {Object<string, Object>}
     */
    function buildFunctionMap(functions) {
      const map = Object.create(null);
      functions.forEach((fn) => {
        if (!fn || !fn.code) return;
        map[fn.code.toLowerCase()] = fn;
      });
      return map;
    }

    return {
      loadFunctions,
      loadTypes,
      buildFunctionMap
    };
  })();

  /* ============================================================
     DOM Layer: カード生成 / セクション描画
     （API: CardsDOM）
  ============================================================ */

  const CardsDOM = (function createCardsDomLayer(Data) {
    const { loadFunctions, loadTypes, buildFunctionMap } = Data;

    /* ------------------------------------------------------------
       DOM 生成（index.html の構造に準拠）
    ------------------------------------------------------------ */

    /**
     * 認知機能カード
     * @param {Object} fn
     * @param {Object} [options]
     *   - getHref?: (fn) => string
     */
    function createCognitiveCardElement(fn, options = {}) {
      const a = document.createElement('a');
      a.className = 'cognitive__card';

      const getHref =
        typeof options.getHref === 'function'
          ? options.getHref
          : (f) => `/function?code=${encodeURIComponent(f.code)}`;

      a.href = getHref(fn);
      a.setAttribute('data-code', fn.code);

      const header = document.createElement('div');
      header.className = 'cognitive__card-header';

      const codeEl = document.createElement('span');
      codeEl.className = 'cognitive__card-code';
      codeEl.textContent = fn.code;

      const nameEl = document.createElement('span');
      nameEl.className = 'cognitive__card-name';
      nameEl.textContent = fn.nameJa || '';

      header.appendChild(codeEl);
      header.appendChild(nameEl);

      const desc = document.createElement('p');
      desc.className = 'cognitive__card-desc';
      desc.textContent = fn.shortDescription || '';

      a.appendChild(header);
      a.appendChild(desc);

      return a;
    }

    /**
     * タイプカード
     * @param {Object} type
     * @param {Object<string, Object>} functionMap
     */
    function createTypeCardElement(type, functionMap) {
      const card = document.createElement('div');
      card.className = 'types__card';
      card.setAttribute('data-type', type.code);

      // header
      const header = document.createElement('div');
      header.className = 'types__card-header';

      const codeEl = document.createElement('span');
      codeEl.className = 'types__card-code';
      codeEl.textContent = type.code;

      const freqEl = document.createElement('span');
      freqEl.className = 'types__card-frequency';
      freqEl.textContent = type.frequency || type.frequencyRaw || '';

      header.appendChild(codeEl);
      header.appendChild(freqEl);

      // body
      const body = document.createElement('div');
      body.className = 'types__card-body';

      const catchEl = document.createElement('h4');
      catchEl.className = 'types__card-catch';
      catchEl.textContent = type.catchphrase || '';

      const tagEl = document.createElement('p');
      tagEl.className = 'types__card-tagline';
      tagEl.textContent = type.tagline || '';

      const ul = document.createElement('ul');
      ul.className = 'types__card-stack';

      if (Array.isArray(type.stack)) {
        type.stack.forEach((st) => {
          const fn = functionMap[st.code.toLowerCase()];
          const li = document.createElement('li');
          li.innerHTML = `<strong>${st.slot}:</strong> ${
            fn ? fn.code : st.code
          }${fn ? ` (${fn.nameJa || ''})` : ''}`;
          ul.appendChild(li);
        });
      }

      body.appendChild(catchEl);
      body.appendChild(tagEl);
      body.appendChild(ul);

      card.appendChild(header);
      card.appendChild(body);

      return card;
    }

    /* ------------------------------------------------------------
       セクション描画（index.html 構造に合わせたヘルパ）
    ------------------------------------------------------------ */

    /**
     * 8認知機能をグリッドに描画
     * @param {Object} [options]
     *   - target?: string|Element  デフォルト: '#cognitive-grid'
     *   - getHref?: (fn) => string
     */
    async function renderCognitiveSection(options = {}) {
      const target = options.target || '#cognitive-grid';
      const grid =
        typeof target === 'string' ? document.querySelector(target) : target;

      if (!grid) {
        cardsLog('info', `cognitive grid not found: ${target}`);
        return;
      }

      try {
        grid.innerHTML = '';
        const functions = await loadFunctions();

        functions.forEach((fn) => {
          const el = createCognitiveCardElement(fn, {
            getHref: options.getHref
          });
          grid.appendChild(el);
        });

        cardsLog('info', `Rendered ${functions.length} cognitive cards`);
      } catch (err) {
        cardsLog('error', 'Failed renderCognitiveSection', err);
        grid.innerHTML = '<p>認知機能の読み込みに失敗しました。</p>';
      }
    }

    /**
     * 16タイプをグループ別に描画
     * @param {Object} [options]
     *   - root?: string|Element    デフォルト: '.types'
     *   - groupAttr?: string       デフォルト: 'data-types-grid'
     */
    async function renderTypesSection(options = {}) {
      const rootOpt = options.root || '.types';
      const groupAttr = options.groupAttr || 'data-types-grid';

      const root =
        typeof rootOpt === 'string' ? document.querySelector(rootOpt) : rootOpt;

      if (!root) {
        cardsLog('info', `types root not found: ${rootOpt}`);
        return;
      }

      try {
        const [types, functions] = await Promise.all([
          loadTypes(),
          loadFunctions()
        ]);
        const functionMap = buildFunctionMap(functions);

        // グループ分け（JSON 内 groupCode 使用）
        const grouped = types.reduce((acc, t) => {
          const g = t.groupCode || 'UNKNOWN';
          (acc[g] ||= []).push(t);
          return acc;
        }, {});

        const grids = root.querySelectorAll(`[${groupAttr}]`);
        grids.forEach((grid) => {
          const group = grid.getAttribute(groupAttr);
          const list = grouped[group] || [];
          grid.innerHTML = '';

          list.forEach((type) => {
            const el = createTypeCardElement(type, functionMap);
            grid.appendChild(el);
          });

          cardsLog(
            'info',
            `Rendered ${list.length} types for group ${group || 'UNKNOWN'}`
          );
        });
      } catch (err) {
        cardsLog('error', 'Failed renderTypesSection', err);
        root
          .querySelectorAll(`[${groupAttr}]`)
          .forEach(
            (grid) =>
              (grid.innerHTML =
                '<p>タイプ情報の読み込みに失敗しました。</p>')
          );
      }
    }

    /* ------------------------------------------------------------
       個別ページ: 認知機能 1件
    ------------------------------------------------------------ */

    /**
     * クエリ (?code=Ne など) から 1件だけ描画
     * @param {Object} [options]
     *   - target?: string|Element  デフォルト: '#cognitive-single'
     *   - param?: string           デフォルト: 'code'
     *   - code?: string            直接コード指定する場合
     */
    async function renderSingleFunctionFromQuery(options = {}) {
      const target = options.target || '#cognitive-single';
      const param = options.param || 'code';

      const container =
        typeof target === 'string' ? document.querySelector(target) : target;

      if (!container) {
        cardsLog('info', `single function container not found: ${target}`);
        return;
      }

      const params = new URLSearchParams(global.location.search);
      const code = options.code || params.get(param);

      if (!code) {
        container.textContent = `${param} が指定されていません。`;
        return;
      }

      try {
        const functions = await loadFunctions();
        const fn = functions.find(
          (f) => f.code.toLowerCase() === String(code).toLowerCase()
        );

        if (!fn) {
          container.textContent = '該当する認知機能が見つかりません。';
          return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'cognitive__single';

        const title = document.createElement('h2');
        title.textContent = `${fn.code} — ${fn.nameJa}`;
        wrap.appendChild(title);

        const desc = document.createElement('p');
        desc.textContent = fn.longDescription || fn.shortDescription || '';
        wrap.appendChild(desc);

        container.innerHTML = '';
        container.appendChild(wrap);
      } catch (err) {
        cardsLog('error', 'Failed renderSingleFunctionFromQuery', err);
        container.textContent = '読み込みに失敗しました。';
      }
    }

    /* ------------------------------------------------------------
       個別ページ: タイプ 1件
    ------------------------------------------------------------ */

    /**
     * クエリ (?type=INTJ など) から 1件だけ描画
     * @param {Object} [options]
     *   - target?: string|Element  デフォルト: '#type-single'
     *   - param?: string           デフォルト: 'type'
     *   - code?: string            直接コード指定する場合
     */
    async function renderSingleTypeFromQuery(options = {}) {
      const target = options.target || '#type-single';
      const param = options.param || 'type';

      const container =
        typeof target === 'string' ? document.querySelector(target) : target;

      if (!container) {
        cardsLog('info', `single type container not found: ${target}`);
        return;
      }

      const params = new URLSearchParams(global.location.search);
      const code = options.code || params.get(param);

      if (!code) {
        container.textContent = `${param} が指定されていません。`;
        return;
      }

      try {
        const [types, functions] = await Promise.all([
          loadTypes(),
          loadFunctions()
        ]);
        const functionMap = buildFunctionMap(functions);

        const type = types.find(
          (t) => t.code.toLowerCase() === String(code).toLowerCase()
        );

        if (!type) {
          container.textContent = '該当するタイプが見つかりません。';
          return;
        }

        const el = createTypeCardElement(type, functionMap);
        container.innerHTML = '';
        container.appendChild(el);
      } catch (err) {
        cardsLog('error', 'Failed renderSingleTypeFromQuery', err);
        container.textContent = '読み込みに失敗しました。';
      }
    }

    return {
      // DOM生成
      createCognitiveCardElement,
      createTypeCardElement,
      // セクション描画
      renderCognitiveSection,
      renderTypesSection,
      // 個別ページ描画
      renderSingleFunctionFromQuery,
      renderSingleTypeFromQuery
    };
  })(CardsData);

  /* ============================================================
     API をグローバル公開
  ============================================================ */

  const CardsAPI = {
    // Data Layer
    loadFunctions: CardsData.loadFunctions,
    loadTypes: CardsData.loadTypes,
    buildFunctionMap: CardsData.buildFunctionMap,

    // DOM Layer
    createCognitiveCardElement: CardsDOM.createCognitiveCardElement,
    createTypeCardElement: CardsDOM.createTypeCardElement,

    renderCognitiveSection: CardsDOM.renderCognitiveSection,
    renderTypesSection: CardsDOM.renderTypesSection,

    renderSingleFunctionFromQuery: CardsDOM.renderSingleFunctionFromQuery,
    renderSingleTypeFromQuery: CardsDOM.renderSingleTypeFromQuery,

    // 内部情報（デバッグ用）
    _config: CARDS_CONFIG,
    _cache: jsonCache
  };

  global.Cards = CardsAPI;

  if (CARDS_CONFIG.debug) {
    cardsLog('info', 'window.Cards ready');
    console.log('[Cards] API', CardsAPI);
  }
})(window);

// ==========================================
// ページ別 Auto Init (data-page ベース)
// ==========================================
(function () {
  'use strict';

  function autoInit() {
    const Cards = window.Cards;
    if (!Cards) {
      console.error(
        '[Cards] window.Cards not found (card-renderer.js の初期化前に autoInit が呼ばれています)'
      );
      return;
    }

    const body = document.body;
    if (!body) return;

    const page = body.dataset.page;
    if (!page) return;

    switch (page) {
      case 'index': {
        const hasCognitive = document.querySelector('#cognitive-grid');
        const hasTypes = document.querySelector('.types [data-types-grid]');

        const tasks = [];

        if (hasCognitive) {
          tasks.push(Cards.renderCognitiveSection());
        }

        if (hasTypes) {
          tasks.push(Cards.renderTypesSection());
        }

  // JSON 描画が終わってからスライダー初期化
  Promise.all(tasks)
    .then(() => {
      // slider.js が読み込まれていれば、ここでグローバル関数が使える
      if (window.initCognitiveSlider) {
        window.initCognitiveSlider({ debug: false });
      }

      if (window.initTypesSliders) {
        window.initTypesSliders({ debug: false });
      }
    })
    .catch((err) => {
      console.error('[Cards] render + slider init failed', err);
    });

  break;
}


      case 'function': {
        // function.html 用の初期化（今はプレースホルダ）
        // 例）cover-flow をやるときここに書く:
        //
        // const cover = document.querySelector('.coverflow-container');
        // if (cover) {
        //   Cards.initCoverFlow({ target: cover });
        // }
        break;
      }

      case 'type': {
        // type.html 用の初期化（今はプレースホルダ）
        // const detail = document.querySelector('.type-detail');
        // if (detail) {
        //   Cards.renderSingleTypeFromQuery({ target: detail });
        // }
        break;
      }

      default:
        // 何もしない（将来の拡張用）
        break;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
