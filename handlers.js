// ============================================
// handlers.js - Event Handlers (リファクタ版)
// ============================================

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
 * @property {string} function - 認知機能
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

// ============================================
// 定数定義
// ============================================

const KEYBOARD_KEYS = {
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    ENTER: 'Enter',
    SPACE: ' '
};

const TRANSITION_DELAY = 100;

// ============================================
// イベントハンドラー生成関数
// ============================================

/**
 * イベントハンドラーを生成
 * @param {StateManager} diagnosisState - 状態管理オブジェクト
 * @param {Question[]} questions - 質問配列
 * @param {(value: number, isReverse: boolean) => number} calculateScore - スコア計算関数
 * @param {StorageManager} storage - ストレージマネージャー
 * @returns {Object} ハンドラー関数群
 */
export function useHandlers(diagnosisState, questions, calculateScore, storage) {
    const { getState, setState } = diagnosisState;

    return {
        /**
         * 回答ハンドラー
         * @param {number} value - 選択された値 (1-5)
         * @param {Object} event - イベントオブジェクト
         */
        handleAnswer: (value, event) => {
            const state = getState();
            const question = questions[state.currentQuestion];
            const isReverse = question.reverse || false;

            // 回答を保存
            setState(prev => ({
                ...prev,
                answers: {
                    ...prev.answers,
                    [question.id]: { value, isReverse }
                }
            }));

            // スコアを更新
            const delta = calculateScore(value, isReverse);
            setState(prev => ({
                ...prev,
                functionScores: {
                    ...prev.functionScores,
                    [question.function]: prev.functionScores[question.function] + delta
                }
            }));

            // Shadow説明フラグを保存
            if (event?.currentTarget?.closest('.option-shadow')) {
                storage.shadowSeen.set();
            }

            // 最後の質問なら結果表示、そうでなければ次の質問へ
            setTimeout(() => {
                const currentState = getState();
                if (currentState.currentQuestion >= questions.length - 1) {
                    setState(prev => ({ ...prev, showResult: true }));
                } else {
                    setState(prev => ({
                        ...prev,
                        currentQuestion: prev.currentQuestion + 1
                    }));
                }
            }, TRANSITION_DELAY);
        },

        /**
         * 戻るハンドラー
         */
        goBack: () => {
            const state = getState();
            if (state.currentQuestion > 0) {
                setState(prev => ({
                    ...prev,
                    currentQuestion: prev.currentQuestion - 1
                }));
            }
        },

        /**
         * 次へハンドラー
         */
        goNext: () => {
            const state = getState();
            const question = questions[state.currentQuestion];
            
            if (state.answers[question.id] && state.currentQuestion < questions.length - 1) {
                setState(prev => ({
                    ...prev,
                    currentQuestion: prev.currentQuestion + 1
                }));
            }
        },

        /**
         * リセットハンドラー
         */
        reset: () => {
            // ストレージをクリア
            storage.clearAll();
            
            // 初期状態に戻す
            setState({
                currentQuestion: 0,
                answers: {},
                functionScores: {
                    Ni: 0, Ne: 0, Si: 0, Se: 0,
                    Ti: 0, Te: 0, Fi: 0, Fe: 0
                },
                showResult: false
            });

            // 結果画面から質問画面に戻る
            const questionScreen = document.getElementById('question-screen');
            const resultScreen = document.getElementById('result-screen');
            
            if (questionScreen && resultScreen) {
                questionScreen.style.display = 'block';
                resultScreen.style.display = 'none';
            }

            // ページトップにスクロール
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        /**
         * キーボードナビゲーションハンドラー
         * @param {KeyboardEvent} event - キーボードイベント
         * @param {number} currentValue - 現在の値
         */
        handleKeyboardNav: (event, currentValue) => {
            const options = Array.from(document.querySelectorAll('.option'));
            const currentIndex = options.findIndex(opt => 
                parseInt(opt.dataset.value) === currentValue
            );

            switch (event.key) {
                case KEYBOARD_KEYS.ARROW_LEFT:
                    event.preventDefault();
                    if (currentIndex > 0) {
                        const prevOption = options[currentIndex - 1];
                        prevOption.focus();
                        updateTabIndex(options, prevOption);
                    }
                    break;

                case KEYBOARD_KEYS.ARROW_RIGHT:
                    event.preventDefault();
                    if (currentIndex < options.length - 1) {
                        const nextOption = options[currentIndex + 1];
                        nextOption.focus();
                        updateTabIndex(options, nextOption);
                    }
                    break;

                case KEYBOARD_KEYS.HOME:
                    event.preventDefault();
                    const firstOption = options[0];
                    firstOption.focus();
                    updateTabIndex(options, firstOption);
                    break;

                case KEYBOARD_KEYS.END:
                    event.preventDefault();
                    const lastOption = options[options.length - 1];
                    lastOption.focus();
                    updateTabIndex(options, lastOption);
                    break;

                case KEYBOARD_KEYS.ENTER:
                case KEYBOARD_KEYS.SPACE:
                    event.preventDefault();
                    this.handleAnswer(currentValue, event);
                    break;

                default:
                    // 1-5のキーで直接選択
                    const num = parseInt(event.key);
                    if (num >= 1 && num <= 5) {
                        event.preventDefault();
                        const targetOption = options.find(opt => 
                            parseInt(opt.dataset.value) === num
                        );
                        if (targetOption) {
                            targetOption.focus();
                            updateTabIndex(options, targetOption);
                        }
                        this.handleAnswer(num, event);
                    }
                    break;
            }
        }
    };
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * tabindexを更新（ローミングタブインデックスパターン）
 * @param {HTMLElement[]} options - オプション要素配列
 * @param {HTMLElement} focusedOption - フォーカスされた要素
 */
function updateTabIndex(options, focusedOption) {
    options.forEach(opt => {
        opt.tabIndex = opt === focusedOption ? 0 : -1;
    });
}