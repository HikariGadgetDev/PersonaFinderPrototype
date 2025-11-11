// ============================================
// core.js - Core Logic (リファクタ版)
// ============================================

// ============================================
// 型定義 (JSDoc)
// ============================================

/**
 * @typedef {Object} FunctionScore
 * @property {number} Ni - 内向的直観
 * @property {number} Ne - 外向的直観
 * @property {number} Si - 内向的感覚
 * @property {number} Se - 外向的感覚
 * @property {number} Ti - 内向的思考
 * @property {number} Te - 外向的思考
 * @property {number} Fi - 内向的感情
 * @property {number} Fe - 外向的感情
 */

/**
 * @typedef {Object} Contradiction
 * @property {string} questionA - 質問A ID
 * @property {string} questionB - 質問B ID
 * @property {number} valueA - 回答A値
 * @property {number} valueB - 回答B値
 * @property {number} severity - 深刻度 (0-1)
 */

/**
 * @typedef {Object} DiagnosticResult
 * @property {string} type - 判定されたMBTIタイプ
 * @property {number} confidence - 確信度 (0-100)
 * @property {number} originalConfidence - 調整前の確信度
 * @property {number} consistency - 一貫性スコア (0-100)
 * @property {number} contradictionCount - 矛盾件数
 * @property {Contradiction[]} contradictions - 矛盾詳細
 * @property {string[]} top2 - トップ2タイプ
 * @property {Object<string, number>} typeScores - 全タイプのスコア
 * @property {string|null} warning - 警告メッセージ
 */

// ============================================
// 定数定義: Jung理論に基づく認知機能重み付け
// ============================================

const JUNG_FUNCTION_WEIGHTS = {
    /** 主機能の重み */
    DOMINANT: 4.0,
    /** 補助機能の重み */
    AUXILIARY: 2.0,
    /** 第三機能の重み */
    TERTIARY: 1.0,
    /** 劣等機能の重み */
    INFERIOR: 0.5
};

/** Likertスケールの中点 */
const LIKERT_SCALE_MIDPOINT = 3;

/** スコア強調指数 (1.0=線形, >1.0=極端な回答を強調) */
const SCORE_EMPHASIS_EXPONENT = 1.2;

/** 逆転項目の計算用ベース値 */
const LIKERT_SCALE_REVERSE_BASE = 6;

/** スコア正規化の設定 */
const SCORE_NORMALIZATION = {
    /** 生スコアの最小値 */
    MIN: -20,
    /** 生スコアの最大値 */
    MAX: 20,
    /** 出力スコアの最小値 */
    OUTPUT_MIN: 0,
    /** 出力スコアの最大値 */
    OUTPUT_MAX: 100
};

/** 確信度計算時の除算エラー回避用イプシロン */
const CONFIDENCE_CALCULATION_EPSILON = 1e-6;

/** 確信度の範囲 */
const CONFIDENCE_BOUNDS = {
    /** 最小値 */
    MIN: 0,
    /** 最大値 */
    MAX: 100
};

/** 診断信頼性の閾値 */
const DIAGNOSTIC_THRESHOLDS = {
    /** 高確信度の閾値 */
    HIGH_CONFIDENCE: 70,
    /** 中確信度の閾値 */
    MEDIUM_CONFIDENCE: 40,
    /** 高一貫性の閾値 */
    HIGH_CONSISTENCY: 80,
    /** 中一貫性の閾値 */
    MEDIUM_CONSISTENCY: 60,
    /** 次点タイプ表示の確信度閾値 */
    SHOW_ALTERNATIVE_THRESHOLD: 40,
    /** 警告表示の一貫性閾値 */
    WARNING_CONSISTENCY_THRESHOLD: 70
};

/** 矛盾検出の設定 */
const CONTRADICTION_DETECTION = {
    /** 矛盾と判定する回答差の最小値 */
    MIN_DIFFERENCE: 2,
    /** 深刻度の最大値 */
    MAX_SEVERITY: 1.0,
    /** 一貫性ペナルティの係数 */
    PENALTY_MULTIPLIER: 200
};

// ============================================
// 認知機能の定義
// ============================================

export const FUNCTIONS = {
    Ni: { name: 'Ni', fullName: '内向的直観', description: '洞察と未来予測' },
    Ne: { name: 'Ne', fullName: '外向的直観', description: '可能性の探求' },
    Si: { name: 'Si', fullName: '内向的感覚', description: '経験と伝統' },
    Se: { name: 'Se', fullName: '外向的感覚', description: '現在の体験' },
    Ti: { name: 'Ti', fullName: '内向的思考', description: '論理的分析' },
    Te: { name: 'Te', fullName: '外向的思考', description: '効率的実行' },
    Fi: { name: 'Fi', fullName: '内向的感情', description: '個人的価値' },
    Fe: { name: 'Fe', fullName: '外向的感情', description: '調和と共感' }
};

export const COGNITIVE_STACKS = {
    INTJ: ['Ni', 'Te', 'Fi', 'Se'],
    INTP: ['Ti', 'Ne', 'Si', 'Fe'],
    ENTJ: ['Te', 'Ni', 'Se', 'Fi'],
    ENTP: ['Ne', 'Ti', 'Fe', 'Si'],
    INFJ: ['Ni', 'Fe', 'Ti', 'Se'],
    INFP: ['Fi', 'Ne', 'Si', 'Te'],
    ENFJ: ['Fe', 'Ni', 'Se', 'Ti'],
    ENFP: ['Ne', 'Fi', 'Te', 'Si'],
    ISTJ: ['Si', 'Te', 'Fi', 'Ne'],
    ISFJ: ['Si', 'Fe', 'Ti', 'Ne'],
    ESTJ: ['Te', 'Si', 'Ne', 'Fi'],
    ESFJ: ['Fe', 'Si', 'Ne', 'Ti'],
    ISTP: ['Ti', 'Se', 'Ni', 'Fe'],
    ISFP: ['Fi', 'Se', 'Ni', 'Te'],
    ESTP: ['Se', 'Ti', 'Fe', 'Ni'],
    ESFP: ['Se', 'Fi', 'Te', 'Ni']
};

export const mbtiDescriptions = {
    INTJ: { name: "建築家", description: "戦略的思考と革新的な洞察力を持つ完璧主義者。" },
    INTP: { name: "論理学者", description: "知的好奇心に満ちた思考家。" },
    ENTJ: { name: "指揮官", description: "明確なビジョンを持ち組織を導くリーダー。" },
    ENTP: { name: "討論者", description: "創造的な発想で新しい可能性を追求する革新者。" },
    INFJ: { name: "提唱者", description: "理想主義で深い洞察を持つビジョナリー。" },
    INFP: { name: "仲介者", description: "誠実で情熱的な理想主義者。" },
    ENFJ: { name: "主人公", description: "人々を鼓舞し導くカリスマ的リーダー。" },
    ENFP: { name: "運動家", description: "自由で創造的、熱意あふれる探求者。" },
    ISTJ: { name: "管理者", description: "責任感が強く信頼できる実務家。" },
    ISFJ: { name: "擁護者", description: "温かく献身的な保護者。" },
    ESTJ: { name: "幹部", description: "組織化と効率を重んじる実践的リーダー。" },
    ESFJ: { name: "領事官", description: "社交的で思いやりのある世話役。" },
    ISTP: { name: "巨匠", description: "現実的で即応力のある問題解決者。" },
    ISFP: { name: "冒険家", description: "柔軟で芸術的な探求者。" },
    ESTP: { name: "起業家", description: "大胆で行動的な実践家。" },
    ESFP: { name: "エンターテイナー", description: "陽気で社交的なパフォーマー。" }
};

// ============================================
// 入力検証ユーティリティ
// ============================================

/**
 * Likert値の妥当性チェック
 * @param {number} value - 検証する値
 * @returns {boolean} 1-5の整数ならtrue
 */
function isValidLikertValue(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * 機能タイプの妥当性チェック
 * @param {string} funcType - 機能タイプ
 * @returns {boolean} FUNCTIONSに存在すればtrue
 */
function isValidFunctionType(funcType) {
    return funcType in FUNCTIONS;
}

// ============================================
// スコア計算
// ============================================

/**
 * Likert値から認知機能スコアを計算
 * @param {number} value - Likert値 (1-5)
 * @param {boolean} [isReverse=false] - 逆転項目フラグ
 * @returns {number} 計算されたスコア
 */
export function calculateScore(value, isReverse = false) {
    if (!isValidLikertValue(value)) {
        console.error(`[calculateScore] 不正な値: ${value}。1〜5の整数が必要です。0を返します。`);
        return 0;
    }
    
    const actualValue = isReverse 
        ? (LIKERT_SCALE_REVERSE_BASE - value)
        : value;
    
    const deviation = actualValue - LIKERT_SCALE_MIDPOINT;
    const emphasizedScore = Math.sign(deviation) * 
                           Math.pow(Math.abs(deviation), SCORE_EMPHASIS_EXPONENT);
    
    return emphasizedScore;
}

/**
 * 生スコアを0-100に正規化
 * @param {number} rawScore - 生スコア
 * @returns {number} 正規化されたスコア (0-100)
 */
function normalizeScore(rawScore) {
    const { MIN, MAX, OUTPUT_MIN, OUTPUT_MAX } = SCORE_NORMALIZATION;
    const normalized = ((rawScore - MIN) / (MAX - MIN)) * (OUTPUT_MAX - OUTPUT_MIN) + OUTPUT_MIN;
    return Math.round(Math.max(OUTPUT_MIN, Math.min(OUTPUT_MAX, normalized)));
}

/**
 * 公開用の正規化関数
 * @param {number} rawScore - 生スコア
 * @returns {number} 正規化されたスコア (0-100)
 */
export function getNormalizedScore(rawScore) {
    return normalizeScore(rawScore);
}

// ============================================
// 矛盾検出機能
// ============================================

/**
 * 2つの回答が矛盾しているかチェック
 * @param {number} valueA - 回答A
 * @param {number} valueB - 回答B
 * @param {Object} questionA - 質問A
 * @param {Object} questionB - 質問B
 * @returns {boolean} 矛盾していればtrue
 */
function checkContradiction(valueA, valueB, questionA, questionB) {
    const normalizedA = questionA.reverse ? (LIKERT_SCALE_REVERSE_BASE - valueA) : valueA;
    const normalizedB = questionB.reverse ? (LIKERT_SCALE_REVERSE_BASE - valueB) : valueB;
    
    // どちらも中立なら矛盾なし
    if (normalizedA === LIKERT_SCALE_MIDPOINT && normalizedB === LIKERT_SCALE_MIDPOINT) {
        return false;
    }
    
    const isAPositive = normalizedA >= 4;
    const isANegative = normalizedA <= 2;
    const isBPositive = normalizedB >= 4;
    const isBNegative = normalizedB <= 2;
    
    return (isAPositive && isBNegative) || (isANegative && isBPositive);
}

/**
 * 矛盾の深刻度を計算 (0-1)
 * @param {number} valueA - 回答A
 * @param {number} valueB - 回答B
 * @param {boolean} isReverseA - 質問Aが逆転項目か
 * @param {boolean} isReverseB - 質問Bが逆転項目か
 * @returns {number} 深刻度 (0-1)
 */
function calculateSeverity(valueA, valueB, isReverseA, isReverseB) {
    const normalizedA = isReverseA ? (LIKERT_SCALE_REVERSE_BASE - valueA) : valueA;
    const normalizedB = isReverseB ? (LIKERT_SCALE_REVERSE_BASE - valueB) : valueB;
    
    const diff = Math.abs(normalizedA - normalizedB);
    
    // diff=4 (5と1) → 深刻度1.0 (完全な矛盾)
    // diff=3 (5と2) → 深刻度0.75
    // diff=2 (5と3) → 深刻度0.5 (軽度の矛盾)
    return diff / 4.0;
}

/**
 * 回答の矛盾を検出
 * @param {Object<string, {value: number, isReverse: boolean}>} answers - 回答データ
 * @param {Array} questions - 質問データ配列
 * @returns {{contradictions: Contradiction[], consistencyScore: number, count: number}} 矛盾分析結果
 */
export function detectContradictions(answers, questions) {
    const contradictions = [];
    const checkedPairs = new Set();
    const answeredQuestions = questions.filter(q => answers[q.id]);
    
    for (const question of answeredQuestions) {
        const answer = answers[question.id];
        
        if (question.related?.contradicts) {
            const contradictIds = question.related.contradicts;
            
            for (const contradictId of contradictIds) {
                const pairId = [question.id, contradictId].sort().join('-');
                
                if (checkedPairs.has(pairId)) continue;
                checkedPairs.add(pairId);
                
                const contradictAnswer = answers[contradictId];
                
                if (contradictAnswer) {
                    const contradictQuestion = questions.find(q => q.id === contradictId);
                    
                    const isContradicting = checkContradiction(
                        answer.value,
                        contradictAnswer.value,
                        question,
                        contradictQuestion
                    );
                    
                    if (isContradicting) {
                        contradictions.push({
                            questionA: question.id,
                            questionB: contradictId,
                            valueA: answer.value,
                            valueB: contradictAnswer.value,
                            severity: calculateSeverity(
                                answer.value, 
                                contradictAnswer.value,
                                question.reverse || false,
                                contradictQuestion.reverse || false
                            )
                        });
                    }
                }
            }
        }
    }
    
    const consistencyScore = calculateConsistencyScore(contradictions, answeredQuestions.length);
    
    return {
        contradictions,
        consistencyScore,
        count: contradictions.length
    };
}

/**
 * 一貫性スコアを計算 (0-100)
 * @param {Contradiction[]} contradictions - 矛盾リスト
 * @param {number} totalAnswered - 回答済み質問数
 * @returns {number} 一貫性スコア (0-100)
 */
function calculateConsistencyScore(contradictions, totalAnswered) {
    if (totalAnswered === 0) return 100;
    if (contradictions.length === 0) return 100;
    
    const totalSeverity = contradictions.reduce((sum, c) => sum + c.severity, 0);
    const avgSeverity = totalSeverity / contradictions.length;
    
    // 理論上の最大矛盾件数 (回答数の約1/4と仮定)
    const maxPossibleContradictions = Math.max(1, totalAnswered / 4);
    
    const contradictionRate = Math.min(1, contradictions.length / maxPossibleContradictions);
    const weightedRate = contradictionRate * avgSeverity;
    
    // より敏感に: ×200で矛盾が多いと急激に下がる
    const score = Math.max(0, 100 - (weightedRate * CONTRADICTION_DETECTION.PENALTY_MULTIPLIER));
    
    return Math.round(score);
}

/**
 * 確信度に一貫性ペナルティを適用
 * @param {number} originalConfidence - 元の確信度 (0-100)
 * @param {number} consistencyScore - 一貫性スコア (0-100)
 * @returns {number} 調整後の確信度 (0-100)
 */
function applyConsistencyPenalty(originalConfidence, consistencyScore) {
    if (consistencyScore >= DIAGNOSTIC_THRESHOLDS.HIGH_CONSISTENCY) {
        return originalConfidence;
    }
    
    const penaltyFactor = consistencyScore / 100;
    const adjustedConfidence = originalConfidence * penaltyFactor;
    
    return Math.round(adjustedConfidence);
}

// ============================================
// MBTIタイプ判定
// ============================================

/**
 * 機能スコアからMBTIタイプを判定
 * @param {FunctionScore} functionScores - 機能スコア
 * @param {Object<string, string[]>} COGNITIVE_STACKS - スタック定義
 * @returns {{type: string, confidence: number, top2: string[], typeScores: Object<string, number>}} 判定結果
 */
export function determineMBTIType(functionScores, COGNITIVE_STACKS) {
    if (!functionScores || typeof functionScores !== 'object') {
        console.error('[determineMBTIType] functionScoresが不正です');
        return {
            type: 'UNKNOWN',
            confidence: 0,
            top2: ['UNKNOWN', 'UNKNOWN'],
            typeScores: {}
        };
    }
    
    const typeScores = {};
    const stackWeights = [
        JUNG_FUNCTION_WEIGHTS.DOMINANT,
        JUNG_FUNCTION_WEIGHTS.AUXILIARY,
        JUNG_FUNCTION_WEIGHTS.TERTIARY,
        JUNG_FUNCTION_WEIGHTS.INFERIOR
    ];
    
    for (const [typeName, functionStack] of Object.entries(COGNITIVE_STACKS)) {
        let totalScore = 0;
        
        for (let position = 0; position < functionStack.length; position++) {
            const funcName = functionStack[position];
            const funcScore = functionScores[funcName] || 0;
            const weight = stackWeights[position];
            
            totalScore += funcScore * weight;
        }
        
        typeScores[typeName] = totalScore;
    }
    
    const sortedTypes = Object.entries(typeScores)
        .sort((a, b) => b[1] - a[1]);
    
    const [firstType, firstScore] = sortedTypes[0];
    const [secondType, secondScore] = sortedTypes[1] || [null, 0];
    const [thirdType, thirdScore] = sortedTypes[2] || [null, 0];
    
    const confidence = calculateImprovedConfidence(
        firstScore, 
        secondScore, 
        thirdScore,
        sortedTypes
    );
    
    return {
        type: firstType,
        confidence: confidence,
        top2: [firstType, secondType],
        typeScores: typeScores
    };
}

/**
 * 改善された確信度計算
 * @param {number} firstScore - 1位スコア
 * @param {number} secondScore - 2位スコア
 * @param {number} thirdScore - 3位スコア
 * @param {Array} sortedTypes - ソート済みタイプ配列
 * @returns {number} 確信度 (0-100)
 */
function calculateImprovedConfidence(firstScore, secondScore, thirdScore, sortedTypes) {
    // スコア差による基本確信度
    const scoreDiff = firstScore - secondScore;
    const scoreSum = Math.abs(firstScore) + Math.abs(secondScore) + CONFIDENCE_CALCULATION_EPSILON;
    const baseConfidence = 100 * (scoreDiff / scoreSum);
    
    // ボーナス1: 1位のスコアが十分に高い (+0〜15点)
    const avgScore = sortedTypes.reduce((sum, [, score]) => sum + score, 0) / sortedTypes.length;
    const scoreBonus = firstScore > avgScore * 1.5 ? 15 : 
                       firstScore > avgScore * 1.2 ? 10 : 
                       firstScore > avgScore ? 5 : 0;
    
    // ボーナス2: 1位と3位の差が大きい (+0〜10点)
    const thirdDiff = firstScore - thirdScore;
    const thirdGapBonus = thirdDiff > (firstScore * 0.4) ? 10 :
                          thirdDiff > (firstScore * 0.3) ? 7 :
                          thirdDiff > (firstScore * 0.2) ? 4 : 0;
    
    // ペナルティ: 2位と3位が接近している (-0〜10点)
    const secondThirdDiff = Math.abs(secondScore - thirdScore);
    const secondThirdGap = secondThirdDiff / (Math.abs(secondScore) + CONFIDENCE_CALCULATION_EPSILON);
    const proximityPenalty = secondThirdGap < 0.1 ? 10 :
                            secondThirdGap < 0.2 ? 5 : 0;
    
    const finalConfidence = baseConfidence + scoreBonus + thirdGapBonus - proximityPenalty;
    
    return Math.max(
        CONFIDENCE_BOUNDS.MIN,
        Math.min(CONFIDENCE_BOUNDS.MAX, Math.round(finalConfidence))
    );
}

/**
 * 矛盾検出を含むMBTIタイプ判定 (拡張版)
 * @param {FunctionScore} functionScores - 認知機能スコア
 * @param {Object<string, string[]>} COGNITIVE_STACKS - スタック定義
 * @param {Object} answers - 回答データ
 * @param {Array} questions - 質問データ配列
 * @returns {DiagnosticResult} 判定結果
 */
export function determineMBTITypeWithConsistency(functionScores, COGNITIVE_STACKS, answers, questions) {
    const result = determineMBTIType(functionScores, COGNITIVE_STACKS);
    const contradictionAnalysis = detectContradictions(answers, questions);
    
    const originalConfidence = result.confidence;
    const adjustedConfidence = applyConsistencyPenalty(
        originalConfidence,
        contradictionAnalysis.consistencyScore
    );
    
    return {
        ...result,
        confidence: adjustedConfidence,
        originalConfidence: originalConfidence,
        consistency: contradictionAnalysis.consistencyScore,
        contradictionCount: contradictionAnalysis.count,
        contradictions: contradictionAnalysis.contradictions,
        warning: contradictionAnalysis.consistencyScore < DIAGNOSTIC_THRESHOLDS.WARNING_CONSISTENCY_THRESHOLD
            ? "回答に矛盾が見られます。診断結果の信頼性が低い可能性があります。"
            : null
    };
}

// ============================================
// エクスポート: 定数も外部から参照可能に
// ============================================

export const CONFIG = {
    JUNG_FUNCTION_WEIGHTS,
    SCORE_EMPHASIS_EXPONENT,
    SCORE_NORMALIZATION,
    LIKERT_SCALE_MIDPOINT,
    LIKERT_SCALE_REVERSE_BASE,
    CONFIDENCE_CALCULATION_EPSILON,
    CONFIDENCE_BOUNDS,
    DIAGNOSTIC_THRESHOLDS,
    CONTRADICTION_DETECTION
};

// ============================================
// デバッグ用ユーティリティ
// ============================================

/**
 * 詳細な機能スコア情報を取得
 * @param {FunctionScore} functionScores - 機能スコア
 * @returns {Array<Object>} 詳細情報配列
 */
export function getDetailedFunctionScores(functionScores) {
    if (!functionScores || typeof functionScores !== 'object') {
        console.error('[getDetailedFunctionScores] 入力が不正です');
        return [];
    }
    
    return Object.entries(functionScores)
        .map(([funcName, rawScore]) => {
            const normalized = normalizeScore(rawScore);
            
            let interpretation;
            if (normalized >= 75) interpretation = "非常に強い";
            else if (normalized >= 60) interpretation = "強い";
            else if (normalized >= 40) interpretation = "平均的";
            else if (normalized >= 25) interpretation = "弱い";
            else interpretation = "非常に弱い";
            
            return {
                name: funcName,
                fullName: FUNCTIONS[funcName]?.fullName || funcName,
                description: FUNCTIONS[funcName]?.description || "",
                rawScore: Number(rawScore.toFixed(2)),
                normalizedScore: normalized,
                percentile: `${normalized}%`,
                interpretation: interpretation
            };
        })
        .sort((a, b) => b.normalizedScore - a.normalizedScore);
}

/**
 * 診断レポートを生成
 * @param {FunctionScore} functionScores - 機能スコア
 * @param {Object<string, string[]>} COGNITIVE_STACKS - スタック定義
 * @param {Object} answers - 回答データ
 * @param {Array} questions - 質問データ
 * @returns {Object} 診断レポート
 */
export function generateDiagnosticReport(functionScores, COGNITIVE_STACKS, answers, questions) {
    const result = determineMBTITypeWithConsistency(functionScores, COGNITIVE_STACKS, answers, questions);
    const detailedScores = getDetailedFunctionScores(functionScores);
    
    const report = {
        timestamp: new Date().toISOString(),
        result: {
            determinedType: result.type,
            confidence: `${result.confidence}%`,
            originalConfidence: `${result.originalConfidence}%`,
            consistency: `${result.consistency}%`,
            secondBestType: result.top2[1],
            warning: result.warning
        },
        contradictions: {
            count: result.contradictionCount,
            details: result.contradictions
        },
        functionScores: detailedScores,
        typeScores: Object.entries(result.typeScores)
            .sort((a, b) => b[1] - a[1])
            .map(([type, score], index) => ({
                rank: index + 1,
                type: type,
                score: Number(score.toFixed(2)),
                description: mbtiDescriptions[type]?.name || ""
            })),
        stackAnalysis: {
            determinedType: result.type,
            stack: COGNITIVE_STACKS[result.type],
            breakdown: COGNITIVE_STACKS[result.type].map((func, index) => ({
                position: ['主機能', '補助機能', '第三機能', '劣等機能'][index],
                function: func,
                fullName: FUNCTIONS[func].fullName,
                rawScore: functionScores[func],
                normalizedScore: normalizeScore(functionScores[func]),
                weight: [
                    JUNG_FUNCTION_WEIGHTS.DOMINANT,
                    JUNG_FUNCTION_WEIGHTS.AUXILIARY,
                    JUNG_FUNCTION_WEIGHTS.TERTIARY,
                    JUNG_FUNCTION_WEIGHTS.INFERIOR
                ][index],
                weightedScore: Number((functionScores[func] * [
                    JUNG_FUNCTION_WEIGHTS.DOMINANT,
                    JUNG_FUNCTION_WEIGHTS.AUXILIARY,
                    JUNG_FUNCTION_WEIGHTS.TERTIARY,
                    JUNG_FUNCTION_WEIGHTS.INFERIOR
                ][index]).toFixed(2))
            }))
        }
    };
    
    return report;
}

/**
 * 診断レポートをコンソールに出力
 * @param {FunctionScore} functionScores - 機能スコア
 * @param {Object<string, string[]>} COGNITIVE_STACKS - スタック定義
 * @param {Object} answers - 回答データ
 * @param {Array} questions - 質問データ
 * @returns {Object} 診断レポート
 */
export function printDiagnosticReport(functionScores, COGNITIVE_STACKS, answers, questions) {
    const report = generateDiagnosticReport(functionScores, COGNITIVE_STACKS, answers, questions);
    
    console.group('🧠 MBTI診断 詳細レポート');
    
    console.group('📊 判定結果');
    console.log('判定タイプ:', report.result.determinedType);
    console.log('確信度:', report.result.confidence, `(元: ${report.result.originalConfidence})`);
    console.log('一貫性:', report.result.consistency);
    console.log('次点タイプ:', report.result.secondBestType);
    if (report.result.warning) console.warn('⚠️', report.result.warning);
    console.groupEnd();
    
    console.group('📄 矛盾分析');
    console.log('矛盾件数:', report.contradictions.count);
    if (report.contradictions.count > 0) {
        console.table(report.contradictions.details);
    }
    console.groupEnd();
    
    console.group('🎯 認知機能スコア');
    console.table(report.functionScores);
    console.groupEnd();
    
    console.group('🏆 全タイプランキング (上位5位)');
    console.table(report.typeScores.slice(0, 5));
    console.groupEnd();
    
    console.group('📝 機能スタック分析');
    console.log('タイプ:', report.stackAnalysis.determinedType);
    console.log('スタック:', report.stackAnalysis.stack.join(' → '));
    console.table(report.stackAnalysis.breakdown);
    console.groupEnd();
    
    console.groupEnd();
    
    return report;
}

// ============================================
// バリデーション用ユーティリティ
// ============================================

/**
 * 機能スコアの妥当性を検証
 * @param {FunctionScore} functionScores - 機能スコア
 * @returns {{isValid: boolean, errors: string[]}} 検証結果
 */
export function validateFunctionScores(functionScores) {
    const errors = [];
    
    if (!functionScores || typeof functionScores !== 'object') {
        errors.push('functionScoresがオブジェクトではありません');
        return { isValid: false, errors };
    }
    
    const requiredFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    
    for (const func of requiredFunctions) {
        if (!(func in functionScores)) {
            errors.push(`必須機能 ${func} が存在しません`);
        } else if (typeof functionScores[func] !== 'number') {
            errors.push(`${func} のスコアが数値ではありません: ${functionScores[func]}`);
        } else if (!isFinite(functionScores[func])) {
            errors.push(`${func} のスコアが有限値ではありません: ${functionScores[func]}`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// ============================================
// テスト用ヘルパー関数
// ============================================

/**
 * モックスコアを生成 (テスト用)
 * @param {string} targetType - 目標MBTIタイプ
 * @returns {FunctionScore|null} モックスコア
 */
export function generateMockScores(targetType) {
    if (!(targetType in COGNITIVE_STACKS)) {
        console.error(`[generateMockScores] 不正なタイプ: ${targetType}`);
        return null;
    }
    
    const stack = COGNITIVE_STACKS[targetType];
    
    const mockScores = {
        Ni: 0, Ne: 0, Si: 0, Se: 0,
        Ti: 0, Te: 0, Fi: 0, Fe: 0
    };
    
    mockScores[stack[0]] = 15;  // 主機能
    mockScores[stack[1]] = 10;  // 補助機能
    mockScores[stack[2]] = 5;   // 第三機能
    mockScores[stack[3]] = -5;  // 劣等機能
    
    return mockScores;
}

/**
 * 定数の整合性を検証
 * @returns {boolean} すべて合格ならtrue
 */
export function validateConstants() {
    const checks = [];
    
    checks.push({
        name: 'Jung重みの降順チェック',
        pass: JUNG_FUNCTION_WEIGHTS.DOMINANT >= JUNG_FUNCTION_WEIGHTS.AUXILIARY &&
              JUNG_FUNCTION_WEIGHTS.AUXILIARY >= JUNG_FUNCTION_WEIGHTS.TERTIARY &&
              JUNG_FUNCTION_WEIGHTS.TERTIARY >= JUNG_FUNCTION_WEIGHTS.INFERIOR
    });
    
    checks.push({
        name: 'スコア強調指数の範囲チェック',
        pass: SCORE_EMPHASIS_EXPONENT >= 1.0 && SCORE_EMPHASIS_EXPONENT <= 2.0
    });
    
    checks.push({
        name: '正規化範囲の妥当性チェック',
        pass: SCORE_NORMALIZATION.MIN < SCORE_NORMALIZATION.MAX &&
              SCORE_NORMALIZATION.OUTPUT_MIN < SCORE_NORMALIZATION.OUTPUT_MAX
    });
    
    checks.push({
        name: '認知機能定義の完全性チェック',
        pass: Object.keys(FUNCTIONS).length === 8
    });
    
    checks.push({
        name: 'MBTIタイプ定義の完全性チェック',
        pass: Object.keys(COGNITIVE_STACKS).length === 16 &&
              Object.keys(mbtiDescriptions).length === 16
    });
    
    checks.push({
        name: '診断閾値の妥当性チェック',
        pass: DIAGNOSTIC_THRESHOLDS.HIGH_CONFIDENCE > DIAGNOSTIC_THRESHOLDS.MEDIUM_CONFIDENCE &&
              DIAGNOSTIC_THRESHOLDS.HIGH_CONSISTENCY > DIAGNOSTIC_THRESHOLDS.MEDIUM_CONSISTENCY
    });
    
    const allPassed = checks.every(check => check.pass);
    
    if (!allPassed) {
        console.error('⚠️ 定数の整合性チェックに失敗しました:');
        checks.filter(c => !c.pass).forEach(c => {
            console.error(`  ✗ ${c.name}`);
        });
    } else {
        console.log('✅ すべての定数チェックに合格しました');
    }
    
    return allPassed;
}

// 開発環境でのみ定数検証を実行
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    validateConstants();
}