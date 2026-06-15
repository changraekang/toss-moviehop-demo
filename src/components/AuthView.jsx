import { useEffect, useState } from "react";
import styled from "styled-components";
import { login as apiLogin, register as apiRegister } from "../api.js";
import { initNaverLogin, triggerNaverLogin } from "../naver.js";

// 로그인 / 회원가입 화면 (네이버 로그인 포함)
function AuthView({ mode, onModeChange, onAuthenticated, notice }) {
  const isLogin = mode === "login";

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    nickname: "",
    email: "",
    password: "",
  });
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  // 네이버 implicit SDK 버튼 초기화
  useEffect(() => {
    initNaverLogin(isLogin ? "login" : "signup");
  }, [isLogin]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const payload = await apiLogin(loginForm.email, loginForm.password);
      onAuthenticated(payload.token, payload.user);
    } catch (err) {
      setFeedback({ tone: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const payload = await apiRegister(registerForm);
      if (payload.token) {
        onAuthenticated(payload.token, payload.user);
      } else {
        setFeedback({
          tone: "success",
          text: "회원가입 완료! 로그인해 주세요.",
        });
        onModeChange("login");
      }
    } catch (err) {
      setFeedback({ tone: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardTitle>{isLogin ? "로그인" : "회원가입"}</CardTitle>

      {notice && <Notice>{notice}</Notice>}

      {/* SDK 가 이 안에 실제 네이버 로그인 a 태그를 주입함 */}
      <div id="naver_id_login" style={{ display: "none" }} />
      <NaverButton type="button" onClick={triggerNaverLogin}>
        <NaverLogo aria-hidden>N</NaverLogo>
        네이버로 {isLogin ? "로그인" : "시작하기"}
      </NaverButton>

      <Divider>
        <span>또는 이메일로</span>
      </Divider>

      {isLogin ? (
        <Form onSubmit={handleLogin}>
          <Field>
            <Label htmlFor="login-email">이메일</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="example@domain.com"
            />
          </Field>
          <Field>
            <Label htmlFor="login-password">비밀번호</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="비밀번호"
            />
          </Field>
          <Submit type="submit" disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </Submit>
        </Form>
      ) : (
        <Form onSubmit={handleRegister}>
          <Field>
            <Label htmlFor="reg-nickname">닉네임</Label>
            <Input
              id="reg-nickname"
              required
              value={registerForm.nickname}
              onChange={(e) =>
                setRegisterForm((p) => ({ ...p, nickname: e.target.value }))
              }
              placeholder="표시할 닉네임"
            />
          </Field>
          <Field>
            <Label htmlFor="reg-username">이름 (선택)</Label>
            <Input
              id="reg-username"
              value={registerForm.username}
              onChange={(e) =>
                setRegisterForm((p) => ({ ...p, username: e.target.value }))
              }
              placeholder="이름"
            />
          </Field>
          <Field>
            <Label htmlFor="reg-email">이메일</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={registerForm.email}
              onChange={(e) =>
                setRegisterForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="example@domain.com"
            />
          </Field>
          <Field>
            <Label htmlFor="reg-password">비밀번호</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              value={registerForm.password}
              onChange={(e) =>
                setRegisterForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="비밀번호"
            />
          </Field>
          <Submit type="submit" disabled={loading}>
            {loading ? "가입 중…" : "회원가입"}
          </Submit>
        </Form>
      )}

      {feedback && <Feedback $tone={feedback.tone}>{feedback.text}</Feedback>}

      <SwitchHint>
        {isLogin ? "계정이 없나요? " : "이미 계정이 있나요? "}
        <InlineButton
          type="button"
          onClick={() => {
            setFeedback(null);
            onModeChange(isLogin ? "register" : "login");
          }}
        >
          {isLogin ? "회원가입" : "로그인"}
        </InlineButton>
      </SwitchHint>
    </Card>
  );
}

const Card = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 420px;
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

const Notice = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  text-align: center;
  background: rgba(0, 104, 255, 0.08);
  color: ${({ theme }) => theme.colors.primary};
`;

const NaverButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
  border-radius: 12px;
  background: #03c75a;
  color: #fff;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: #02b150;
  }
`;

const NaverLogo = styled.span`
  font-weight: 900;
  font-size: 18px;
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: ${({ theme }) => theme.colors.secondaryText};
  font-size: 13px;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.border};
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Input = styled.input`
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 14px;
  font-size: 15px;
  background: ${({ theme }) => theme.colors.background};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    background: #fff;
  }
`;

const Submit = styled.button`
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    background: rgba(0, 104, 255, 0.5);
    cursor: not-allowed;
  }
`;

const Feedback = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  text-align: center;
  background: ${({ $tone }) =>
    $tone === "success" ? "rgba(14,165,233,0.16)" : "rgba(239,68,68,0.16)"};
  color: ${({ $tone }) => ($tone === "success" ? "#0ea5e9" : "#ef4444")};
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

  &:hover {
    text-decoration: underline;
  }
`;

export default AuthView;
