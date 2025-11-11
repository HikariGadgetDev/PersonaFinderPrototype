// ============================================
// app.js - Application Entry Point (リファクタ版)
// ============================================

import { useDiagnosisState, useLocalStorage } from './hooks.js';
import { ProgressSection, QuestionCard, ResultCard } from './components.js';
import { useHandlers } from './handlers.js';
import { initializeData } from './data.js';
import { 
    calculateScore, 
    determineMBTITypeWithConsistency,
    getNormalizedScore,
    FUNCTIONS
} from './core.js';

// ============================================
// 型定義 (JSDoc)
// ============================================

/**
 * @typedef {Object} Question
 * @property {string} id - 質問ID
 * @property {string} text - 質問文
 * @property {keyof typeof FUNCTIONS} function - 認知機能
 * @property {boolean} [reverse] - 逆転項目フラグ
 * @property {number} priority - 優先度
 * @property {string[]} tags - タグ
 * @property {Object} [related] - 関連情報
 * @property {string[]} [related.contradicts] - 矛盾する質問ID
 */

/**
 * @typedef {Object} DiagnosisState
 * @property {number} currentQuestion - 現在の質問インデックス
 * @property {Object<string, {value: number, isReverse: boolean}>} answers - 回答記録
 * @property {Object<string, number>} functionScores - 機能スコア
 * @property {boolean} showResult - 結果表示フラグ
 */

/**
 * @typedef {Object} AppContext
 * @property {Question[]} questions - 質問配列
 * @property {Object<string, string[]>} cognitiveStacks - 認知スタック定義
 * @property {Object<string, {name: string, description: string}>} mbtiDescriptions - MBTI説明
 * @property {ReturnType<typeof useDiagnosisState>} diagnosisState - 診断状態
 * @property {ReturnType<typeof useHandlers>} handlers - イベントハンドラー
 * @property {ReturnType<typeof useLocalStorage>} storage - ストレージ
 */

// ============================================
// 定数定義
// ============================================

const CONFIG = {
    /** 信頼できる診断に必要な最小回答数 */
    MIN_RELIABLE_ANSWERS: 8,
    /** Shadow説明表示の遅延時間 (ms) */
    SHADOW_EXPLANATION_DELAY: 500,
    /** 通知表示時間 (ms) */
    NOTIFICATION_DURATION: 3000,
    /** シャッフル最大試行回数 */
    SHUFFLE_MAX_ATTEMPTS: 5000,
    /** シャッフル制約緩和試行回数 */
    SHUFFLE_RELAXED_ATTEMPTS: 1000,
    /** 画面遷移アニメーション遅延 (ms) */
    TRANSITION_DELAY: 100,
};

const ERROR_MESSAGES = {
    INIT_FAILED: 'アプリケーションの初期化に失敗しました',
    NO_QUESTIONS: '質問データが読み込まれませんでした',
    NETWORK_ERROR: 'ネットワークエラーが発生しました。オフラインモードで起動します。',
    JSON_PARSE_ERROR: 'データの読み込みに失敗しました。バックアップデータを使用します。',
};

// ============================================
// アプリケーションコンテキスト (グローバル変数削減)
// ============================================

/** @type {AppContext|null} */
let appContext = null;

/** Shadow機能説明の表示済みフラグ */
let hasSeenShadowExplanation = false;

// ============================================
// ユーティリティ: 質問のシャッフル
// ============================================

/**
 * シード付き疑似乱数生成器
 * @param {number} seed - シード値
 * @returns {() => number} 0-1の乱数を返す関数
 */
function seededRandom(seed) {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

/**
 * Fisher-Yatesシャッフル (シード付き)
 * @param {Question[]} array - 配列
 * @param {number} seed - シード値
 * @returns {Question[]} シャッフルされた配列
 */
function fisherYatesShuffleWithSeed(array, seed) {
    const shuffled = [...array];
    const random = seededRandom(seed);
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * 制約付きシャッフル (同じ機能が連続しないように)
 * @param {Question[]} questions - 質問配列
 * @param {number} seed - シード値
 * @returns {{shuffled: Question[], seed: number}} シャッフル結果とシード
 */
function shuffleQuestionsWithConstraints(questions, seed) {
    // 2連続禁止
    for (let attempt = 0; attempt < CONFIG.SHUFFLE_MAX_ATTEMPTS; attempt++) {
        const currentSeed = seed + attempt;
        const shuffled = fisherYatesShuffleWithSeed(questions, currentSeed);
        
        let hasConsecutive = false;
        for (let i = 1; i < shuffled.length; i++) {
            if (shuffled[i].function === shuffled[i - 1].function) {
                hasConsecutive = true;
                break;
            }
        }
        
        if (!hasConsecutive) {
            return { shuffled, seed: currentSeed };
        }
    }
    
    console.warn(`制約付きシャッフルが${CONFIG.SHUFFLE_MAX_ATTEMPTS}回で完了しませんでした。制約を緩和します。`);
    
    // 3連続まで許容
    for (let attempt = 0; attempt < CONFIG.SHUFFLE_RELAXED_ATTEMPTS; attempt++) {
        const currentSeed = seed + CONFIG.SHUFFLE_MAX_ATTEMPTS + attempt;
        const shuffled = fisherYatesShuffleWithSeed(questions, currentSeed);
        
        let hasTripleConsecutive = false;
        for (let i = 2; i < shuffled.length; i++) {
            if (shuffled[i].function === shuffled[i - 1].function && 
                shuffled[i].function === shuffled[i - 2].function) {
                hasTripleConsecutive = true;
                break;
            }
        }
        
        if (!hasTripleConsecutive) {
            console.info('制約緩和版シャッフル成功(3連続まで許容)');
            return { shuffled, seed: currentSeed };
        }
    }
    
    console.warn('制約なしシャッフルを使用します');
    return { shuffled: fisherYatesShuffleWithSeed(questions, seed), seed };
}

// ============================================
// ビジネスロジック
// ============================================

/**
 * 機能スコアを再計算
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @returns {Object<string, number>} 機能スコア
 */
function recalculateFunctionScores(state, questions) {
    const scores = {
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    };
    
    for (let i = 0; i <= state.currentQuestion && i < questions.length; i++) {
        const q = questions[i];
        const answer = state.answers[q.id];
        
        if (answer !== undefined) {
            const answerValue = typeof answer === 'object' ? answer.value : answer;
            const isReverse = typeof answer === 'object' ? answer.isReverse : false;
            const delta = calculateScore(answerValue, isReverse);
            scores[q.function] += delta;
        }
    }
    
    return scores;
}

/**
 * 暫定タイプを取得
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @returns {string} MBTI タイプ
 */
function getProvisionalType(state, questions) {
    if (!appContext) return 'INTJ';
    
    const answeredCount = Object.keys(state.answers).length;
    
    if (answeredCount === 0) {
        return 'INTJ';
    }
    
    const currentScores = recalculateFunctionScores(state, questions);
    const result = determineMBTITypeWithConsistency(
        currentScores, 
        appContext.cognitiveStacks, 
        state.answers, 
        questions
    );
    return result.type;
}

/**
 * 各選択肢の影響を計算
 * @param {Question} question - 質問
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @returns {Array<Object>} 影響データ配列
 */
function calculateOptionImpacts(question, state, questions) {
    if (!appContext) return [];
    
    const funcType = question.function;
    const isReverse = question.reverse || false;
    const provisionalType = getProvisionalType(state, questions);
    const stack = appContext.cognitiveStacks[provisionalType];
    const weights = [4.0, 2.0, 1.0, 0.5];
    
    const currentScores = recalculateFunctionScores(state, questions);
    
    return [1, 2, 3, 4, 5].map(value => {
        const delta = calculateScore(value, isReverse);
        const position = stack.indexOf(funcType);
        
        const currentRaw = currentScores[funcType];
        const currentNormalized = getNormalizedScore(currentRaw);
        
        const newRaw = currentRaw + delta;
        const newNormalized = getNormalizedScore(newRaw);
        const normalizedDelta = newNormalized - currentNormalized;
        
        if (position === -1) {
            return {
                value,
                isShadow: true,
                funcType,
                rawDelta: delta,
                weightedDelta: 0,
                currentNormalized,
                newNormalized,
                normalizedDelta,
                provisionalType
            };
        }
        
        const weight = weights[position];
        const weightedDelta = delta * weight;
        
        return {
            value,
            isShadow: false,
            funcType,
            position: ['主', '補', '第三', '劣'][position],
            weight,
            rawDelta: delta,
            weightedDelta,
            currentNormalized,
            newNormalized,
            normalizedDelta
        };
    });
}

// ============================================
// UI Effects
// ============================================

/**
 * Shadow機能の説明を表示
 */
function showShadowExplanation() {
    const tooltip = document.createElement('div');
    tooltip.className = 'shadow-explanation';
    tooltip.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 8px;">💡 Shadow機能とは?</div>
        <div style="font-size: 13px; line-height: 1.5; opacity: 0.9;">
            暫定タイプのスタックに含まれない機能です。<br>
            スコアは表示されますが、<strong>タイプ診断には影響しません。</strong>
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    Object.assign(tooltip.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(30, 41, 59, 0.95)',
        color: 'white',
        padding: '16px 20px',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        maxWidth: '400px',
        zIndex: '10000',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out'
    });
    
    setTimeout(() => {
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => tooltip.remove(), 300);
    }, 5000);
}

/**
 * 復元通知を表示
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 */
function showRestoreNotification(state, questions) {
    const notification = document.createElement('div');
    notification.className = 'restore-notification';
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">前回の続きから再開</div>
        <div style="font-size: 12px; opacity: 0.8;">
            質問 ${state.currentQuestion + 1} / ${questions.length}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, CONFIG.NOTIFICATION_DURATION);
}

/**
 * 初期フォーカスを設定
 */
function setInitialFocus() {
    setTimeout(() => {
        const selectedOption = document.querySelector('.option[aria-checked="true"]');
        const firstOption = document.querySelector('.option');
        const targetOption = selectedOption || firstOption;
        
        if (targetOption) {
            targetOption.focus();
            document.querySelectorAll('.option').forEach(opt => {
                opt.tabIndex = opt === targetOption ? 0 : -1;
            });
        }
    }, 0);
}

// ============================================
// レンダリング
// ============================================

/**
 * 進捗セクションを更新
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 */
function updateProgressSection(state, questions) {
    if (!appContext) return;
    
    const provisionalType = getProvisionalType(state, questions);
    const currentScores = recalculateFunctionScores(state, questions);
    
    const progressSection = document.getElementById('progress-section');
    if (!progressSection) return;
    
    const previousType = progressSection.dataset.currentType;
    const wasOpen = document.getElementById('scores-list')?.classList.contains('open');
    
    if (!progressSection.dataset.initialized || previousType !== provisionalType) {
        progressSection.innerHTML = ProgressSection.render(
            state,
            provisionalType,
            appContext.mbtiDescriptions,
            appContext.cognitiveStacks,
            getNormalizedScore,
            questions,
            currentScores
        );
        progressSection.dataset.initialized = 'true';
        progressSection.dataset.currentType = provisionalType;
        
        if (wasOpen) {
            const scoresList = document.getElementById('scores-list');
            const toggleText = document.getElementById('toggle-text');
            const toggleIcon = document.getElementById('toggle-icon');
            
            if (scoresList) {
                scoresList.classList.add('open');
                if (toggleText) toggleText.textContent = 'スコア詳細を非表示';
                if (toggleIcon) toggleIcon.textContent = '▲';
            }
        }
        
        return;
    }
    
    const answeredCount = Object.keys(state.answers).length;
    const progressPercent = Math.round((state.currentQuestion / Math.max(1, questions.length - 1)) * 100);
    
    const progressFill = document.getElementById('progress-fill');
    const progressPercentEl = document.getElementById('progress-percent');
    const progressNote = document.getElementById('progress-note');
    
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }
    
    if (progressPercentEl) {
        progressPercentEl.textContent = `${progressPercent}%`;
    }
    
    if (progressNote) {
        const isInitialState = answeredCount === 0;
        progressNote.innerHTML = isInitialState 
            ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;opacity:0.7;">※便宜上の仮値です</div>'
            : (answeredCount < CONFIG.MIN_RELIABLE_ANSWERS
                ? '<div style="font-size:11px;color:#fbbf24;margin-top:4px;">⚠ 回答数が少ないため精度が低い可能性があります</div>'
                : '');
    }
    
    updateScoresList(state, questions);
}

/**
 * スコアリストを更新
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 */
function updateScoresList(state, questions) {
    if (!appContext) return;
    
    const provisionalType = getProvisionalType(state, questions);
    const stack = appContext.cognitiveStacks[provisionalType];
    const allFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    const currentScores = recalculateFunctionScores(state, questions);
    const orderedFunctions = [...stack, ...allFunctions.filter(f => !stack.includes(f))];
    
    orderedFunctions.forEach(key => {
        const normalizedValue = getNormalizedScore(currentScores[key]);
        const valueEl = document.querySelector(`[data-score-key="${key}"] .score-mini-value`);
        
        if (valueEl) {
            const currentDisplayValue = parseInt(valueEl.textContent);
            
            if (currentDisplayValue !== normalizedValue) {
                valueEl.textContent = normalizedValue;
                valueEl.style.animation = 'none';
                void valueEl.offsetWidth;
                valueEl.style.animation = 'scoreUpdate 0.3s ease';
            }
        }
    });
}

/**
 * 質問をレンダリング
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 */
function renderQuestion(state, questions) {
    if (!appContext) return;
    
    const question = questions[state.currentQuestion];
    const savedAnswer = state.answers[question.id];
    const currentValue = savedAnswer ? savedAnswer.value : undefined;
    
    const impacts = calculateOptionImpacts(question, state, questions);
    const isShadow = impacts[0].isShadow;
    
    updateProgressSection(state, questions);
    
    const questionContent = document.getElementById('question-content');
    if (!questionContent) return;
    
    questionContent.innerHTML = QuestionCard.render(
        question,
        impacts,
        currentValue,
        isShadow,
        state.currentQuestion,
        questions.length
    );
    
    const optionsContainer = questionContent.querySelector('.options-horizontal');
    if (optionsContainer && !optionsContainer.dataset.listenerAttached) {
        optionsContainer.addEventListener('click', handleOptionClick);
        optionsContainer.addEventListener('keydown', handleOptionKeydown);
        optionsContainer.dataset.listenerAttached = 'true';
    }
    
    setInitialFocus();
    
    const backBtn = document.getElementById('btn-back');
    const nextBtn = document.getElementById('btn-next');
    
    if (backBtn) {
        backBtn.style.display = state.currentQuestion > 0 ? 'block' : 'none';
    }
    
    const hasAnswer = state.answers[question.id];
    const isLastQuestion = state.currentQuestion >= questions.length - 1;
    if (nextBtn) {
        nextBtn.style.display = hasAnswer && !isLastQuestion ? 'block' : 'none';
    }
    
    if (isShadow && !hasSeenShadowExplanation) {
        hasSeenShadowExplanation = true;
        setTimeout(() => showShadowExplanation(), CONFIG.SHADOW_EXPLANATION_DELAY);
    }
}

/**
 * 結果をレンダリング
 * @param {DiagnosisState} state - 診断状態
 */
function renderResult(state) {
    if (!appContext) return;
    
    const result = determineMBTITypeWithConsistency(
        state.functionScores, 
        appContext.cognitiveStacks,
        state.answers,
        appContext.questions
    );
    
    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');
    
    if (questionScreen && resultScreen) {
        questionScreen.style.display = 'none';
        resultScreen.style.display = 'block';
        resultScreen.className = 'result-screen active';
        
        resultScreen.innerHTML = ResultCard.render(
            result,
            appContext.mbtiDescriptions,
            appContext.cognitiveStacks,
            FUNCTIONS,
            getNormalizedScore,
            state.functionScores
        );
    }
}

/**
 * メインレンダリング関数
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 */
function render(state, questions) {
    if (state.showResult) {
        renderResult(state);
    } else {
        renderQuestion(state, questions);
    }
}

// ============================================
// イベントハンドラーのラッパー
// ============================================

/**
 * オプションクリックハンドラー
 * @param {MouseEvent} event - クリックイベント
 */
function handleOptionClick(event) {
    if (!appContext) return;
    
    const button = event.target.closest('.option');
    if (!button) return;
    
    const value = parseInt(button.dataset.value);
    if (!isNaN(value)) {
        appContext.handlers.handleAnswer(value, { currentTarget: button });
    }
}

/**
 * オプションキーボードハンドラー
 * @param {KeyboardEvent} event - キーボードイベント
 */
function handleOptionKeydown(event) {
    if (!appContext) return;
    
    const button = event.target.closest('.option');
    if (!button) return;
    
    const value = parseInt(button.dataset.value);
    if (!isNaN(value)) {
        appContext.handlers.handleKeyboardNav(event, value);
    }
}

/**
 * スコアトグル関数 (グローバル公開用)
 */
window.toggleScores = function() {
    const button = document.querySelector('.scores-toggle-btn');
    const list = document.getElementById('scores-list');
    const text = document.getElementById('toggle-text');
    const icon = document.getElementById('toggle-icon');
    
    if (!list) return;
    
    const isOpen = list.classList.contains('open');
    
    list.classList.toggle('open');
    
    if (button) {
        button.setAttribute('aria-expanded', String(!isOpen));
    }
    
    if (text) {
        text.textContent = isOpen ? 'スコア詳細を表示' : 'スコア詳細を非表示';
    }
    
    if (icon) {
        icon.textContent = isOpen ? '▼' : '▲';
    }
    
    if (!isOpen && appContext) {
        const state = appContext.diagnosisState.getState();
        updateScoresList(state, appContext.questions);
    }
};

// ============================================
// エラーハンドリング
// ============================================

/**
 * エラー画面を表示
 * @param {Error} error - エラーオブジェクト
 * @param {string} message - ユーザー向けメッセージ
 */
function showErrorScreen(error, message) {
    console.error('Application Error:', error);
    
    const errorDiv = document.getElementById('question-content');
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div style="text-align:center;padding:40px;color:#ef4444;">
                <h3>エラーが発生しました</h3>
                <p style="margin: 16px 0; color: #cbd5e1;">${message}</p>
                <details style="margin: 20px 0; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto;">
                    <summary style="cursor: pointer; color: #94a3b8;">詳細情報</summary>
                    <pre style="background: #1a2332; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin-top: 8px;">${error.stack || error.message}</pre>
                </details>
                <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#60a5fa;color:#021426;border:none;border-radius:8px;font-weight:700;cursor:pointer;">
                    再読み込み
                </button>
            </div>
        `;
    }
}

/**
 * ローディング画面を表示
 */
function showLoadingScreen() {
    const loadingDiv = document.getElementById('question-content');
    if (loadingDiv) {
        loadingDiv.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <div style="width:40px;height:40px;border:4px solid #1a2332;border-top-color:#60a5fa;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
                <div style="color:#94a3b8;">読み込み中...</div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }
}

// ============================================
// アプリケーション初期化
// ============================================

/**
 * アプリケーションを初期化
 * @returns {Promise<void>}
 */
async function initializeApplication() {
    showLoadingScreen();
    
    try {
        // データ読み込み
        const data = await initializeData('simple');
        
        if (!data.questions || data.questions.length === 0) {
            throw new Error(ERROR_MESSAGES.NO_QUESTIONS);
        }
        
        // ストレージ初期化
        const storage = useLocalStorage();
        
        // シャッフル
        let shuffleSeed = storage.shuffleSeed.get();
        const { shuffled: shuffledQuestions, seed: usedSeed } = 
            shuffleQuestionsWithConstraints(data.questions, shuffleSeed);
        storage.shuffleSeed.set(usedSeed);
        
        // 状態管理初期化
        const diagnosisState = useDiagnosisState(shuffledQuestions);
        const handlers = useHandlers(diagnosisState, shuffledQuestions, calculateScore, storage);
        
        // アプリケーションコンテキスト設定
        appContext = {
            questions: shuffledQuestions,
            cognitiveStacks: data.cognitiveStacks,
            mbtiDescriptions: data.mbtiDescriptions,
            diagnosisState,
            handlers,
            storage
        };
        
        // Shadow説明の表示履歴チェック
        hasSeenShadowExplanation = storage.shadowSeen.get();
        
        // 状態監視
        diagnosisState.subscribe((state) => {
            storage.saveState(state);
            render(state, appContext.questions);
        });
        
        // 保存状態の復元
        const savedState = storage.loadState();
        if (savedState) {
            diagnosisState.setState(savedState);
        }
        
        // グローバルハンドラー登録
        window.handleAnswer = handlers.handleAnswer;
        window.goBack = handlers.goBack;
        window.goNext = handlers.goNext;
        window.reset = handlers.reset;
        window.handleKeyboardNav = handlers.handleKeyboardNav;
        
        // 初回レンダリング
        const state = diagnosisState.getState();
        render(state, appContext.questions);
        
        // 復元通知
        if (savedState && state.currentQuestion > 0) {
            showRestoreNotification(state, appContext.questions);
        }
        
    } catch (error) {
        // エラー種別に応じた処理
        if (error instanceof TypeError && error.message.includes('fetch')) {
            showErrorScreen(error, ERROR_MESSAGES.NETWORK_ERROR);
        } else if (error instanceof SyntaxError) {
            showErrorScreen(error, ERROR_MESSAGES.JSON_PARSE_ERROR);
        } else {
            showErrorScreen(error, error.message || ERROR_MESSAGES.INIT_FAILED);
        }
    }
}

// ============================================
// エントリーポイント
// ============================================

window.onload = initializeApplication;