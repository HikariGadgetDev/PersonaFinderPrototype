// app.js (リファクタリング版 - アクセシビリティ + パフォーマンス + ローカルストレージ)

import {
    calculateScore,
    determineMBTIType,
    FUNCTIONS,
    COGNITIVE_STACKS,
    mbtiDescriptions,
    getNormalizedScore
} from './core.js';
import { questions as originalQuestions } from './data.js';

// ============================================
// ローカルストレージ管理
// ============================================

const STORAGE_KEYS = {
    STATE: 'persona_finder_state',
    SHUFFLE_SEED: 'persona_finder_shuffle_seed',
    HAS_SEEN_SHADOW: 'persona_finder_seen_shadow'
};

/**
 * 状態をローカルストレージに保存
 */
function saveStateToStorage(state) {
    try {
        const serialized = JSON.stringify({
            currentQuestion: state.currentQuestion,
            answers: state.answers,
            functionScores: state.functionScores,
            showResult: state.showResult,
            timestamp: Date.now()
        });
        localStorage.setItem(STORAGE_KEYS.STATE, serialized);
        console.log('✅ 状態を保存しました');
    } catch (error) {
        console.error('❌ 保存エラー:', error);
    }
}

/**
 * 状態をローカルストレージから復元
 */
function loadStateFromStorage() {
    try {
        const serialized = localStorage.getItem(STORAGE_KEYS.STATE);
        if (!serialized) return null;
        
        const loaded = JSON.parse(serialized);
        
        // 24時間以上前のデータは破棄
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - loaded.timestamp > ONE_DAY) {
            console.log('⏰ 古いデータを削除しました');
            clearStorage();
            return null;
        }
        
        console.log('✅ 状態を復元しました');
        return {
            currentQuestion: loaded.currentQuestion || 0,
            answers: loaded.answers || {},
            functionScores: loaded.functionScores || createDefaultFunctionScores(),
            showResult: loaded.showResult || false
        };
    } catch (error) {
        console.error('❌ 復元エラー:', error);
        return null;
    }
}

/**
 * ローカルストレージをクリア
 */
function clearStorage() {
    localStorage.removeItem(STORAGE_KEYS.STATE);
    localStorage.removeItem(STORAGE_KEYS.SHUFFLE_SEED);
    console.log('🗑️ データを削除しました');
}

/**
 * Shadow説明の表示履歴を保存/取得
 */
function getHasSeenShadow() {
    return localStorage.getItem(STORAGE_KEYS.HAS_SEEN_SHADOW) === 'true';
}

function setHasSeenShadow() {
    localStorage.setItem(STORAGE_KEYS.HAS_SEEN_SHADOW, 'true');
}

// ============================================
// セキュリティ: HTMLサニタイズ関数
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 質問のシャッフル処理(シード保存対応)
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
            if (shuffled[i].type === shuffled[i - 1].type) {
                hasConsecutive = true;
                break;
            }
        }
        
        if (!hasConsecutive) {
            // 成功したシードを保存
            localStorage.setItem(STORAGE_KEYS.SHUFFLE_SEED, currentSeed.toString());
            return shuffled;
        }
    }
    
    console.warn('制約付きシャッフルが1000回で完了しませんでした。');
    return fisherYatesShuffleWithSeed(questions, seed);
}

// シードの取得または生成
function getOrCreateShuffleSeed() {
    const stored = localStorage.getItem(STORAGE_KEYS.SHUFFLE_SEED);
    if (stored) {
        return parseInt(stored, 10);
    }
    return Date.now(); // 新規シード
}

const shuffleSeed = getOrCreateShuffleSeed();
const questions = shuffleQuestionsWithConstraints(originalQuestions, shuffleSeed);

// ============================================
// 初期状態定義
// ============================================

function createDefaultFunctionScores() {
    return {
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    };
}

const createDefaultState = () => ({
    currentQuestion: 0,
    answers: {},
    functionScores: createDefaultFunctionScores(),
    showResult: false
});

// 復元を試みる
let state = loadStateFromStorage() || createDefaultState();
let isProcessing = false;
let hasSeenShadowExplanation = getHasSeenShadow();

// ============================================
// 定数定義
// ============================================

const SCORE_LABELS = {
    1: "全くそう思わない",
    2: "あまりそう思わない",
    3: "どちらとも言えない",
    4: "ややそう思う",
    5: "とてもそう思う"
};

const DEFAULT_PROVISIONAL_TYPE = 'INTJ';

const ANIMATION_DELAY = {
    BUTTON_FEEDBACK: 200,
    SCREEN_TRANSITION: 300
};

// ============================================
// キーボードナビゲーション
// ============================================

/**
 * キーボード矢印キー対応
 */
window.handleKeyboardNav = function(event, currentValue) {
    const options = Array.from(document.querySelectorAll('.option'));
    const currentIndex = options.findIndex(btn => 
        parseInt(btn.getAttribute('data-value')) === currentValue
    );
    
    let nextIndex = currentIndex;
    
    switch(event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
            event.preventDefault();
            nextIndex = Math.max(0, currentIndex - 1);
            break;
            
        case 'ArrowRight':
        case 'ArrowDown':
            event.preventDefault();
            nextIndex = Math.min(options.length - 1, currentIndex + 1);
            break;
            
        case 'Home':
            event.preventDefault();
            nextIndex = 0;
            break;
            
        case 'End':
            event.preventDefault();
            nextIndex = options.length - 1;
            break;
            
        case 'Enter':
        case ' ':
            event.preventDefault();
            const value = parseInt(options[currentIndex].getAttribute('data-value'));
            handleAnswer(value, { currentTarget: options[currentIndex] });
            return;
            
        default:
            return;
    }
    
    // フォーカス移動
    if (nextIndex !== currentIndex && options[nextIndex]) {
        options[nextIndex].focus();
        
        // tabindexを更新(ローミングタブインデックス)
        options.forEach((opt, idx) => {
            opt.tabIndex = idx === nextIndex ? 0 : -1;
        });
    }
};

/**
 * 初期フォーカス設定
 */
function setInitialFocus() {
    setTimeout(() => {
        const selectedOption = document.querySelector('.option[aria-checked="true"]');
        const firstOption = document.querySelector('.option');
        const targetOption = selectedOption || firstOption;
        
        if (targetOption) {
            targetOption.focus();
            // 他のボタンのtabindexを-1に
            document.querySelectorAll('.option').forEach(opt => {
                opt.tabIndex = opt === targetOption ? 0 : -1;
            });
        }
    }, 0);
}

// ============================================
// イベントハンドラ
// ============================================

window.handleAnswer = function (value, event) {
    if (isProcessing) return;
    isProcessing = true;

    const question = questions[state.currentQuestion];
    const funcType = question.type;
    const isReverse = question.reverse || false;
    const oldAnswer = state.answers[question.id];

    // スコアボードの開閉状態を保存
    const scoresList = document.getElementById('scores-list');
    const wasOpen = scoresList && scoresList.classList.contains('open');

    // 前回の回答スコアを差し引く
    if (oldAnswer !== undefined) {
        const oldAnswerData = state.answers[question.id];
        const oldScore = calculateScore(
            typeof oldAnswerData === 'object' ? oldAnswerData.value : oldAnswerData, 
            isReverse
        );
        state.functionScores[funcType] -= oldScore;
    }

    // 新しいスコアを加算
    const delta = calculateScore(value, isReverse);
    state.functionScores[funcType] += delta;

    // 回答を保存
    state.answers[question.id] = {
        value: value,
        isReverse: isReverse
    };

    // ローカルストレージに保存
    saveStateToStorage(state);

    // ボタンの選択状態を更新
    if (event && event.currentTarget) {
        const buttons = document.querySelectorAll('.option');
        buttons.forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        });
        event.currentTarget.classList.add('selected');
        event.currentTarget.setAttribute('aria-checked', 'true');
    }

    // 次の質問へ
    if (state.currentQuestion < questions.length - 1) {
        setTimeout(() => {
            nextStep(() => state.currentQuestion++, wasOpen);
        }, ANIMATION_DELAY.BUTTON_FEEDBACK);
    } else {
        setTimeout(() => {
            nextStep(() => state.showResult = true, wasOpen);
        }, ANIMATION_DELAY.BUTTON_FEEDBACK);
    }
};

window.goBack = function () {
    if (state.currentQuestion > 0 && !isProcessing) {
        // スコアボードの開閉状態を保存
        const scoresList = document.getElementById('scores-list');
        const wasOpen = scoresList && scoresList.classList.contains('open');
        
        state.currentQuestion--;
        saveStateToStorage(state);
        render();
        
        // スコアボードの状態を復元
        if (wasOpen) {
            restoreScoresListState(true);
        }
    }
};

window.goNext = function () {
    if (state.currentQuestion < questions.length - 1 && !isProcessing) {
        // 現在の質問に回答済みかチェック
        const currentQuestion = questions[state.currentQuestion];
        if (state.answers[currentQuestion.id]) {
            // スコアボードの開閉状態を保存
            const scoresList = document.getElementById('scores-list');
            const wasOpen = scoresList && scoresList.classList.contains('open');
            
            state.currentQuestion++;
            saveStateToStorage(state);
            render();
            
            // スコアボードの状態を復元
            if (wasOpen) {
                restoreScoresListState(true);
            }
        }
    }
};

window.reset = function () {
    // 確認ダイアログを表示
    const confirmed = confirm(
        '診断をリセットしますか?\n\n' +
        '現在の回答データが全て削除されます。\n' +
        'この操作は取り消せません。'
    );
    
    if (!confirmed) {
        return; // キャンセルされた場合は何もしない
    }
    
    clearStorage();
    state = createDefaultState();
    hasSeenShadowExplanation = false;
    render();
    
    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // リセット完了通知
    showResetNotification();
};

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
        updateScoresList();
        text.textContent = 'スコア詳細を非表示';
        icon.textContent = '▲';
    }
};

// ============================================
// 影響計算関数
// ============================================

/**
 * 現在の質問までのスコアを再計算
 */
function recalculateFunctionScores() {
    const scores = createDefaultFunctionScores();
    
    // 現在の質問までのスコアのみを計算
    for (let i = 0; i <= state.currentQuestion; i++) {
        const q = questions[i];
        const answer = state.answers[q.id];
        
        if (answer !== undefined) {
            const answerValue = typeof answer === 'object' ? answer.value : answer;
            const isReverse = typeof answer === 'object' ? answer.isReverse : false;
            const delta = calculateScore(answerValue, isReverse);
            scores[q.type] += delta;
        }
    }
    
    return scores;
}

function getProvisionalType() {
    const answeredCount = Object.keys(state.answers).length;
    
    if (answeredCount === 0) {
        return DEFAULT_PROVISIONAL_TYPE;
    }
    
    // 現在の質問までのスコアで判定
    const currentScores = recalculateFunctionScores();
    const result = determineMBTIType(currentScores, COGNITIVE_STACKS);
    return result.type;
}

function calculateOptionImpacts(question) {
    const funcType = question.type;
    const isReverse = question.reverse || false;
    const provisionalType = getProvisionalType();
    const stack = COGNITIVE_STACKS[provisionalType];
    const weights = [4.0, 2.0, 1.0, 0.5];
    
    // 現在の質問までのスコアを取得
    const currentScores = recalculateFunctionScores();
    
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
                normalizedDelta
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
// UI演出関数
// ============================================

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
    
    tooltip.style.position = 'fixed';
    tooltip.style.bottom = '80px';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.background = 'rgba(30, 41, 59, 0.95)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '16px 20px';
    tooltip.style.borderRadius = '12px';
    tooltip.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
    tooltip.style.maxWidth = '400px';
    tooltip.style.zIndex = '10000';
    tooltip.style.textAlign = 'center';
    tooltip.style.animation = 'fadeIn 0.3s ease-out';
    
    setTimeout(() => {
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => tooltip.remove(), 300);
    }, 5000);
}

function nextStep(callback, wasOpen = false) {
    setTimeout(() => {
        callback();
        render();
        isProcessing = false;
        
        // スコアボードが開いていた場合は復元
        if (wasOpen) {
            restoreScoresListState(true);
        }
    }, ANIMATION_DELAY.SCREEN_TRANSITION);
}

/**
 * スコアボードの状態を復元
 */
function restoreScoresListState(shouldBeOpen) {
    setTimeout(() => {
        const list = document.getElementById('scores-list');
        const text = document.getElementById('toggle-text');
        const icon = document.getElementById('toggle-icon');
        
        if (shouldBeOpen && list && text && icon) {
            list.classList.add('open');
            text.textContent = 'スコア詳細を非表示';
            icon.textContent = '▲';
        }
    }, 0);
}

// ============================================
// 差分レンダリング関数
// ============================================

/**
 * 進捗セクションの差分更新
 */
function updateProgressSection() {
    const answeredCount = Object.keys(state.answers).length;
    const progressPercent = Math.round((state.currentQuestion / Math.max(1, questions.length - 1)) * 100);
    
    const provisionalType = getProvisionalType();
    const provisionalDesc = mbtiDescriptions[provisionalType];
    
    // DOM要素を取得
    let progressSection = document.getElementById('progress-section');
    const previousType = progressSection.dataset.currentType;
    
    // 初回レンダリング または タイプが変更された場合は再生成
    if (!progressSection.dataset.initialized || previousType !== provisionalType) {
        progressSection.innerHTML = generateProgressHTML();
        progressSection.dataset.initialized = 'true';
        progressSection.dataset.currentType = provisionalType;
        return; // 再生成したので差分更新は不要
    }
    
    // 差分更新のみ(タイプが変わっていない場合)
    const typeBadge = document.getElementById('type-badge');
    const typeName = document.getElementById('type-name');
    const progressFill = document.getElementById('progress-fill');
    const progressPercentEl = document.getElementById('progress-percent');
    const progressNote = document.getElementById('progress-note');
    
    if (typeBadge && typeBadge.textContent !== provisionalType) {
        typeBadge.textContent = provisionalType;
        typeBadge.style.animation = 'none';
        setTimeout(() => typeBadge.style.animation = 'typeBadgeUpdate 0.3s ease', 10);
    }
    
    if (typeName) {
        typeName.textContent = provisionalDesc.name;
    }
    
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }
    
    if (progressPercentEl) {
        progressPercentEl.textContent = `${progressPercent}%`;
    }
    
    // 注意書きの更新
    if (progressNote) {
        const isInitialState = answeredCount === 0;
        progressNote.innerHTML = isInitialState 
            ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;opacity:0.7;">※便宜上の仮値です</div>'
            : (answeredCount < 8 
                ? '<div style="font-size:11px;color:#fbbf24;margin-top:4px;">⚠ 回答数が少ないため精度が低い可能性があります</div>'
                : '');
    }
}

/**
 * スコアリストの差分更新
 */
function updateScoresList() {
    const provisionalType = getProvisionalType();
    const stack = COGNITIVE_STACKS[provisionalType];
    const allFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    
    // 現在の質問までのスコアを取得
    const currentScores = recalculateFunctionScores();
    
    // スタック順 + スタック外の順に更新
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

/**
 * 進捗セクションのHTML生成(初回のみ)
 */
function generateProgressHTML() {
    const provisionalType = getProvisionalType();
    const provisionalDesc = mbtiDescriptions[provisionalType];
    const answeredCount = Object.keys(state.answers).length;
    const progressPercent = Math.round((state.currentQuestion / Math.max(1, questions.length - 1)) * 100);
    
    const isInitialState = answeredCount === 0;
    const progressNote = isInitialState 
        ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;opacity:0.7;">※便宜上の仮値です</div>'
        : (answeredCount < 8 
            ? '<div style="font-size:11px;color:#fbbf24;margin-top:4px;">⚠ 回答数が少ないため精度が低い可能性があります</div>'
            : '');
    
    // 現在の質問までのスコアを取得
    const currentScores = recalculateFunctionScores();
    
    // スタック順(上段4つ)
    const stack = COGNITIVE_STACKS[provisionalType];
    const stackLabels = ['主機能', '補助機能', '第三機能', '劣等機能'];
    const stackScores = stack.map((key, index) => ({
        key,
        label: stackLabels[index],
        normalizedValue: getNormalizedScore(currentScores[key])
    }));
    
    // スタック外(下段4つ)
    const allFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    const shadowScores = allFunctions
        .filter(key => !stack.includes(key))
        .map(key => ({
            key,
            label: 'Shadow',
            normalizedValue: getNormalizedScore(currentScores[key])
        }));
    
    return `
        <div class="progress-header">
            <div class="provisional-type">
                <span class="type-badge" id="type-badge">${escapeHtml(provisionalType)}</span>
                <span class="type-name" id="type-name">${escapeHtml(provisionalDesc.name)}</span>
            </div>
            <div class="progress-percent" id="progress-percent">${progressPercent}%</div>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div id="progress-note">${progressNote}</div>

        <div class="scores-toggle">
            <button class="scores-toggle-btn" onclick="toggleScores()">
                <span id="toggle-text">スコア詳細を表示</span>
                <span id="toggle-icon">▼</span>
            </button>
            <div class="scores-list" id="scores-list">
                ${stackScores.map(item => `
                    <div class="score-mini" data-score-key="${item.key}">
                        <div class="score-mini-position">${escapeHtml(item.label)}</div>
                        <div class="score-mini-label">${escapeHtml(item.key)}</div>
                        <div class="score-mini-value">${item.normalizedValue}</div>
                    </div>
                `).join('')}
                ${shadowScores.map(item => `
                    <div class="score-mini score-mini-shadow" data-score-key="${item.key}">
                        <div class="score-mini-position">${escapeHtml(item.label)}</div>
                        <div class="score-mini-label">${escapeHtml(item.key)}</div>
                        <div class="score-mini-value">${item.normalizedValue}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============================================
// レンダリング関数
// ============================================

function render() {
    if (state.showResult) {
        renderResult();
    } else {
        renderQuestion();
    }
}

function renderQuestion() {
    const q = questions[state.currentQuestion];
    const savedAnswer = state.answers[q.id];
    const currentValue = savedAnswer ? savedAnswer.value : undefined;
    
    const impacts = calculateOptionImpacts(q);
    const isShadow = impacts[0].isShadow;
    const funcColor = isShadow ? '#94a3b8' : '#60a5fa';
    
    // 進捗セクション差分更新
    updateProgressSection();
    
    // 質問セクションは毎回生成
    const questionContent = document.getElementById('question-content');
    questionContent.innerHTML = generateQuestionHTML(q, impacts, currentValue, isShadow, funcColor);
    
    // イベント委譲でリスナーを設定
    const optionsContainer = questionContent.querySelector('.options-horizontal');
    if (optionsContainer && !optionsContainer.dataset.listenerAttached) {
        optionsContainer.addEventListener('click', handleOptionClick);
        optionsContainer.addEventListener('keydown', handleOptionKeydown);
        optionsContainer.dataset.listenerAttached = 'true';
    }
    
    // フォーカス設定
    setInitialFocus();
    
    // ナビゲーションボタンの表示/非表示
    const backBtn = document.getElementById('btn-back');
    const nextBtn = document.getElementById('btn-next');
    
    backBtn.style.display = state.currentQuestion > 0 ? 'block' : 'none';
    
    // 次へボタンは回答済み かつ 最終問題でない場合に表示
    const currentQuestion = questions[state.currentQuestion];
    const hasAnswer = state.answers[currentQuestion.id];
    const isLastQuestion = state.currentQuestion >= questions.length - 1;
    
    nextBtn.style.display = hasAnswer && !isLastQuestion ? 'block' : 'none';
    
    // Shadow機能の説明 (初回のみ)
    if (isShadow && !hasSeenShadowExplanation) {
        hasSeenShadowExplanation = true;
        setHasSeenShadow();
        setTimeout(() => showShadowExplanation(), 500);
    }
}

/**
 * 質問HTMLの生成
 */
function generateQuestionHTML(q, impacts, currentValue, isShadow, funcColor) {
    const questionId = `question-text-${state.currentQuestion}`;
    
    return `
        <div class="question-header" id="question-header-${state.currentQuestion}">
            Question ${state.currentQuestion + 1} of ${questions.length}
        </div>
        <div class="question-text" id="${questionId}">
            ${escapeHtml(q.text)}
            ${q.reverse ? ' <span style="color:var(--color-accent-primary);font-size:0.9em">(逆転項目)</span>' : ''}
        </div>

        <div class="options-horizontal" 
             role="radiogroup" 
             aria-labelledby="${questionId}"
             aria-describedby="question-header-${state.currentQuestion}">
            ${[1, 2, 3, 4, 5].map((v, index) => {
                const impact = impacts[index];
                const isSelected = currentValue === v;
                
                return `
                    <button class="option ${isSelected ? 'selected' : ''} ${isShadow ? 'option-shadow' : ''}"
                            role="radio"
                            aria-checked="${isSelected}"
                            aria-label="${escapeHtml(SCORE_LABELS[v])} - ${v}点"
                            data-value="${v}"
                            tabindex="${isSelected ? '0' : '-1'}">
                        
                        <div class="option-header">
                            <div class="option-score">${v}</div>
                            <div class="option-label">${escapeHtml(SCORE_LABELS[v])}</div>
                        </div>
                        
                        ${impact.isShadow ? `
                            <div class="option-impact">
                                <span class="impact-func" style="color:${funcColor};">
                                    ${escapeHtml(impact.funcType)}
                                </span>
                                <span class="impact-position">[shadow]</span>
                                
                                <div class="impact-change">
                                    <span class="impact-current">${impact.currentNormalized}</span>
                                    <span class="impact-arrow">→</span>
                                    <span class="impact-new ${impact.normalizedDelta >= 0 ? 'positive' : 'negative'}">
                                        ${impact.newNormalized}
                                    </span>
                                </div>
                                
                                <div class="impact-shadow-note">
                                    スタック外 (${escapeHtml(getProvisionalType())})
                                </div>
                            </div>
                        ` : `
                            <div class="option-impact">
                                <span class="impact-func" style="color:${funcColor};">
                                    ${escapeHtml(impact.funcType)}
                                </span>
                                <span class="impact-position">[${escapeHtml(impact.position)}]</span>
                                
                                <div class="impact-change">
                                    <span class="impact-current">${impact.currentNormalized}</span>
                                    <span class="impact-arrow">→</span>
                                    <span class="impact-new ${impact.normalizedDelta >= 0 ? 'positive' : 'negative'}">
                                        ${impact.newNormalized}
                                    </span>
                                </div>
                                
                                <div class="impact-weighted">
                                    診断影響: ${impact.weightedDelta >= 0 ? '+' : ''}${impact.weightedDelta.toFixed(1)} (×${impact.weight})
                                </div>
                            </div>
                        `}
                    </button>
                `;
            }).join('')}
        </div>

        ${window.innerWidth <= 360 ? `
            <div class="mobile-hint">
                横スクロールで全選択肢を確認できます
            </div>
        ` : ''}

        <div class="keyboard-hint">
            キーボード操作: 
            <kbd>←</kbd><kbd>→</kbd> 選択肢移動 | 
            <kbd>Enter</kbd> 決定 | 
            <kbd>Home</kbd>/<kbd>End</kbd> 最初/最後
        </div>
    `;
}

/**
 * イベント委譲:選択肢クリック
 */
function handleOptionClick(event) {
    const button = event.target.closest('.option');
    if (!button) return;
    
    const value = parseInt(button.dataset.value);
    if (!isNaN(value)) {
        handleAnswer(value, { currentTarget: button });
    }
}

/**
 * イベント委譲:選択肢キーボード
 */
function handleOptionKeydown(event) {
    const button = event.target.closest('.option');
    if (!button) return;
    
    const value = parseInt(button.dataset.value);
    if (!isNaN(value)) {
        handleKeyboardNav(event, value);
    }
}

function renderResult() {
    const result = determineMBTIType(state.functionScores, COGNITIVE_STACKS);
    const mbtiType = result.type;
    const confidence = result.confidence;
    const desc = mbtiDescriptions[mbtiType];

    const sortedScores = Object.entries(state.functionScores)
        .map(([key, val]) => ({
            key,
            value: getNormalizedScore(val),
            func: FUNCTIONS[key]
        }))
        .sort((a, b) => b.value - a.value);

    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');
    
    questionScreen.style.display = 'none';
    resultScreen.style.display = 'block';
    resultScreen.className = 'result-screen active';
    
    resultScreen.innerHTML = `
        <div class="result-header">
            <h2 class="result-title">診断完了</h2>
            <p class="result-subtitle">あなたの認知機能プロファイルが特定されました</p>
        </div>

        <div class="result-card">
            <div class="result-mbti">${escapeHtml(mbtiType)}</div>
            <h3 class="result-name">${escapeHtml(desc.name)}</h3>
            <p class="result-desc">${escapeHtml(desc.description)}</p>
        </div>

        <div class="result-card">
            <h4 style="margin-bottom: 16px; font-size: 18px;">認知機能スタック</h4>
            <div style="display: grid; gap: 12px;">
                ${COGNITIVE_STACKS[mbtiType].map((f, index) => `
                    <div style="padding: 16px; background: var(--color-bg-secondary); border-radius: 12px; border: 1px solid var(--color-border);">
                        <div style="font-size: 11px; color: var(--color-accent-primary); font-weight: 700; margin-bottom: 8px;">
                            ${['主機能', '補助機能', '第三機能', '劣等機能'][index]}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">
                                    ${escapeHtml(FUNCTIONS[f].fullName)}
                                </div>
                                <div style="font-size: 13px; color: var(--color-text-secondary);">
                                    ${escapeHtml(FUNCTIONS[f].description)}
                                </div>
                            </div>
                            <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 800; color: var(--color-accent-primary);">
                                ${escapeHtml(f)}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="result-card">
            <h4 style="margin-bottom: 16px; font-size: 18px;">詳細スコア</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                ${sortedScores.map(item => `
                    <div style="text-align: center; padding: 12px; background: var(--color-bg-secondary); border-radius: 8px; border: 1px solid var(--color-border);">
                        <div style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: var(--color-accent-primary); margin-bottom: 4px;">
                            ${escapeHtml(item.key)}
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 800;">
                            ${item.value}
                        </div>
                        <div style="font-size: 11px; color: var(--color-text-secondary);">
                            ${escapeHtml(item.func.fullName)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <button class="btn-restart" onclick="reset()">
            診断をやり直す
        </button>
    `;
}

// ============================================
// 初期化
// ============================================

window.onload = function() {
    render();
    
    // 復元メッセージ表示
    const savedState = localStorage.getItem(STORAGE_KEYS.STATE);
    if (savedState && state.currentQuestion > 0) {
        showRestoreNotification();
    }
};

/**
 * 復元通知の表示
 */
function showRestoreNotification() {
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