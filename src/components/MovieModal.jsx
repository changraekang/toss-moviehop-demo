import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

const modalRoot =
  typeof document !== "undefined"
    ? document.getElementById("modal-root") ?? document.body
    : null;

function MovieModal({
  apiBaseUrl,
  movie,
  movieId,
  onClose,
  onSubmitRating,
  token,
}) {
  const [details, setDetails] = useState(movie ?? null);
  const [reviews, setReviews] = useState([]);
  const [ratingStats, setRatingStats] = useState({
    average: movie?.ratingAverage ?? 0,
    count: movie?.ratingCount ?? 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ratingValue, setRatingValue] = useState(movie?.ratingAverage ?? 0);
  const [ratingFeedback, setRatingFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setDetails(movie ?? null);
    setRatingStats({
      average: movie?.ratingAverage ?? 0,
      count: movie?.ratingCount ?? 0,
    });
    setRatingValue(movie?.ratingAverage ?? 0);
  }, [movie, movieId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!movieId || !apiBaseUrl) return;
    let ignore = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [detailRes, reviewRes, ratingRes] = await Promise.all([
          fetch(`${apiBaseUrl}/movies/${movieId}`),
          fetch(`${apiBaseUrl}/review/movie/${movieId}`),
          fetch(`${apiBaseUrl}/ratings/movie/${movieId}`),
        ]);

        if (!ignore) {
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setDetails(detailData);
          } else if (!details) {
            const detailPayload = await detailRes.json().catch(() => ({}));
            throw new Error(
              detailPayload?.error ?? "영화 상세 정보를 불러오지 못했습니다.",
            );
          }

          if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            setReviews(reviewData);
          } else {
            setReviews([]);
          }

          if (ratingRes.ok) {
            const ratingData = await ratingRes.json();
            setRatingStats({
              average: ratingData?.average ?? 0,
              count: ratingData?.count ?? 0,
            });
            if (typeof ratingData?.average === "number") {
              setRatingValue(ratingData.average);
            }
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message ?? "상세 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, movieId]);

  const fallbackPoster = useMemo(
    () => details?.posterUrl ?? movie?.posterUrl ?? "",
    [details, movie],
  );

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSubmitRating = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setRatingFeedback(null);
    setSubmitting(true);

    try {
      const numericValue = Number(ratingValue);
      const payload = await onSubmitRating(movieId, numericValue);
      if (payload?.stats) {
        setRatingStats((prev) => ({
          average: payload.stats.average ?? numericValue,
          count: payload.stats.count ?? prev.count,
        }));
        if (typeof payload.stats.average === "number") {
          setRatingValue(payload.stats.average);
        }
      }
      setRatingFeedback({
        tone: "success",
        text: "평점이 저장되었습니다.",
      });
    } catch (submitError) {
      setRatingFeedback({
        tone: "error",
        text:
          submitError?.message ??
          "평점 업데이트 중 문제가 발생했습니다. 토큰 또는 네트워크를 확인하세요.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!modalRoot) return null;

  return createPortal(
    <Overlay onClick={handleOverlayClick}>
      <Dialog role="dialog" aria-modal="true">
        <ModalHeader>
          <div>
            <ModalTitle>{details?.title ?? "제목 미확인"}</ModalTitle>
            <ModalSubtitle>
              {formatYear(details?.releaseDate)} ·{" "}
              {details?.genres?.join(", ") ?? "장르 정보 없음"}
            </ModalSubtitle>
          </div>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            ✕
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          {loading && <StateMessage>불러오는 중입니다…</StateMessage>}
          {error && !loading && <StateMessage error>{error}</StateMessage>}
          {!loading && !error && (
            <>
              <HeroSection>
                {fallbackPoster ? (
                  <ModalPoster src={fallbackPoster} alt="영화 포스터" />
                ) : (
                  <PosterPlaceholder>포스터 없음</PosterPlaceholder>
                )}

                <HeroInfo>
                  <InfoList>
                    <InfoRow>
                      <InfoKey>개봉</InfoKey>
                      <InfoValue>{formatDate(details?.releaseDate)}</InfoValue>
                    </InfoRow>
                    <InfoRow>
                      <InfoKey>평점</InfoKey>
                      <InfoValue>
                        ⭐ {formatAverage(ratingStats.average)} ·{" "}
                        {ratingStats.count}명
                      </InfoValue>
                    </InfoRow>
                    {details?.runtime ? (
                      <InfoRow>
                        <InfoKey>러닝타임</InfoKey>
                        <InfoValue>{details.runtime}분</InfoValue>
                      </InfoRow>
                    ) : null}
                    {details?.director ? (
                      <InfoRow>
                        <InfoKey>감독</InfoKey>
                        <InfoValue>{details.director}</InfoValue>
                      </InfoRow>
                    ) : null}
                  </InfoList>

                  <RatingSection onSubmit={handleSubmitRating}>
                    <RatingHeader>평점 업데이트</RatingHeader>
                    <RatingControl>
                      <RatingLabel htmlFor="rating-range">
                        ⭐ {formatAverage(ratingValue)}
                      </RatingLabel>
                      <RatingRange
                        id="rating-range"
                        min="0"
                        max="5"
                        step="0.1"
                        value={ratingValue}
                        onChange={(event) =>
                          setRatingValue(Number(event.target.value))
                        }
                      />
                    </RatingControl>
                    <RatingButton type="submit" disabled={submitting}>
                      {submitting ? "저장 중…" : "평점 저장"}
                    </RatingButton>
                    {!token && (
                      <HintText>
                        * 평점을 저장하려면 상단에 JWT 토큰을 입력해야 합니다.
                      </HintText>
                    )}
                    {ratingFeedback && (
                      <HintText tone={ratingFeedback.tone}>
                        {ratingFeedback.text}
                      </HintText>
                    )}
                  </RatingSection>
                </HeroInfo>
              </HeroSection>

              <OverviewSection>
                <SectionTitle>줄거리</SectionTitle>
                <OverviewText>
                  {details?.overview ?? "등록된 줄거리 정보가 없습니다."}
                </OverviewText>
              </OverviewSection>

              <ReviewSection>
                <SectionTitle>리뷰</SectionTitle>
                {reviews.length === 0 ? (
                  <EmptyReview>아직 등록된 리뷰가 없습니다.</EmptyReview>
                ) : (
                  <ReviewList>
                    {reviews.map((review) => (
                      <ReviewItem key={review._id ?? review.createdAt}>
                        <ReviewHeader>
                          <ReviewerName>
                            {review.username ?? "익명 사용자"}
                          </ReviewerName>
                          <ReviewDate>
                            {formatDate(review.createdAt)}
                          </ReviewDate>
                        </ReviewHeader>
                        <ReviewContent>{review.content}</ReviewContent>
                      </ReviewItem>
                    ))}
                  </ReviewList>
                )}
              </ReviewSection>
            </>
          )}
        </ModalBody>
      </Dialog>
    </Overlay>,
    modalRoot,
  );
}

function formatYear(value) {
  if (!value) return "연도 정보 없음";
  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? "연도 정보 없음" : `${year}년`;
}

function formatDate(value) {
  if (!value) return "정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "정보 없음";
  }
  return date.toLocaleDateString("ko-KR");
}

function formatAverage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.0";
  return Number(value).toFixed(1);
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
  width: min(860px, 100%);
  background: #ffffff;
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.2);
  max-height: calc(100vh - 80px);
  overflow-y: auto;

  @media (max-width: 640px) {
    padding: 24px 20px;
    border-radius: 20px;
  }
`;

const ModalHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 28px;
  font-weight: 700;
`;

const ModalSubtitle = styled.p`
  margin: 6px 0 0;
  color: #64748b;
  font-size: 15px;
`;

const CloseButton = styled.button`
  border: none;
  background: rgba(148, 163, 184, 0.16);
  color: #1f2937;
  border-radius: 999px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(100, 116, 139, 0.22);
  }
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
`;

const StateMessage = styled.div`
  text-align: center;
  padding: 60px 0;
  color: ${({ error }) => (error ? "#ef4444" : "#475569")};
  font-weight: 500;
`;

const HeroSection = styled.section`
  display: flex;
  gap: 24px;
  align-items: flex-start;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ModalPoster = styled.img`
  width: 180px;
  border-radius: 18px;
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.22);
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 100%;
    max-width: 280px;
    align-self: center;
  }
`;

const PosterPlaceholder = styled.div`
  width: 180px;
  height: 270px;
  border-radius: 18px;
  background: rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-weight: 600;
`;

const HeroInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
`;

const InfoList = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(100px, 140px) 1fr;
  gap: 10px 16px;
`;

const InfoRow = styled.div`
  display: contents;
`;

const InfoKey = styled.dt`
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
`;

const InfoValue = styled.dd`
  margin: 0;
  font-size: 15px;
  color: #1f2937;
  font-weight: 500;
`;

const RatingSection = styled.form`
  background: rgba(37, 99, 235, 0.06);
  border-radius: 18px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RatingHeader = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
`;

const RatingControl = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const RatingLabel = styled.span`
  font-size: 18px;
  font-weight: 700;
`;

const RatingRange = styled.input`
  flex: 1;
  accent-color: #2563eb;
`;

const RatingButton = styled.button`
  border: none;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: #1d4ed8;
  }

  &:disabled {
    background: rgba(37, 99, 235, 0.5);
    cursor: not-allowed;
  }
`;

const HintText = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ tone }) =>
    tone === "success"
      ? "#0ea5e9"
      : tone === "error"
        ? "#ef4444"
        : "#64748b"};
`;

const OverviewSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
`;

const OverviewText = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #334155;
`;

const ReviewSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const EmptyReview = styled.div`
  padding: 24px;
  border-radius: 14px;
  background: rgba(226, 232, 240, 0.4);
  text-align: center;
  color: #64748b;
  font-weight: 500;
`;

const ReviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ReviewItem = styled.article`
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
`;

const ReviewHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const ReviewerName = styled.span`
  font-weight: 700;
  color: #1f2937;
`;

const ReviewDate = styled.time`
  color: #94a3b8;
  font-size: 13px;
`;

const ReviewContent = styled.p`
  margin: 0;
  font-size: 14px;
  color: #334155;
  line-height: 1.6;
`;

export default MovieModal;

