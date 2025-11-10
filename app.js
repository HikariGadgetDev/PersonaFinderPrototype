// ============================================
// app.js - Application Entry Point (非同期対応版)
// ============================================

import { useDiagnosisState, useLocalStorage } from './hooks.js';
import { ProgressSection, QuestionCard, ResultCard } from './components.js';
import { useHandlers } from './handlers.js';
import { initializeData } from './data.js';
import { 
    calculateScore, 
    determineMBTITypeWithConsistency,
    getNormalizedScore,
    FUNCTIONS as CORE_FUNCTIONS
} from './core.js';

// ============================================
// グローバル変数(初期化後に設定)
// ============================================

let questions = [];
let COGNITIVE_STACKS = {};
let mbtiDescriptions = {};
let diagnosisState = null;
let handlers = null;
let storage = null;
let FUNCTIONS = CORE_FUNCTIONS; // core.jsのFUNCTIONSを使用

// ============================================
// ユーティリティ: 質問のシャッフル
// ============================================

function seededRandom(seed) {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

function fisherYatesShuffleWithSeed(array, seed) {
    const shuffled = [...array];
    const random = seededRandom(seed);
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function shuffleQuestionsWithConstraints(questions, seed) {
    const maxAttempts = 1000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
    
    console.warn('制約付きシャッフルが1000回で完了しませんでした。');
    return { shuffled: fisherYatesShuffleWithSeed(questions, seed), seed };
}

// ============================================
// ビジネスロジック
// ============================================

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

function getProvisionalType(state, questions) {
    const answeredCount = Object.keys(state.answers).length;
    
    if (answeredCount === 0) {
        return 'INTJ';
    }
    
    const currentScores = recalculateFunctionScores(state, questions);
    
    // 矛盾検出はまだ行わない（暫定タイプ取得のみ）
    const result = determineMBTITypeWithConsistency(currentScores, COGNITIVE_STACKS, state.answers, questions);
    return result.type;
}

function calculateOptionImpacts(question, state, questions) {
    const funcType = question.function;
    const isReverse = question.reverse || false;
    const provisionalType = getProvisionalType(state, questions);
    const stack = COGNITIVE_STACKS[provisionalType];
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

let hasSeenShadowExplanation = false;

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
    }, 3000);
}

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

function updateProgressSection(state, questions) {
    const provisionalType = getProvisionalType(state, questions);
    const currentScores = recalculateFunctionScores(state, questions);
    
    const progressSection = document.getElementById('progress-section');
    const previousType = progressSection.dataset.currentType;
    
    if (!progressSection.dataset.initialized || previousType !== provisionalType) {
        progressSection.innerHTML = ProgressSection.render(
            state,
            provisionalType,
            mbtiDescriptions,
            COGNITIVE_STACKS,
            getNormalizedScore,
            questions,
            currentScores
        );
        progressSection.dataset.initialized = 'true';
        progressSection.dataset.currentType = provisionalType;
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
            : (answeredCount < 8 
                ? '<div style="font-size:11px;color:#fbbf24;margin-top:4px;">⚠ 回答数が少ないため精度が低い可能性があります</div>'
                : '');
    }
    
    const scoresList = document.getElementById('scores-list');
    if (scoresList && scoresList.classList.contains('open')) {
        updateScoresList(state, questions);
    }
}

function updateScoresList(state, questions) {
    const provisionalType = getProvisionalType(state, questions);
    const stack = COGNITIVE_STACKS[provisionalType];
    const allFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    const currentScores = recalculateFunctionScores(state, questions);
    const orderedFunctions = [...stack, ...allFunctions.filter(f => !stack.includes(f))];
    
    orderedFunctions.forEach(key => {
        const normalizedValue = getNormalizedScore(currentScores[key]);
        const valueEl = document.querySelector(`[data-score-key="${key}"] .score-mini-value`);
        if (valueEl && valueEl.textContent !== String(normalizedValue)) {
            valueEl.textContent = normalizedValue;
            valueEl.style.animation = 'none';
            setTimeout(() => valueEl.style.animation = 'scoreUpdate 0.3s ease', 10);
        }
    });
}

function renderQuestion(state, questions) {
    const question = questions[state.currentQuestion];
    const savedAnswer = state.answers[question.id];
    const currentValue = savedAnswer ? savedAnswer.value : undefined;
    
    const impacts = calculateOptionImpacts(question, state, questions);
    const isShadow = impacts[0].isShadow;
    
    updateProgressSection(state, questions);
    
    const questionContent = document.getElementById('question-content');
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
    
    backBtn.style.display = state.currentQuestion > 0 ? 'block' : 'none';
    
    const hasAnswer = state.answers[question.id];
    const isLastQuestion = state.currentQuestion >= questions.length - 1;
    nextBtn.style.display = hasAnswer && !isLastQuestion ? 'block' : 'none';
    
    if (isShadow && !hasSeenShadowExplanation) {
        hasSeenShadowExplanation = true;
        setTimeout(() => showShadowExplanation(), 500);
    }
}

function renderResult(state) {
    // 矛盾検出を含む完全な診断結果を取得
    const result = determineMBTITypeWithConsistency(
        state.functionScores, 
        COGNITIVE_STACKS,
        state.answers,
        questions
    );
    
    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');
    
    questionScreen.style.display = 'none';
    resultScreen.style.display = 'block';
    resultScreen.className = 'result-screen active';
    
    // FUNCTIONSを渡す
    resultScreen.innerHTML = ResultCard.render(
        result,
        mbtiDescriptions,
        COGNITIVE_STACKS,
        FUNCTIONS,  // ← これが渡されているか確認
        getNormalizedScore,
        state.functionScores
    );
}

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

function handleOptionClick(event) {
    const button = event.target.closest('.option');
    if (!button) return;
    
    const value = parseInt(button.dataset.value);
    if (!isNaN(value)) {
        handlers.handleAnswer(value, { currentTarget: button });
    }
}

function handleOptionKeydown(event) {
    const button = event.target.closest('.option');
    if (!button) return;
    
    const value = parseInt(button.dataset.value);
    if (!isNaN(value)) {
        handlers.handleKeyboardNav(event, value);
    }
}

window.toggleScores = function() {
    const list = document.getElementById('scores-list');
    const text = document.getElementById('toggle-text');
    const icon = document.getElementById('toggle-icon');
    
    if (list.classList.contains('open')) {
        list.classList.remove('open');
        text.textContent = 'スコア詳細を表示';
        icon.textContent = '▼';
    } else {
        list.classList.add('open');
        const state = diagnosisState.getState();
        updateScoresList(state, questions);
        text.textContent = 'スコア詳細を非表示';
        icon.textContent = '▲';
    }
};

// ============================================
// アプリケーション初期化
// ============================================

window.onload = async function() {
    try {
        // ローディング表示
        const loadingDiv = document.getElementById('question-content');
        if (loadingDiv) {
            loadingDiv.innerHTML = '<div style="text-align:center;padding:40px;">読み込み中...</div>';
        }
        
        // データ読み込み
        const data = await initializeData('simple'); // または 'detailed'
        questions = data.questions;
        COGNITIVE_STACKS = data.cognitiveStacks;
        mbtiDescriptions = data.mbtiDescriptions;
        
        if (questions.length === 0) {
            throw new Error('質問データが読み込まれませんでした');
        }
        
        // ストレージ初期化
        storage = useLocalStorage();
        
        // シャッフルシードの取得・保存
        let shuffleSeed = storage.shuffleSeed.get();
        const { shuffled: shuffledQuestions, seed: usedSeed } = 
            shuffleQuestionsWithConstraints(questions, shuffleSeed);
        storage.shuffleSeed.set(usedSeed);
        questions = shuffledQuestions;
        
        // 状態管理初期化
        diagnosisState = useDiagnosisState(questions);
        handlers = useHandlers(diagnosisState, questions, calculateScore, storage);
        
        // Shadow説明の表示履歴チェック
        hasSeenShadowExplanation = storage.shadowSeen.get();
        
        // 状態監視
        diagnosisState.subscribe((state) => {
            storage.saveState(state);
            render(state, questions);
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
        render(state, questions);
        
        // 復元通知
        if (savedState && state.currentQuestion > 0) {
            showRestoreNotification(state, questions);
        }
        
    } catch (error) {
        console.error('アプリケーションの初期化に失敗:', error);
        const errorDiv = document.getElementById('question-content');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div style="text-align:center;padding:40px;color:#ef4444;">
                    <h3>エラーが発生しました</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;">
                        再読み込み
                    </button>
                </div>
            `;
        }
    }
};