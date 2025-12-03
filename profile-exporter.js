// ============================================
// profile-exporter.js - myself.json 生成モジュール
// ============================================

import {
    generateDiagnosticReport,
    getNormalizedScore
} from './core.js';

/**
 * @typedef {import('./core.js').FunctionScore} FunctionScore
 */

/**
 * @typedef {Object} MyselfProfileOptions
 * @property {string} [mode] - 'simple' | 'standard' | 'detail'
 * @property {string} [source] - 生成元ツール名 (例: "PersonaFinder")
 * @property {string} [profileId] - 任意のID (ユーザーIDなど)
 */

/**
 * Persona Finder の診断結果から
 * AI向けの「自己プロファイルJSON」を生成する。
 *
 * @param {FunctionScore} functionScores - 認知機能の生スコア (Ni, Ne, ... Fe)
 * @param {Object<string, {value: number, isReverse: boolean}>} answers - 回答データ
 * @param {Array} questions - 質問配列
 * @param {Object<string, string[]>} cognitiveStacks - 認知スタック (INTJ: ["Ni","Te","Fi","Se"] ...)
 * @param {Object<string, {name: string, description: string}>} mbtiDescriptions - MBTI説明
 * @param {MyselfProfileOptions} [options]
 * @returns {Object} myself プロファイルオブジェクト
 */
export function buildMyselfProfile(
    functionScores,
    answers,
    questions,
    cognitiveStacks,
    mbtiDescriptions,
    options = {}
) {
    const {
        mode = 'standard',
        source = 'PersonaFinder',
        profileId = null
    } = options;

    // 既存ロジックで詳細レポートを生成
    const report = generateDiagnosticReport(
        functionScores,
        cognitiveStacks,
        answers,
        questions
    );

    const determinedType = report.result.determinedType;
    const typeDesc = mbtiDescriptions[determinedType] || { name: '', description: '' };

    // --------------------------------------------
    // 認知機能プロファイル (0-100 & ランク付き)
    // report.functionScores は既に正規化＆解釈付き
    // --------------------------------------------
    const functionProfile = {};
    report.functionScores.forEach((entry, index) => {
        // entry = { name, fullName, description, rawScore, normalizedScore, percentile, interpretation }
        functionProfile[entry.name] = {
            rank: index + 1,
            label_ja: entry.fullName,
            description_ja: entry.description,
            raw: entry.rawScore,
            normalized: entry.normalizedScore, // 0-100
            strength_label_ja: entry.interpretation // 「非常に強い / 強い / 平均的 / ...」
        };
    });

    // --------------------------------------------
    // タイプランキング (上位16タイプ全部 / スコア)
    // report.typeScores は rank, type, score, description
    // --------------------------------------------
    const typeRanking = report.typeScores.map(t => ({
        rank: t.rank,
        type: t.type,
        name_ja: mbtiDescriptions[t.type]?.name || t.description || '',
        score: t.score
    }));

    // --------------------------------------------
    // スタック情報
    // --------------------------------------------
    const stack = report.stackAnalysis.stack;
    const stackBreakdown = report.stackAnalysis.breakdown.map(item => ({
        position_ja: item.position,        // 主機能 / 補助機能 / 第三機能 / 劣等機能
        function: item.function,          // Ni, Te ...
        label_ja: item.fullName,
        raw: item.rawScore,
        normalized: item.normalizedScore,
        weight: item.weight,
        weightedScore: item.weightedScore
    }));

    // --------------------------------------------
    // 簡易な「軸スコア」も出しておく (AIが扱いやすくするため)
    // N/S, T/F, J/P を 0-1 で表現
    // --------------------------------------------
    function safeNorm(func) {
        const raw = functionScores[func] ?? 0;
        return getNormalizedScore(raw); // 0-100
    }

    const intuition = (safeNorm('Ni') + safeNorm('Ne')) / 2;
    const sensing  = (safeNorm('Si') + safeNorm('Se')) / 2;
    const thinking = (safeNorm('Ti') + safeNorm('Te')) / 2;
    const feeling  = (safeNorm('Fi') + safeNorm('Fe')) / 2;

    const axisScores = {
        intuition_vs_sensing: {
            scale: '0 = S 寄り, 1 = N 寄り',
            value: clamp01(intuition / (intuition + sensing || 1))
        },
        thinking_vs_feeling: {
            scale: '0 = F 寄り, 1 = T 寄り',
            value: clamp01(thinking / (thinking + feeling || 1))
        },
        introversion_vs_extraversion: {
            // 内向機能 (Ni, Si, Ti, Fi) vs 外向機能 (Ne, Se, Te, Fe)
            scale: '0 = 外向傾向, 1 = 内向傾向',
            value: computeIntroversionIndex(functionScores)
        }
    };

    // --------------------------------------------
    // メタ情報
    // --------------------------------------------
    const answeredCount = Object.keys(answers || {}).length;
    const totalQuestions = questions?.length || 0;

    const profile = {
        schemaVersion: 1,
        generatedAt: report.timestamp,
        source: {
            tool: source,
            mode,
            profileId
        },
        mbti: {
            type: determinedType,
            name_ja: typeDesc.name,
            description_ja: typeDesc.description,
            confidence: parseInt(report.result.confidence.replace('%', ''), 10),
            originalConfidence: parseInt(report.result.originalConfidence.replace('%', ''), 10),
            consistency: parseInt(report.result.consistency.replace('%', ''), 10),
            warning_ja: report.result.warning || null
        },
        axes: axisScores,
        cognitiveFunctions: functionProfile,
        stack: {
            order: stack,            // 例: ["Ni","Te","Fi","Se"]
            breakdown: stackBreakdown
        },
        typeRanking,
        meta: {
            questionCount: totalQuestions,
            answeredCount,
            contradictions: {
                count: report.contradictions.count,
                details: report.contradictions.details
            }
        }
    };

    return profile;
}

/**
 * 0-1 にクランプ
 * @param {number} v
 * @returns {number}
 */
function clamp01(v) {
    if (Number.isNaN(v)) return 0.5;
    return Math.max(0, Math.min(1, v));
}

/**
 * 内向 / 外向インデックスをざっくり算出
 * @param {FunctionScore} scores
 * @returns {number} 0 = 外向優勢, 1 = 内向優勢
 */
function computeIntroversionIndex(scores) {
    const intro = (scores.Ni ?? 0) + (scores.Si ?? 0) + (scores.Ti ?? 0) + (scores.Fi ?? 0);
    const extra = (scores.Ne ?? 0) + (scores.Se ?? 0) + (scores.Te ?? 0) + (scores.Fe ?? 0);
    const total = intro + extra || 1;
    return clamp01(intro / total);
}

/**
 * そのまま JSON 文字列まで欲しいとき用ヘルパー
 */
export function buildMyselfJSON(params, space = 2) {
    const profile = buildMyselfProfile(
        params.functionScores,
        params.answers,
        params.questions,
        params.cognitiveStacks,
        params.mbtiDescriptions,
        params.options || {}
    );
    return JSON.stringify(profile, null, space);
}
