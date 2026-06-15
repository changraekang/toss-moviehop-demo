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
    background: "#f7f8fa",
    surface: "#ffffff",
    primary: "#0068ff",
    text: "#1f2a37",
    secondaryText: "#6b7280",
    border: "#e5e7eb",
    success: "#0ea5e9",
    error: "#ef4444",
  },
};

const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  #root { min-height: 100vh; }
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
      <Shell>
        <Header
          user={user}
          isLoggedIn={isLoggedIn}
          onHome={() => setView("home")}
          onLogin={() => goAuth("login")}
          onLogout={handleLogout}
        />

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
                <CountText>총 {total}편</CountText>
                <Grid>
                  {movies.map((movie) => (
                    <Card
                      key={movie._id}
                      onClick={() => setSelectedMovieId(movie._id)}
                    >
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
                      <CardBody>
                        <CardTitle>{movie.title}</CardTitle>
                        <CardMeta>{formatYear(movie.releaseDate)}</CardMeta>
                        <CardRating>
                          <StarRating
                            value={movie.ratingAverage ?? 0}
                            readOnly
                            size={16}
                          />
                          <RatingNum>
                            {formatAverage(movie.ratingAverage)}
                            <RatingCount>
                              ({movie.ratingCount ?? 0})
                            </RatingCount>
                          </RatingNum>
                        </CardRating>
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
  if (!value) return "연도 정보 없음";
  const y = new Date(value).getFullYear();
  return Number.isNaN(y) ? "연도 정보 없음" : `${y}년`;
}

function formatAverage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.0";
  return value.toFixed(1);
}

const Shell = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px 24px 64px;
  display: flex;
  flex-direction: column;
  gap: 28px;

  @media (max-width: 640px) {
    padding: 20px 16px 48px;
  }
`;

const Toast = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.colors.text};
  color: #fff;
  padding: 12px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
`;

const Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Hero = styled.section`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const HeroTitle = styled.h1`
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const HeroSub = styled.p`
  margin: 0;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const CountText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Placeholder = styled.div`
  padding: 64px 16px;
  text-align: center;
  font-weight: 500;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.error : theme.colors.secondaryText};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;

  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 14px;
  }
`;

const Card = styled.button`
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  cursor: pointer;
`;

const Poster = styled.img`
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 14px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  background: #e2e8f0;
  transition: transform 0.2s ease;

  ${Card}:hover & {
    transform: translateY(-4px);
  }
`;

const PosterFallback = styled.div`
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 14px;
  background: rgba(226, 232, 240, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 600;
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardMeta = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const CardRating = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
`;

const RatingNum = styled.span`
  font-size: 13px;
  font-weight: 700;
`;

const RatingCount = styled.span`
  font-weight: 400;
  color: ${({ theme }) => theme.colors.secondaryText};
  margin-left: 2px;
`;

const Sentinel = styled.div`
  height: 1px;
`;

const LoadMore = styled.div`
  text-align: center;
  padding: 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

export default App;
