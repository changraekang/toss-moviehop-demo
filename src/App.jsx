import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { ThemeProvider, createGlobalStyle } from "styled-components";
import Header from "./components/Header.jsx";
import AuthView from "./components/AuthView.jsx";
import LinkView from "./components/LinkView.jsx";
import MovieModal from "./components/MovieModal.jsx";
import QuizModal from "./components/QuizModal.jsx";
import StarRating from "./components/StarRating.jsx";
import { useAuth } from "./useAuth.js";
import {
  fetchMovies,
  fetchMyRating,
  submitRating,
  fetchQuizCompletion,
  naverLogin,
  verifyNaverLink,
} from "./api.js";
import {
  isNaverCallbackPath,
  readNaverCallback,
  clearNaverCallbackUrl,
  popPendingLinkCode,
} from "./naver.js";

const PAGE_SIZE = 24;
const RECENT_DAYS = 30; // 상영일 기준 1개월 이내 신작만

const theme = {
  colors: {
    background: "#0a0b0f",
    surface: "#15171e",
    surfaceAlt: "#1e212b",
    primary: "#4f8cff",
    primaryHover: "#6b9dff",
    text: "#f3f4f6",
    secondaryText: "#9aa3b2",
    border: "#2a2e3a",
    gold: "#ffc043",
    success: "#2dd4bf",
    error: "#ff5a6a",
    naver: "#03c75a",
  },
};

const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  #root { min-height: 100dvh; }
  img { display: block; }
  ::selection { background: ${theme.colors.primary}; color: #fff; }
`;

function App() {
  const { token, user, isLoggedIn, signIn, signOut } = useAuth();

  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); // 첫 페이지
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [view, setView] = useState("home"); // "home" | "auth" | "link"
  const [authMode, setAuthMode] = useState("login");
  const [authNotice, setAuthNotice] = useState(null);
  const [linkNotice, setLinkNotice] = useState(null);

  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [userRatings, setUserRatings] = useState({}); // { movieId: rating }
  const [ratingPendingId, setRatingPendingId] = useState(null);
  const [quizState, setQuizState] = useState(null); // { movieId, pendingRating }
  const [toast, setToast] = useState(null);

  // 비로그인 = 다른 유저가 별점 매긴 영화만, 로그인 = 전체
  const ratedOnly = !isLoggedIn;
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (pageToLoad, replace) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await fetchMovies({
          page: pageToLoad,
          limit: PAGE_SIZE,
          rated: ratedOnly,
          recentDays: RECENT_DAYS,
        });
        const list = Array.isArray(data?.movies) ? data.movies : [];
        setMovies((prev) => (replace ? list : [...prev, ...list]));
        setHasMore(Boolean(data?.hasMore));
        setTotal(data?.total ?? list.length);
        setPage(pageToLoad);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [ratedOnly]
  );

  // 로그인 상태(필터)가 바뀌면 목록 초기화 후 첫 페이지 로드
  useEffect(() => {
    setMovies([]);
    setHasMore(true);
    setPage(0);
    loadPage(0, true);
  }, [loadPage]);

  // 무한 스크롤: 바닥 센티넬이 보이면 다음 페이지
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (loading || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current && hasMore) {
          loadPage(page + 1, false);
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, hasMore, page, loadPage]);

  // 이메일 링크(?link=1)로 진입하면 연동 화면 표시
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("link") === "1") setView("link");
  }, []);

  // 네이버 콜백 처리 (implicit SDK 가 해시로 access_token 을 돌려줌, 최초 1회)
  useEffect(() => {
    if (!isNaverCallbackPath()) return;
    const cb = readNaverCallback();
    if (!cb) return;

    const cleanUrl = () =>
      window.history.replaceState({}, document.title, "/");

    (async () => {
      if (cb.error) {
        setAuthNotice(`네이버 로그인 실패: ${cb.errorDescription || cb.error}`);
        setView("auth");
        cleanUrl();
        return;
      }
      if (!cb.stateValid) {
        setAuthNotice("보안 검증에 실패했습니다. 다시 시도해 주세요.");
        setView("auth");
        cleanUrl();
        return;
      }

      const linkCode = popPendingLinkCode();
      try {
        if (linkCode) {
          const payload = await verifyNaverLink({
            code: linkCode,
            accessToken: cb.accessToken,
            tokenType: cb.tokenType,
          });
          signIn(payload.token, payload.user);
          setView("home");
          setToast("네이버 계정이 연동되었습니다.");
          return;
        }

        const payload = await naverLogin({
          accessToken: cb.accessToken,
          tokenType: cb.tokenType,
          state: cb.state,
        });
        if (payload.errorCode === 1001) {
          setAuthNotice("회원가입이 필요합니다.");
          setView("auth");
          return;
        }
        signIn(payload.token, payload.user);
        setView("home");
        setToast("네이버 계정으로 로그인되었습니다.");
      } catch (err) {
        if (linkCode) {
          setLinkNotice(`연동 실패: ${err.message}`);
          setView("link");
        } else {
          setAuthNotice(`네이버 로그인 실패: ${err.message}`);
          setView("auth");
        }
      } finally {
        cleanUrl();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모달을 연 영화 1개만 내 평점 조회 (대량 요청 방지)
  useEffect(() => {
    if (!token || !selectedMovieId) return;
    let ignore = false;
    (async () => {
      try {
        const data = await fetchMyRating(selectedMovieId, token);
        if (!ignore) {
          setUserRatings((prev) => ({
            ...prev,
            [selectedMovieId]: data?.rating ?? null,
          }));
        }
      } catch {
        /* 무시 */
      }
    })();
    return () => {
      ignore = true;
    };
  }, [token, selectedMovieId]);

  // 토스트 자동 숨김
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedMovie = useMemo(
    () => movies.find((m) => m._id === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  const goAuth = (mode = "login", notice = null) => {
    setAuthMode(mode);
    setAuthNotice(notice);
    setView("auth");
  };

  const handleAuthenticated = (nextToken, nextUser) => {
    signIn(nextToken, nextUser);
    setAuthNotice(null);
    setView("home");
    setToast("로그인되었습니다.");
  };

  const handleLogout = () => {
    signOut();
    setUserRatings({});
    setToast("로그아웃되었습니다.");
  };

  const doSubmitRating = useCallback(
    async (movieId, rating) => {
      setRatingPendingId(movieId);
      try {
        const payload = await submitRating(movieId, rating, token);
        setMovies((prev) =>
          prev.map((m) =>
            m._id === movieId
              ? {
                  ...m,
                  ratingAverage: payload?.stats?.average ?? m.ratingAverage,
                  ratingCount: payload?.stats?.count ?? m.ratingCount,
                }
              : m
          )
        );
        setUserRatings((prev) => ({
          ...prev,
          [movieId]: payload?.rating ?? rating,
        }));
        setToast("평점이 등록되었습니다.");
      } catch (err) {
        setToast(`평점 등록 실패: ${err.message}`);
      } finally {
        setRatingPendingId(null);
      }
    },
    [token]
  );

  const handleRateAttempt = useCallback(
    async (movieId, value) => {
      if (!isLoggedIn) {
        setSelectedMovieId(null);
        goAuth("login", "별점을 매기려면 로그인이 필요합니다.");
        return;
      }
      setRatingPendingId(movieId);
      try {
        const { completed } = await fetchQuizCompletion(movieId, token);
        if (completed) {
          await doSubmitRating(movieId, value);
        } else {
          setRatingPendingId(null);
          setQuizState({ movieId, pendingRating: value });
        }
      } catch (err) {
        setRatingPendingId(null);
        setToast(`퀴즈 확인 실패: ${err.message}`);
      }
    },
    [isLoggedIn, token, doSubmitRating]
  );

  const handleQuizSolved = async () => {
    const pending = quizState;
    setQuizState(null);
    if (pending) {
      await doSubmitRating(pending.movieId, pending.pendingRating);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Header
        user={user}
        isLoggedIn={isLoggedIn}
        onHome={() => setView("home")}
        onLogin={() => goAuth("login")}
        onLogout={handleLogout}
      />

      <Shell>
        {toast && <Toast>{toast}</Toast>}

        {view === "auth" && (
          <AuthView
            mode={authMode}
            onModeChange={setAuthMode}
            onAuthenticated={handleAuthenticated}
            notice={authNotice}
          />
        )}

        {view === "link" && <LinkView notice={linkNotice} />}

        {view === "home" && (
          <Main>
            <Hero>
              <HeroEyebrow>MOVIE QUIZ · 진짜 본 사람만</HeroEyebrow>
              <HeroTitle>진짜 본 사람만 별점을 남깁니다</HeroTitle>
              <HeroSub>
                {isLoggedIn
                  ? "별점을 매기려면 그 영화 퀴즈를 맞혀야 해요. (예: 쇼생크 탈출 — 앤디 듀프레인의 원래 직업은?)"
                  : "영화를 진짜 본 사람만 남긴 별점이에요. 로그인하면 퀴즈를 풀고 직접 평가할 수 있어요."}
              </HeroSub>
            </Hero>

            {loading && <Placeholder>영화를 불러오는 중입니다…</Placeholder>}
            {error && !loading && <Placeholder $error>{error}</Placeholder>}
            {!loading && !error && movies.length === 0 && (
              <Placeholder>표시할 영화가 없습니다.</Placeholder>
            )}

            {!loading && !error && movies.length > 0 && (
              <>
                <CountText>최근 개봉작 {total}편</CountText>
                <Grid>
                  {movies.map((movie) => (
                    <Card
                      key={movie._id}
                      onClick={() => setSelectedMovieId(movie._id)}
                    >
                      <PosterWrap>
                        {movie.posterUrl ? (
                          <Poster
                            src={movie.posterUrl}
                            alt={`${movie.title} 포스터`}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <PosterFallback>포스터 없음</PosterFallback>
                        )}
                        <RatingBadge>
                          <span>★</span>
                          {formatAverage(movie.ratingAverage)}
                        </RatingBadge>
                      </PosterWrap>
                      <CardBody>
                        <CardTitle>{movie.title}</CardTitle>
                        <CardMeta>
                          {formatYear(movie.releaseDate)} · 평가{" "}
                          {movie.ratingCount ?? 0}
                        </CardMeta>
                      </CardBody>
                    </Card>
                  ))}
                </Grid>

                {hasMore && <Sentinel ref={sentinelRef} />}
                {loadingMore && <LoadMore>더 불러오는 중…</LoadMore>}
                {!hasMore && <LoadMore>마지막입니다 ✦</LoadMore>}
              </>
            )}
          </Main>
        )}
      </Shell>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          isLoggedIn={isLoggedIn}
          myRating={userRatings[selectedMovie._id] ?? null}
          ratingPending={ratingPendingId === selectedMovie._id}
          onRateAttempt={(value) =>
            handleRateAttempt(selectedMovie._id, value)
          }
          onClose={() => setSelectedMovieId(null)}
        />
      )}

      {quizState && (
        <QuizModal
          movieId={quizState.movieId}
          movieTitle={
            movies.find((m) => m._id === quizState.movieId)?.title ?? ""
          }
          token={token}
          onClose={() => setQuizState(null)}
          onSolved={handleQuizSolved}
        />
      )}
    </ThemeProvider>
  );
}

function formatYear(value) {
  if (!value) return "연도 미상";
  const y = new Date(value).getFullYear();
  return Number.isNaN(y) ? "연도 미상" : `${y}`;
}

function formatAverage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.0";
  return value.toFixed(1);
}

const Shell = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px calc(40px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 22px;

  @media (min-width: 768px) {
    padding: 28px 24px 64px;
  }
`;

const Toast = styled.div`
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  z-index: 3000;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  max-width: calc(100vw - 32px);
`;

const Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Hero = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 20px;
  border-radius: 18px;
  background: radial-gradient(
      120% 140% at 0% 0%,
      rgba(79, 140, 255, 0.18),
      transparent 60%
    ),
    ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};

  @media (min-width: 768px) {
    padding: 28px 32px;
  }
`;

const HeroEyebrow = styled.span`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.primary};
`;

const HeroTitle = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;

  @media (min-width: 768px) {
    font-size: 34px;
  }
`;

const HeroSub = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.secondaryText};

  @media (min-width: 768px) {
    font-size: 15px;
  }
`;

const CountText = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Placeholder = styled.div`
  padding: 56px 16px;
  text-align: center;
  font-weight: 500;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.error : theme.colors.secondaryText};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px 12px;

  @media (min-width: 560px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 22px 16px;
  }
  @media (min-width: 900px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const PosterWrap = styled.div`
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  aspect-ratio: 2 / 3;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
`;

const Card = styled.button`
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  cursor: pointer;
  transition: transform 0.18s ease;

  &:active {
    transform: scale(0.97);
  }
  @media (hover: hover) {
    &:hover ${PosterWrap} {
      box-shadow: 0 14px 34px rgba(79, 140, 255, 0.25);
    }
  }
`;

const Poster = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PosterFallback = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 600;
  font-size: 13px;
`;

const RatingBadge = styled.div`
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  background: rgba(10, 11, 15, 0.72);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  span {
    color: ${({ theme }) => theme.colors.gold};
  }
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 2px;
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text};
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardMeta = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Sentinel = styled.div`
  height: 1px;
`;

const LoadMore = styled.div`
  text-align: center;
  padding: 18px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

export default App;
