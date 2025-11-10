// ============================================
// data.js - JSON Data Loader
// ============================================

// 注意: FUNCTIONSはcore.jsで定義されています
// 重複を避けるため、ここでは定義しません

// ============================================
// モード管理
// ============================================

let currentMode = 'simple';
let cachedQuestions = null;
let cachedConfig = null;

export function setMode(mode) {
    if (mode !== 'simple' && mode !== 'detailed') {
        console.warn(`Invalid mode: ${mode}. Using 'simple' instead.`);
        currentMode = 'simple';
        return;
    }
    currentMode = mode;
    cachedQuestions = null; // キャッシュクリア
}

export function getMode() {
    return currentMode;
}

// ============================================
// JSON読み込み
// ============================================

/**
 * 質問データを読み込む
 * @param {string} mode - 'simple' or 'detailed'
 * @returns {Promise<Array>} 質問配列
 */
export async function loadQuestions(mode = currentMode) {
    try {
        const response = await fetch(`data/questions-${mode}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load questions-${mode}.json: ${response.status}`);
        }
        const data = await response.json();
        return data.questions;
    } catch (error) {
        console.error('質問データの読み込みに失敗:', error);
        return [];
    }
}

/**
 * MBTI設定を読み込む
 * @returns {Promise<Object>} { cognitiveStacks, mbtiDescriptions }
 */
export async function loadMBTIConfig() {
    if (cachedConfig) return cachedConfig;
    
    try {
        const response = await fetch('data/mbti-config.json');
        if (!response.ok) {
            throw new Error(`Failed to load mbti-config.json: ${response.status}`);
        }
        cachedConfig = await response.json();
        return cachedConfig;
    } catch (error) {
        console.error('MBTI設定の読み込みに失敗:', error);
        return {
            cognitiveStacks: getDefaultCognitiveStacks(),
            mbtiDescriptions: getDefaultMBTIDescriptions()
        };
    }
}

// ============================================
// 同期的アクセス（後方互換性）
// ============================================

/**
 * 質問データを取得（同期的）
 * 注意: 初回は空配列を返す可能性があります
 */
export function getQuestionsByMode(mode = currentMode) {
    if (!cachedQuestions) {
        loadQuestions(mode).then(data => {
            cachedQuestions = data;
        });
        return [];
    }
    return cachedQuestions;
}

// デフォルトエクスポート（非推奨、後方互換性のため）
export const questions = [];

// ============================================
// 初期化関数（推奨）
// ============================================

/**
 * データを事前読み込み
 * app.js の起動時に呼び出すことを推奨
 */
export async function initializeData(mode = 'simple') {
    const [questionsData, configData] = await Promise.all([
        loadQuestions(mode),
        loadMBTIConfig()
    ]);
    
    cachedQuestions = questionsData;
    cachedConfig = configData;
    
    return {
        questions: questionsData,
        cognitiveStacks: configData.cognitiveStacks,
        mbtiDescriptions: configData.mbtiDescriptions
    };
}

// ============================================
// フォールバック用デフォルト値
// ============================================

function getDefaultCognitiveStacks() {
    return {
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
}

function getDefaultMBTIDescriptions() {
    return {
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
}