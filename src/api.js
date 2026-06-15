import { API_BASE_URL } from "./config.js";

// 공통 요청 헬퍼
async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error ?? "요청을 처리하지 못했습니다.");
  }
  return payload;
}

// --- 인증 ---
export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password } });

export const register = (form) =>
  request("/auth/register", { method: "POST", body: form });

// 네이버 로그인: implicit SDK 가 받은 access_token 을 백엔드로 전달
export const naverLogin = ({ accessToken, tokenType, state, type }) =>
  request("/auth/naver", {
    method: "POST",
    body: { access_token: accessToken, token_type: tokenType, state, type },
  });

// --- 영화 ---
export const fetchMovies = ({ page = 0, limit = 24, rated = false, recentDays } = {}) =>
  request(
    `/movies?page=${page}&limit=${limit}&rated=${rated}` +
      (recentDays ? `&recentDays=${recentDays}` : "")
  );

// --- 평점 ---
export const fetchMovieRating = (movieId) =>
  request(`/ratings/movie/${movieId}`);

export const fetchMyRating = (movieId, token) =>
  request(`/ratings/movie/${movieId}/user`, { token });

export const submitRating = (movieId, rating, token) =>
  request("/ratings", { method: "POST", token, body: { movieId, rating } });

// --- 퀴즈 ---
export const fetchQuizCompletion = (movieId, token) =>
  request(`/quiz/completion/${movieId}`, { token });

export const fetchQuiz = (movieId) => request(`/quiz/movie/${movieId}`);

export const checkQuiz = ({ quizId, movieId, userAnswer }, token) =>
  request("/quiz/check", {
    method: "POST",
    token,
    body: { quizId, movieId, userAnswer },
  });

// --- 리뷰 ---
export const fetchMovieReviews = (movieId) =>
  request(`/review/movie/${movieId}`);

// --- 네이버 계정 연동 ---
// (Toss 사용자) 인증코드 메일 발송 요청
export const sendLinkCode = (email, token) =>
  request("/auth/link/send-code", { method: "POST", token, body: { email } });

// (웹) 코드 + 네이버 access_token 으로 연동 확정
export const verifyNaverLink = ({ code, accessToken, tokenType }) =>
  request("/auth/link/verify", {
    method: "POST",
    body: { code, access_token: accessToken, token_type: tokenType },
  });
