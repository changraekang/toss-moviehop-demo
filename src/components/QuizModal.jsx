import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { fetchQuiz, checkQuiz } from "../api.js";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

// 별점을 매기기 전에 풀어야 하는 영화 퀴즈 모달
// 정답을 맞히면 onSolved() 호출 → 부모가 별점 등록
function QuizModal({ movieId, movieTitle, token, onClose, onSolved }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { isCorrect, correctAnswer }

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    try {
      const data = await fetchQuiz(movieId);
      setQuiz(data);
    } catch (err) {
      setError(err.message ?? "퀴즈를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [movieId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    if (selected == null || submitting) return;
    setSubmitting(true);
    try {
      const res = await checkQuiz(
        { quizId: quiz.quizId, movieId, userAnswer: quiz.options[selected] },
        token
      );
      setResult(res);
      if (res.isCorrect) {
        // 백엔드가 완료 상태를 기록함 → 잠시 후 별점 등록 단계로
        setTimeout(() => onSolved(), 700);
      }
    } catch (err) {
      setError(err.message ?? "정답 확인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!modalRoot) return null;

  return createPortal(
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Dialog role="dialog" aria-modal="true">
        <Header>
          <div>
            <Badge>퀴즈</Badge>
            <Title>별점을 매기려면 퀴즈를 풀어주세요</Title>
            {movieTitle && <Subtitle>{movieTitle}</Subtitle>}
          </div>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            ✕
          </CloseButton>
        </Header>

        {loading && <State>퀴즈를 불러오는 중입니다…</State>}
        {error && !loading && <State $error>{error}</State>}

        {!loading && !error && quiz && (
          <>
            <Question>{quiz.question}</Question>
            <Options>
              {quiz.options.map((option, index) => {
                const isPicked = selected === index;
                const isAnswer =
                  result && result.correctAnswer === option;
                const isWrongPick =
                  result && isPicked && !result.isCorrect;
                return (
                  <OptionButton
                    key={index}
                    type="button"
                    $picked={isPicked}
                    $correct={isAnswer}
                    $wrong={isWrongPick}
                    disabled={Boolean(result?.isCorrect) || submitting}
                    onClick={() => setSelected(index)}
                  >
                    {option}
                  </OptionButton>
                );
              })}
            </Options>

            {result && (
              <Feedback $ok={result.isCorrect}>
                {result.isCorrect
                  ? "정답입니다! 별점을 등록할게요."
                  : "오답입니다. 다시 시도해 주세요."}
              </Feedback>
            )}

            <Actions>
              {result && !result.isCorrect ? (
                <PrimaryButton type="button" onClick={loadQuiz}>
                  다른 문제 풀기
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  type="button"
                  disabled={selected == null || submitting || result?.isCorrect}
                  onClick={handleSubmit}
                >
                  {submitting ? "확인 중…" : "정답 확인"}
                </PrimaryButton>
              )}
            </Actions>
          </>
        )}
      </Dialog>
    </Overlay>,
    modalRoot
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  z-index: 1100;
`;

const Dialog = styled.div`
  width: min(520px, 100%);
  background: #fff;
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
`;

const Badge = styled.span`
  display: inline-block;
  background: rgba(0, 104, 255, 0.1);
  color: ${({ theme }) => theme.colors.primary};
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 6px 0 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const CloseButton = styled.button`
  border: none;
  background: rgba(148, 163, 184, 0.16);
  color: #1f2937;
  border-radius: 999px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
`;

const State = styled.div`
  text-align: center;
  padding: 32px 0;
  font-weight: 500;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.error : theme.colors.secondaryText};
`;

const Question = styled.p`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
`;

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const OptionButton = styled.button`
  text-align: left;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 2px solid
    ${({ $picked, $correct, $wrong, theme }) =>
      $correct
        ? "#16a34a"
        : $wrong
        ? theme.colors.error
        : $picked
        ? theme.colors.primary
        : theme.colors.border};
  background: ${({ $picked, $correct, $wrong }) =>
    $correct
      ? "rgba(22,163,74,0.1)"
      : $wrong
      ? "rgba(239,68,68,0.08)"
      : $picked
      ? "rgba(0,104,255,0.06)"
      : "#fff"};
  color: ${({ theme }) => theme.colors.text};

  &:disabled {
    cursor: default;
  }
`;

const Feedback = styled.div`
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  color: ${({ $ok, theme }) => ($ok ? "#16a34a" : theme.colors.error)};
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const PrimaryButton = styled.button`
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    background: rgba(0, 104, 255, 0.4);
    cursor: not-allowed;
  }
`;

export default QuizModal;
