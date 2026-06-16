import { useEffect } from "react";
import styled from "styled-components";
import { initNaverLogin, triggerNaverLogin } from "../naver.js";

// 로그인 화면 (네이버 전용). 이메일/비번 로그인은 어드민 사이트에서만 사용.
function AuthView({ notice }) {
  useEffect(() => {
    initNaverLogin("login");
  }, []);

  return (
    <Card>
      <CardTitle>로그인</CardTitle>
      <Lead>네이버로 3초 만에 시작하세요.</Lead>

      {notice && <Notice>{notice}</Notice>}

      <div id="naver_id_login" style={{ display: "none" }} />
      <NaverButton type="button" onClick={triggerNaverLogin}>
        <NaverLogo aria-hidden>N</NaverLogo>
        네이버로 로그인
      </NaverButton>
    </Card>
  );
}

const Card = styled.section.attrs({ className: "Card" })`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 18px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 30px 24px calc(30px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 380px;
  width: 100%;
  align-self: center;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08);

  @media (min-width: 768px) {
    padding: 34px;
  }
`;

const CardTitle = styled.h2.attrs({ className: "CardTitle" })`
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  text-align: center;
`;

const Lead = styled.p.attrs({ className: "Lead" })`
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Notice = styled.div.attrs({ className: "Notice" })`
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  text-align: center;
  background: rgba(49, 130, 246, 0.08);
  color: ${({ theme }) => theme.colors.primary};
`;

const NaverButton = styled.button.attrs({ className: "NaverButton" })`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.naver};
  color: #fff;
  padding: 15px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  min-height: 52px;
  margin-top: 4px;

  &:active {
    transform: translateY(1px);
  }
`;

const NaverLogo = styled.span.attrs({ className: "NaverLogo" })`
  font-weight: 900;
  font-size: 18px;
`;

export default AuthView;
