import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { fetchQuiz, checkQuiz } from "../api.js";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

// 별점을 매기기 전에 풀어야 하는 영화 퀴즈 (다크 / 모바일 바텀시트)
function QuizModal({ movieId, movieTitle, token, onClose, onSolved }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

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
      if (res.isCorrect) setTimeout(() => onSolved(), 700);
    } catch (err) {
      setError(err.message ?? "정답 확인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!modalRoot) return null;

  return createPortal(
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Sheet role="dialog" aria-modal="true">
        <Grabber />
        <Header>
          <div>
            <Badge>QUIZ</Badge>
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
                const isAnswer = result && result.correctAnswer === option;
                const isWrongPick = result && isPicked && !result.isCorrect;
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
      </Sheet>
    </Overlay>,
    modalRoot
  );
}

const slideUp = keyframes`
  from { transform: translateY(24px); opacity: 0.6; }
  to { transform: translateY(0); opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1100;

  @media (min-width: 768px) {
    align-items: center;
    padding: 24px 16px;
  }
`;

const Sheet = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 22px 22px 0 0;
  padding: 14px 18px calc(22px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: ${slideUp} 0.22s ease;

  @media (min-width: 768px) {
    width: min(520px, 100%);
    border-radius: 22px;
    padding: 24px;
  }
`;

const Grabber = styled.div`
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.border};
  margin: 0 auto 4px;
  @media (min-width: 768px) {
    display: none;
  }
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
`;

const Badge = styled.span`
  display: inline-block;
  background: rgba(79, 140, 255, 0.16);
  color: ${({ theme }) => theme.colors.primary};
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.3;
`;

const Subtitle = styled.p`
  margin: 6px 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const CloseButton = styled.button`
  border: none;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border-radius: 999px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  font-size: 15px;
  flex-shrink: 0;
`;

const State = styled.div`
  text-align: center;
  padding: 28px 0;
  font-weight: 500;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.error : theme.colors.secondaryText};
`;

const Question = styled.p`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
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
  padding: 15px 16px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 50px;
  color: ${({ theme }) => theme.colors.text};
  border: 1.5px solid
    ${({ $picked, $correct, $wrong, theme }) =>
      $correct
        ? theme.colors.success
        : $wrong
        ? theme.colors.error
        : $picked
        ? theme.colors.primary
        : theme.colors.border};
  background: ${({ $picked, $correct, $wrong, theme }) =>
    $correct
      ? "rgba(45,212,191,0.12)"
      : $wrong
      ? "rgba(255,90,106,0.12)"
      : $picked
      ? "rgba(79,140,255,0.12)"
      : theme.colors.surfaceAlt};

  &:disabled {
    cursor: default;
  }
`;

const Feedback = styled.div`
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  color: ${({ $ok, theme }) => ($ok ? theme.colors.success : theme.colors.error)};
`;

const Actions = styled.div`
  display: flex;
`;

const PrimaryButton = styled.button`
  flex: 1;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  padding: 15px 20px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-height: 50px;

  &:disabled {
    background: ${({ theme }) => theme.colors.surfaceAlt};
    color: ${({ theme }) => theme.colors.secondaryText};
    cursor: not-allowed;
  }
`;

export default QuizModal;
