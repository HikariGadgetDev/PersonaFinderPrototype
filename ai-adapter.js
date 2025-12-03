// ============================================
// ai-adapter-refined.js - AI Adapter with Corrected I/E Axis
// ============================================

/**
 * @typedef {Object} ProfileAxes
 * @property {Object} intuition_vs_sensing - N/S軸 (0=S, 1=N)
 * @property {number} intuition_vs_sensing.value - 軸の値
 * @property {Object} thinking_vs_feeling - T/F軸 (0=F, 1=T)
 * @property {number} thinking_vs_feeling.value - 軸の値
 * @property {Object} introversion_vs_extraversion - I/E軸 (0=E, 1=I)
 * @property {number} introversion_vs_extraversion.value - 軸の値
 */

/**
 * @typedef {Object} Profile
 * @property {Object} mbti - MBTI情報
 * @property {string} mbti.type - MBTIタイプ (例: "INTJ")
 * @property {string} mbti.name_ja - タイプ名 (例: "建築家")
 * @property {ProfileAxes} axes - 軸スコア
 * @property {Object} cognitiveFunctions - 認知機能詳細
 * @property {Object} stack - スタック情報
 * @property {string[]} stack.order - スタック順序 (例: ["Ni","Te","Fi","Se"])
 * @property {Object} meta - メタ情報
 * @property {Object} meta.contradictions - 矛盾情報
 * @property {number} meta.contradictions.count - 矛盾件数
 */

/**
 * @typedef {Object} StyleAdjustments
 * @property {number} abstraction_tolerance - 抽象度許容度 (0=具体的, 1=抽象的)
 * @property {number} logic_vs_empathy - 論理vs共感 (0=共感重視, 1=論理重視)
 * @property {number} introversion_index - 内向性指標 (0=外向, 1=内向) ★追加
 * @property {string} verbosity_preference - 冗長性の好み ("concise" | "balanced" | "detailed")
 * @property {string} pace_modifier - ペース調整係数 ("faster" | "moderate" | "slower")
 */

/**
 * @typedef {Object} AiAdapter
 * @property {Object} communication - コミュニケーション設定
 * @property {string} detail_level - 詳細度 ("low" | "medium" | "high")
 * @property {boolean} prefers_structure - 構造化を好むか
 * @property {boolean} step_by_step - ステップバイステップを好むか
 * @property {string[]} tone - トーン設定
 * @property {string[]} push_zones - 深掘りすべき領域
 * @property {string[]} avoid_zones - 避けるべき領域
 * @property {number} introversion_index - 内向性指標 ★追加
 * @property {Object} prompt_template - プロンプトテンプレート
 * @property {string} prompt_template.system_instruction - システム指示
 * @property {string} prompt_template.user_instruction - ユーザー指示
 * @property {ProfileAxes} axes - 軸スコア (参照用)
 * @property {string} mbti_type - MBTIタイプ
 * @property {string[]} stack_order - スタック順序
 */

// ============================================
// 定数定義
// ============================================

/** 軸の閾値 */
const AXIS_THRESHOLDS = Object.freeze({
    HIGH: 0.6,
    MEDIUM: 0.4,
    LOW: 0.4
});

/** ペルソナ定義 */
const PERSONAS = Object.freeze({
    ARCHITECT: 'architect',      // INTJ/INFJ系
    ANALYST: 'analyst',          // INTP/ISTP系
    DIPLOMAT: 'diplomat',        // INFP/ENFP系
    SENTINEL: 'sentinel',        // ISTJ/ESTJ系
    EXPLORER: 'explorer',        // ESTP/ESFP系
    COMMANDER: 'commander'       // ENTJ/ENFJ系
});

// ============================================
// ペルソナ判定
// ============================================

/**
 * プロファイルからペルソナを判定
 * @param {Profile} profile - プロファイル
 * @returns {string} ペルソナ
 */
function determinePersona(profile) {
    const type = profile.mbti.type;
    const nBias = profile.axes.intuition_vs_sensing.value;
    const tBias = profile.axes.thinking_vs_feeling.value;
    const iBias = profile.axes.introversion_vs_extraversion.value;

    // INTJやINFJのような内向的直観型
    if (type.startsWith('IN') && type.includes('J')) {
        return PERSONAS.ARCHITECT;
    }

    // INTPやISTPのような内向的思考型
    if (type.startsWith('I') && type.includes('T') && type.includes('P')) {
        return PERSONAS.ANALYST;
    }

    // INFPやENFPのような直観+感情型
    if ((type.includes('NF') && type.includes('P')) || type === 'INFJ') {
        return PERSONAS.DIPLOMAT;
    }

    // ISTJやESTJのような感覚+思考+判断型
    if (type.includes('ST') && type.includes('J')) {
        return PERSONAS.SENTINEL;
    }

    // ESTPやESFPのような外向的感覚型
    if (type.startsWith('ES') && type.includes('P')) {
        return PERSONAS.EXPLORER;
    }

    // ENTJやENFJのような外向的判断型
    if (type.startsWith('EN') && type.includes('J')) {
        return PERSONAS.COMMANDER;
    }

    // デフォルト: 軸から推定
    if (nBias > AXIS_THRESHOLDS.HIGH && iBias > AXIS_THRESHOLDS.HIGH) {
        return PERSONAS.ARCHITECT;
    }

    return PERSONAS.ANALYST; // フォールバック
}

// ============================================
// スタイル調整パラメータの計算
// ============================================

/**
 * 軸スコアから対話スタイルの微調整パラメータを計算
 * @param {ProfileAxes} axes - プロファイルの axes オブジェクト
 * @returns {StyleAdjustments} 微調整パラメータ
 */
function calculateStyleAdjustments(axes) {
    const nBias = axes.intuition_vs_sensing.value;
    const tBias = axes.thinking_vs_feeling.value;
    const iBias = axes.introversion_vs_extraversion.value;

    return {
        // 抽象度許容度 (0=具体的, 1=抽象的)
        abstraction_tolerance: nBias,
        
        // 論理 vs 共感 (0=共感重視, 1=論理重視)
        logic_vs_empathy: tBias,
        
        // ★修正: 内向性指標を追加
        introversion_index: iBias,
        
        // 冗長性の好み
        verbosity_preference: iBias > AXIS_THRESHOLDS.HIGH ? "detailed" 
                            : iBias > AXIS_THRESHOLDS.MEDIUM ? "balanced" 
                            : "concise",
        
        // ペース調整係数
        pace_modifier: iBias > AXIS_THRESHOLDS.HIGH ? "slower" 
                     : iBias > AXIS_THRESHOLDS.MEDIUM ? "moderate" 
                     : "faster"
    };
}

// ============================================
// プロンプトテンプレート生成
// ============================================

/**
 * プロンプトテンプレートを生成
 * @param {string} persona - ペルソナ
 * @param {string} mbtiType - MBTIタイプ
 * @param {Profile} profile - プロファイル
 * @param {StyleAdjustments} adjustments - スタイル調整
 * @param {string} language - 言語 ('ja' | 'en')
 * @returns {Object} プロンプトテンプレート
 */
function generatePromptTemplate(persona, mbtiType, profile, adjustments, language = 'ja') {
    if (language === 'en') {
        return generateEnglishPrompt(persona, mbtiType, profile, adjustments);
    }
    
    // 日本語プロンプト生成
    const isAbstract = adjustments.abstraction_tolerance >= AXIS_THRESHOLDS.HIGH;
    const isLogical = adjustments.logic_vs_empathy >= AXIS_THRESHOLDS.HIGH;
    
    // ★修正: I/E軸から正しく算出
    const isIntroverted = adjustments.introversion_index >= AXIS_THRESHOLDS.HIGH;

    const systemInstruction = buildSystemInstruction(
        persona,
        mbtiType,
        isAbstract,
        isLogical,
        isIntroverted,
        adjustments
    );

    const userInstruction = buildUserInstruction(
        persona,
        mbtiType,
        profile,
        isAbstract,
        isLogical,
        isIntroverted
    );

    return {
        system_instruction: systemInstruction,
        user_instruction: userInstruction
    };
}

/**
 * システム指示を構築
 * @param {string} persona - ペルソナ
 * @param {string} mbtiType - MBTIタイプ
 * @param {boolean} isAbstract - 抽象的か
 * @param {boolean} isLogical - 論理的か
 * @param {boolean} isIntroverted - 内向的か
 * @param {StyleAdjustments} adjustments - スタイル調整
 * @returns {string} システム指示
 */
function buildSystemInstruction(persona, mbtiType, isAbstract, isLogical, isIntroverted, adjustments) {
    const baseInstruction = `あなたは ${mbtiType} タイプ (${getPersonaName(persona)}) のユーザーと対話しています。`;

    const styleGuidelines = [];

    // 抽象度
    if (isAbstract) {
        styleGuidelines.push('抽象的な概念や理論的枠組みを用いた説明を好みます');
        styleGuidelines.push('具体例は必要最小限に留め、本質的な構造に焦点を当ててください');
    } else {
        styleGuidelines.push('具体的な事例やステップバイステップの説明を好みます');
        styleGuidelines.push('抽象的な理論より、実践的な応用を重視してください');
    }

    // 論理 vs 共感
    if (isLogical) {
        styleGuidelines.push('論理的一貫性と客観的根拠を重視します');
        styleGuidelines.push('感情的配慮より、事実とデータに基づいた説明を優先してください');
    } else {
        styleGuidelines.push('価値観や人への影響を考慮した説明を好みます');
        styleGuidelines.push('論理だけでなく、感情的な側面にも配慮してください');
    }

    // 内向 vs 外向
    if (isIntroverted) {
        styleGuidelines.push('深い思考の時間を尊重し、一度に多くの情報を詰め込まないでください');
        styleGuidelines.push('対話的というより、熟考を促すスタイルが適しています');
    } else {
        styleGuidelines.push('対話的に考えを発展させるスタイルを好みます');
        styleGuidelines.push('アイデアを広げ、複数の可能性を提示してください');
    }

    // ペース
    styleGuidelines.push(`説明のペース: ${adjustments.pace_modifier === 'slower' ? 'ゆっくり丁寧に' : adjustments.pace_modifier === 'moderate' ? '適度な速さで' : '簡潔に要点を'}`);

    return `${baseInstruction}

## 対話スタイルのガイドライン
${styleGuidelines.map(g => `- ${g}`).join('\n')}

## 重要な原則
- 表面的なアドバイスや根拠のないポジティブさは避けてください
- ユーザーの知的水準を尊重し、簡略化しすぎないでください
- 長期的視点と構造的理解を重視してください`;
}

/**
 * ユーザー指示を構築
 * @param {string} persona - ペルソナ
 * @param {string} mbtiType - MBTIタイプ
 * @param {Profile} profile - プロファイル
 * @param {boolean} isAbstract - 抽象的か
 * @param {boolean} isLogical - 論理的か
 * @param {boolean} isIntroverted - 内向的か
 * @returns {string} ユーザー指示
 */
function buildUserInstruction(persona, mbtiType, profile, isAbstract, isLogical, isIntroverted) {
    const parts = [];

    parts.push(`私は ${mbtiType} タイプ (${profile.mbti.name_ja}) です。`);

    // 認知スタック
    parts.push(`\n## 私の認知機能スタック\n${profile.stack.order.join(' → ')}`);

    // 思考スタイル
    const thinkingStyle = [];
    if (isAbstract) {
        thinkingStyle.push('抽象的な概念や全体像から理解する');
        thinkingStyle.push('パターンや構造を見抜くことを重視する');
    } else {
        thinkingStyle.push('具体的な事実やデータから理解する');
        thinkingStyle.push('実践的で現実的なアプローチを好む');
    }

    if (isLogical) {
        thinkingStyle.push('論理的一貫性と客観性を重視する');
        thinkingStyle.push('感情より分析を優先する');
    } else {
        thinkingStyle.push('価値観や人への影響を考慮する');
        thinkingStyle.push('調和と共感を大切にする');
    }

    if (isIntroverted) {
        thinkingStyle.push('深く考える時間を必要とする');
        thinkingStyle.push('少ない情報を深く掘り下げることを好む');
    } else {
        thinkingStyle.push('対話しながら考えを発展させる');
        thinkingStyle.push('複数のアイデアを同時に探求することを好む');
    }

    parts.push(`\n## 私の思考スタイル\n${thinkingStyle.map(s => `- ${s}`).join('\n')}`);

    // 期待すること
    const expectations = [
        '表面的な励ましではなく、本質的な洞察を提供してください',
        '短期的な解決策だけでなく、長期的な視点も含めてください',
        '私の知的水準を尊重し、複雑な概念も遠慮なく扱ってください'
    ];

    if (profile.meta.contradictions.count > 5) {
        expectations.push('私の回答には矛盾が見られるため、状況依存的な判断をしている可能性を考慮してください');
    }

    parts.push(`\n## あなたに期待すること\n${expectations.map(e => `- ${e}`).join('\n')}`);

    return parts.join('\n');
}

/**
 * 英語プロンプトを生成
 * @param {string} persona - ペルソナ
 * @param {string} mbtiType - MBTIタイプ
 * @param {Profile} profile - プロファイル
 * @param {StyleAdjustments} adjustments - スタイル調整
 * @returns {Object} プロンプトテンプレート
 */
function generateEnglishPrompt(persona, mbtiType, profile, adjustments) {
    const isAbstract = adjustments.abstraction_tolerance >= AXIS_THRESHOLDS.HIGH;
    const isLogical = adjustments.logic_vs_empathy >= AXIS_THRESHOLDS.HIGH;
    
    // ★修正: I/E軸から正しく算出
    const isIntroverted = adjustments.introversion_index >= AXIS_THRESHOLDS.HIGH;

    const systemInstruction = `You are interacting with an ${mbtiType} (${getPersonaName(persona)}) user.

## Communication Style Guidelines
${isAbstract ? '- Prefers abstract concepts and theoretical frameworks' : '- Prefers concrete examples and step-by-step explanations'}
${isAbstract ? '- Focus on essential structures rather than details' : '- Emphasize practical applications over abstract theory'}
${isLogical ? '- Values logical consistency and objective evidence' : '- Values consideration of values and human impact'}
${isLogical ? '- Prioritize facts and data over emotional considerations' : '- Balance logic with emotional awareness'}
${isIntroverted ? '- Respect deep thinking time, avoid information overload' : '- Embrace interactive thinking and idea exploration'}
${isIntroverted ? '- Prefer contemplative over highly interactive style' : '- Encourage brainstorming and multiple possibilities'}

## Key Principles
- Avoid superficial advice or unfounded positivity
- Respect their intellectual level, don't oversimplify
- Emphasize long-term perspective and structural understanding`;

    const userInstruction = `I am an ${mbtiType} type (${profile.mbti.name_ja}).

## My Cognitive Function Stack
${profile.stack.order.join(' → ')}

## My Thinking Style
${isAbstract ? '- Understand through abstract concepts and big picture' : '- Understand through concrete facts and data'}
${isLogical ? '- Value logical consistency and objectivity' : '- Consider values and impact on people'}
${isIntroverted ? '- Need time for deep reflection' : '- Develop ideas through dialogue'}

## What I Expect
- Provide essential insights, not just surface-level encouragement
- Include long-term perspective, not just immediate solutions
- Respect my intellectual capacity, don't shy away from complexity`;

    return {
        system_instruction: systemInstruction,
        user_instruction: userInstruction
    };
}

/**
 * ペルソナ名を取得
 * @param {string} persona - ペルソナ
 * @returns {string} ペルソナ名
 */
function getPersonaName(persona) {
    const names = {
        [PERSONAS.ARCHITECT]: '建築家',
        [PERSONAS.ANALYST]: '分析者',
        [PERSONAS.DIPLOMAT]: '外交官',
        [PERSONAS.SENTINEL]: '番人',
        [PERSONAS.EXPLORER]: '探検家',
        [PERSONAS.COMMANDER]: '指揮官'
    };
    return names[persona] || persona;
}

// ============================================
// メインエクスポート関数
// ============================================

/**
 * プロファイルから高度なAIアダプターを構築
 * @param {Profile} profile - buildMyselfProfile の出力
 * @param {string} [language='ja'] - 言語 ('ja' | 'en')
 * @returns {AiAdapter} AIアダプター設定
 */
export function buildAdvancedAiAdapter(profile, language = 'ja') {
    // 入力検証
    if (!profile || !profile.mbti || !profile.axes || !profile.stack) {
        throw new Error('[AI Adapter] Invalid profile structure');
    }

    // ペルソナ判定
    const persona = determinePersona(profile);

    // スタイル調整パラメータを計算
    const adjustments = calculateStyleAdjustments(profile.axes);

    // プロンプトテンプレート生成
    const promptTemplate = generatePromptTemplate(
        persona,
        profile.mbti.type,
        profile,
        adjustments,
        language
    );

    // トーン設定
    const tone = [];
    if (adjustments.logic_vs_empathy >= AXIS_THRESHOLDS.HIGH) {
        tone.push('logical', 'direct');
    } else {
        tone.push('gentle', 'empathetic');
    }

    if (adjustments.introversion_index > 0.5) {
        tone.push('low_noise'); // うるさくしない
    }

    // 深掘りすべき領域
    const pushZones = ['技術的な深掘り', '構造化された説明'];
    if (adjustments.abstraction_tolerance >= AXIS_THRESHOLDS.HIGH) {
        pushZones.push('理論的枠組み', '概念的モデル');
    }

    // 避けるべき領域
    const avoidZones = [];
    if (profile.meta.contradictions.count > 5) {
        avoidZones.push('曖昧な断定');
    }
    if (adjustments.logic_vs_empathy >= AXIS_THRESHOLDS.HIGH) {
        avoidZones.push('過度な感情的配慮');
    }

    // AIアダプターを構築
    return {
        communication: {
            detail_level: adjustments.abstraction_tolerance >= AXIS_THRESHOLDS.HIGH ? 'high' : 'medium',
            prefers_structure: true,
            step_by_step: true,
            tone,
            push_zones: pushZones,
            avoid_zones: avoidZones,
            introversion_index: adjustments.introversion_index // ★追加
        },
        prompt_template: promptTemplate,
        axes: profile.axes,
        mbti_type: profile.mbti.type,
        stack_order: profile.stack.order
    };
}

/**
 * 簡易版アダプター (後方互換性のため)
 * @param {Profile} profile - プロファイル
 * @returns {Object} 簡易版アダプター
 */
export function buildAiAdapter(profile) {
    const { mbti, axes, stack } = profile;

    const nBias = axes.intuition_vs_sensing.value;
    const tBias = axes.thinking_vs_feeling.value;
    const iBias = axes.introversion_vs_extraversion.value;

    const isNBias = nBias >= AXIS_THRESHOLDS.HIGH;
    const isTBias = tBias >= AXIS_THRESHOLDS.HIGH;

    const detailLevel = isNBias ? 'high' : 'medium';
    const prefersStructure = true;
    const stepByStep = true;

    const tone = [];
    if (isTBias) tone.push('logical', 'direct');
    else tone.push('gentle', 'empathetic');

    if (iBias > 0.5) tone.push('low_noise');

    const pushZones = ['技術的な深掘り', '構造化された説明'];
    const avoidZones = [];

    if (profile.meta.contradictions.count > 5) {
        avoidZones.push('曖昧な断定');
    }

    const summaryPromptJa = [
        `ユーザーは ${mbti.type} タイプ (${mbti.name_ja})。`,
        isNBias ? '抽象度の高い構造説明を好む。' : '具体例と現実的な話を好む。',
        isTBias ? '論理性と一貫性を重視する。' : '感情・価値観への配慮を重視する。',
        prefersStructure ? '結論→理由→具体例→手順 の順番で説明すると理解しやすい。' : '',
        '薄いアドバイスや根拠のないポジティブさは好まない。',
        '技術的な深掘りや長期ロードマップを提示してよい。'
    ].filter(Boolean).join(' ');

    return {
        detail_level: detailLevel,
        prefers_structure: prefersStructure,
        step_by_step: stepByStep,
        tone,
        push_zones: pushZones,
        avoid_zones: avoidZones,
        axes: profile.axes,
        mbti_type: mbti.type,
        stack_order: stack.order,
        summary_prompt_ja: summaryPromptJa
    };
}

// ============================================
// エクスポート
// ============================================

export {
    AXIS_THRESHOLDS,
    PERSONAS,
    determinePersona,
    calculateStyleAdjustments,
    generatePromptTemplate
};

なんかしょうもないこと話してる間にすごいので来たぞ