// ============================================
// app.js - Application Entry Point (メモ化実装版 v3)
// ============================================

import { useDiagnosisState, createStorageManager } from './hooks.js';
import { ProgressSection, QuestionCard, ResultCard } from './components.js';
import { createHandlers } from './handlers.js';
import { initializeData } from './data.js';
import { 
    calculateScore, 
    determineMBTITypeWithConsistency,
    getNormalizedScore,
    FUNCTIONS
} from './core.js';

// ============================================
// 定数定義(イミュータブル)
// ============================================

/** アプリケーション設定 */
const CONFIG = Object.freeze({
    MIN_RELIABLE_ANSWERS: 8,
    SHADOW_EXPLANATION_DELAY: 500,
    NOTIFICATION_DURATION: 3000,
    SHUFFLE_MAX_ATTEMPTS: 5000,
    SHUFFLE_RELAXED_ATTEMPTS: 1000,
    TRANSITION_DELAY: 200,
    VALID_MODES: Object.freeze(['simple', 'standard', 'detail']),
    DEFAULT_MODE: 'standard'
});

/** エラーメッセージ定数 */
const ERROR_MESSAGES = Object.freeze({
    INIT_FAILED: 'アプリケーションの初期化に失敗しました',
    NO_QUESTIONS: '質問データが読み込まれませんでした',
    NETWORK_ERROR: 'ネットワークエラーが発生しました。オフラインモードで起動します。',
    JSON_PARSE_ERROR: 'データの読み込みに失敗しました。バックアップデータを使用します。',
    MODE_MISMATCH: 'モードが変更されたため、保存データをクリアしました'
});

/** モード表示名マッピング */
const MODE_DISPLAY_NAMES = Object.freeze({
    simple: 'クイック診断',
    standard: 'スタンダード診断',
    detail: '詳細診断'
});

// ============================================
// グローバル状態(最小限に抑制)
// ============================================

/** @type {AppContext|null} */
let appContext = null;

/** Shadow機能説明の表示済みフラグ */
let hasSeenShadowExplanation = false;

// ============================================
// メモ化システム (React移行準備)
// ============================================

/**
 * シンプルなメモ化ヘルパー
 * React移行時は useMemo に置き換え
 */
function createMemo() {
    const cache = new Map();
    
    return function memoize(key, computeFn) {
        if (cache.has(key)) {
            return cache.get(key);
        }
        const value = computeFn();
        cache.set(key, value);
        return value;
    };
}

// メモキャッシュインスタンス
let scoreMemo = createMemo();
let typeMemo = createMemo();

/**
 * メモキャッシュをクリア(状態更新時に呼ぶ)
 */
function clearMemoCache() {
    scoreMemo = createMemo();
    typeMemo = createMemo();
    console.debug('[Memo] Cache cleared');
}

/**
 * メモ化されたスコア計算
 * React移行時: useMemo(() => recalculateFunctionScores(state, questions), [state.answers, state.currentQuestion])
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @returns {Object<string, number>} 機能スコア
 */
function getMemoizedScores(state, questions) {
    const key = `${state.currentQuestion}-${Object.keys(state.answers).length}`;
    return scoreMemo(key, () => recalculateFunctionScores(state, questions));
}

/**
 * メモ化されたタイプ判定
 * React移行時: useMemo(() => getProvisionalType(scores, state), [scores, state.answers])
 * @param {Object<string, number>} currentScores - 現在のスコア
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @returns {string} MBTI タイプ
 */
function getMemoizedProvisionalType(currentScores, state, questions) {
    const answeredCount = Object.keys(state.answers).length;
    const key = `${answeredCount}-${currentScores.Ni}-${currentScores.Ne}`;
    
    return typeMemo(key, () => {
        if (!appContext) return 'INTJ';
        
        if (answeredCount === 0) {
            return 'INTJ';
        }
        
        const result = determineMBTITypeWithConsistency(
            currentScores, 
            appContext.cognitiveStacks, 
            state.answers, 
            questions,
            appContext.mode
        );
        return result.type;
    });
}

// ============================================
// URL・モード管理
// ============================================

/**
 * URLからモードパラメータを取得
 * @returns {string} モード ('simple' | 'standard' | 'detail')
 */
function getModeFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        
        if (mode && CONFIG.VALID_MODES.includes(mode)) {
            console.info(`[App] URLパラメータからモード取得: ${mode}`);
            return mode;
        }
        
        console.info(`[App] デフォルトモード使用: ${CONFIG.DEFAULT_MODE}`);
        return CONFIG.DEFAULT_MODE;
    } catch (error) {
        console.error('[App] Error in getModeFromURL:', error);
        return CONFIG.DEFAULT_MODE;
    }
}

/**
 * モード名を日本語表示用に変換
 * @param {string} mode - モードID
 * @returns {string} 日本語名
 */
function getModeDisplayName(mode) {
    return MODE_DISPLAY_NAMES[mode] || mode;
}

// ============================================
// データ初期化・シャッフル
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
            const funcType1 = shuffled[i].funcType || shuffled[i].function;
            const funcType2 = shuffled[i - 1].funcType || shuffled[i - 1].function;
            if (funcType1 === funcType2) {
                hasConsecutive = true;
                break;
            }
        }
        
        if (!hasConsecutive) {
            return { shuffled, seed: currentSeed };
        }
    }
    
    console.warn(`[Shuffle] 制約付きシャッフルが${CONFIG.SHUFFLE_MAX_ATTEMPTS}回で完了しませんでした。制約を緩和します。`);
    
    // 3連続まで許容
    for (let attempt = 0; attempt < CONFIG.SHUFFLE_RELAXED_ATTEMPTS; attempt++) {
        const currentSeed = seed + CONFIG.SHUFFLE_MAX_ATTEMPTS + attempt;
        const shuffled = fisherYatesShuffleWithSeed(questions, currentSeed);
        
        let hasTripleConsecutive = false;
        for (let i = 2; i < shuffled.length; i++) {
            const funcType1 = shuffled[i].funcType || shuffled[i].function;
            const funcType2 = shuffled[i - 1].funcType || shuffled[i - 1].function;
            const funcType3 = shuffled[i - 2].funcType || shuffled[i - 2].function;
            if (funcType1 === funcType2 && funcType1 === funcType3) {
                hasTripleConsecutive = true;
                break;
            }
        }
        
        if (!hasTripleConsecutive) {
            console.info('[Shuffle] 制約緩和版シャッフル成功(3連続まで許容)');
            return { shuffled, seed: currentSeed };
        }
    }
    
    console.warn('[Shuffle] 制約なしシャッフルを使用します');
    return { shuffled: fisherYatesShuffleWithSeed(questions, seed), seed };
}

// ============================================
// ビジネスロジック(UIに依存しない)
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
            const funcType = q.funcType || q.function;
            
            if (funcType in scores) {
                scores[funcType] += delta;
            }
        }
    }
    
    return scores;
}

/**
 * 各選択肢の影響を計算
 * @param {Question} question - 質問
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @param {Object<string, number>|null} currentScores - 事前計算されたスコア
 * @returns {Array<Object>} 影響データ配列
 */
function calculateOptionImpacts(question, state, questions, currentScores = null) {
    if (!appContext) return [];
    
    const funcType = question.funcType || question.function;
    const isReverse = question.reverse || false;
    
    // スコアが渡されていなければメモ化版を使用
    const scores = currentScores || getMemoizedScores(state, questions);
    const provisionalType = getMemoizedProvisionalType(scores, state, questions);
    const stack = appContext.cognitiveStacks[provisionalType];
    
    const weights = [4.0, 2.0, 1.0, 0.5];
    
    return [1, 2, 3, 4, 5].map(value => {
        const delta = calculateScore(value, isReverse);
        const position = stack.indexOf(funcType);
        
        const currentRaw = scores[funcType];
        const currentNormalized = getNormalizedScore(currentRaw, appContext.mode);
        
        const newRaw = currentRaw + delta;
        const newNormalized = getNormalizedScore(newRaw, appContext.mode);
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
 * モード変更通知を表示
 * @param {string} mode - 新しいモード
 */
function showModeChangeNotification(mode) {
    const notification = document.createElement('div');
    notification.className = 'restore-notification';
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">📋 ${getModeDisplayName(mode)}</div>
        <div style="font-size: 12px; opacity: 0.8;">
            ${ERROR_MESSAGES.MODE_MISMATCH}
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
    requestAnimationFrame(() => {
        const selectedOption = document.querySelector('.option[aria-checked="true"]');
        const firstOption = document.querySelector('.option');
        const targetOption = selectedOption || firstOption;
        
        if (targetOption) {
            targetOption.focus();
            document.querySelectorAll('.option').forEach(opt => {
                opt.tabIndex = opt === targetOption ? 0 : -1;
            });
        }
    });
}

// ============================================
// レンダリング
// ============================================

/**
 * 進捗セクションを更新
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @param {Object<string, number>|null} currentScores - 事前計算されたスコア
 * @param {string|null} provisionalType - 事前計算されたタイプ
 */
function updateProgressSection(state, questions, currentScores = null, provisionalType = null) {
    if (!appContext) return;
    
    // スコアが渡されていなければメモ化版を使用
    const scores = currentScores || getMemoizedScores(state, questions);
    const type = provisionalType || getMemoizedProvisionalType(scores, state, questions);
    
    const progressSection = document.getElementById('progress-section');
    if (!progressSection) return;
    
    const previousType = progressSection.dataset.currentType;
    const wasOpen = document.getElementById('scores-list')?.classList.contains('open');
    
    if (!progressSection.dataset.initialized || previousType !== type) {
        progressSection.innerHTML = ProgressSection.render(
            state,
            type,
            appContext.mbtiDescriptions,
            appContext.cognitiveStacks,
            (score) => getNormalizedScore(score, appContext.mode),
            questions,
            scores
        );
        progressSection.dataset.initialized = 'true';
        progressSection.dataset.currentType = type;
        
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
    
    updateScoresList(state, questions, scores);
}

/**
 * スコアリストを更新
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 * @param {Object<string, number>|null} currentScores - 事前計算されたスコア
 */
function updateScoresList(state, questions, currentScores = null) {
    if (!appContext) return;
    
    const scores = currentScores || getMemoizedScores(state, questions);
    const provisionalType = getMemoizedProvisionalType(scores, state, questions);
    const stack = appContext.cognitiveStacks[provisionalType];
    const allFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    const orderedFunctions = [...stack, ...allFunctions.filter(f => !stack.includes(f))];
    
    orderedFunctions.forEach(key => {
        const normalizedValue = getNormalizedScore(scores[key], appContext.mode);
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
    
    if (!question) {
        console.error('[App] Invalid question at index:', state.currentQuestion);
        return;
    }
    
    const savedAnswer = state.answers[question.id];
    const currentValue = savedAnswer ? savedAnswer.value : undefined;
    
    // メモ化されたスコア取得
    const currentScores = getMemoizedScores(state, questions);
    
    // メモ化されたタイプ取得
    const provisionalType = getMemoizedProvisionalType(currentScores, state, questions);
    
    // 影響計算(スコアを渡す)
    const impacts = calculateOptionImpacts(question, state, questions, currentScores);
    const isShadow = impacts[0].isShadow;
    
    // 進捗更新(スコアとタイプを渡す)
    updateProgressSection(state, questions, currentScores, provisionalType);
    
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
        appContext.questions,
        appContext.mode
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
            (score) => getNormalizedScore(score, appContext.mode),
            state.functionScores,
            appContext.questions,
            appContext.mode
        );
    }
}

/**
 * メインレンダリング関数
 * @param {DiagnosisState} state - 診断状態
 * @param {Question[]} questions - 質問配列
 */
function render(state, questions) {
    try {
        if (state.showResult) {
            renderResult(state);
        } else {
            renderQuestion(state, questions);
        }
    } catch (error) {
        console.error('[App] Render error:', error);
        showErrorScreen(error, 'レンダリング中にエラーが発生しました');
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
    console.error('[App] Application Error:', error);
    
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
 * UIを初期化
 * @private
 */
function initUI() {
    try {
        const mode = getModeFromURL();
        document.title = `Persona Finder - ${getModeDisplayName(mode)}`;
    } catch (error) {
        console.error('[App] Error in initUI:', error);
    }
}

/**
 * ストレージを初期化
 * @private
 * @param {string} mode - 現在のモード
 * @returns {ReturnType<typeof createStorageManager>} ストレージマネージャー
 */
function initStorage(mode) {
    const storage = createStorageManager('persona_finder');
    
    try {
        const savedMode = storage.getMode();
        if (savedMode && savedMode !== mode) {
            console.warn(`[App] モード不一致 (保存: ${savedMode}, 現在: ${mode}). 診断状態のみリセット`);
            
            // シャッフルシードを保持
            const seed = storage.shuffleSeed.get();
            storage.clearAll();
            storage.shuffleSeed.set(seed);
            storage.setMode(mode);
            showModeChangeNotification(mode);
        } else if (!savedMode) {
            storage.setMode(mode);
        }
    } catch (error) {
        console.error('[App] Error in initStorage:', error);
    }
    
    return storage;
}

/**
 * データを初期化
 * @private
 * @param {string} mode - 現在のモード
 * @returns {Promise<Object>} データオブジェクト
 */
async function initData(mode) {
    try {
        const data = await initializeData(mode);
        
        if (!data.questions || data.questions.length === 0) {
            throw new Error(ERROR_MESSAGES.NO_QUESTIONS);
        }
        
        console.info(`[App] モード: ${mode}, 質問数: ${data.questions.length}`);
        
        return data;
    } catch (error) {
        console.error('[App] Error in initData:', error);
        throw error;
    }
}

/**
 * 質問をシャッフル
 * @private
 * @param {Question[]} questions - 質問配列
 * @param {ReturnType<typeof createStorageManager>} storage - ストレージマネージャー
 * @returns {Question[]} シャッフルされた質問配列
 */
function initQuestions(questions, storage) {
    try {
        let shuffleSeed = storage.shuffleSeed.get();
        const { shuffled, seed: usedSeed } = shuffleQuestionsWithConstraints(questions, shuffleSeed);
        storage.shuffleSeed.set(usedSeed);
        
        return shuffled;
    } catch (error) {
        console.error('[App] Error in initQuestions:', error);
        return questions;
    }
}

/**
 * ハンドラーを初期化
 * @private
 * @param {ReturnType<typeof useDiagnosisState>} diagnosisState - 診断状態
 * @param {Question[]} questions - 質問配列
 * @param {ReturnType<typeof createStorageManager>} storage - ストレージマネージャー
 * @returns {ReturnType<typeof createHandlers>} ハンドラー関数群
 */
function initHandlers(diagnosisState, questions, storage) {
    try {
        const handlers = createHandlers({
            diagnosisState,
            questions,
            calculateScore,
            storage
        });
        
        // グローバルハンドラー登録(後方互換性のため)
        window.handleAnswer = handlers.handleAnswer.bind(handlers);
        window.goBack = handlers.goBack.bind(handlers);
        window.goNext = handlers.goNext.bind(handlers);
        window.reset = handlers.reset.bind(handlers);
        window.handleKeyboardNav = handlers.handleKeyboardNav.bind(handlers);
        
        return handlers;
    } catch (error) {
        console.error('[App] Error in initHandlers:', error);
        throw error;
    }
}

/**
 * 状態を復元
 * @private
 * @param {ReturnType<typeof useDiagnosisState>} diagnosisState - 診断状態
 * @param {ReturnType<typeof createStorageManager>} storage - ストレージマネージャー
 * @param {string} mode - 現在のモード
 * @returns {boolean} 復元が成功したかどうか
 */
function restoreState(diagnosisState, storage, mode) {
    try {
        const savedState = storage.loadState();
        const savedMode = storage.getMode();
        
        if (savedState && savedMode === mode) {
            diagnosisState.setState(savedState);
            console.info(`[App] 保存状態を復元 (mode: ${savedMode})`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[App] Error in restoreState:', error);
        return false;
    }
}

/**
 * アプリケーションを初期化
 * @returns {Promise<void>}
 */
async function initializeApplication() {
    showLoadingScreen();
    
    try {
        // 1. UI初期化
        initUI();
        
        // 2. モード取得
        const mode = getModeFromURL();
        
        // 3. ストレージ初期化
        const storage = initStorage(mode);
        
        // 4. データ読み込み
        const data = await initData(mode);
        
        // 5. 質問シャッフル
        const shuffledQuestions = initQuestions(data.questions, storage);
        
        // 6. 状態管理初期化
        const diagnosisState = useDiagnosisState(shuffledQuestions);
        
        // 7. ハンドラー初期化
        const handlers = initHandlers(diagnosisState, shuffledQuestions, storage);
        
        // 8. アプリケーションコンテキスト設定
        appContext = Object.freeze({
            questions: shuffledQuestions,
            cognitiveStacks: data.cognitiveStacks,
            mbtiDescriptions: data.mbtiDescriptions,
            diagnosisState,
            handlers,
            storage,
            mode
        });
        
        // 9. Shadow説明の表示履歴チェック
        hasSeenShadowExplanation = storage.shadowSeen.get();
        
        // 10. 状態監視
        diagnosisState.subscribe((state) => {
            try {
                // メモキャッシュをクリア
                clearMemoCache();
                
                storage.saveState(state);
                render(state, appContext.questions);
            } catch (error) {
                console.error('[App] Error in state subscription:', error);
            }
        });
        
        // 11. 保存状態の復元
        const wasRestored = restoreState(diagnosisState, storage, mode);
        
        // 12. 初回レンダリング
        const state = diagnosisState.getState();
        render(state, appContext.questions);
        
        // 13. 復元通知
        if (wasRestored && state.currentQuestion > 0) {
            showRestoreNotification(state, appContext.questions);
        }
        
        console.info('[App] Application initialized successfully');
        
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

/**
 * DOMContentLoaded イベントハンドラー
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // 既に読み込み済みの場合は即実行
    initializeApplication();
}

// 開発用: アプリケーションコンテキストをグローバルに公開(デバッグ用)
if (typeof window !== 'undefined') {
    const isDev = typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development';
    if (isDev) {
        window.__APP_CONTEXT__ = appContext;
    }
}

// ============================================
// エクスポート(テスト用)
// ============================================

export {
    initializeApplication,
    getModeFromURL,
    getModeDisplayName,
    recalculateFunctionScores,
    getMemoizedScores,
    getMemoizedProvisionalType,
    calculateOptionImpacts,
    shuffleQuestionsWithConstraints,
    clearMemoCache,
    CONFIG,
    ERROR_MESSAGES,
    MODE_DISPLAY_NAMES
};