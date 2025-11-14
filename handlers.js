// ============================================
// handlers.js - Event Handlers (Safari対応版 v3)
// ============================================

import { safeStructuredClone } from './hooks.js';

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
 * @property {(newState: DiagnosisState | Function) => void} setState - 状態更新関数
 */

/**
 * @typedef {Object} StorageManager
 * @property {(state: DiagnosisState) => boolean} saveState - 状態保存
 * @property {() => DiagnosisState|null} loadState - 状態読み込み
 * @property {() => void} clearAll - 全削除
 * @property {{get: () => boolean, set: () => void}} shadowSeen - Shadow表示履歴
 */

/**
 * @typedef {Object} HandlerDependencies
 * @property {StateManager} diagnosisState - 状態管理オブジェクト
 * @property {Question[]} questions - 質問配列
 * @property {(value: number, isReverse: boolean) => number} calculateScore - スコア計算関数
 * @property {StorageManager} storage - ストレージマネージャー
 */

// ============================================
// 定数定義(イミュータブル)
// ============================================

/** キーボード操作用の定数 */
const KEYBOARD_KEYS = Object.freeze({
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    ENTER: 'Enter',
    SPACE: ' '
});

/** 画面遷移アニメーション遅延 (ms) */
const TRANSITION_DELAY = 200;

/** 初期状態テンプレート */
const INITIAL_STATE = Object.freeze({
    currentQuestion: 0,
    answers: {},
    functionScores: Object.freeze({
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    }),
    showResult: false
});

// ============================================
// 純粋関数群 (副作用なし)
// ============================================

/**
 * 初期状態のディープコピーを生成
 * Safari 15.3未満対応
 * @returns {DiagnosisState} 初期化された状態
 */
function createInitialState() {
    return safeStructuredClone(INITIAL_STATE);
}

/**
 * tabindexを更新(ローミングタブインデックスパターン)
 * @param {HTMLElement[]} options - オプション要素配列
 * @param {HTMLElement} focusedOption - フォーカスされた要素
 */
function updateTabIndex(options, focusedOption) {
    if (!options || !focusedOption) {
        console.warn('[Handlers] Invalid parameters for updateTabIndex');
        return;
    }
    
    options.forEach(opt => {
        opt.tabIndex = opt === focusedOption ? 0 : -1;
    });
}

/**
 * 指定値の option 要素を取得
 * @param {number} value - 選択肢の値 (1-5)
 * @returns {HTMLElement|null} 対応する要素
 */
function getOptionElement(value) {
    const options = Array.from(document.querySelectorAll('.option'));
    return options.find(opt => parseInt(opt.dataset.value) === value) || null;
}

/**
 * 全 option 要素を取得
 * @returns {HTMLElement[]} option 要素配列
 */
function getAllOptionElements() {
    return Array.from(document.querySelectorAll('.option'));
}

// ============================================
// DOM操作関数群 (副作用あり・UI層)
// ============================================

/**
 * 結果画面から質問画面に戻す
 */
function switchToQuestionScreen() {
    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');
    
    if (questionScreen && resultScreen) {
        questionScreen.style.display = 'block';
        resultScreen.style.display = 'none';
    } else {
        console.warn('[Handlers] Screen elements not found');
    }
}

/**
 * ページトップにスムーススクロール
 */
function scrollToTop() {
    try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        // フォールバック(古いブラウザ対応)
        window.scrollTo(0, 0);
    }
}

// ============================================
// イベントハンドラー生成関数
// ============================================

/**
 * イベントハンドラーを生成
 * @param {HandlerDependencies} deps - 依存オブジェクト
 * @returns {Object} ハンドラー関数群
 */
export function createHandlers(deps) {
    const { diagnosisState, questions, calculateScore, storage } = deps;
    
    // 依存関係の検証
    if (!diagnosisState || !questions || !calculateScore || !storage) {
        throw new Error('[Handlers] Missing required dependencies');
    }
    
    const { getState, setState } = diagnosisState;

    /**
     * 回答処理の内部実装
     * @private
     * @param {number} value - 選択された値 (1-5)
     * @param {Question} question - 現在の質問
     * @param {boolean} isShadowOption - Shadow機能かどうか
     */
    function processAnswer(value, question, isShadowOption) {
        if (!question) {
            console.error('[Handlers] Invalid question in processAnswer');
            return;
        }

        const isReverse = question.reverse || false;
        const funcType = question.funcType || question.function; // 後方互換性

        if (!funcType) {
            console.error('[Handlers] Question missing funcType:', question);
            return;
        }

        try {
            // 1. 回答を保存
            setState(prev => ({
                ...prev,
                answers: {
                    ...prev.answers,
                    [question.id]: { value, isReverse }
                }
            }));

            // 2. スコアを更新
            const delta = calculateScore(value, isReverse);
            setState(prev => ({
                ...prev,
                functionScores: {
                    ...prev.functionScores,
                    [funcType]: prev.functionScores[funcType] + delta
                }
            }));

            // 3. Shadow説明フラグを保存
            if (isShadowOption) {
                storage.shadowSeen.set();
            }
        } catch (error) {
            console.error('[Handlers] Error in processAnswer:', error);
        }
    }

    /**
     * 次の画面に遷移
     * @private
     * @param {number} currentIndex - 現在の質問インデックス
     */
    function transitionToNext(currentIndex) {
        setTimeout(() => {
            try {
                if (currentIndex >= questions.length - 1) {
                    // 最後の質問 → 結果表示
                    setState(prev => ({ ...prev, showResult: true }));
                } else {
                    // 次の質問へ
                    setState(prev => ({
                        ...prev,
                        currentQuestion: prev.currentQuestion + 1
                    }));
                }
            } catch (error) {
                console.error('[Handlers] Error in transitionToNext:', error);
            }
        }, TRANSITION_DELAY);
    }

    // ============================================
    // 公開ハンドラー関数群
    // ============================================

    return Object.freeze({
        /**
         * 回答ハンドラー
         * @param {number} value - 選択された値 (1-5)
         * @param {Object} event - イベントオブジェクト
         */
        handleAnswer(value, event) {
            try {
                // バリデーション
                if (typeof value !== 'number' || value < 1 || value > 5) {
                    console.error('[Handlers] Invalid answer value:', value);
                    return;
                }

                const state = getState();
                const question = questions[state.currentQuestion];
                
                if (!question) {
                    console.error('[Handlers] Invalid question index:', state.currentQuestion);
                    return;
                }

                // Shadow機能判定
                const isShadowOption = event?.currentTarget?.closest?.('.option-shadow') !== null;

                // 回答処理
                processAnswer(value, question, isShadowOption);

                // 画面遷移
                transitionToNext(state.currentQuestion);

            } catch (error) {
                console.error('[Handlers] Error in handleAnswer:', error);
            }
        },

        /**
         * 戻るハンドラー
         */
        goBack() {
            try {
                const state = getState();
                if (state.currentQuestion > 0) {
                    setState(prev => ({
                        ...prev,
                        currentQuestion: prev.currentQuestion - 1
                    }));
                }
            } catch (error) {
                console.error('[Handlers] Error in goBack:', error);
            }
        },

        /**
         * 次へハンドラー
         */
        goNext() {
            try {
                const state = getState();
                const question = questions[state.currentQuestion];
                
                if (!question) {
                    console.error('[Handlers] Invalid question index:', state.currentQuestion);
                    return;
                }

                // 回答済み かつ 最後の質問でない場合のみ進む
                if (state.answers[question.id] && state.currentQuestion < questions.length - 1) {
                    setState(prev => ({
                        ...prev,
                        currentQuestion: prev.currentQuestion + 1
                    }));
                }
            } catch (error) {
                console.error('[Handlers] Error in goNext:', error);
            }
        },

        /**
         * リセットハンドラー
         */
        reset() {
            try {
                // 1. ストレージをクリア
                storage.clearAll();
                
                // 2. 初期状態に戻す (Safari対応版を使用)
                setState(createInitialState());

                // 3. UI を質問画面に戻す
                switchToQuestionScreen();

                // 4. ページトップにスクロール
                scrollToTop();

                console.info('[Handlers] Application reset complete');

            } catch (error) {
                console.error('[Handlers] Error in reset:', error);
            }
        },

        /**
         * キーボードナビゲーションハンドラー
         * @param {KeyboardEvent} event - キーボードイベント
         * @param {number} currentValue - 現在の値
         */
        handleKeyboardNav(event, currentValue) {
            try {
                const options = getAllOptionElements();
                
                if (options.length === 0) {
                    console.warn('[Handlers] No option elements found');
                    return;
                }

                const currentIndex = options.findIndex(opt => 
                    parseInt(opt.dataset.value) === currentValue
                );

                if (currentIndex === -1) {
                    console.warn('[Handlers] Current option not found:', currentValue);
                    return;
                }

                let targetOption = null;

                switch (event.key) {
                    case KEYBOARD_KEYS.ARROW_LEFT:
                        event.preventDefault();
                        if (currentIndex > 0) {
                            targetOption = options[currentIndex - 1];
                        }
                        break;

                    case KEYBOARD_KEYS.ARROW_RIGHT:
                        event.preventDefault();
                        if (currentIndex < options.length - 1) {
                            targetOption = options[currentIndex + 1];
                        }
                        break;

                    case KEYBOARD_KEYS.HOME:
                        event.preventDefault();
                        targetOption = options[0];
                        break;

                    case KEYBOARD_KEYS.END:
                        event.preventDefault();
                        targetOption = options[options.length - 1];
                        break;

                    case KEYBOARD_KEYS.ENTER:
                    case KEYBOARD_KEYS.SPACE:
                        event.preventDefault();
                        this.handleAnswer(currentValue, event);
                        return;

                    default:
                        // 1-5のキーで直接選択
                        const num = parseInt(event.key);
                        if (num >= 1 && num <= 5) {
                            event.preventDefault();
                            targetOption = getOptionElement(num);
                            if (targetOption) {
                                targetOption.focus();
                                updateTabIndex(options, targetOption);
                            }
                            this.handleAnswer(num, event);
                        }
                        return;
                }

                // フォーカス移動
                if (targetOption) {
                    targetOption.focus();
                    updateTabIndex(options, targetOption);
                }

            } catch (error) {
                console.error('[Handlers] Error in handleKeyboardNav:', error);
            }
        }
    });
}

// ============================================
// 定数のエクスポート(テスト用)
// ============================================

export { KEYBOARD_KEYS, TRANSITION_DELAY, INITIAL_STATE };