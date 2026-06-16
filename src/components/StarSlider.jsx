import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

// 별점 입력기.
// - 첫 탭(클릭): 0.5 단위 / 드래그(슬라이드): 0.1 단위
// - spread: 별은 왼쪽, 점수 배지는 오른쪽 끝으로 분리(목록용)
// - locked: 별 정중앙에 ? 표시(문제 미해결). ? 클릭 시 onUnlock
function StarSlider({
  value = 0,
  onCommit,
  disabled = false,
  size = 30,
  scoreSize,
  spread = false,
  locked = false,
  hideScore = false,
  onUnlock,
}) {
  const sSize = scoreSize ?? size;
  const [val, setVal] = useState(value ?? 0);
  const barRef = useRef(null);
  const drag = useRef({ active: false, moved: false, startX: 0 });
  const interactive = !disabled && !locked;

  useEffect(() => {
    setVal(value ?? 0);
  }, [value]);

  const valueFromX = (clientX) => {
    const el = barRef.current;
    if (!el) return val;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * 5;
  };
  const snap01 = (v) => Math.round(v * 10) / 10;
  const snap05 = (v) => Math.min(5, Math.max(0.5, Math.round(v * 2) / 2));

  const onDown = (e) => {
    if (!interactive) return;
    e.preventDefault();
    barRef.current?.setPointerCapture?.(e.pointerId);
    drag.current = { active: true, moved: false, startX: e.clientX };
    setVal(snap01(valueFromX(e.clientX)));
  };
  const onMove = (e) => {
    if (!drag.current.active) return;
    if (Math.abs(e.clientX - drag.current.startX) > 4) drag.current.moved = true;
    setVal(snap01(valueFromX(e.clientX)));
  };
  const onUp = (e) => {
    if (!drag.current.active) return;
    const moved = drag.current.moved;
    drag.current.active = false;
    const raw = valueFromX(e.clientX);
    const final = moved ? snap01(raw) : snap05(raw); // 탭=0.5, 드래그=0.1
    setVal(final);
    if (interactive && onCommit) onCommit(Number(final.toFixed(1)));
  };

  return (
    <Wrap $spread={spread}>
      <BarHolder>
        <Bar
          ref={barRef}
          $size={size}
          $interactive={interactive}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={val}
          aria-label="별점 (첫 탭 0.5단위, 드래그 0.1단위)"
        >
          {[1, 2, 3, 4, 5].map((index) => {
            const fill = Math.max(0, Math.min(1, val - (index - 1)));
            return (
              <Star key={index} $size={size}>
                <Fill style={{ width: `${fill * 100}%` }}>★</Fill>
                <Base>★</Base>
              </Star>
            );
          })}
        </Bar>
        {locked && (
          <Lock type="button" onClick={onUnlock} aria-label="문제 풀기">
            <span>?</span>
          </Lock>
        )}
      </BarHolder>
      {!hideScore && (
        <Score $val={val} $disabled={disabled || locked} $size={sSize}>
          {val.toFixed(1)}
        </Score>
      )}
    </Wrap>
  );
}

export function scoreColor(v, disabled) {
  if (disabled || v <= 0) return "#b0b8c1"; // 잠금/미평가 (grey400)
  if (v >= 3.5) return "#15c47e"; // 높음(green)
  if (v >= 2.0) return "#fe9800"; // 보통(TDS orange500)
  return "#f04452"; // 낮음(red)
}

const Wrap = styled.div.attrs({ className: "Wrap" })`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  touch-action: none;
  ${({ $spread }) =>
    $spread && "width: 100%; justify-content: space-between; gap: 8px;"}
`;

const BarHolder = styled.div.attrs({ className: "BarHolder" })`
  position: relative;
  display: inline-flex;
`;

const Bar = styled.div.attrs({ className: "Bar" })`
  position: relative;
  display: inline-flex;
  gap: 4px;
  line-height: 1;
  cursor: ${({ $interactive }) => ($interactive ? "pointer" : "default")};
  touch-action: none;
`;

const Star = styled.span.attrs({ className: "Star" })`
  position: relative;
  display: inline-block;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  font-size: ${({ $size }) => $size}px;
  pointer-events: none;
`;

const Base = styled.span.attrs({ className: "Base" })`
  color: #e5e8eb;
`;

const Fill = styled.span.attrs({ className: "Fill" })`
  position: absolute;
  inset: 0;
  overflow: hidden;
  white-space: nowrap;
  color: #ffb331;
`;

const Lock = styled.button.attrs({ className: "Lock" })`
  position: absolute;
  inset: -4px -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  border-radius: 10px;
  background: rgba(242, 244, 246, 0.7);

  span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: 22px;
    font-weight: 800;
    box-shadow: 0 4px 12px rgba(49, 130, 246, 0.25);
  }
  &:active span {
    transform: scale(0.94);
  }
`;

const Score = styled.span.attrs({ className: "Score" })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${({ $size }) => Math.round($size * 1.35)}px;
  height: ${({ $size }) => Math.round($size * 1.18)}px;
  padding: 0 8px;
  border-radius: 10px;
  background: ${({ $val, $disabled }) => scoreColor($val, $disabled)};
  color: #fff;
  font-size: ${({ $size }) => Math.round($size * 0.62)}px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
`;

export default StarSlider;
