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
const RECENT_DAYS = 30; // 신작 탭: 최근 N일 개봉

const theme = {
  colors: {
    background: "#faf1dc", // 크림 배경
    surface: "#ffffff", // 카드(흰색)
    surfaceAlt: "#fbeacb", // 입력/보조 표면(연한 크림)
    primary: "#6b4a26", // 다크브라운 포인트
    primaryHover: "#543a1e",
    text: "#3a2a18", // 본문(짙은 브라운)
    secondaryText: "#9a7e58", // 보조 텍스트
    border: "#e6d2a8", // 탄 보더
    gold: "#c98a2e", // 별점 앰버
    success: "#2e9e73",
    error: "#c0392b",
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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [view, setView] = useState("home"); // "home" | "auth" | "link"
  const [homeTab, setHomeTab] = useState("movies"); // "movies" | "new"
  const [authMode, setAuthMode] = useState("login");
  const [authNotice, setAuthNotice] = useState(null);
  const [linkNotice, setLinkNotice] = useState(null);

  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [userRatings, setUserRatings] = useState({});
  const [ratingPendingId, setRatingPendingId] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [toast, setToast] = useState(null);

  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (pageToLoad, replace) => {
      if (!isLoggedIn) return; // 비로그인은 목록을 불러오지 않음(로그인 게이트)
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = { page: pageToLoad, limit: PAGE_SIZE };
        if (homeTab === "new") params.recentDays = RECENT_DAYS; // 신작 탭
        else params.onlyWithQuiz = true; // 퀴즈 영화 탭
        const data = await fetchMovies(params);
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
    [isLoggedIn, homeTab]
  );

  // 로그인 상태/탭이 바뀌면 목록 초기화 후 첫 페이지
  useEffect(() => {
    setMovies([]);
    setHasMore(true);
    setPage(0);
    if (isLoggedIn) loadPage(0, true);
    else setLoading(false);
  }, [loadPage, isLoggedIn]);

  // 무한 스크롤
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!isLoggedIn || loading || !hasMore) return;
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
  }, [isLoggedIn, loading, hasMore, page, loadPage]);

  // 이메일 링크(?link=1) 진입 → 연동 화면
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("link") === "1") setView("link");
  }, []);

  // 네이버 콜백 처리 (해시 access_token, 최초 1회)
  useEffect(() => {
    if (!isNaverCallbackPath()) return;
    const cb = readNaverCallback();
    if (!cb) return;
    const cleanUrl = () =>
      window.history.replaceState({}, document.title, "/");

    (async () => {
      if (cb.error) {
        setAuthNotice(`네이버 로그인 실패: ${cb.errorDescription || cb.error}`);
        setView("home");
        cleanUrl();
        return;
      }
      if (!cb.stateValid) {
        setAuthNotice("보안 검증에 실패했습니다. 다시 시도해 주세요.");
        setView("home");
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
          setView("home");
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
          setView("home");
        }
      } finally {
        cleanUrl();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모달 연 영화 1개만 내 평점 조회
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

  const handleAuthenticated = (nextToken, nextUser) => {
    signIn(nextToken, nextUser);
    setAuthNotice(null);
    setView("home");
    setToast("로그인되었습니다.");
  };

  const handleLogout = () => {
    signOut();
    setUserRatings({});
    setMovies([]);
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
    if (pending) await doSubmitRating(pending.movieId, pending.pendingRating);
  };

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Header
        user={user}
        isLoggedIn={isLoggedIn}
        onHome={() => setView("home")}
        onLogin={() => setView("home")}
        onLogout={handleLogout}
      />

      <Shell>
        {toast && <Toast>{toast}</Toast>}

        {view === "link" && <LinkView notice={linkNotice} />}

        {view === "home" && !isLoggedIn && (
          <GuestArea>
            <GuestHero>
              <HeroEyebrow>MOVIE QUIZ · 진짜 본 사람만</HeroEyebrow>
              <HeroTitle>진짜 본 사람만 별점을 남깁니다</HeroTitle>
              <HeroSub>
                로그인하고 영화 퀴즈를 맞히면 별점을 남길 수 있어요.
              </HeroSub>
            </GuestHero>
            <AuthView
              mode={authMode}
              onModeChange={setAuthMode}
              onAuthenticated={handleAuthenticated}
              notice={authNotice}
            />
          </GuestArea>
        )}

        {view === "home" && isLoggedIn && (
          <Main>
            <Tabs role="tablist">
              <Tab
                type="button"
                $active={homeTab === "movies"}
                onClick={() => setHomeTab("movies")}
              >
                퀴즈 영화
              </Tab>
              <Tab
                type="button"
                $active={homeTab === "new"}
                onClick={() => setHomeTab("new")}
              >
                신작
              </Tab>
            </Tabs>

            {loading && <Placeholder>영화를 불러오는 중입니다…</Placeholder>}
            {error && !loading && <Placeholder $error>{error}</Placeholder>}
            {!loading && !error && movies.length === 0 && (
              <Placeholder>
                {homeTab === "new"
                  ? "최근 개봉작이 아직 없어요."
                  : "퀴즈가 등록된 영화가 아직 없어요."}
              </Placeholder>
            )}

            {!loading && !error && movies.length > 0 && (
              <>
                <CountText>
                  {homeTab === "new" ? "신작" : "퀴즈 영화"} {total}편
                </CountText>
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
  gap: 18px;

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
  box-shadow: 0 12px 28px rgba(104, 71, 37, 0.16);
  max-width: calc(100vw - 32px);
`;

const GuestArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding-top: 12px;

  @media (min-width: 768px) {
    min-height: calc(100dvh - 200px);
    justify-content: center;
    padding-top: 0;
  }
`;

const GuestHero = styled.section`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 460px;
`;

const HeroEyebrow = styled.span`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.primary};
`;

const HeroTitle = styled.h1`
  margin: 0;
  font-size: 26px;
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
`;

const Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  padding: 5px;
  width: fit-content;
`;

const Tab = styled.button`
  border: none;
  border-radius: 999px;
  padding: 9px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $active, theme }) =>
    $active ? "#fff" : theme.colors.secondaryText};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : "transparent"};
  transition: background 0.15s ease, color 0.15s ease;
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
  box-shadow: 0 8px 22px rgba(104, 71, 37, 0.16);
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
      box-shadow: 0 12px 28px rgba(107, 74, 38, 0.22);
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
