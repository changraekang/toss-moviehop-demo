import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { ThemeProvider, createGlobalStyle, keyframes } from "styled-components";
import Header from "./components/Header.jsx";
import AuthView from "./components/AuthView.jsx";
import LinkView from "./components/LinkView.jsx";
import MovieModal from "./components/MovieModal.jsx";
import QuizModal from "./components/QuizModal.jsx";
import QuizSubmitModal from "./components/QuizSubmitModal.jsx";
import StarRating from "./components/StarRating.jsx";
import StarSlider, { scoreColor } from "./components/StarSlider.jsx";
import { formatAudience } from "./format.js";
import { useAuth } from "./useAuth.js";
import {
  fetchMovies,
  fetchMyRating,
  fetchMyRatings,
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
const CURRENT_YEAR = new Date().getFullYear(); // 당해년도 탭
const HIT_AUDIENCE = 5_000_000; // 흥행작 탭: 관객수 하한
const TAB_LABEL = {
  movies: "영화 목록",
  new: "신작",
  year: String(CURRENT_YEAR),
  hit: "흥행작 500만+",
  indie: "독립영화",
  boxoffice: "박스오피스",
  mine: "내 평점",
};

const theme = {
  colors: {
    background: "#f2f4f6", // TDS grey100 (앱 배경)
    surface: "#ffffff", // 카드(흰색)
    surfaceAlt: "#f2f4f6", // 입력/보조 표면(grey100)
    primary: "#3182f6", // Toss Blue
    primaryHover: "#2272eb",
    text: "#191f28", // grey900
    secondaryText: "#6b7684", // grey600
    border: "#e5e8eb", // grey200
    gold: "#ffb331", // 별점 앰버 = TDS yellow600
    success: "#15c47e", // toss green
    error: "#f04452", // toss red
    naver: "#03c75a",
  },
};

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: "Paperlogy";
    src: url("/fonts/Paperlogy-Regular.woff2") format("woff2");
    font-weight: 400;
    font-display: swap;
  }
  @font-face {
    font-family: "Paperlogy";
    src: url("/fonts/Paperlogy-Medium.woff2") format("woff2");
    font-weight: 500;
    font-display: swap;
  }
  @font-face {
    font-family: "Paperlogy";
    src: url("/fonts/Paperlogy-SemiBold.woff2") format("woff2");
    font-weight: 600;
    font-display: swap;
  }
  @font-face {
    font-family: "Paperlogy";
    src: url("/fonts/Paperlogy-Bold.woff2") format("woff2");
    font-weight: 700;
    font-display: swap;
  }
  @font-face {
    font-family: "Paperlogy";
    src: url("/fonts/Paperlogy-ExtraBold.woff2") format("woff2");
    font-weight: 800;
    font-display: swap;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: "Paperlogy", "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    overflow-x: hidden;
  }
  html { overflow-x: hidden; }
  #root { min-height: 100dvh; overflow-x: hidden; width: 100%; }
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
  const [authNotice, setAuthNotice] = useState(null);
  const [linkNotice, setLinkNotice] = useState(null);

  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [userRatings, setUserRatings] = useState({});
  const [completions, setCompletions] = useState({}); // { movieId: bool }
  const [ratedIds, setRatedIds] = useState(() => new Set()); // 평점 준 movieId(브라우즈 숨김)
  const [ratingPendingId, setRatingPendingId] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [quizSubmitMovie, setQuizSubmitMovie] = useState(null); // 퀴즈 직접 올리기
  const [toast, setToast] = useState(null);

  const loadingRef = useRef(false);
  const seedRef = useRef(Math.random()); // 세션별 랜덤 정렬 시드

  const loadPage = useCallback(
    async (pageToLoad, replace) => {
      if (!isLoggedIn) return; // 비로그인은 목록을 불러오지 않음(로그인 게이트)
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        if (homeTab === "mine") {
          const data = await fetchMyRatings(token);
          const list = Array.isArray(data?.movies) ? data.movies : [];
          setMovies(list);
          setHasMore(false);
          setTotal(data?.total ?? list.length);
          setPage(0);
          setError(null);
          return;
        }
        const params = { page: pageToLoad, limit: PAGE_SIZE };
        if (homeTab === "movies") {
          params.onlyWithQuiz = true; // 영화 목록: 퀴즈 있는 영화만
        } else {
          params.quizFlag = true; // 그 외 탭: 퀴즈 보유여부(hasQuiz)만 표시
          if (homeTab === "new") params.recentDays = RECENT_DAYS; // 신작
          else if (homeTab === "year") params.year = CURRENT_YEAR; // 당해년도
          else if (homeTab === "hit") params.minAudience = HIT_AUDIENCE; // 흥행작
          else if (homeTab === "indie") params.independent = true; // 독립영화
          else if (homeTab === "boxoffice") params.boxOffice = true; // 박스오피스(데이터 추후)
        }
        if (homeTab !== "new") params.seed = seedRef.current; // 세션 랜덤(신작 제외)
        if (user?.id) params.userId = user.id; // 각 영화 문제 완료여부(hasCompleted)
        const data = await fetchMovies(params);
        const list = Array.isArray(data?.movies) ? data.movies : [];
        setMovies((prev) => (replace ? list : [...prev, ...list]));
        setCompletions((prev) => {
          const next = replace ? {} : { ...prev };
          for (const m of list) if (m.hasCompleted) next[m._id] = true;
          return next;
        });
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
    [isLoggedIn, homeTab, user, token]
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

  // 모달 연 영화 1개만: 내 평점 + 문제 완료여부 조회
  useEffect(() => {
    if (!token || !selectedMovieId) return;
    let ignore = false;
    (async () => {
      const [rating, comp] = await Promise.all([
        fetchMyRating(selectedMovieId, token).catch(() => null),
        fetchQuizCompletion(selectedMovieId, token).catch(() => ({ completed: false })),
      ]);
      if (!ignore) {
        setUserRatings((prev) => ({
          ...prev,
          [selectedMovieId]: rating?.rating ?? null,
        }));
        setCompletions((prev) => ({
          ...prev,
          [selectedMovieId]: Boolean(comp?.completed),
        }));
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

  // 로그인하면 내 평점 영화 id 세트를 받아 브라우즈 목록에서 숨김
  useEffect(() => {
    if (!isLoggedIn || !token) {
      setRatedIds(new Set());
      return;
    }
    let ignore = false;
    fetchMyRatings(token)
      .then((data) => {
        if (ignore) return;
        const list = Array.isArray(data?.movies) ? data.movies : [];
        setRatedIds(new Set(list.map((m) => m._id)));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [isLoggedIn, token]);

  const selectedMovie = useMemo(
    () => movies.find((m) => m._id === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  // 브라우즈 탭에서는 이미 평점 준 영화 숨김(내 평점 탭은 그대로)
  const visibleMovies = useMemo(
    () =>
      homeTab === "mine" ? movies : movies.filter((m) => !ratedIds.has(m._id)),
    [movies, ratedIds, homeTab]
  );

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
                  myRating: payload?.rating ?? rating,
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
        setRatedIds((prev) => new Set(prev).add(movieId));
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
        setToast(`문제 확인 실패: ${err.message}`);
      }
    },
    [isLoggedIn, token, doSubmitRating]
  );

  const handleQuizSolved = async () => {
    const pending = quizState;
    setQuizState(null);
    if (!pending) return;
    setCompletions((prev) => ({ ...prev, [pending.movieId]: true }));
    if (pending.pendingRating != null) {
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
        onLogin={() => setView("home")}
        onLogout={handleLogout}
        onMyRatings={
          isLoggedIn && view === "home" ? () => setHomeTab("mine") : undefined
        }
        myActive={homeTab === "mine"}
      />

      <Shell>
        {toast && <Toast>{toast}</Toast>}

        {view === "link" && <LinkView notice={linkNotice} />}

        {view === "home" && !isLoggedIn && (
          <GuestArea>
            <GuestHero>
              <HeroEyebrow>MOVIE-HOP · 진짜 본 사람만</HeroEyebrow>
              <HeroTitle>진짜 본 사람만 별점을 남깁니다</HeroTitle>
              <HeroSub>
                로그인하고 영화 문제를 맞히면 별점을 남길 수 있어요.
              </HeroSub>
            </GuestHero>
            <AuthView notice={authNotice} />
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
                영화 목록
              </Tab>
              <Tab
                type="button"
                $active={homeTab === "new"}
                onClick={() => setHomeTab("new")}
              >
                신작
              </Tab>
              <Tab
                type="button"
                $active={homeTab === "year"}
                onClick={() => setHomeTab("year")}
              >
                {String(CURRENT_YEAR)}
              </Tab>
              <Tab
                type="button"
                $active={homeTab === "hit"}
                onClick={() => setHomeTab("hit")}
              >
                흥행작
              </Tab>
              <Tab
                type="button"
                $active={homeTab === "indie"}
                onClick={() => setHomeTab("indie")}
              >
                독립영화
              </Tab>
              <Tab
                type="button"
                $active={homeTab === "boxoffice"}
                onClick={() => setHomeTab("boxoffice")}
              >
                박스오피스
              </Tab>
              <Tab
                type="button"
                $desktopOnly
                $active={homeTab === "mine"}
                onClick={() => setHomeTab("mine")}
              >
                내 평점
              </Tab>
            </Tabs>

            {loading && <SkeletonList />}
            {error && !loading && <Placeholder $error>{error}</Placeholder>}
            {!loading && !error && movies.length === 0 && (
              <Placeholder>
                {homeTab === "new"
                  ? "최근 개봉작이 아직 없어요."
                  : homeTab === "mine"
                  ? "아직 평점을 준 영화가 없어요."
                  : `${TAB_LABEL[homeTab]} 목록이 아직 없어요.`}
              </Placeholder>
            )}

            {!loading && !error && movies.length > 0 && (
              <>
                <Grid>
                  {visibleMovies.map((movie) => (
                    <Card key={movie._id}>
                      <PosterArea
                        type="button"
                        onClick={() => setSelectedMovieId(movie._id)}
                        aria-label={`${movie.title} 정보 보기`}
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
                        </PosterWrap>
                      </PosterArea>
                      <CardBody>
                        <Info
                          type="button"
                          onClick={() => setSelectedMovieId(movie._id)}
                        >
                          <CardTitle>{movie.title}</CardTitle>
                          <CardMeta>
                            {formatYear(movie.releaseDate)}
                            {formatAudience(movie.audience)
                              ? ` · 관객 ${formatAudience(movie.audience)}`
                              : ""}
                          </CardMeta>
                          <CardRate>
                            ★ {formatAverage(movie.ratingAverage)} (
                            {movie.ratingCount ?? 0})
                          </CardRate>
                        </Info>
                        <RateRow>
                          {homeTab === "mine" ? (
                            <StarSlider
                              value={movie.myRating ?? 0}
                              onCommit={(v) => handleRateAttempt(movie._id, v)}
                              disabled={ratingPendingId === movie._id}
                              hideScore
                              size={24}
                            />
                          ) : (
                            <StarSlider
                              value={0}
                              onCommit={(v) => handleRateAttempt(movie._id, v)}
                              disabled={ratingPendingId === movie._id}
                              locked={!completions[movie._id]}
                              onUnlock={() =>
                                movie.hasQuiz === false
                                  ? setQuizSubmitMovie(movie)
                                  : setQuizState({
                                      movieId: movie._id,
                                      pendingRating: null,
                                    })
                              }
                              hideScore
                              size={24}
                            />
                          )}
                        </RateRow>
                      </CardBody>
                      {homeTab === "mine" ? (
                        <ScoreBadge $val={movie.myRating ?? 0} $locked={false}>
                          {(movie.myRating ?? 0).toFixed(1)}
                        </ScoreBadge>
                      ) : (
                        <ScoreBadge $val={movie.ratingAverage ?? 0} $locked={false}>
                          {formatAverage(movie.ratingAverage)}
                        </ScoreBadge>
                      )}
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
          quizCompleted={completions[selectedMovie._id] ?? false}
          ratingPending={ratingPendingId === selectedMovie._id}
          onRateAttempt={(value) =>
            handleRateAttempt(selectedMovie._id, value)
          }
          onStartQuiz={() =>
            selectedMovie.hasQuiz === false
              ? setQuizSubmitMovie(selectedMovie)
              : setQuizState({ movieId: selectedMovie._id, pendingRating: null })
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

      {quizSubmitMovie && (
        <QuizSubmitModal
          movieId={quizSubmitMovie._id}
          movieTitle={quizSubmitMovie.title}
          token={token}
          onClose={() => setQuizSubmitMovie(null)}
          onSubmitted={() => setToast("퀴즈를 제출했어요. 검토 후 등록됩니다.")}
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

const Shell = styled.div.attrs({ className: "Shell" })`
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

const Toast = styled.div.attrs({ className: "Toast" })`
  position: fixed;
  top: 42%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border: none;
  padding: 16px 26px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  z-index: 3000;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
  max-width: calc(100vw - 48px);
`;

const GuestArea = styled.div.attrs({ className: "GuestArea" })`
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

const GuestHero = styled.section.attrs({ className: "GuestHero" })`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 460px;
`;

const HeroEyebrow = styled.span.attrs({ className: "HeroEyebrow" })`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.primary};
`;

const HeroTitle = styled.h1.attrs({ className: "HeroTitle" })`
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;

  @media (min-width: 768px) {
    font-size: 34px;
  }
`;

const HeroSub = styled.p.attrs({ className: "HeroSub" })`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Main = styled.main.attrs({ className: "Main" })`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

// TDS Segmented Control: 회색 트랙 + 흰색 선택 pill(그림자)
const Tabs = styled.div.attrs({ className: "Tabs" })`
  display: flex;
  gap: 4px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border-radius: 12px;
  padding: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled.button.attrs({ className: "Tab" })`
  flex: 0 0 auto;
  border: none;
  border-radius: 9px;
  padding: 9px 14px;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? 700 : 600)};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.text : theme.colors.secondaryText};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.surface : "transparent"};
  box-shadow: ${({ $active }) =>
    $active
      ? "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.04)"
      : "none"};
  transition: color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  ${({ $desktopOnly }) =>
    $desktopOnly && "@media (max-width: 559px) { display: none; }"}
`;

const Placeholder = styled.div.attrs({ className: "Placeholder" })`
  padding: 56px 16px;
  text-align: center;
  font-weight: 500;
  color: ${({ $error, theme }) =>
    $error ? theme.colors.error : theme.colors.secondaryText};
`;

const Grid = styled.div.attrs({ className: "Grid" })`
  display: grid;
  grid-template-columns: 1fr; /* 모바일: 한 줄 리스트 */
  gap: 14px;

  @media (min-width: 560px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 22px 16px;
  }
  @media (min-width: 900px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const Card = styled.div.attrs({ className: "Card" })`
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  padding: 14px 78px 14px 14px;

  @media (min-width: 560px) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    background: transparent;
    border: none;
    padding: 0;
  }
`;

const ScoreBadge = styled.span.attrs({ className: "ScoreBadge" })`
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 52px;
  padding: 0 8px;
  border-radius: 12px;
  background: ${({ $val, $locked }) => scoreColor($val, $locked)};
  color: #fff;
  font-size: 25px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;

  @media (min-width: 560px) {
    top: 10px;
    right: 10px;
    transform: none;
    min-width: 44px;
    height: 40px;
    font-size: 19px;
    border-radius: 10px;
  }
`;

const PosterWrap = styled.div.attrs({ className: "PosterWrap" })`
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  aspect-ratio: 2 / 3;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.18s ease;
`;

const PosterArea = styled.button.attrs({ className: "PosterArea" })`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  width: 80px;
  flex-shrink: 0;

  @media (min-width: 560px) {
    width: 100%;
  }
  @media (hover: hover) {
    &:hover ${PosterWrap} {
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
    }
  }
`;

const Poster = styled.img.attrs({ className: "Poster" })`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PosterFallback = styled.div.attrs({ className: "PosterFallback" })`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-weight: 600;
  font-size: 12px;
`;

const CardBody = styled.div.attrs({ className: "CardBody" })`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Info = styled.button.attrs({ className: "Info" })`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const CardTitle = styled.h2.attrs({ className: "CardTitle" })`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (min-width: 560px) {
    font-size: 14px;
    -webkit-line-clamp: 1;
  }
`;

const CardMeta = styled.span.attrs({ className: "CardMeta" })`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const CardRate = styled.span.attrs({ className: "CardRate" })`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gold};
`;

const RateRow = styled.div.attrs({ className: "RateRow" })`
  display: flex;
  align-items: center;
`;


const Sentinel = styled.div.attrs({ className: "Sentinel" })`
  height: 1px;
`;

const LoadMore = styled.div.attrs({ className: "LoadMore" })`
  text-align: center;
  padding: 18px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

// ── TDS Skeleton (로딩 placeholder) ──
const shimmer = keyframes`
  0% { background-position: -180px 0; }
  100% { background-position: calc(180px + 100%) 0; }
`;

const SkelBlock = styled.div.attrs({ className: "SkelBlock" })`
  background-color: #e7eaee;
  background-image: linear-gradient(
    90deg,
    #e7eaee 0px,
    #f2f4f6 90px,
    #e7eaee 180px
  );
  background-size: 180px 100%;
  background-repeat: no-repeat;
  border-radius: 8px;
  animation: ${shimmer} 1.3s ease-in-out infinite;
`;

const SkelCard = styled.div.attrs({ className: "SkelCard" })`
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  padding: 14px;

  @media (min-width: 560px) {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    background: transparent;
    border: none;
    padding: 0;
  }
`;

const SkelPoster = styled(SkelBlock)`
  width: 80px;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  flex-shrink: 0;

  @media (min-width: 560px) {
    width: 100%;
  }
`;

const SkelBody = styled.div.attrs({ className: "SkelBody" })`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SkelLine = styled(SkelBlock)`
  height: ${({ $h }) => $h || 14}px;
  width: ${({ $w }) => $w || "100%"};
`;

function SkeletonList() {
  return (
    <Grid>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkelCard key={i}>
          <SkelPoster />
          <SkelBody>
            <SkelLine $h={18} $w="72%" />
            <SkelLine $h={13} $w="45%" />
            <SkelLine $h={13} $w="32%" />
            <SkelLine $h={26} $w="60%" />
          </SkelBody>
        </SkelCard>
      ))}
    </Grid>
  );
}

export default App;
