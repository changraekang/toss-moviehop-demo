import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { fetchQuiz, checkQuiz } from "../api.js";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

const PENALTY_MS = 3 * 60 * 1000; // 오답 시 3분 잠금 (클라이언트 처리)
const lockKey = (movieId) => `moviehop_quizlock_${movieId}`;

function readLock(movieId) {
  try {
    const v = Number(localStorage.getItem(lockKey(movieId)));
    return v && v > Date.now() ? v : 0;
  } catch {
    return 0;
  }
}

// 영화 문제. 보기를 고르면 바로 O/X 채점 후 자동으로 닫힌다.
// 정답은 노출하지 않고, 틀리면 3분 동안 다시 풀 수 없다(클라이언트).
function QuizModal({ movieId, movieTitle, token, onClose, onSolved }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null); // { isCorrect }
  const [lockUntil, setLockUntil] = useState(() => readLock(movieId));
  const [remaining, setRemaining] = useState(0);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuiz(movieId);
      setQuiz(data);
    } catch (err) {
      setError(err.message ?? "문제를 불러오지 못했습니다.");
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

  // 잠금 카운트다운 (다시 열었을 때)
  useEffect(() => {
    if (!lockUntil) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, lockUntil - Date.now());
      setRemaining(left);
      if (left <= 0) {
        setLockUntil(0);
        try {
          localStorage.removeItem(lockKey(movieId));
        } catch {
          /* noop */
        }
        setResult(null);
        setSelected(null);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lockUntil, movieId]);

  const locked = remaining > 0;

  const handlePick = async (index) => {
    if (locked || result || selected != null) return;
    setSelected(index);
    try {
      const res = await checkQuiz(
        { quizId: quiz.quizId, movieId, userAnswer: quiz.options[index] },
        token
      );
      setResult({ isCorrect: res.isCorrect });
      if (res.isCorrect) {
        setTimeout(() => onSolved(), 900); // 정답 → 별점 잠금 해제 후 닫힘
      } else {
        try {
          localStorage.setItem(lockKey(movieId), String(Date.now() + PENALTY_MS));
        } catch {
          /* noop */
        }
        setTimeout(() => onClose(), 1100); // 오답 → 바로 닫힘 (3분 잠금 저장)
      }
    } catch (err) {
      setError(err.message ?? "채점에 실패했습니다.");
      setSelected(null);
    }
  };

  const fmt = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  if (!modalRoot) return null;

  return createPortal(
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Sheet role="dialog" aria-modal="true">
        <Grabber />
        <Header>
          <div>
            <Badge>문제</Badge>
            <Title>문제를 맞히면 별점을 줄 수 있어요</Title>
            {movieTitle && <Subtitle>{movieTitle}</Subtitle>}
          </div>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            ✕
          </CloseButton>
        </Header>

        {loading && <State>문제를 불러오는 중입니다…</State>}
        {error && !loading && <State $error>{error}</State>}

        {!loading && !error && quiz && locked && (
          <LockBox>
            <LockMark>✕</LockMark>
            <LockText>틀렸어요. 잠시 후 다시 도전할 수 있어요.</LockText>
            <LockTimer>{fmt(remaining)}</LockTimer>
          </LockBox>
        )}

        {!loading && !error && quiz && !locked && (
          <>
            <Question>{quiz.question}</Question>
            <Options>
              {quiz.options.map((option, index) => {
                const isPicked = selected === index;
                const ok = result?.isCorrect;
                return (
                  <OptionButton
                    key={index}
                    type="button"
                    $picked={isPicked}
                    $correct={isPicked && result && ok}
                    $wrong={isPicked && result && !ok}
                    disabled={selected != null}
                    onClick={() => handlePick(index)}
                  >
                    {option}
                    {isPicked && result && (
                      <PickMark $ok={ok}>{ok ? "O" : "X"}</PickMark>
                    )}
                  </OptionButton>
                );
              })}
            </Options>

            {result && (
              <Feedback $ok={result.isCorrect}>
                {result.isCorrect ? "정답입니다! 별점을 등록할게요." : "오답입니다."}
              </Feedback>
            )}
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

const Overlay = styled.div.attrs({ className: "Overlay" })`
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

const Sheet = styled.div.attrs({ className: "Sheet" })`
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

const Grabber = styled.div.attrs({ className: "Grabber" })`
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.border};
  margin: 0 auto 4px;
  @media (min-width: 768px) {
    display: none;
  }
`;

const Header = styled.header.attrs({ className: "Header" })`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
`;

const Badge = styled.span.attrs({ className: "Badge" })`
  display: inline-block;
  background: rgba(107, 74, 38, 0.12);
  color: ${({ theme }) => theme.colors.primary};
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
`;

const Title = styled.h2.attrs({ className: "Title" })`
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.3;
`;

const Subtitle = styled.p.attrs({ className: "Subtitle" })`
  margin: 6px 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const CloseButton = styled.button.attrs({ className: "CloseButton" })`
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

const State = styled.div.attrs({ className: "State" })`
  text-align: center;
  padding: 28px 0;
  font-weight: 500;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.error : theme.colors.secondaryText};
`;

const Question = styled.p.attrs({ className: "Question" })`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.5;
`;

const Options = styled.div.attrs({ className: "Options" })`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const OptionButton = styled.button.attrs({ className: "OptionButton" })`
  position: relative;
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
  background: ${({ $correct, $wrong, $picked, theme }) =>
    $correct
      ? "rgba(46,158,115,0.12)"
      : $wrong
      ? "rgba(192,57,43,0.12)"
      : $picked
      ? "rgba(107,74,38,0.10)"
      : theme.colors.surfaceAlt};

  &:disabled {
    cursor: default;
  }
`;

const PickMark = styled.span.attrs({ className: "PickMark" })`
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  font-size: 22px;
  font-weight: 800;
  color: ${({ $ok, theme }) => ($ok ? theme.colors.success : theme.colors.error)};
`;

const Feedback = styled.div.attrs({ className: "Feedback" })`
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  color: ${({ $ok, theme }) => ($ok ? theme.colors.success : theme.colors.error)};
`;

const LockBox = styled.div.attrs({ className: "LockBox" })`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 22px 14px;
  border-radius: 14px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.18);
`;

const LockMark = styled.span.attrs({ className: "LockMark" })`
  font-size: 34px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.error};
  line-height: 1;
`;

const LockText = styled.span.attrs({ className: "LockText" })`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.error};
`;

const LockTimer = styled.span.attrs({ className: "LockTimer" })`
  font-size: 32px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.error};
  line-height: 1.1;
`;

export default QuizModal;
