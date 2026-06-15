import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import StarRating from "./StarRating.jsx";
import { fetchMovieReviews, fetchMovieRating } from "../api.js";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

// 영화 상세 + 평점 등록(퀴즈 게이팅) + 리뷰
function MovieModal({
  movie,
  isLoggedIn,
  myRating,
  ratingPending,
  onRateAttempt,
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

  // 별점 등록이 반영되면 평균 표시 갱신 (movie prop 이 부모에서 업데이트됨)
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
      <Dialog role="dialog" aria-modal="true">
        <ModalHeader>
          <div>
            <ModalTitle>{movie.title}</ModalTitle>
            <ModalSubtitle>
              {formatYear(movie.releaseDate)}
              {movie.genres?.length ? ` · ${movie.genres.join(", ")}` : ""}
              {movie.runtime ? ` · ${movie.runtime}분` : ""}
            </ModalSubtitle>
          </div>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            ✕
          </CloseButton>
        </ModalHeader>

        <Hero>
          {poster ? (
            <Poster src={poster} alt={`${movie.title} 포스터`} />
          ) : (
            <PosterFallback>포스터 없음</PosterFallback>
          )}

          <HeroInfo>
            <AverageBlock>
              <StarRating value={stats.average} readOnly size={24} />
              <AverageText>
                {formatAverage(stats.average)}
                <Count> · {stats.count}명 참여</Count>
              </AverageText>
            </AverageBlock>

            <RateBox>
              <RateTitle>내 평점</RateTitle>
              <StarRating
                value={myRating ?? 0}
                onRate={(v) => onRateAttempt(v)}
                disabled={ratingPending}
                size={34}
              />
              <RateHint>
                {ratingPending
                  ? "평점을 등록하는 중입니다…"
                  : myRating != null
                  ? `현재 ${formatAverage(myRating)}점을 주셨어요. 별을 눌러 수정할 수 있어요.`
                  : isLoggedIn
                  ? "별을 누르면 퀴즈를 푼 뒤 평점이 등록됩니다."
                  : "별을 누르면 로그인 화면으로 이동합니다."}
              </RateHint>
            </RateBox>
          </HeroInfo>
        </Hero>

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
      </Dialog>
    </Overlay>,
    modalRoot
  );
}

function formatYear(value) {
  if (!value) return "연도 정보 없음";
  const y = new Date(value).getFullYear();
  return Number.isNaN(y) ? "연도 정보 없음" : `${y}년`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR");
}

function formatAverage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.0";
  return value.toFixed(1);
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  z-index: 1000;
`;

const Dialog = styled.div`
  width: min(820px, 100%);
  background: #fff;
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.2);
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (max-width: 640px) {
    padding: 22px 18px;
    border-radius: 20px;
  }
`;

const ModalHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 26px;
  font-weight: 700;
`;

const ModalSubtitle = styled.p`
  margin: 6px 0 0;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-size: 14px;
`;

const CloseButton = styled.button`
  border: none;
  background: rgba(148, 163, 184, 0.16);
  color: #1f2937;
  border-radius: 999px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 18px;
  flex-shrink: 0;
`;

const Hero = styled.section`
  display: flex;
  gap: 24px;
  align-items: flex-start;

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const Poster = styled.img`
  width: 170px;
  border-radius: 16px;
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.2);
  flex-shrink: 0;

  @media (max-width: 720px) {
    width: 140px;
    align-self: center;
  }
`;

const PosterFallback = styled.div`
  width: 170px;
  height: 250px;
  border-radius: 16px;
  background: rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 600;
  flex-shrink: 0;
`;

const HeroInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const AverageBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const AverageText = styled.span`
  font-size: 18px;
  font-weight: 700;
`;

const Count = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const RateBox = styled.div`
  background: rgba(0, 104, 255, 0.05);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RateTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
`;

const RateHint = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
`;

const Overview = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #334155;
`;

const Empty = styled.div`
  padding: 22px;
  border-radius: 14px;
  background: rgba(226, 232, 240, 0.4);
  text-align: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 500;
`;

const ReviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ReviewItem = styled.article`
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ReviewHead = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const Reviewer = styled.span`
  font-weight: 700;
`;

const ReviewDate = styled.time`
  color: #94a3b8;
  font-size: 13px;
`;

const ReviewBody = styled.p`
  margin: 0;
  font-size: 14px;
  color: #334155;
  line-height: 1.6;
`;

export default MovieModal;
