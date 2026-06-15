import { useState } from "react";
import styled from "styled-components";

// 0.5 단위 별점 컴포넌트
// - readOnly: 평균 평점 표시용 (소수점 채움)
// - 클릭 시 onRate(value) 호출 → 게이팅(로그인/퀴즈)은 부모가 처리
function StarRating({
  value = 0,
  onRate,
  readOnly = false,
  size = 28,
  disabled = false,
}) {
  const [hover, setHover] = useState(null);
  const display = hover ?? value;

  const handleClick = (starValue) => {
    if (readOnly || disabled || !onRate) return;
    onRate(starValue);
  };

  return (
    <Row
      $size={size}
      onMouseLeave={() => setHover(null)}
      role={readOnly ? "img" : "slider"}
      aria-label={`별점 ${Number(value).toFixed(1)}점 (5점 만점)`}
    >
      {[1, 2, 3, 4, 5].map((index) => {
        const fill = Math.max(0, Math.min(1, display - (index - 1)));
        return (
          <Star key={index} $size={size}>
            <StarFill style={{ width: `${fill * 100}%` }}>★</StarFill>
            <StarBase>★</StarBase>
            {!readOnly && (
              <>
                <HalfHit
                  $left
                  $disabled={disabled}
                  onMouseEnter={() => setHover(index - 0.5)}
                  onClick={() => handleClick(index - 0.5)}
                  aria-label={`${index - 0.5}점`}
                />
                <HalfHit
                  $disabled={disabled}
                  onMouseEnter={() => setHover(index)}
                  onClick={() => handleClick(index)}
                  aria-label={`${index}점`}
                />
              </>
            )}
          </Star>
        );
      })}
    </Row>
  );
}

const Row = styled.div`
  display: inline-flex;
  gap: 4px;
  line-height: 1;
`;

const Star = styled.span`
  position: relative;
  display: inline-block;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  font-size: ${({ $size }) => $size}px;
`;

const StarBase = styled.span`
  color: #e6d2a8;
`;

const StarFill = styled.span`
  position: absolute;
  inset: 0;
  overflow: hidden;
  white-space: nowrap;
  color: #ffb400;
`;

const HalfHit = styled.button`
  position: absolute;
  top: 0;
  ${({ $left }) => ($left ? "left: 0;" : "right: 0;")}
  width: 50%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
`;

export default StarRating;
