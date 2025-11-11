// ============================================
// components.js - UI Components (リファクタ版)
// ============================================

// ============================================
// 型定義 (JSDoc)
// ============================================

/**
 * @typedef {Object} DiagnosisState
 * @property {number} currentQuestion - 現在の質問インデックス
 * @property {Object<string, {value: number, isReverse: boolean}>} answers - 回答記録
 */

/**
 * @typedef {Object} OptionImpact
 * @property {number} value - 選択肢の値 (1-5)
 * @property {boolean} isShadow - Shadow機能フラグ
 * @property {string} funcType - 機能タイプ
 * @property {number} currentNormalized - 現在の正規化スコア
 * @property {number} newNormalized - 新しい正規化スコア
 * @property {number} normalizedDelta - 正規化スコアの変化量
 */

/**
 * @typedef {Object} DiagnosticResult
 * @property {string} type - 判定されたMBTIタイプ
 * @property {number} confidence - 確信度 (0-100)
 * @property {number} originalConfidence - 調整前の確信度
 * @property {number} consistency - 一貫性スコア (0-100)
 * @property {number} contradictionCount - 矛盾件数
 * @property {string[]} top2 - トップ2タイプ
 * @property {Object<string, number>} typeScores - 全タイプのスコア
 * @property {string|null} warning - 警告メッセージ
 */

// ============================================
// ユーティリティ関数
// ============================================

/**
 * HTMLエスケープ処理
 * @param {string} text - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ProgressSection - 進捗セクションコンポーネント
// ============================================

export const ProgressSection = {
    /**
     * 進捗セクションをレンダリング
     * @param {DiagnosisState} state - 診断状態
     * @param {string} provisionalType - 暫定タイプ
     * @param {Object} mbtiDescriptions - MBTI説明
     * @param {Object} COGNITIVE_STACKS - 認知スタック
     * @param {Function} getNormalizedScore - スコア正規化関数
     * @param {Array} questions - 質問配列
     * @param {Object} currentScores - 現在のスコア
     * @returns {string} HTMLマークアップ
     */
    render(state, provisionalType, mbtiDescriptions, COGNITIVE_STACKS, getNormalizedScore, questions, currentScores) {
        const { currentQuestion, answers } = state;
        const answeredCount = Object.keys(answers).length;
        const progressPercent = Math.round((currentQuestion / Math.max(1, questions.length - 1)) * 100);
        
        const provisionalDesc = mbtiDescriptions[provisionalType];
        const isInitialState = answeredCount === 0;
        
        const progressNote = isInitialState 
            ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;opacity:0.7;">※便宜上の仮値です</div>'
            : (answeredCount < 8 
                ? '<div style="font-size:11px;color:#fbbf24;margin-top:4px;">⚠ 回答数が少ないため精度が低い可能性があります</div>'
                : '');

        const stack = COGNITIVE_STACKS[provisionalType];
        const stackLabels = ['主機能', '補助機能', '第三機能', '劣等機能'];
        
        const stackScores = stack.map((key, index) => ({
            key,
            label: stackLabels[index],
            normalizedValue: getNormalizedScore(currentScores[key])
        }));

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
                    <span class="type-badge" id="type-badge" aria-label="暫定タイプ ${provisionalType}">${provisionalType}</span>
                    <span class="type-name" id="type-name">${escapeHtml(provisionalDesc.name)}</span>
                </div>
                <div class="progress-percent" id="progress-percent" aria-label="進捗 ${progressPercent}パーセント">${progressPercent}%</div>
            </div>
            <div class="progress-bar" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="診断進捗">
                <div class="progress-fill" id="progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div id="progress-note">${progressNote}</div>

            <div class="scores-toggle">
                <button 
                    class="scores-toggle-btn" 
                    onclick="toggleScores()"
                    aria-expanded="false"
                    aria-controls="scores-list">
                    <span id="toggle-text">スコア詳細を表示</span>
                    <span id="toggle-icon" aria-hidden="true">▼</span>
                </button>
                <div class="scores-list" id="scores-list" role="region" aria-label="スコア詳細">
                    ${stackScores.map(item => this._renderScoreMini(item, false)).join('')}
                    ${shadowScores.map(item => this._renderScoreMini(item, true)).join('')}
                </div>
            </div>
        `;
    },

    /**
     * ミニスコアカードをレンダリング
     * @param {Object} item - スコア項目
     * @param {boolean} isShadow - Shadow機能フラグ
     * @returns {string} HTMLマークアップ
     */
    _renderScoreMini(item, isShadow) {
        return `
            <div class="score-mini ${isShadow ? 'score-mini-shadow' : ''}" data-score-key="${item.key}">
                <div class="score-mini-position">${escapeHtml(item.label)}</div>
                <div class="score-mini-label">${item.key}</div>
                <div class="score-mini-value" aria-label="${item.key} スコア ${item.normalizedValue}">${item.normalizedValue}</div>
            </div>
        `;
    }
};

// ============================================
// QuestionCard - 質問カードコンポーネント
// ============================================

export const QuestionCard = {
    /**
     * 質問カードをレンダリング
     * @param {Object} question - 質問オブジェクト
     * @param {OptionImpact[]} impacts - 影響データ配列
     * @param {number|undefined} currentValue - 現在の選択値
     * @param {boolean} isShadow - Shadow機能フラグ
     * @param {number} questionIndex - 質問インデックス
     * @param {number} totalQuestions - 総質問数
     * @returns {string} HTMLマークアップ
     */
    render(question, impacts, currentValue, isShadow, questionIndex, totalQuestions) {
        const SCORE_LABELS = {
            1: "全くそう思わない",
            2: "あまりそう思わない",
            3: "どちらとも言えない",
            4: "ややそう思う",
            5: "とてもそう思う"
        };

        const funcColor = isShadow ? '#94a3b8' : '#60a5fa';
        const questionId = `question-text-${questionIndex}`;
        const headerId = `question-header-${questionIndex}`;

        return `
            <div class="question-header" id="${headerId}">
                Question ${questionIndex + 1} of ${totalQuestions}
            </div>
            <div class="question-text" id="${questionId}">
                ${escapeHtml(question.text)}
                ${question.reverse ? ' <span style="color:var(--color-accent-primary);font-size:0.9em">(逆転項目)</span>' : ''}
            </div>

            <div class="options-horizontal" 
                 role="radiogroup" 
                 aria-labelledby="${questionId}"
                 aria-describedby="${headerId}">
                ${[1, 2, 3, 4, 5].map((v, index) => 
                    this._renderOption(v, impacts[index], currentValue, isShadow, funcColor, SCORE_LABELS)
                ).join('')}
            </div>

            ${window.innerWidth <= 360 ? `
                <div class="mobile-hint" role="note">
                    横スクロールで全選択肢を確認できます
                </div>
            ` : ''}

            <div class="keyboard-hint" role="note">
                キーボード操作: 
                <kbd>←</kbd><kbd>→</kbd> 選択肢移動 | 
                <kbd>Enter</kbd> 決定 | 
                <kbd>Home</kbd>/<kbd>End</kbd> 最初/最後
            </div>
        `;
    },

    /**
     * オプションボタンをレンダリング
     * @param {number} value - 選択肢の値
     * @param {OptionImpact} impact - 影響データ
     * @param {number|undefined} currentValue - 現在の選択値
     * @param {boolean} isShadow - Shadow機能フラグ
     * @param {string} funcColor - 機能の色
     * @param {Object} SCORE_LABELS - スコアラベル
     * @returns {string} HTMLマークアップ
     */
    _renderOption(value, impact, currentValue, isShadow, funcColor, SCORE_LABELS) {
        const isSelected = currentValue === value;

        return `
            <button class="option ${isSelected ? 'selected' : ''} ${isShadow ? 'option-shadow' : ''}"
                    role="radio"
                    aria-checked="${isSelected}"
                    aria-label="${escapeHtml(SCORE_LABELS[value])} - ${value}点"
                    data-value="${value}"
                    tabindex="${isSelected ? '0' : '-1'}">
                
                <div class="option-header">
                    <div class="option-score" aria-hidden="true">${value}</div>
                    <div class="option-label">${escapeHtml(SCORE_LABELS[value])}</div>
                </div>
                
                ${this._renderImpact(impact, isShadow, funcColor)}
            </button>
        `;
    },

    /**
     * 影響プレビューをレンダリング
     * @param {OptionImpact} impact - 影響データ
     * @param {boolean} isShadow - Shadow機能フラグ
     * @param {string} funcColor - 機能の色
     * @returns {string} HTMLマークアップ
     */
    _renderImpact(impact, isShadow, funcColor) {
        if (isShadow) {
            return `
                <div class="option-impact" role="status" aria-label="Shadow機能への影響">
                    <span class="impact-func" style="color:${funcColor};">
                        ${escapeHtml(impact.funcType)}
                    </span>
                    <span class="impact-position">[shadow]</span>
                    
                    <div class="impact-change">
                        <span class="impact-current">${impact.currentNormalized}</span>
                        <span class="impact-arrow" aria-hidden="true">→</span>
                        <span class="impact-new ${impact.normalizedDelta >= 0 ? 'positive' : 'negative'}">
                            ${impact.newNormalized}
                        </span>
                    </div>
                    
                    <div class="impact-shadow-note">
                        スタック外 (${escapeHtml(impact.provisionalType || '')})
                    </div>
                </div>
            `;
        }

        return `
            <div class="option-impact" role="status" aria-label="スコアへの影響">
                <span class="impact-func" style="color:${funcColor};">
                    ${escapeHtml(impact.funcType)}
                </span>
                <span class="impact-position">[${escapeHtml(impact.position)}]</span>
                
                <div class="impact-change">
                    <span class="impact-current">${impact.currentNormalized}</span>
                    <span class="impact-arrow" aria-hidden="true">→</span>
                    <span class="impact-new ${impact.normalizedDelta >= 0 ? 'positive' : 'negative'}">
                        ${impact.newNormalized}
                    </span>
                </div>
                
                <div class="impact-weighted">
                    診断影響: ${impact.weightedDelta >= 0 ? '+' : ''}${impact.weightedDelta.toFixed(1)} (×${impact.weight})
                </div>
            </div>
        `;
    }
};

// ============================================
// ResultCard - 結果カードコンポーネント
// ============================================

export const ResultCard = {
    /**
     * 結果カードをレンダリング
     * @param {DiagnosticResult} result - 診断結果
     * @param {Object} mbtiDescriptions - MBTI説明
     * @param {Object} COGNITIVE_STACKS - 認知スタック
     * @param {Object} FUNCTIONS - 機能定義
     * @param {Function} getNormalizedScore - スコア正規化関数
     * @param {Object} functionScores - 機能スコア
     * @returns {string} HTMLマークアップ
     */
    render(result, mbtiDescriptions, COGNITIVE_STACKS, FUNCTIONS, getNormalizedScore, functionScores) {
        const { type: mbtiType, confidence, originalConfidence, consistency, contradictionCount, warning, top2, typeScores } = result;
        const desc = mbtiDescriptions[mbtiType];
        const showAlternative = confidence < 40;

        return `
            <div class="result-header" role="banner">
                <h2 class="result-title">診断完了</h2>
                <p class="result-subtitle">あなたの認知機能プロファイルが特定されました</p>
            </div>

            ${this._renderTypeCard(mbtiType, desc)}
            ${showAlternative ? this._renderAlternativeTypeCard(top2, mbtiDescriptions, typeScores, confidence) : ''}
            ${this._renderMetricsCard(confidence, originalConfidence, consistency, contradictionCount, warning)}
            ${this._renderStackCard(mbtiType, COGNITIVE_STACKS, FUNCTIONS)}
            ${this._renderScoresCard(functionScores, FUNCTIONS, getNormalizedScore)}

            <button class="btn-restart" onclick="reset()" aria-label="診断をやり直す">
                診断をやり直す
            </button>
        `;
    },

    /**
     * タイプカードをレンダリング
     * @param {string} mbtiType - MBTIタイプ
     * @param {Object} desc - タイプ説明
     * @returns {string} HTMLマークアップ
     */
    _renderTypeCard(mbtiType, desc) {
        return `
            <div class="result-card" role="region" aria-labelledby="result-type">
                <div class="result-mbti" id="result-type" aria-label="診断結果 ${mbtiType}">${mbtiType}</div>
                <h3 class="result-name">${escapeHtml(desc.name)}</h3>
                <p class="result-desc">${escapeHtml(desc.description)}</p>
            </div>
        `;
    },

    /**
     * 次点タイプカードをレンダリング
     * @param {string[]} top2 - トップ2タイプ
     * @param {Object} mbtiDescriptions - MBTI説明
     * @param {Object} typeScores - タイプスコア
     * @param {number} confidence - 確信度
     * @returns {string} HTMLマークアップ
     */
    _renderAlternativeTypeCard(top2, mbtiDescriptions, typeScores, confidence) {
        const [firstType, secondType] = top2;
        const secondDesc = mbtiDescriptions[secondType];
        const firstScore = typeScores[firstType];
        const secondScore = typeScores[secondType];
        const scoreDiff = Math.abs(firstScore - secondScore).toFixed(1);

        return `
            <div class="result-card" style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.3);" role="region" aria-labelledby="alternative-type-heading">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 20px;" aria-hidden="true">💡</span>
                    <h4 id="alternative-type-heading" style="font-size: 16px; color: #fbbf24; margin: 0;">次点タイプの可能性</h4>
                </div>
                <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 16px; line-height: 1.5;">
                    確信度が${confidence}%と低めのため、以下のタイプの特性も持っている可能性があります。
                </p>
                <div style="
                    padding: 16px;
                    background: rgba(30, 41, 59, 0.6);
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                ">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <div style="
                            font-family: 'JetBrains Mono', monospace;
                            font-size: 24px;
                            font-weight: 800;
                            color: #f59e0b;
                        " aria-label="次点タイプ ${secondType}">
                            ${secondType}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 700; color: #f1f5f9;">
                                ${escapeHtml(secondDesc.name)}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                スコア差: ${scoreDiff}点
                            </div>
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">
                        ${escapeHtml(secondDesc.description)}
                    </p>
                </div>
            </div>
        `;
    },

    /**
     * メトリクスカードをレンダリング
     * @param {number} confidence - 確信度
     * @param {number} originalConfidence - 元の確信度
     * @param {number} consistency - 一貫性
     * @param {number} contradictionCount - 矛盾件数
     * @param {string|null} warning - 警告
     * @returns {string} HTMLマークアップ
     */
    _renderMetricsCard(confidence, originalConfidence, consistency, contradictionCount, warning) {
        const getConfidenceColor = (conf) => {
            if (conf >= 70) return '#10b981';
            if (conf >= 40) return '#60a5fa';
            return '#f59e0b';
        };

        const getConsistencyColor = (cons) => {
            if (cons >= 80) return '#10b981';
            if (cons >= 60) return '#f59e0b';
            return '#ef4444';
        };

        const getConfidenceDesc = (conf) => {
            if (conf >= 70) return 'タイプの特徴が明確です';
            if (conf >= 40) return '標準的な診断結果です';
            return '複数タイプの特性を持つ可能性があります';
        };

        const getConsistencyDesc = (cons) => {
            if (cons >= 80) return '回答に高い一貫性があります';
            if (cons >= 60) return '一部矛盾が見られます';
            return '回答の見直しをお勧めします';
        };

        const confColor = getConfidenceColor(confidence);
        const consColor = getConsistencyColor(consistency);

        return `
            <div class="result-card" role="region" aria-labelledby="metrics-heading">
                <h4 id="metrics-heading" style="margin-bottom: 16px; font-size: 18px;">診断信頼性</h4>
                
                ${this._renderMetricItem(
                    '🎯',
                    '確信度',
                    confidence,
                    confColor,
                    getConfidenceDesc(confidence),
                    originalConfidence !== confidence ? `(調整前: ${originalConfidence}%)` : null
                )}
                
                ${this._renderMetricItem(
                    '📄',
                    '回答の一貫性',
                    consistency,
                    consColor,
                    getConsistencyDesc(consistency),
                    contradictionCount > 0 ? `矛盾検出: ${contradictionCount}件` : null
                )}

                ${warning ? `
                    <div style="
                        display: flex;
                        align-items: flex-start;
                        gap: 8px;
                        padding: 12px;
                        margin-top: 12px;
                        background: rgba(251, 191, 36, 0.1);
                        border: 1px solid rgba(251, 191, 36, 0.3);
                        border-radius: 8px;
                        font-size: 12px;
                        color: #fbbf24;
                        line-height: 1.5;
                    " role="alert">
                        <span style="font-size: 16px; flex-shrink: 0;" aria-hidden="true">⚠️</span>
                        <span>${escapeHtml(warning)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * メトリクス項目をレンダリング
     * @param {string} icon - アイコン
     * @param {string} title - タイトル
     * @param {number} value - 値
     * @param {string} color - 色
     * @param {string} description - 説明
     * @param {string|null} note - 注釈
     * @returns {string} HTMLマークアップ
     */
    _renderMetricItem(icon, title, value, color, description, note) {
        const percentage = value;
        
        return `
            <div style="
                background: rgba(30, 41, 59, 0.4);
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="font-size: 20px; margin-right: 10px;" aria-hidden="true">${icon}</div>
                    <div style="flex: 1;">
                        <div style="
                            font-size: 12px;
                            color: #94a3b8;
                            font-weight: 600;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            margin-bottom: 2px;
                        ">
                            ${escapeHtml(title)}
                        </div>
                        <div style="font-size: 10px; color: #64748b; line-height: 1.3;">
                            ${escapeHtml(description)}
                        </div>
                        ${note ? `
                            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px; opacity: 0.8;">
                                ${escapeHtml(note)}
                            </div>
                        ` : ''}
                    </div>
                    <div style="
                        font-size: 28px;
                        font-weight: 800;
                        font-family: 'JetBrains Mono', monospace;
                        color: ${color};
                    " aria-label="${title} ${value}パーセント">
                        ${value}%
                    </div>
                </div>
                
                <div style="
                    width: 100%;
                    height: 6px;
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 3px;
                    overflow: hidden;
                " role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                    <div style="
                        width: ${percentage}%;
                        height: 100%;
                        background: linear-gradient(90deg, ${color}, ${color}dd);
                        transition: width 0.5s ease-out;
                        box-shadow: 0 0 8px ${color}44;
                    "></div>
                </div>
            </div>
        `;
    },

    /**
     * スタックカードをレンダリング
     * @param {string} mbtiType - MBTIタイプ
     * @param {Object} COGNITIVE_STACKS - 認知スタック
     * @param {Object} FUNCTIONS - 機能定義
     * @returns {string} HTMLマークアップ
     */
    _renderStackCard(mbtiType, COGNITIVE_STACKS, FUNCTIONS) {
        const stack = COGNITIVE_STACKS[mbtiType];
        const labels = ['主機能', '補助機能', '第三機能', '劣等機能'];

        return `
            <div class="result-card" role="region" aria-labelledby="stack-heading">
                <h4 id="stack-heading" style="margin-bottom: 16px; font-size: 18px;">認知機能スタック</h4>
                <div style="display: grid; gap: 12px;">
                    ${stack.map((f, index) => `
                        <div style="padding: 16px; background: var(--color-bg-secondary); border-radius: 12px; border: 1px solid var(--color-border);">
                            <div style="font-size: 11px; color: var(--color-accent-primary); font-weight: 700; margin-bottom: 8px;">
                                ${escapeHtml(labels[index])}
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
                                <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 800; color: var(--color-accent-primary);" aria-label="${f} ${FUNCTIONS[f].fullName}">
                                    ${f}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * スコアカードをレンダリング
     * @param {Object} functionScores - 機能スコア
     * @param {Object} FUNCTIONS - 機能定義
     * @param {Function} getNormalizedScore - スコア正規化関数
     * @returns {string} HTMLマークアップ
     */
    _renderScoresCard(functionScores, FUNCTIONS, getNormalizedScore) {
        const sortedScores = Object.entries(functionScores)
            .filter(([key]) => key in FUNCTIONS)
            .map(([key, val]) => ({
                key,
                value: getNormalizedScore(val),
                rawValue: val,
                func: FUNCTIONS[key]
            }))
            .sort((a, b) => b.value - a.value);

        return `
            <div class="result-card" role="region" aria-labelledby="scores-heading">
                <h4 id="scores-heading" style="margin-bottom: 16px; font-size: 18px;">詳細スコア</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                    ${sortedScores.map(item => `
                        <div style="text-align: center; padding: 12px; background: var(--color-bg-secondary); border-radius: 8px; border: 1px solid var(--color-border);">
                            <div style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: var(--color-accent-primary); margin-bottom: 4px;">
                                ${item.key}
                            </div>
                            <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 800;" aria-label="${item.key} スコア ${item.value}">
                                ${item.value}
                            </div>
                            <div style="font-size: 11px; color: var(--color-text-secondary);">
                                ${escapeHtml(item.func.fullName)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
};