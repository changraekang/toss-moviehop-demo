import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import StarRating from "./StarRating.jsx";
import StarSlider from "./StarSlider.jsx";
import { formatAudience } from "../format.js";
import { fetchMovieReviews, fetchMovieRating } from "../api.js";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

// 영화 상세 + 평점 등록(문제 게이팅) + 리뷰. 모바일에선 바텀시트.
function MovieModal({
  movie,
  isLoggedIn,
  myRating,
  quizCompleted,
  ratingPending,
  onRateAttempt,
  onStartQuiz,
  onClose,
}) {
  const movieId = movie?._id;
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    average: movie?.ratingAverage ?? 0,
    count: movie?.ratingCount ?? 0,
  });
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!movieId) return;
    let ignore = false;
    setLoading(true);
    Promise.all([
      fetchMovieReviews(movieId).catch(() => []),
      fetchMovieRating(movieId).catch(() => null),
    ]).then(([reviewData, ratingData]) => {
      if (ignore) return;
      setReviews(Array.isArray(reviewData) ? reviewData : []);
      if (ratingData) {
        setStats({
          average: ratingData.average ?? 0,
          count: ratingData.count ?? 0,
        });
      }
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [movieId]);

  useEffect(() => {
    setStats({
      average: movie?.ratingAverage ?? 0,
      count: movie?.ratingCount ?? 0,
    });
  }, [movie?.ratingAverage, movie?.ratingCount]);

  const poster = useMemo(() => movie?.posterUrl ?? "", [movie]);

  if (!modalRoot || !movie) return null;

  return createPortal(
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Sheet role="dialog" aria-modal="true">
        <Grabber />
        <CloseButton type="button" onClick={onClose} aria-label="닫기">
          ✕
        </CloseButton>

        <Hero>
          {poster ? (
            <Poster src={poster} alt={`${movie.title} 포스터`} />
          ) : (
            <PosterFallback>포스터 없음</PosterFallback>
          )}
          <HeroInfo>
            <Title>{movie.title}</Title>
            <Sub>
              {formatYear(movie.releaseDate)}
              {formatAudience(movie.audience)
                ? ` · 관객 ${formatAudience(movie.audience)}`
                : ""}
              {movie.genres?.length
                ? ` · ${movie.genres
                    .map((g) => (typeof g === "string" ? g : g?.name))
                    .filter(Boolean)
                    .join(", ")}`
                : ""}
              {movie.runtime ? ` · ${movie.runtime}분` : ""}
            </Sub>
            <AverageRow>
              <StarRating value={stats.average} readOnly size={20} />
              <AverageText>
                {formatAverage(stats.average)}
                <Count> · {stats.count}명</Count>
              </AverageText>
            </AverageRow>
          </HeroInfo>
        </Hero>

        <Body>
          <RateBox>
            <RateTitle>내 평점</RateTitle>
            <StarWrap>
              <StarSlider
                value={myRating ?? 0}
                onCommit={(v) => onRateAttempt(v)}
                disabled={ratingPending || !quizCompleted}
                size={38}
              />
              {!quizCompleted && (
                <QuizLock type="button" onClick={onStartQuiz} aria-label="문제 풀기">
                  <span>?</span>
                </QuizLock>
              )}
            </StarWrap>
            <RateHint>
              {ratingPending
                ? "평점을 등록하는 중입니다…"
                : !quizCompleted
                ? "별점을 주려면 먼저 문제를 맞혀야 해요. ? 를 눌러보세요."
                : myRating != null
                ? `${formatAverage(myRating)}점을 주셨어요. 별 위를 드래그해 수정할 수 있어요.`
                : "별 위를 좌우로 드래그해 0.1점 단위로 평가해요."}
            </RateHint>
          </RateBox>

          <Section>
            <SectionTitle>줄거리</SectionTitle>
            <Overview>
              {movie.overview || "등록된 줄거리 정보가 없습니다."}
            </Overview>
          </Section>

          <Section>
            <SectionTitle>리뷰</SectionTitle>
            {loading ? (
              <Empty>불러오는 중입니다…</Empty>
            ) : reviews.length === 0 ? (
              <Empty>아직 등록된 리뷰가 없습니다.</Empty>
            ) : (
              <ReviewList>
                {reviews.map((review) => (
                  <ReviewItem key={review._id ?? review.createdAt}>
                    <ReviewHead>
                      <Reviewer>{review.username ?? "익명"}</Reviewer>
                      <ReviewDate>{formatDate(review.createdAt)}</ReviewDate>
                    </ReviewHead>
                    <ReviewBody>{review.content}</ReviewBody>
                  </ReviewItem>
                ))}
              </ReviewList>
            )}
          </Section>
        </Body>
      </Sheet>
    </Overlay>,
    modalRoot
  );
}

function formatYear(value) {
  if (!value) return "연도 미상";
  const y = new Date(value).getFullYear();
  return Number.isNaN(y) ? "연도 미상" : `${y}년`;
}
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR");
}
function formatAverage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.0";
  return Number(value).toFixed(1);
}

const slideUp = keyframes`
  from { transform: translateY(24px); opacity: 0.6; }
  to { transform: translateY(0); opacity: 1; }
`;

const Overlay = styled.div.attrs({ className: "Overlay" })`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;

  @media (min-width: 768px) {
    align-items: center;
    padding: 32px 16px;
  }
`;

const Sheet = styled.div.attrs({ className: "Sheet" })`
  position: relative;
  width: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 22px 22px 0 0;
  max-height: 92dvh;
  overflow-y: auto;
  padding: 14px 18px calc(24px + env(safe-area-inset-bottom));
  animation: ${slideUp} 0.22s ease;
  -webkit-overflow-scrolling: touch;

  @media (min-width: 768px) {
    width: min(760px, 100%);
    border-radius: 22px;
    max-height: calc(100dvh - 64px);
    padding: 24px 28px;
  }
`;

const Grabber = styled.div.attrs({ className: "Grabber" })`
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.border};
  margin: 2px auto 12px;

  @media (min-width: 768px) {
    display: none;
  }
`;

const CloseButton = styled.button.attrs({ className: "CloseButton" })`
  position: absolute;
  top: 12px;
  right: 14px;
  border: none;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border-radius: 999px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  font-size: 15px;
  z-index: 2;
`;

const Hero = styled.section.attrs({ className: "Hero" })`
  display: flex;
  gap: 16px;
  align-items: flex-start;
`;

const Poster = styled.img.attrs({ className: "Poster" })`
  width: 104px;
  border-radius: 12px;
  flex-shrink: 0;
  box-shadow: 0 8px 20px rgba(104, 71, 37, 0.18);

  @media (min-width: 768px) {
    width: 150px;
  }
`;

const PosterFallback = styled.div.attrs({ className: "PosterFallback" })`
  width: 104px;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 600;
  font-size: 12px;
  flex-shrink: 0;

  @media (min-width: 768px) {
    width: 150px;
  }
`;

const HeroInfo = styled.div.attrs({ className: "HeroInfo" })`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 28px;
`;

const Title = styled.h2.attrs({ className: "Title" })`
  margin: 0;
  font-size: 21px;
  font-weight: 800;
  line-height: 1.25;

  @media (min-width: 768px) {
    font-size: 26px;
  }
`;

const Sub = styled.p.attrs({ className: "Sub" })`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const AverageRow = styled.div.attrs({ className: "AverageRow" })`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 2px;
`;

const AverageText = styled.span.attrs({ className: "AverageText" })`
  font-size: 16px;
  font-weight: 800;
`;

const Count = styled.span.attrs({ className: "Count" })`
  font-size: 13px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Body = styled.div.attrs({ className: "Body" })`
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin-top: 20px;
`;

const RateBox = styled.div.attrs({ className: "RateBox" })`
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RateTitle = styled.h3.attrs({ className: "RateTitle" })`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const RateHint = styled.p.attrs({ className: "RateHint" })`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Section = styled.section.attrs({ className: "Section" })`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.h3.attrs({ className: "SectionTitle" })`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
`;

const Overview = styled.p.attrs({ className: "Overview" })`
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.text};
  opacity: 0.85;
`;

const Empty = styled.div.attrs({ className: "Empty" })`
  padding: 20px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  text-align: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 500;
  font-size: 14px;
`;

const ReviewList = styled.div.attrs({ className: "ReviewList" })`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ReviewItem = styled.article.attrs({ className: "ReviewItem" })`
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ReviewHead = styled.header.attrs({ className: "ReviewHead" })`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const Reviewer = styled.span.attrs({ className: "Reviewer" })`
  font-weight: 700;
  font-size: 14px;
`;

const ReviewDate = styled.time.attrs({ className: "ReviewDate" })`
  color: ${({ theme }) => theme.colors.secondaryText};
  font-size: 12px;
`;

const ReviewBody = styled.p.attrs({ className: "ReviewBody" })`
  margin: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
  opacity: 0.85;
  line-height: 1.6;
`;

const StarWrap = styled.div.attrs({ className: "StarWrap" })`
  position: relative;
  display: inline-flex;
  align-self: flex-start;
`;

const QuizLock = styled.button.attrs({ className: "QuizLock" })`
  position: absolute;
  inset: -6px -12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);

  span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: 21px;
    font-weight: 800;
    box-shadow: 0 6px 16px rgba(104, 71, 37, 0.3);
  }
  &:active span {
    transform: scale(0.94);
  }
`;

export default MovieModal;
