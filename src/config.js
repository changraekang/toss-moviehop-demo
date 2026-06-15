// 환경 설정 (배포 시 .env 로 주입)
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

// 네이버 로그인 Client ID
export const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_CLIENT_ID ?? "";

// 네이버 콘솔에 등록한 Callback URL 과 정확히 일치해야 함.
// 로그인 콜백 (/OauthLogin)
export const NAVER_CALLBACK_LOGIN_URL =
  import.meta.env.VITE_NAVER_CALLBACK_LOGIN_URL ??
  "https://movie-hop.com/OauthLogin";

// 가입 콜백 (/Oauth)
export const NAVER_CALLBACK_URL =
  import.meta.env.VITE_NAVER_CALLBACK_URL ?? "https://movie-hop.com/Oauth";
