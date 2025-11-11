// ============================================
// data.js - JSON Data Loader (リファクタ版)
// ============================================

// ============================================
// 型定義 (JSDoc)
// ============================================

/**
 * @typedef {Object} Question
 * @property {string} id - 質問ID
 * @property {string} text - 質問文
 * @property {string} function - 認知機能
 * @property {boolean} [reverse] - 逆転項目フラグ
 * @property {number} priority - 優先度
 * @property {string[]} tags - タグ
 * @property {Object} [related] - 関連情報
 */

/**
 * @typedef {Object} MBTIConfig
 * @property {Object<string, string[]>} cognitiveStacks - 認知スタック定義
 * @property {Object<string, {name: string, description: string}>} mbtiDescriptions - MBTI説明
 */

/**
 * @typedef {Object} InitializedData
 * @property {Question[]} questions - 質問配列
 * @property {Object<string, string[]>} cognitiveStacks - 認知スタック
 * @property {Object<string, {name: string, description: string}>} mbtiDescriptions - MBTI説明
 */

// ============================================
// 定数定義
// ============================================

const VALID_MODES = ['simple', 'detailed'];
const DEFAULT_MODE = 'simple';

const DATA_PATHS = {
    QUESTIONS: (mode) => `data/questions-${mode}.json`,
    CONFIG: 'data/mbti-config.json'
};

const ERROR_MESSAGES = {
    INVALID_MODE: (mode) => `Invalid mode: ${mode}. Valid modes are: ${VALID_MODES.join(', ')}`,
    FETCH_FAILED: (path, status) => `Failed to load ${path}: HTTP ${status}`,
    JSON_PARSE_FAILED: (path) => `Failed to parse JSON from ${path}`,
    NO_QUESTIONS: (mode) => `No questions found in ${mode} mode data`,
    NETWORK_ERROR: (path) => `Network error loading ${path}`
};

// ============================================
// モード管理
// ============================================

let currentMode = DEFAULT_MODE;
let cachedQuestions = null;
let cachedConfig = null;

/**
 * モードを設定
 * @param {string} mode - 'simple' または 'detailed'
 */
export function setMode(mode) {
    if (!VALID_MODES.includes(mode)) {
        console.warn(ERROR_MESSAGES.INVALID_MODE(mode));
        currentMode = DEFAULT_MODE;
        return;
    }
    currentMode = mode;
    cachedQuestions = null; // キャッシュクリア
}

/**
 * 現在のモードを取得
 * @returns {string} 現在のモード
 */
export function getMode() {
    return currentMode;
}

// ============================================
// JSON読み込み
// ============================================

/**
 * JSONファイルを安全に読み込む
 * @param {string} url - 読み込むURL
 * @returns {Promise<any>} パース済みJSON
 * @throws {Error} 読み込みまたはパースに失敗した場合
 */
async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(ERROR_MESSAGES.FETCH_FAILED(url, response.status));
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(ERROR_MESSAGES.JSON_PARSE_FAILED(url));
        }
        if (error instanceof TypeError) {
            throw new Error(ERROR_MESSAGES.NETWORK_ERROR(url));
        }
        throw error;
    }
}

/**
 * 質問データを読み込む
 * @param {string} [mode] - 'simple' または 'detailed'
 * @returns {Promise<Question[]>} 質問配列
 */
export async function loadQuestions(mode = currentMode) {
    const path = DATA_PATHS.QUESTIONS(mode);
    
    try {
        const data = await fetchJSON(path);
        
        if (!data.questions || !Array.isArray(data.questions)) {
            throw new Error(ERROR_MESSAGES.NO_QUESTIONS(mode));
        }
        
        return data.questions;
        
    } catch (error) {
        console.error(`[Data] 質問データの読み込みに失敗 (${mode}):`, error);
        throw error;
    }
}

/**
 * MBTI設定を読み込む
 * @returns {Promise<MBTIConfig>} MBTI設定
 */
export async function loadMBTIConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    
    try {
        const config = await fetchJSON(DATA_PATHS.CONFIG);
        
        // 必須フィールドの検証
        if (!config.cognitiveStacks || !config.mbtiDescriptions) {
            throw new Error('Invalid MBTI config format');
        }
        
        cachedConfig = config;
        return config;
        
    } catch (error) {
        console.error('[Data] MBTI設定の読み込みに失敗:', error);
        console.warn('[Data] デフォルト設定を使用します');
        
        // フォールバック
        const fallback = {
            cognitiveStacks: getDefaultCognitiveStacks(),
            mbtiDescriptions: getDefaultMBTIDescriptions()
        };
        cachedConfig = fallback;
        return fallback;
    }
}

// ============================================
// 同期的アクセス（後方互換性）
// ============================================

/**
 * 質問データを取得（同期的）
 * @deprecated 初回は空配列を返す可能性があります。initializeData()を使用してください。
 * @param {string} [mode] - モード
 * @returns {Question[]} 質問配列
 */
export function getQuestionsByMode(mode = currentMode) {
    if (!cachedQuestions) {
        console.warn('[Data] 質問データが未読み込みです。initializeData()を先に呼び出してください。');
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
 * @param {string} [mode] - 'simple' または 'detailed'
 * @returns {Promise<InitializedData>} 初期化されたデータ
 */
export async function initializeData(mode = DEFAULT_MODE) {
    try {
        // 並行読み込み
        const [questionsData, configData] = await Promise.all([
            loadQuestions(mode),
            loadMBTIConfig()
        ]);
        
        // キャッシュ更新
        cachedQuestions = questionsData;
        cachedConfig = configData;
        
        console.info(`[Data] データ初期化完了 (mode: ${mode}, questions: ${questionsData.length})`);
        
        return {
            questions: questionsData,
            cognitiveStacks: configData.cognitiveStacks,
            mbtiDescriptions: configData.mbtiDescriptions
        };
        
    } catch (error) {
        console.error('[Data] データ初期化に失敗:', error);
        throw error;
    }
}

// ============================================
// フォールバック用デフォルト値
// ============================================

/**
 * デフォルトの認知スタック定義を取得
 * @returns {Object<string, string[]>} 認知スタック
 */
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

/**
 * デフォルトのMBTI説明を取得
 * @returns {Object<string, {name: string, description: string}>} MBTI説明
 */
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

// ============================================
// バリデーション
// ============================================

/**
 * 質問データの妥当性を検証
 * @param {Question[]} questions - 質問配列
 * @returns {{isValid: boolean, errors: string[]}} 検証結果
 */
export function validateQuestions(questions) {
    const errors = [];
    
    if (!Array.isArray(questions)) {
        errors.push('questions must be an array');
        return { isValid: false, errors };
    }
    
    const requiredFields = ['id', 'text', 'function'];
    const validFunctions = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'];
    
    questions.forEach((q, index) => {
        // 必須フィールドチェック
        requiredFields.forEach(field => {
            if (!(field in q)) {
                errors.push(`Question ${index}: missing required field '${field}'`);
            }
        });
        
        // 機能タイプの妥当性チェック
        if (q.function && !validFunctions.includes(q.function)) {
            errors.push(`Question ${index}: invalid function '${q.function}'`);
        }
        
        // IDの重複チェック
        const duplicates = questions.filter(other => other.id === q.id);
        if (duplicates.length > 1) {
            errors.push(`Question ${index}: duplicate ID '${q.id}'`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}