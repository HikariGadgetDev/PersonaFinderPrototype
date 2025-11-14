// ============================================
// hooks.js - State Management Hooks (Safari対応版 v3)
// ============================================

// ============================================
// Safari互換: structuredClone ポリフィル
// ============================================

/**
 * structuredClone のポリフィル
 * Safari 15.3未満対応
 * @template T
 * @param {T} obj - クローンするオブジェクト
 * @returns {T} ディープコピーされたオブジェクト
 */
function deepClone(obj) {
    // プリミティブ値
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    // Date
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    // Array
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    
    // Object
    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * structuredClone のラッパー
 * ネイティブ実装があれば使用、なければポリフィル
 * @template T
 * @param {T} obj - クローンするオブジェクト
 * @returns {T} ディープコピーされたオブジェクト
 */
function safeStructuredClone(obj) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch (error) {
            console.warn('[Hooks] structuredClone failed, using fallback:', error);
            return deepClone(obj);
        }
    }
    return deepClone(obj);
}

// ============================================
// 型定義 (JSDoc)
// ============================================

/**
 * @typedef {Object} DiagnosisState
 * @property {number} currentQuestion - 現在の質問インデックス
 * @property {Object<string, {value: number, isReverse: boolean}>} answers - 回答記録
 * @property {Object<string, number>} functionScores - 機能スコア
 * @property {boolean} showResult - 結果表示フラグ
 */

/**
 * @typedef {Object} Question
 * @property {string} id - 質問ID
 * @property {string} text - 質問文
 * @property {string} funcType - 認知機能
 * @property {boolean} [reverse] - 逆転項目フラグ
 */

/**
 * @typedef {Object} StateManager
 * @property {() => DiagnosisState} getState - 状態取得関数
 * @property {(newState: DiagnosisState | ((prev: DiagnosisState) => DiagnosisState)) => void} setState - 状態更新関数
 * @property {(listener: (state: DiagnosisState) => void) => () => void} subscribe - 購読関数
 */

/**
 * @typedef {Object} DiagnosisActions
 * @property {(questionId: string, value: number, isReverse: boolean) => void} setAnswer - 回答設定
 * @property {(funcType: string, delta: number) => void} updateFunctionScore - スコア更新
 * @property {() => void} nextQuestion - 次の質問へ
 * @property {() => void} prevQuestion - 前の質問へ
 * @property {() => void} revealResult - 結果表示
 * @property {() => void} reset - リセット
 */

/**
 * @typedef {Object} StorageAPI
 * @property {(state: DiagnosisState) => boolean} saveState - 状態保存
 * @property {() => DiagnosisState|null} loadState - 状態読み込み
 * @property {() => void} clearAll - 全削除
 * @property {{get: () => number, set: (seed: number) => void}} shuffleSeed - シャッフルシード管理
 * @property {{get: () => boolean, set: () => void}} shadowSeen - Shadow表示履歴
 * @property {() => string} getMode - モード取得
 * @property {(mode: string) => void} setMode - モード設定
 * @property {(verbose?: boolean) => Object} getUsageInfo - 使用状況取得
 */

// ============================================
// 定数定義
// ============================================

/** ストレージキーのプレフィックス */
const DEFAULT_KEY_PREFIX = 'persona_finder';

/** ストレージTTL(24時間) */
const STORAGE_TTL = 24 * 60 * 60 * 1000;

/** 初期診断状態(イミュータブル) */
export const INITIAL_DIAGNOSIS_STATE = Object.freeze({
    currentQuestion: 0,
    answers: {},
    functionScores: Object.freeze({
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    }),
    showResult: false
});

// ============================================
// 状態管理: createState
// ============================================

/**
 * useState風の状態管理を生成
 * @template T
 * @param {T} initialState - 初期状態
 * @returns {[() => T, (newState: T | ((prev: T) => T)) => void, (listener: (state: T) => void) => () => void]}
 */
export function createState(initialState) {
    let state = initialState;
    const listeners = new Set();

    /**
     * 状態を更新
     * @param {T | ((prev: T) => T)} newState - 新しい状態または更新関数
     */
    const setState = (newState) => {
        const prevState = state;
        state = typeof newState === 'function' ? newState(state) : newState;
        
        // 変更があった場合のみリスナーに通知
        if (prevState !== state) {
            listeners.forEach(listener => {
                try {
                    listener(state);
                } catch (error) {
                    console.error('[State] Listener error:', error);
                }
            });
        }
    };

    /**
     * 現在の状態を取得
     * @returns {T} 現在の状態
     */
    const getState = () => state;

    /**
     * 状態変更を購読
     * @param {(state: T) => void} listener - リスナー関数
     * @returns {() => void} unsubscribe 関数
     */
    const subscribe = (listener) => {
        if (typeof listener !== 'function') {
            console.warn('[State] Invalid listener provided');
            return () => {};
        }
        
        listeners.add(listener);
        
        // unsubscribe 関数を返す(メモリリーク防止)
        return () => {
            listeners.delete(listener);
        };
    };

    return [getState, setState, subscribe];
}

// ============================================
// 診断状態管理: useDiagnosisState
// ============================================

/**
 * 診断状態管理フックを生成
 * @param {Question[]} questions - 質問配列
 * @returns {StateManager & {actions: DiagnosisActions}} 状態管理オブジェクト
 */
export function useDiagnosisState(questions) {
    const [getState, setState, subscribe] = createState(
        safeStructuredClone(INITIAL_DIAGNOSIS_STATE)
    );

    /**
     * アクション群(名前空間化)
     * @type {DiagnosisActions}
     */
    const actions = {
        /**
         * 回答を設定
         * @param {string} questionId - 質問ID
         * @param {number} value - 回答値 (1-5)
         * @param {boolean} isReverse - 逆転項目フラグ
         */
        setAnswer(questionId, value, isReverse) {
            if (!questionId || typeof value !== 'number' || value < 1 || value > 5) {
                console.error('[Actions] Invalid answer parameters:', { questionId, value, isReverse });
                return;
            }

            setState(prev => ({
                ...prev,
                answers: {
                    ...prev.answers,
                    [questionId]: { value, isReverse }
                }
            }));
        },

        /**
         * 機能スコアを更新
         * @param {string} funcType - 認知機能タイプ
         * @param {number} delta - スコア変化量
         */
        updateFunctionScore(funcType, delta) {
            if (!funcType || typeof delta !== 'number') {
                console.error('[Actions] Invalid score update parameters:', { funcType, delta });
                return;
            }

            setState(prev => {
                if (!(funcType in prev.functionScores)) {
                    console.warn('[Actions] Unknown function type:', funcType);
                    return prev;
                }

                return {
                    ...prev,
                    functionScores: {
                        ...prev.functionScores,
                        [funcType]: prev.functionScores[funcType] + delta
                    }
                };
            });
        },

        /**
         * 次の質問へ進む
         */
        nextQuestion() {
            setState(prev => ({
                ...prev,
                currentQuestion: Math.min(prev.currentQuestion + 1, questions.length - 1)
            }));
        },

        /**
         * 前の質問に戻る
         */
        prevQuestion() {
            setState(prev => ({
                ...prev,
                currentQuestion: Math.max(prev.currentQuestion - 1, 0)
            }));
        },

        /**
         * 結果を表示
         */
        revealResult() {
            setState(prev => ({ ...prev, showResult: true }));
        },

        /**
         * 状態をリセット
         */
        reset() {
            setState(safeStructuredClone(INITIAL_DIAGNOSIS_STATE));
        }
    };

    return { getState, setState, subscribe, actions };
}

// ============================================
// ローカルストレージ管理: createStorageManager
// ============================================

/**
 * ローカルストレージマネージャーを生成
 * @param {string} keyPrefix - ストレージキーのプレフィックス
 * @returns {StorageAPI} ストレージAPI
 */
export function createStorageManager(keyPrefix = DEFAULT_KEY_PREFIX) {
    const keys = Object.freeze({
        STATE: `${keyPrefix}_state`,
        SHUFFLE_SEED: `${keyPrefix}_shuffle_seed`,
        HAS_SEEN_SHADOW: `${keyPrefix}_seen_shadow`,
        MODE: `${keyPrefix}_mode`
    });

    /**
     * 安全にlocalStorageに書き込み
     * @private
     * @param {string} key - キー
     * @param {string} value - 値
     * @returns {boolean} 成功したかどうか
     */
    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('[Storage] Quota exceeded. Clearing old data...');
                try {
                    // 古いデータを削除して再試行
                    localStorage.removeItem(keys.STATE);
                    localStorage.setItem(key, value);
                    return true;
                } catch (retryError) {
                    console.error('[Storage] Retry failed:', retryError);
                    return false;
                }
            } else {
                console.error('[Storage] Write error:', error);
                return false;
            }
        }
    }

    /**
     * 安全にlocalStorageから読み込み
     * @private
     * @param {string} key - キー
     * @returns {string|null} 値またはnull
     */
    function safeGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error('[Storage] Read error:', error);
            return null;
        }
    }

    /**
     * 安全にlocalStorageから削除
     * @private
     * @param {string} key - キー
     * @returns {boolean} 成功したかどうか
     */
    function safeRemove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('[Storage] Remove error:', error);
            return false;
        }
    }

    return Object.freeze({
        /**
         * 状態を保存
         * @param {DiagnosisState} state - 診断状態
         * @returns {boolean} 成功したかどうか
         */
        saveState(state) {
            try {
                const serialized = JSON.stringify({
                    ...state,
                    timestamp: Date.now()
                });
                return safeSet(keys.STATE, serialized);
            } catch (error) {
                console.error('[Storage] State serialization error:', error);
                return false;
            }
        },

        /**
         * 状態を読み込み
         * @returns {DiagnosisState|null} 診断状態またはnull
         */
        loadState() {
            try {
                const serialized = safeGet(keys.STATE);
                if (!serialized) return null;

                const loaded = JSON.parse(serialized);
                
                // TTLチェック
                if (Date.now() - loaded.timestamp > STORAGE_TTL) {
                    console.info('[Storage] Saved data expired, removing');
                    safeRemove(keys.STATE);
                    return null;
                }

                // timestampを除外して返す
                const { timestamp, ...state } = loaded;
                return state;

            } catch (error) {
                console.error('[Storage] State deserialization error:', error);
                safeRemove(keys.STATE); // 破損データを削除
                return null;
            }
        },

        /**
         * 全ストレージをクリア
         */
        clearAll() {
            Object.values(keys).forEach(key => {
                safeRemove(key);
            });
            console.info('[Storage] All data cleared');
        },

        /**
         * シャッフルシード管理
         */
        shuffleSeed: Object.freeze({
            /**
             * シードを取得
             * @returns {number} シード値
             */
            get() {
                const stored = safeGet(keys.SHUFFLE_SEED);
                return stored ? parseInt(stored, 10) : Date.now();
            },

            /**
             * シードを保存
             * @param {number} seed - シード値
             */
            set(seed) {
                if (typeof seed !== 'number' || isNaN(seed)) {
                    console.error('[Storage] Invalid seed value:', seed);
                    return;
                }
                safeSet(keys.SHUFFLE_SEED, seed.toString());
            }
        }),

        /**
         * Shadow説明表示履歴
         */
        shadowSeen: Object.freeze({
            /**
             * 表示済みかチェック
             * @returns {boolean} 表示済みかどうか
             */
            get() {
                return safeGet(keys.HAS_SEEN_SHADOW) === 'true';
            },

            /**
             * 表示済みフラグを設定
             */
            set() {
                safeSet(keys.HAS_SEEN_SHADOW, 'true');
            }
        }),

        /**
         * モードを取得
         * @returns {string} モードID ('simple' | 'standard' | 'detail')
         */
        getMode() {
            return safeGet(keys.MODE) || 'standard';
        },

        /**
         * モードを保存
         * @param {string} mode - モードID
         */
        setMode(mode) {
            if (!['simple', 'standard', 'detail'].includes(mode)) {
                console.error('[Storage] Invalid mode:', mode);
                return;
            }
            if (safeSet(keys.MODE, mode)) {
                console.info(`[Storage] Mode saved: ${mode}`);
            }
        },

        /**
         * ストレージ使用状況を取得(デバッグ用)
         * @param {boolean} [verbose=false] - 詳細情報を含むか
         * @returns {Object} 使用状況
         */
        getUsageInfo(verbose = false) {
            try {
                const usage = {};
                
                Object.entries(keys).forEach(([name, key]) => {
                    const item = safeGet(key);
                    usage[name] = {
                        exists: item !== null,
                        size: verbose && item ? new Blob([item]).size : undefined
                    };
                });
                
                return usage;
            } catch (error) {
                console.error('[Storage] Usage info error:', error);
                return {};
            }
        }
    });
}

// ============================================
// 定数のエクスポート(テスト用)
// ============================================

// Safari互換性をグローバルにエクスポート
export { STORAGE_TTL, DEFAULT_KEY_PREFIX, safeStructuredClone, deepClone };