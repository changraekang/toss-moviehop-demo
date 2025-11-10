import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { ThemeProvider, createGlobalStyle } from "styled-components";
import MovieModal from "./components/MovieModal.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

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
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  #root {
    min-height: 100vh;
  }
`;

function App() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [token, setToken] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeView, setActiveView] = useState("movies");
  const [moviesTab, setMoviesTab] = useState("overview");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginFeedback, setLoginFeedback] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    username: "",
    nickname: "",
    email: "",
    password: "",
  });
  const [registerFeedback, setRegisterFeedback] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [userRatings, setUserRatings] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [pendingRatingId, setPendingRatingId] = useState(null);
  const [userRatingsLoading, setUserRatingsLoading] = useState(false);

  const isMountedRef = useRef(true);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const fetchMovies = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/movies`);

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error ?? "영화 목록을 불러오지 못했습니다.");
      }

      const data = await response.json();
      if (isMountedRef.current) {
        setMovies(data);
      }
    } catch (fetchError) {
      if (isMountedRef.current) {
        setError(fetchError.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  useEffect(() => {
    if (!token) {
      setUserRatings({});
      setRatingDrafts({});
    }
  }, [token]);

  useEffect(() => {
    if (!token || movies.length === 0) {
      return;
    }

    let ignore = false;

    async function loadUserRatings() {
      setUserRatingsLoading(true);

      try {
        const results = await Promise.all(
          movies.map(async (movie) => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/ratings/movie/${movie._id}/user`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (!response.ok) {
                throw new Error("failed");
              }

              const data = await response.json();
              return [movie._id, data?.rating ?? null];
            } catch {
              return [movie._id, null];
            }
          })
        );

        if (!ignore) {
          const nextRatings = Object.fromEntries(results);
          setUserRatings(nextRatings);
          setRatingDrafts(nextRatings);
        }
      } finally {
        if (!ignore) {
          setUserRatingsLoading(false);
        }
      }
    }

    loadUserRatings();

    return () => {
      ignore = true;
    };
  }, [token, movies]);

  useEffect(() => {
    if (!statusMessage) return;

    const timer = window.setTimeout(() => {
      setStatusMessage(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const handleNavigate = (view) => {
    setActiveView(view);
    if (view !== "movies") {
      setMoviesTab("overview");
    }
    setStatusMessage(null);
    setLoginFeedback(null);
    setRegisterFeedback(null);
  };

  const handleLoginInputChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegisterInputChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginFeedback(null);
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginForm.email,
          password: loginForm.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "로그인에 실패했습니다.");
      }

      setToken(payload?.token ?? "");
      setLoginForm({ email: "", password: "" });
      await fetchMovies();
      handleNavigate("movies");
      setStatusMessage({
        tone: "success",
        text: "로그인되었습니다.",
      });
    } catch (loginError) {
      setLoginFeedback({
        tone: "error",
        text:
          loginError?.message ??
          "로그인 중 문제가 발생했습니다. 입력 정보를 확인해주세요.",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setRegisterFeedback(null);
    setRegisterLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerForm),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "회원가입에 실패했습니다.");
      }

      setRegisterFeedback({
        tone: "success",
        text:
          payload?.message ??
          "회원가입이 완료되었습니다. 로그인 페이지로 이동해 주세요.",
      });
      setRegisterForm({
        username: "",
        nickname: "",
        email: "",
        password: "",
      });

      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }

      redirectTimerRef.current = window.setTimeout(() => {
        handleNavigate("login");
      }, 1200);
    } catch (registerError) {
      setRegisterFeedback({
        tone: "error",
        text:
          registerError?.message ??
          "회원가입 중 문제가 발생했습니다. 입력 정보를 다시 확인해주세요.",
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRatingDraftChange = (movieId, value) => {
    setRatingDrafts((prev) => ({
      ...prev,
      [movieId]: value,
    }));
  };

  const handleRateListSubmit = async (movieId) => {
    if (!token) {
      setStatusMessage({
        tone: "error",
        text: "평점을 등록하려면 먼저 로그인해주세요.",
      });
      handleNavigate("login");
      return;
    }

    const numericValue = Number(ratingDrafts[movieId] ?? 0);

    setPendingRatingId(movieId);
    try {
      await handleRatingSubmit(movieId, numericValue);
    } finally {
      setPendingRatingId((prev) => (prev === movieId ? null : prev));
    }
  };

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie._id === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  const handleRatingSubmit = async (movieId, rating) => {
    if (!token) {
      setStatusMessage({
        tone: "error",
        text: "평점을 업데이트하려면 먼저 JWT 토큰을 입력해 주세요.",
      });
      throw new Error("토큰이 필요합니다.");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/ratings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ movieId, rating }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "평점을 저장하지 못했습니다.");
      }

      setMovies((prev) =>
        prev.map((movie) =>
          movie._id === movieId
            ? {
                ...movie,
                ratingAverage: payload?.stats?.average ?? movie.ratingAverage,
                ratingCount: payload?.stats?.count ?? movie.ratingCount,
              }
            : movie
        )
      );

      const nextRating = payload?.rating ?? rating;
      setUserRatings((prev) => ({
        ...prev,
        [movieId]: nextRating,
      }));
      setRatingDrafts((prev) => ({
        ...prev,
        [movieId]: nextRating,
      }));

      setStatusMessage({
        tone: "success",
        text: "평점이 성공적으로 업데이트되었습니다.",
      });

      return payload;
    } catch (submitError) {
      setStatusMessage({
        tone: "error",
        text: submitError.message ?? "평점 업데이트 중 문제가 발생했습니다.",
      });
      throw submitError;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AppShell>
        <Header>
          <Title>MovieHop Demo</Title>
          <Subtitle>영화 리스트 & 평점 테스트용 클라이언트</Subtitle>
        </Header>

        <TabBar aria-label="화면 전환">
          <TabButton
            type="button"
            $active={activeView === "movies"}
            onClick={() => handleNavigate("movies")}
          >
            영화 목록
          </TabButton>
          <TabButton
            type="button"
            $active={activeView === "login"}
            onClick={() => handleNavigate("login")}
          >
            로그인
          </TabButton>
          <TabButton
            type="button"
            $active={activeView === "register"}
            onClick={() => handleNavigate("register")}
          >
            회원가입
          </TabButton>
        </TabBar>

        {statusMessage && (
          <StatusBanner tone={statusMessage.tone}>
            {statusMessage.text}
          </StatusBanner>
        )}

        {activeView === "movies" && (
          <>
            <TokenPanel>
              <TokenLabel htmlFor="token-input">
                인증 토큰 (Bearer JWT)
              </TokenLabel>
              <TokenInput
                id="token-input"
                placeholder="로그인 후 발급받은 JWT 토큰을 붙여넣으세요."
                value={token}
                onChange={(event) => setToken(event.target.value)}
                spellCheck={false}
              />
            </TokenPanel>

            <SecondaryTabBar aria-label="영화 보기 모드 전환">
              <SecondaryTabButton
                type="button"
                $active={moviesTab === "overview"}
                onClick={() => setMoviesTab("overview")}
              >
                평점 보기
              </SecondaryTabButton>
              <SecondaryTabButton
                type="button"
                $active={moviesTab === "rate"}
                onClick={() => setMoviesTab("rate")}
              >
                평점 매기기
              </SecondaryTabButton>
            </SecondaryTabBar>

            {moviesTab === "overview" && (
              <ContentSection>
                {loading && (
                  <Placeholder>영화 정보를 불러오는 중입니다…</Placeholder>
                )}
                {error && <Placeholder error>{error}</Placeholder>}
                {!loading && !error && movies.length === 0 && (
                  <Placeholder>표시할 영화가 없습니다.</Placeholder>
                )}

                {!loading && !error && movies.length > 0 && (
                  <MovieList>
                    {movies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        onClick={() => setSelectedMovieId(movie._id)}
                      >
                        {movie.posterUrl ? (
                          <Poster
                            src={movie.posterUrl}
                            alt={`${movie.title} 포스터`}
                            loading="lazy"
                          />
                        ) : (
                          <PosterFallback>포스터 없음</PosterFallback>
                        )}
                        <MovieInfo>
                          <MovieTitle>{movie.title}</MovieTitle>
                          <MovieMeta>
                            {formatYear(movie.releaseDate)}
                            {movie.genres?.length
                              ? ` · ${movie.genres.join(", ")}`
                              : ""}
                            {movie.runtime ? ` · ${movie.runtime}분` : ""}
                          </MovieMeta>
                          <MovieOverview>
                            {movie.overview
                              ? movie.overview.slice(0, 120) +
                                (movie.overview.length > 120 ? "…" : "")
                              : "설명이 준비되지 않은 영화입니다."}
                          </MovieOverview>
                          <RatingLine>
                            <RatingBadge>⭐</RatingBadge>
                            <RatingText>
                              {formatAverage(movie.ratingAverage)}{" "}
                              <RatingCount>
                                ({movie.ratingCount ?? 0}명)
                              </RatingCount>
                            </RatingText>
                          </RatingLine>
                        </MovieInfo>
                      </MovieCard>
                    ))}
                  </MovieList>
                )}
              </ContentSection>
            )}

            {moviesTab === "rate" && (
              <RateSection>
                {!token && (
                  <Placeholder error>
                    로그인을 완료하고 JWT 토큰을 입력하면 평점을 등록할 수
                    있습니다.
                  </Placeholder>
                )}

                {token && userRatingsLoading && (
                  <Placeholder>내 평점 정보를 불러오는 중입니다…</Placeholder>
                )}

                {token && !userRatingsLoading && movies.length === 0 && (
                  <Placeholder>평점을 남길 영화가 없습니다.</Placeholder>
                )}

                {token && !userRatingsLoading && movies.length > 0 && (
                  <RateList>
                    {movies.map((movie) => {
                      const draftValue = Number(ratingDrafts[movie._id] ?? 0);
                      const personalRating = userRatings[movie._id];

                      return (
                        <RateCard key={movie._id}>
                          <RateHeader>
                            <RateTitle>{movie.title}</RateTitle>
                            <RateMeta>
                              내 평점:{" "}
                              {personalRating != null
                                ? `${formatAverage(personalRating)}점`
                                : "아직 등록되지 않았어요"}
                            </RateMeta>
                          </RateHeader>
                          <RateDetails>
                            <span>
                              평균 {formatAverage(movie.ratingAverage)}점 ·{" "}
                              {movie.ratingCount ?? 0}명 참여
                            </span>
                            <span>{formatYear(movie.releaseDate)}</span>
                          </RateDetails>
                          <RateControls>
                            <RateSlider
                              type="range"
                              min="0"
                              max="5"
                              step="0.1"
                              value={draftValue}
                              onChange={(event) =>
                                handleRatingDraftChange(
                                  movie._id,
                                  Number(event.target.value)
                                )
                              }
                            />
                            <RateValue>
                              ⭐ {formatAverage(draftValue)}
                            </RateValue>
                            <RateSubmit
                              type="button"
                              disabled={pendingRatingId === movie._id}
                              onClick={() => handleRateListSubmit(movie._id)}
                            >
                              {pendingRatingId === movie._id
                                ? "저장 중…"
                                : "평점 저장"}
                            </RateSubmit>
                          </RateControls>
                        </RateCard>
                      );
                    })}
                  </RateList>
                )}
              </RateSection>
            )}
          </>
        )}

        {activeView === "login" && (
          <AuthCard>
            <CardTitle>로그인</CardTitle>
            <AuthForm onSubmit={handleLoginSubmit}>
              <FieldGroup>
                <FieldLabel htmlFor="login-email">이메일</FieldLabel>
                <TextInput
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="example@domain.com"
                  value={loginForm.email}
                  onChange={handleLoginInputChange}
                  autoComplete="email"
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
                <TextInput
                  id="login-password"
                  name="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={loginForm.password}
                  onChange={handleLoginInputChange}
                  autoComplete="current-password"
                  required
                />
              </FieldGroup>
              <AuthSubmitButton type="submit" disabled={loginLoading}>
                {loginLoading ? "로그인 중…" : "로그인"}
              </AuthSubmitButton>
            </AuthForm>
            {loginFeedback && (
              <FormFeedback tone={loginFeedback.tone}>
                {loginFeedback.text}
              </FormFeedback>
            )}
            <SwitchHint>
              계정이 없나요?{" "}
              <InlineButton
                type="button"
                onClick={() => handleNavigate("register")}
              >
                회원가입 하기
              </InlineButton>
            </SwitchHint>
          </AuthCard>
        )}

        {activeView === "register" && (
          <AuthCard>
            <CardTitle>회원가입</CardTitle>
            <AuthForm onSubmit={handleRegisterSubmit}>
              <FieldGroup>
                <FieldLabel htmlFor="register-username">이름 (선택)</FieldLabel>
                <TextInput
                  id="register-username"
                  name="username"
                  type="text"
                  placeholder="이름 또는 별명을 입력하세요"
                  value={registerForm.username}
                  onChange={handleRegisterInputChange}
                  autoComplete="name"
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel htmlFor="register-nickname">닉네임</FieldLabel>
                <TextInput
                  id="register-nickname"
                  name="nickname"
                  type="text"
                  placeholder="표시할 닉네임을 입력하세요"
                  value={registerForm.nickname}
                  onChange={handleRegisterInputChange}
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel htmlFor="register-email">이메일</FieldLabel>
                <TextInput
                  id="register-email"
                  name="email"
                  type="email"
                  placeholder="example@domain.com"
                  value={registerForm.email}
                  onChange={handleRegisterInputChange}
                  autoComplete="email"
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel htmlFor="register-password">비밀번호</FieldLabel>
                <TextInput
                  id="register-password"
                  name="password"
                  type="password"
                  placeholder="안전한 비밀번호를 입력하세요"
                  value={registerForm.password}
                  onChange={handleRegisterInputChange}
                  autoComplete="new-password"
                  required
                />
              </FieldGroup>
              <AuthSubmitButton type="submit" disabled={registerLoading}>
                {registerLoading ? "가입 중…" : "회원가입"}
              </AuthSubmitButton>
            </AuthForm>
            {registerFeedback && (
              <FormFeedback tone={registerFeedback.tone}>
                {registerFeedback.text}
              </FormFeedback>
            )}
            <SwitchHint>
              이미 계정이 있나요?{" "}
              <InlineButton
                type="button"
                onClick={() => handleNavigate("login")}
              >
                로그인하기
              </InlineButton>
            </SwitchHint>
          </AuthCard>
        )}
      </AppShell>

      {selectedMovie && (
        <MovieModal
          apiBaseUrl={API_BASE_URL}
          movie={selectedMovie}
          movieId={selectedMovie._id}
          onClose={() => setSelectedMovieId(null)}
          onSubmitRating={handleRatingSubmit}
          token={token}
        />
      )}
    </ThemeProvider>
  );
}

function formatYear(dateValue) {
  if (!dateValue) return "연도 정보 없음";
  const year = new Date(dateValue).getFullYear();
  return Number.isNaN(year) ? "연도 정보 없음" : `${year}년`;
}

function formatAverage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.0";
  }
  return value.toFixed(1);
}

const AppShell = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px 64px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (max-width: 768px) {
    padding: 32px 16px 48px;
  }
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const TokenPanel = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TokenLabel = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const TokenInput = styled.textarea`
  resize: vertical;
  min-height: 64px;
  max-height: 180px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.background};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    background: #fff;
  }
`;

const StatusBanner = styled.div`
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  background: ${({ tone }) =>
    tone === "success"
      ? "rgba(14, 165, 233, 0.15)"
      : "rgba(239, 68, 68, 0.12)"};
  color: ${({ tone, theme }) =>
    tone === "success" ? theme.colors.success : theme.colors.error};
  border: 1px solid
    ${({ tone }) =>
      tone === "success"
        ? "rgba(14, 165, 233, 0.4)"
        : "rgba(239, 68, 68, 0.4)"};
`;

const ContentSection = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 24px;
  min-height: 320px;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

const Placeholder = styled.div`
  padding: 48px 16px;
  text-align: center;
  color: ${({ error, theme }) =>
    error ? theme.colors.error : theme.colors.secondaryText};
  font-weight: 500;
`;

const MovieInfo = styled.div`
  background: rgba(15, 23, 42, 0.02);
  border-radius: 16px;
  padding: 16px 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.2s ease, background 0.2s ease;
`;

const MovieTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
`;

const MovieMeta = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const MovieOverview = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
  opacity: 0.9;
`;

const MovieList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const MovieCard = styled.button`
  display: flex;
  gap: 20px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  cursor: pointer;

  &:hover ${MovieInfo} {
    transform: translateY(-2px);
    background: rgba(15, 23, 42, 0.04);
  }
`;

const Poster = styled.img`
  width: 90px;
  height: 130px;
  object-fit: cover;
  border-radius: 12px;
  flex-shrink: 0;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);

  @media (max-width: 640px) {
    width: 70px;
    height: 110px;
  }
`;

const PosterFallback = styled.div`
  width: 90px;
  height: 130px;
  border-radius: 12px;
  background: rgba(226, 232, 240, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-size: 13px;
  font-weight: 600;

  @media (max-width: 640px) {
    width: 70px;
    height: 110px;
  }
`;

const RatingLine = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RatingBadge = styled.span`
  font-size: 20px;
`;

const RatingText = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const RatingCount = styled.span`
  font-weight: 400;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const SecondaryTabBar = styled.nav`
  display: flex;
  gap: 8px;
  margin-top: -8px;
  flex-wrap: wrap;
`;

const SecondaryTabButton = styled.button`
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : "rgba(15, 23, 42, 0.05)"};
  color: ${({ theme, $active }) => ($active ? "#ffffff" : theme.colors.text)};
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: ${({ $active }) =>
      $active ? "#0052cc" : "rgba(15, 23, 42, 0.12)"};
  }
`;

const RateSection = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

const RateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const RateCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: rgba(15, 23, 42, 0.02);
`;

const RateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  align-items: baseline;
`;

const RateTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
`;

const RateMeta = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const RateDetails = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const RateControls = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const RateSlider = styled.input`
  flex: 1;
  min-width: 160px;
  accent-color: ${({ theme }) => theme.colors.primary};
`;

const RateValue = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const RateSubmit = styled.button`
  border: none;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover:not(:disabled) {
    background: #0052cc;
  }

  &:disabled {
    background: rgba(0, 104, 255, 0.5);
    cursor: wait;
  }
`;

const TabBar = styled.nav`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? "#ffffff" : theme.colors.text)};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : "rgba(15, 23, 42, 0.06)"};
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: ${({ $active }) =>
      $active ? "#0052cc" : "rgba(15, 23, 42, 0.12)"};
  }

  &:active {
    transform: scale(0.98);
  }
`;

const AuthCard = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 460px;
  width: 100%;
  align-self: center;
  box-shadow: 0 24px 40px rgba(15, 23, 42, 0.08);

  @media (max-width: 640px) {
    padding: 24px 20px;
  }
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  text-align: center;
`;

const AuthForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const TextInput = styled.input`
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 14px;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.background};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    background: #ffffff;
  }
`;

const AuthSubmitButton = styled.button`
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover:not(:disabled) {
    background: #0052cc;
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    background: rgba(0, 104, 255, 0.5);
    cursor: not-allowed;
  }
`;

const SwitchHint = styled.p`
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const InlineButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 2px;

  &:hover {
    text-decoration: underline;
  }
`;

const FormFeedback = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  text-align: center;
  background: ${({ tone }) =>
    tone === "success"
      ? "rgba(14, 165, 233, 0.16)"
      : "rgba(239, 68, 68, 0.16)"};
  color: ${({ tone }) => (tone === "success" ? "#0ea5e9" : "#ef4444")};
  border: 1px solid
    ${({ tone }) =>
      tone === "success"
        ? "rgba(14, 165, 233, 0.4)"
        : "rgba(239, 68, 68, 0.4)"};
`;

export default App;
