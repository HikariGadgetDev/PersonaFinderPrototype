// ai-adapter.js

/**
 * @param {ReturnType<buildMyselfProfile>} profile
 * @returns {Object} aiAdapter
 */
export function buildAiAdapter(profile) {
    const { mbti, axes, cognitiveFunctions, stack } = profile;

    const nBias = axes.intuition_vs_sensing.value; // 0〜1
    const tBias = axes.thinking_vs_feeling.value;  // 0〜1
    const iBias = axes.introversion_vs_extraversion.value;

    // --- ざっくり判定ヘルパ ---
    const isNBias = nBias >= 0.6;
    const isTBias = tBias >= 0.6;

    const detailLevel = isNBias ? 'high' : 'medium';
    const prefersStructure = true; // Ni/Te, Si/Te ならほぼ固定で true で良い
    const stepByStep = true;

    const tone = [];
    if (isTBias) tone.push('logical', 'direct');
    else tone.push('gentle', 'empathetic');

    if (iBias > 0.5) tone.push('low_noise'); // うるさくしない

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
        axes: profile.axes, // そのまま持ってもOK
        mbti_type: mbti.type,
        stack_order: stack.order,
        summary_prompt_ja: summaryPromptJa
    };
}
