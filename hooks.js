// ============================================
// hooks.js - Custom Hooks (状態管理)
// ============================================

/**
 * useState風の状態管理
 */
export function createState(initialState) {
    let state = initialState;
    const listeners = new Set();

    const setState = (newState) => {
        state = typeof newState === 'function' ? newState(state) : newState;
        listeners.forEach(listener => listener(state));
    };

    const getState = () => state;

    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return [getState, setState, subscribe];
}

/**
 * useDiagnosisState - 診断状態管理フック
 */
export function useDiagnosisState(questions) {
    const initialState = {
        currentQuestion: 0,
        answers: {},
        functionScores: {
            Ni: 0, Ne: 0, Si: 0, Se: 0,
            Ti: 0, Te: 0, Fi: 0, Fe: 0
        },
        showResult: false
    };

    const [getState, setState, subscribe] = createState(initialState);

    // Actions
    const actions = {
        setAnswer: (questionId, value, isReverse) => {
            setState(prev => ({
                ...prev,
                answers: {
                    ...prev.answers,
                    [questionId]: { value, isReverse }
                }
            }));
        },

        updateFunctionScore: (funcType, delta) => {
            setState(prev => ({
                ...prev,
                functionScores: {
                    ...prev.functionScores,
                    [funcType]: prev.functionScores[funcType] + delta
                }
            }));
        },

        nextQuestion: () => {
            setState(prev => ({
                ...prev,
                currentQuestion: Math.min(prev.currentQuestion + 1, questions.length - 1)
            }));
        },

        prevQuestion: () => {
            setState(prev => ({
                ...prev,
                currentQuestion: Math.max(prev.currentQuestion - 1, 0)
            }));
        },

        showResult: () => {
            setState(prev => ({ ...prev, showResult: true }));
        },

        reset: () => {
            setState(initialState);
        }
    };

    return { getState, setState, subscribe, actions };
}

/**
 * useLocalStorage - ローカルストレージフック
 */
export function useLocalStorage(keyPrefix = 'persona_finder') {
    const keys = {
        STATE: `${keyPrefix}_state`,
        SHUFFLE_SEED: `${keyPrefix}_shuffle_seed`,
        HAS_SEEN_SHADOW: `${keyPrefix}_seen_shadow`
    };

    return {
        saveState: (state) => {
            try {
                const serialized = JSON.stringify({
                    ...state,
                    timestamp: Date.now()
                });
                localStorage.setItem(keys.STATE, serialized);
                return true;
            } catch (error) {
                console.error('保存エラー:', error);
                return false;
            }
        },

        loadState: () => {
            try {
                const serialized = localStorage.getItem(keys.STATE);
                if (!serialized) return null;

                const loaded = JSON.parse(serialized);
                const ONE_DAY = 24 * 60 * 60 * 1000;
                
                if (Date.now() - loaded.timestamp > ONE_DAY) {
                    localStorage.removeItem(keys.STATE);
                    return null;
                }

                return loaded;
            } catch (error) {
                console.error('復元エラー:', error);
                return null;
            }
        },

        clearAll: () => {
            Object.values(keys).forEach(key => localStorage.removeItem(key));
        },

        shuffleSeed: {
            get: () => {
                const stored = localStorage.getItem(keys.SHUFFLE_SEED);
                return stored ? parseInt(stored, 10) : Date.now();
            },
            set: (seed) => {
                localStorage.setItem(keys.SHUFFLE_SEED, seed.toString());
            }
        },

        shadowSeen: {
            get: () => localStorage.getItem(keys.HAS_SEEN_SHADOW) === 'true',
            set: () => localStorage.setItem(keys.HAS_SEEN_SHADOW, 'true')
        }
    };
}
