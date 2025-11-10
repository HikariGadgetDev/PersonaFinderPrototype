// ============================================
// components.js - UI Components
// ============================================

/**
 * ProgressSection - 進捗セクションコンポーネント
 */
export const ProgressSection = {
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
                    <span class="type-badge" id="type-badge">${provisionalType}</span>
                    <span class="type-name" id="type-name">${provisionalDesc.name}</span>
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
                    ${stackScores.map(item => this._renderScoreMini(item, false)).join('')}
                    ${shadowScores.map(item => this._renderScoreMini(item, true)).join('')}
                </div>
            </div>
        `;
    },

    _renderScoreMini(item, isShadow) {
        return `
            <div class="score-mini ${isShadow ? 'score-mini-shadow' : ''}" data-score-key="${item.key}">
                <div class="score-mini-position">${item.label}</div>
                <div class="score-mini-label">${item.key}</div>
                <div class="score-mini-value">${item.normalizedValue}</div>
            </div>
        `;
    }
};

/**
 * QuestionCard - 質問カードコンポーネント
 */
export const QuestionCard = {
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

        return `
            <div class="question-header" id="question-header-${questionIndex}">
                Question ${questionIndex + 1} of ${totalQuestions}
            </div>
            <div class="question-text" id="${questionId}">
                ${this._escapeHtml(question.text)}
                ${question.reverse ? ' <span style="color:var(--color-accent-primary);font-size:0.9em">(逆転項目)</span>' : ''}
            </div>

            <div class="options-horizontal" 
                 role="radiogroup" 
                 aria-labelledby="${questionId}">
                ${[1, 2, 3, 4, 5].map((v, index) => 
                    this._renderOption(v, impacts[index], currentValue, isShadow, funcColor, SCORE_LABELS)
                ).join('')}
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
    },

    _renderOption(value, impact, currentValue, isShadow, funcColor, SCORE_LABELS) {
        const isSelected = currentValue === value;

        return `
            <button class="option ${isSelected ? 'selected' : ''} ${isShadow ? 'option-shadow' : ''}"
                    role="radio"
                    aria-checked="${isSelected}"
                    aria-label="${this._escapeHtml(SCORE_LABELS[value])} - ${value}点"
                    data-value="${value}"
                    tabindex="${isSelected ? '0' : '-1'}">
                
                <div class="option-header">
                    <div class="option-score">${value}</div>
                    <div class="option-label">${this._escapeHtml(SCORE_LABELS[value])}</div>
                </div>
                
                ${this._renderImpact(impact, isShadow, funcColor)}
            </button>
        `;
    },

    _renderImpact(impact, isShadow, funcColor) {
        if (isShadow) {
            return `
                <div class="option-impact">
                    <span class="impact-func" style="color:${funcColor};">
                        ${this._escapeHtml(impact.funcType)}
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
                        スタック外 (${this._escapeHtml(impact.provisionalType || '')})
                    </div>
                </div>
            `;
        }

        return `
            <div class="option-impact">
                <span class="impact-func" style="color:${funcColor};">
                    ${this._escapeHtml(impact.funcType)}
                </span>
                <span class="impact-position">[${this._escapeHtml(impact.position)}]</span>
                
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
        `;
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

/**
 * ResultCard - 結果カードコンポーネント
 */
export const ResultCard = {
    render(result, mbtiDescriptions, COGNITIVE_STACKS, FUNCTIONS, getNormalizedScore, functionScores) {
        const { type: mbtiType, confidence, originalConfidence, consistency, contradictionCount, warning, top2, typeScores } = result;
        const desc = mbtiDescriptions[mbtiType];
        const showAlternative = confidence < 40; // 確信度40%未満で次点タイプも表示

        return `
            <div class="result-header">
                <h2 class="result-title">診断完了</h2>
                <p class="result-subtitle">あなたの認知機能プロファイルが特定されました</p>
            </div>

            ${this._renderTypeCard(mbtiType, desc)}
            ${showAlternative ? this._renderAlternativeTypeCard(top2, mbtiDescriptions, typeScores, confidence) : ''}
            ${this._renderMetricsCard(confidence, originalConfidence, consistency, contradictionCount, warning)}
            ${this._renderStackCard(mbtiType, COGNITIVE_STACKS, FUNCTIONS)}
            ${this._renderScoresCard(functionScores, FUNCTIONS, getNormalizedScore)}

            <button class="btn-restart" onclick="reset()">
                診断をやり直す
            </button>
        `;
    },

    _renderTypeCard(mbtiType, desc) {
        return `
            <div class="result-card">
                <div class="result-mbti">${mbtiType}</div>
                <h3 class="result-name">${desc.name}</h3>
                <p class="result-desc">${desc.description}</p>
            </div>
        `;
    },

    _renderAlternativeTypeCard(top2, mbtiDescriptions, typeScores, confidence) {
        const [firstType, secondType] = top2;
        const secondDesc = mbtiDescriptions[secondType];
        const firstScore = typeScores[firstType];
        const secondScore = typeScores[secondType];
        const scoreDiff = Math.abs(firstScore - secondScore).toFixed(1);

        return `
            <div class="result-card" style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.3);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 20px;">💡</span>
                    <h4 style="font-size: 16px; color: #fbbf24; margin: 0;">次点タイプの可能性</h4>
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
                        ">
                            ${secondType}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 700; color: #f1f5f9;">
                                ${secondDesc.name}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                スコア差: ${scoreDiff}点
                            </div>
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">
                        ${secondDesc.description}
                    </p>
                </div>
            </div>
        `;
    },

    _renderAlternativeTypeCard(top2, mbtiDescriptions, typeScores, confidence) {
        const [firstType, secondType] = top2;
        const secondDesc = mbtiDescriptions[secondType];
        const firstScore = typeScores[firstType];
        const secondScore = typeScores[secondType];
        const scoreDiff = Math.abs(firstScore - secondScore).toFixed(1);

        return `
            <div class="result-card" style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.3);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 20px;">💡</span>
                    <h4 style="font-size: 16px; color: #fbbf24; margin: 0;">次点タイプの可能性</h4>
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
                        ">
                            ${secondType}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 700; color: #f1f5f9;">
                                ${secondDesc.name}
                            </div>
                            <div style="font-size: 12px; color: #94a3b8;">
                                スコア差: ${scoreDiff}点
                            </div>
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">
                        ${secondDesc.description}
                    </p>
                </div>
            </div>
        `;
    },

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
            <div class="result-card">
                <h4 style="margin-bottom: 16px; font-size: 18px;">診断信頼性</h4>
                
                <!-- 確信度 -->
                ${this._renderMetricItem(
                    '🎯',
                    '確信度',
                    confidence,
                    confColor,
                    getConfidenceDesc(confidence),
                    originalConfidence !== confidence ? `(調整前: ${originalConfidence}%)` : null
                )}
                
                <!-- 一貫性スコア -->
                ${this._renderMetricItem(
                    '🔄',
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
                    ">
                        <span style="font-size: 16px; flex-shrink: 0;">⚠️</span>
                        <span>${warning}</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

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
                    <div style="font-size: 20px; margin-right: 10px;">${icon}</div>
                    <div style="flex: 1;">
                        <div style="
                            font-size: 12px;
                            color: #94a3b8;
                            font-weight: 600;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            margin-bottom: 2px;
                        ">
                            ${title}
                        </div>
                        <div style="font-size: 10px; color: #64748b; line-height: 1.3;">
                            ${description}
                        </div>
                        ${note ? `
                            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px; opacity: 0.8;">
                                ${note}
                            </div>
                        ` : ''}
                    </div>
                    <div style="
                        font-size: 28px;
                        font-weight: 800;
                        font-family: 'JetBrains Mono', monospace;
                        color: ${color};
                    ">
                        ${value}%
                    </div>
                </div>
                
                <!-- プログレスバー -->
                <div style="
                    width: 100%;
                    height: 6px;
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 3px;
                    overflow: hidden;
                ">
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

    _renderStackCard(mbtiType, COGNITIVE_STACKS, FUNCTIONS) {
        const stack = COGNITIVE_STACKS[mbtiType];
        const labels = ['主機能', '補助機能', '第三機能', '劣等機能'];

        return `
            <div class="result-card">
                <h4 style="margin-bottom: 16px; font-size: 18px;">認知機能スタック</h4>
                <div style="display: grid; gap: 12px;">
                    ${stack.map((f, index) => `
                        <div style="padding: 16px; background: var(--color-bg-secondary); border-radius: 12px; border: 1px solid var(--color-border);">
                            <div style="font-size: 11px; color: var(--color-accent-primary); font-weight: 700; margin-bottom: 8px;">
                                ${labels[index]}
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">
                                        ${FUNCTIONS[f].fullName}
                                    </div>
                                    <div style="font-size: 13px; color: var(--color-text-secondary);">
                                        ${FUNCTIONS[f].description}
                                    </div>
                                </div>
                                <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 800; color: var(--color-accent-primary);">
                                    ${f}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _renderScoresCard(functionScores, FUNCTIONS, getNormalizedScore) {
        // デバッグ
        console.log('_renderScoresCard called');
        console.log('functionScores:', functionScores);
        console.log('FUNCTIONS:', FUNCTIONS);
        console.log('getNormalizedScore:', getNormalizedScore);
        
        if (!FUNCTIONS) {
            console.error('FUNCTIONSがundefinedです！');
            return '<div style="color: red;">エラー: FUNCTIONSが定義されていません</div>';
        }
        
        const sortedScores = Object.entries(functionScores)
            .map(([key, val]) => {
                const func = FUNCTIONS[key];
                if (!func) {
                    console.error(`FUNCTIONS[${key}]が存在しません`);
                }
                return {
                    key,
                    value: getNormalizedScore(val),
                    func: func || { fullName: key, description: '' }
                };
            })
            .sort((a, b) => b.value - a.value);

        return `
            <div class="result-card">
                <h4 style="margin-bottom: 16px; font-size: 18px;">詳細スコア</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                    ${sortedScores.map(item => `
                        <div style="text-align: center; padding: 12px; background: var(--color-bg-secondary); border-radius: 8px; border: 1px solid var(--color-border);">
                            <div style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: var(--color-accent-primary); margin-bottom: 4px;">
                                ${item.key}
                            </div>
                            <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 800;">
                                ${item.value}
                            </div>
                            <div style="font-size: 11px; color: var(--color-text-secondary);">
                                ${item.func.fullName}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
};