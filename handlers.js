
/**
 * useHandlers - イベントハンドラーフック
 */
export function useHandlers(diagnosisState, questions, calculateScore, storage) {
    const { getState, actions } = diagnosisState;
    let isProcessing = false;

    return {
        handleAnswer: (value, event) => {
            if (isProcessing) return;
            isProcessing = true;

            const state = getState();
            const question = questions[state.currentQuestion];
            const funcType = question.type;
            const isReverse = question.reverse || false;
            const oldAnswer = state.answers[question.id];

            // 前回のスコアを差し引く
            if (oldAnswer !== undefined) {
                const oldScore = calculateScore(oldAnswer.value, isReverse);
                actions.updateFunctionScore(funcType, -oldScore);
            }

            // 新しいスコアを加算
            const delta = calculateScore(value, isReverse);
            actions.updateFunctionScore(funcType, delta);
            actions.setAnswer(question.id, value, isReverse);

            // ボタンの選択状態を更新
            if (event && event.currentTarget) {
                const buttons = document.querySelectorAll('.option');
                buttons.forEach(btn => {
                    btn.classList.remove('selected');
                    btn.setAttribute('aria-checked', 'false');
                });
                event.currentTarget.classList.add('selected');
                event.currentTarget.setAttribute('aria-checked', 'true');
            }

            // 次へ
            setTimeout(() => {
                if (state.currentQuestion < questions.length - 1) {
                    actions.nextQuestion();
                } else {
                    actions.showResult();
                }
                isProcessing = false;
            }, 200);
        },

        goBack: () => {
            actions.prevQuestion();
        },

        goNext: () => {
            const state = getState();
            const currentQuestion = questions[state.currentQuestion];
            if (state.answers[currentQuestion.id]) {
                actions.nextQuestion();
            }
        },

        reset: () => {
            if (confirm('診断をリセットしますか?\n\n現在の回答データが全て削除されます。\nこの操作は取り消せません。')) {
                storage.clearAll();
                actions.reset();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        handleKeyboardNav: (event, currentValue) => {
            const options = Array.from(document.querySelectorAll('.option'));
            const currentIndex = options.findIndex(btn => 
                parseInt(btn.getAttribute('data-value')) === currentValue
            );
            
            let nextIndex = currentIndex;
            
            switch(event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    event.preventDefault();
                    nextIndex = Math.max(0, currentIndex - 1);
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    event.preventDefault();
                    nextIndex = Math.min(options.length - 1, currentIndex + 1);
                    break;
                case 'Home':
                    event.preventDefault();
                    nextIndex = 0;
                    break;
                case 'End':
                    event.preventDefault();
                    nextIndex = options.length - 1;
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    const value = parseInt(options[currentIndex].getAttribute('data-value'));
                    this.handleAnswer(value, { currentTarget: options[currentIndex] });
                    return;
                default:
                    return;
            }
            
            if (nextIndex !== currentIndex && options[nextIndex]) {
                options[nextIndex].focus();
                options.forEach((opt, idx) => {
                    opt.tabIndex = idx === nextIndex ? 0 : -1;
                });
            }
        }
    };
}