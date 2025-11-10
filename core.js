// core.js

// ============================================
// 定数定義: Jung理論に基づく認知機能重み付け
// ============================================

const JUNG_FUNCTION_WEIGHTS = {
    DOMINANT: 4.0,
    AUXILIARY: 2.0,
    TERTIARY: 1.0,
    INFERIOR: 0.5
};

const LIKERT_SCALE_MIDPOINT = 3;
const SCORE_EMPHASIS_EXPONENT = 1.2;
const LIKERT_SCALE_REVERSE_BASE = 6;

const SCORE_NORMALIZATION = {
    MIN: -20,
    MAX: 20,
    OUTPUT_MIN: 0,
    OUTPUT_MAX: 100
};

const CONFIDENCE_CALCULATION_EPSILON = 1e-6;

const CONFIDENCE_BOUNDS = {
    MIN: 0,
    MAX: 100
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

function isValidLikertValue(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5;
}

function isValidFunctionType(funcType) {
    return funcType in FUNCTIONS;
}

// ============================================
// スコア計算
// ============================================

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

function normalizeScore(rawScore) {
    const { MIN, MAX, OUTPUT_MIN, OUTPUT_MAX } = SCORE_NORMALIZATION;
    const normalized = ((rawScore - MIN) / (MAX - MIN)) * (OUTPUT_MAX - OUTPUT_MIN) + OUTPUT_MIN;
    return Math.round(Math.max(OUTPUT_MIN, Math.min(OUTPUT_MAX, normalized)));
}

// ============================================
// 矛盾検出機能
// ============================================

/**
 * 2つの回答が矛盾しているかチェック
 */
function checkContradiction(valueA, valueB, questionA, questionB) {
    const normalizedA = questionA.reverse ? (6 - valueA) : valueA;
    const normalizedB = questionB.reverse ? (6 - valueB) : valueB;
    
    if (normalizedA === 3 && normalizedB === 3) return false;
    
    const isAPositive = normalizedA >= 4;
    const isANegative = normalizedA <= 2;
    const isBPositive = normalizedB >= 4;
    const isBNegative = normalizedB <= 2;
    
    return (isAPositive && isBNegative) || (isANegative && isBPositive);
}

/**
 * 矛盾の深刻度を計算(0-1)
 */
function calculateSeverity(valueA, valueB) {
    const maxDiff = 4;
    const actualDiff = Math.abs(valueA - valueB);
    return Math.min(actualDiff / maxDiff, 1.0);
}

/**
 * 回答の矛盾を検出する
 * @param {Object} answers - { questionId: { value, isReverse } }
 * @param {Array} questions - 質問データ配列
 * @returns {Object} { contradictions: [...], consistencyScore: 0-100, count: number }
 */
export function detectContradictions(answers, questions) {
    const contradictions = [];
    const answeredQuestions = questions.filter(q => answers[q.id]);
    
    for (const question of answeredQuestions) {
        const answer = answers[question.id];
        
        if (question.related?.contradicts) {
            const contradictIds = question.related.contradicts;
            
            for (const contradictId of contradictIds) {
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
                            severity: calculateSeverity(answer.value, contradictAnswer.value)
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
 * 一貫性スコアを計算(0-100)
 */
function calculateConsistencyScore(contradictions, totalAnswered) {
    if (totalAnswered === 0) return 100;
    if (contradictions.length === 0) return 100;
    
    // 矛盾の総深刻度を計算
    const totalSeverity = contradictions.reduce((sum, c) => sum + c.severity, 0);
    
    // 矛盾の平均深刻度
    const avgSeverity = totalSeverity / contradictions.length;
    
    // 矛盾の割合（矛盾件数 / 総回答数）
    const contradictionRate = contradictions.length / totalAnswered;
    
    // 一貫性スコア = 100 - (矛盾率 × 100 × 平均深刻度)
    // 例: 27件の矛盾、64問、平均深刻度0.8
    //     contradictionRate = 27/64 = 0.42
    //     score = 100 - (0.42 × 100 × 0.8) = 100 - 33.6 = 66.4
    const score = Math.max(0, 100 - (contradictionRate * 100 * avgSeverity));
    
    return Math.round(score);
}

/**
 * 確信度に一貫性ペナルティを適用
 * @param {number} originalConfidence - 元の確信度(0-100)
 * @param {number} consistencyScore - 一貫性スコア(0-100)
 * @returns {number} 調整後の確信度(0-100)
 */
function applyConsistencyPenalty(originalConfidence, consistencyScore) {
    if (consistencyScore >= 90) return originalConfidence;
    
    const penaltyFactor = consistencyScore / 100;
    const adjustedConfidence = originalConfidence * penaltyFactor;
    
    return Math.round(adjustedConfidence);
}

// ============================================
// MBTIタイプ判定
// ============================================

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
    
    const scoreDifference = firstScore - secondScore;
    const scoreSum = Math.abs(firstScore) + Math.abs(secondScore) + CONFIDENCE_CALCULATION_EPSILON;
    const rawConfidence = 100 * (scoreDifference / scoreSum);
    
    const confidence = Math.max(
        CONFIDENCE_BOUNDS.MIN,
        Math.min(CONFIDENCE_BOUNDS.MAX, Math.round(rawConfidence))
    );
    
    return {
        type: firstType,
        confidence: confidence,
        top2: [firstType, secondType],
        typeScores: typeScores
    };
}

/**
 * 矛盾検出を含むMBTIタイプ判定（拡張版）
 * @param {Object} functionScores - 認知機能スコア
 * @param {Object} COGNITIVE_STACKS - 機能スタック定義
 * @param {Object} answers - 回答データ
 * @param {Array} questions - 質問データ配列
 * @returns {Object} 判定結果（矛盾情報・調整済み確信度を含む）
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
        warning: contradictionAnalysis.consistencyScore < 70 
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
    CONFIDENCE_BOUNDS
};

export function getNormalizedScore(rawScore) {
    return normalizeScore(rawScore);
}

// ============================================
// デバッグ用ユーティリティ
// ============================================

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
    
    console.group('🔄 矛盾分析');
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
    
    console.group('🔍 機能スタック分析');
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
    
    mockScores[stack[0]] = 15;
    mockScores[stack[1]] = 10;
    mockScores[stack[2]] = 5;
    mockScores[stack[3]] = -5;
    
    return mockScores;
}

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

if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    validateConstants();
}