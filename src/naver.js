import {
  NAVER_CLIENT_ID,
  NAVER_CALLBACK_URL,
  NAVER_CALLBACK_LOGIN_URL,
} from "./config.js";

// 네이버 implicit JS SDK (index.html 에서 로드됨) 기반 로그인.
// 흐름: 버튼 클릭 -> 네이버 인증 -> 콜백 URL 로 #access_token=... 해시와 함께 복귀.

let naverInstance = null;

// SDK 가 로드될 때까지 잠깐 대기 (head 의 동기 스크립트라 보통 즉시 사용 가능)
function waitForSDK(timeout = 4000) {
  return new Promise((resolve) => {
    if (typeof window.naver_id_login !== "undefined") return resolve(true);
    const start = Date.now();
    const timer = setInterval(() => {
      if (typeof window.naver_id_login !== "undefined") {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

// 숨겨진 네이버 로그인 버튼(#naver_id_login)을 초기화한다.
// mode: "login"(/OauthLogin) | "signup"(/Oauth)
export async function initNaverLogin(mode = "login") {
  if (!NAVER_CLIENT_ID) return false;
  const ready = await waitForSDK();
  if (!ready) return false;

  const callback =
    mode === "signup" ? NAVER_CALLBACK_URL : NAVER_CALLBACK_LOGIN_URL;

  // 모드 전환 시 중복 앵커가 쌓이지 않도록 컨테이너를 비운다.
  const container = document.getElementById("naver_id_login");
  if (container) container.innerHTML = "";

  naverInstance = new window.naver_id_login(NAVER_CLIENT_ID, callback);
  const state = naverInstance.getUniqState();
  naverInstance.setState(state);
  try {
    // CSRF 검증용 state 를 저장 (콜백에서 대조)
    sessionStorage.setItem("naver_oauth_state", state);
  } catch {
    // sessionStorage 불가 시 state 검증만 생략
  }
  naverInstance.init_naver_id_login();
  return true;
}

// 커스텀 버튼 → SDK 가 주입한 실제 a 태그 클릭
export function triggerNaverLogin() {
  if (!NAVER_CLIENT_ID) {
    alert(
      "네이버 Client ID 가 설정되지 않았습니다. .env 의 VITE_NAVER_CLIENT_ID 를 채워주세요."
    );
    return;
  }
  const container = document.getElementById("naver_id_login");
  const anchor = container?.querySelector("a");
  if (anchor) {
    anchor.click();
  } else {
    alert("네이버 로그인 버튼을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
}

// 콜백 해시에 토큰이 있는지 여부
export function isNaverCallbackPath() {
  const hash = window.location.hash || "";
  return hash.includes("access_token=") || hash.includes("error=");
}

// 콜백 해시에서 access_token 등 추출 + state 검증
export function readNaverCallback() {
  const hash = window.location.hash || "";
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));

  const accessToken = params.get("access_token");
  const error = params.get("error");
  if (!accessToken && !error) return null;

  const state = params.get("state");
  let storedState = null;
  try {
    storedState = sessionStorage.getItem("naver_oauth_state");
    sessionStorage.removeItem("naver_oauth_state");
  } catch {
    storedState = null;
  }

  return {
    accessToken,
    tokenType: params.get("token_type") || "Bearer",
    expiresIn: params.get("expires_in"),
    state,
    error,
    errorDescription: params.get("error_description"),
    stateValid: storedState ? storedState === state : true,
  };
}

// 콜백 처리 후 주소창에서 해시(및 콜백 경로) 제거
export function clearNaverCallbackUrl() {
  window.history.replaceState({}, document.title, "/");
}

// 네이버 연동 흐름: 리다이렉트 전에 입력한 인증코드를 보관해 두고,
// 콜백에서 꺼내 연동(verify)에 사용한다.
export function setPendingLinkCode(code) {
  try {
    sessionStorage.setItem("naver_link_code", code);
  } catch {
    // sessionStorage 불가 시 연동 흐름은 동작하지 않음
  }
}

export function popPendingLinkCode() {
  try {
    const code = sessionStorage.getItem("naver_link_code");
    sessionStorage.removeItem("naver_link_code");
    return code;
  } catch {
    return null;
  }
}
