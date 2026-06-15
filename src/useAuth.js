import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "moviehop_token";
const USER_KEY = "moviehop_user";

function readStored() {
  try {
    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    const userRaw = localStorage.getItem(USER_KEY);
    return { token, user: userRaw ? JSON.parse(userRaw) : null };
  } catch {
    return { token: "", user: null };
  }
}

// 로그인 토큰/유저 정보를 localStorage 에 보관하는 간단한 인증 훅
export function useAuth() {
  const [{ token, user }, setAuth] = useState(readStored);

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch {
      // localStorage 사용 불가 환경은 무시 (메모리 상태만 유지)
    }
  }, [token, user]);

  const signIn = useCallback((nextToken, nextUser) => {
    setAuth({ token: nextToken ?? "", user: nextUser ?? null });
  }, []);

  const signOut = useCallback(() => {
    setAuth({ token: "", user: null });
  }, []);

  return { token, user, isLoggedIn: Boolean(token), signIn, signOut };
}
