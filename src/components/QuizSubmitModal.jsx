import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { submitUserQuiz } from "../api.js";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

// 퀴즈가 없는 영화에 사용자가 직접 퀴즈를 올린다(검토 대기).
function QuizSubmitModal({ movieId, movieTitle, token, onClose, onSubmitted }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

  const setOption = (i, v) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  const handleSubmit = async () => {
    const q = question.trim();
    const opts = options.map((o) => o.trim());
    const filled = opts.filter(Boolean);
    if (!q) return setError("문제를 입력해 주세요.");
    if (filled.length < 2) return setError("보기를 2개 이상 입력해 주세요.");
    if (!opts[correct]) return setError("정답으로 고른 보기가 비어 있어요.");

    // 빈 보기는 제외하고, 정답 인덱스 재계산
    const compact = [];
    let correctIdx = 0;
    opts.forEach((o, i) => {
      if (o) {
        if (i === correct) correctIdx = compact.length;
        compact.push(o);
      }
    });

    setSubmitting(true);
    try {
      await submitUserQuiz(
        { movieId, question: q, options: compact, correctAnswer: correctIdx },
        token
      );
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.message ?? "제출에 실패했습니다.");
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
            <Badge>퀴즈 올리기</Badge>
            <Title>이 영화의 문제를 직접 만들어요</Title>
            {movieTitle && <Subtitle>{movieTitle}</Subtitle>}
          </div>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            ✕
          </CloseButton>
        </Header>

        <Field>
          <Label>문제</Label>
          <TextArea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="영화 내용에 대한 문제를 적어주세요 (예: 주인공이 끝에 선택한 것은?)"
          />
        </Field>

        <Field>
          <Label>보기 (정답을 왼쪽 ○로 선택)</Label>
          {options.map((opt, i) => (
            <OptionRow key={i}>
              <Radio
                type="button"
                $on={correct === i}
                onClick={() => setCorrect(i)}
                aria-label={`${i + 1}번을 정답으로`}
              />
              <OptionInput
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`보기 ${i + 1}`}
              />
            </OptionRow>
          ))}
        </Field>

        {error && <ErrorText>{error}</ErrorText>}

        <PrimaryButton type="button" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "제출 중…" : "검토 요청 보내기"}
        </PrimaryButton>
        <Hint>관리자 승인 후 다른 사람에게도 문제로 노출됩니다.</Hint>
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
  gap: 14px;
  animation: ${slideUp} 0.22s ease;
  max-height: 92dvh;
  overflow-y: auto;
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
  background: rgba(49, 130, 246, 0.1);
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

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const TextArea = styled.textarea`
  width: 100%;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  font-family: inherit;
  resize: vertical;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Radio = styled.button`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 2px solid
    ${({ $on, theme }) => ($on ? theme.colors.success : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.success : "transparent")};
  cursor: pointer;
`;

const OptionInput = styled.input`
  flex: 1;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 15px;
  font-family: inherit;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
`;

const ErrorText = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.error};
`;

const PrimaryButton = styled.button`
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
  }
`;

const Hint = styled.p`
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

export default QuizSubmitModal;
