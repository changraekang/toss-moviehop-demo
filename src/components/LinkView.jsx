import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  initNaverLogin,
  triggerNaverLogin,
  setPendingLinkCode,
} from "../naver.js";

// 네이버 계정 연동 화면 (다크). 메일 버튼(?link=1&code=...)으로 코드 자동 보관.
function LinkView({ notice }) {
  const [code] = useState(
    () => new URLSearchParams(window.location.search).get("code") || ""
  );

  useEffect(() => {
    initNaverLogin();
    if (code) setPendingLinkCode(code);
  }, [code]);

  const handleLink = () => {
    if (!code) return;
    setPendingLinkCode(code);
    triggerNaverLogin();
  };

  return (
    <Card>
      <CardTitle>네이버 계정 연동</CardTitle>

      {code ? (
        <Desc>
          네이버 로그인을 완료하면 기존 계정에 네이버 로그인이 연결됩니다.
          이후엔 토스 / 네이버 어느 쪽으로도 로그인할 수 있어요.
        </Desc>
      ) : (
        <Desc>
          유효하지 않은 접근입니다. 메일의 “네이버 연동하러 가기” 버튼으로 다시
          접속해 주세요.
        </Desc>
      )}

      {notice && <Notice>{notice}</Notice>}

      <div id="naver_id_login" style={{ display: "none" }} />
      <NaverButton type="button" onClick={handleLink} disabled={!code}>
        <NaverLogo aria-hidden>N</NaverLogo>
        네이버 로그인하고 연동하기
      </NaverButton>
    </Card>
  );
}

const Card = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 18px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 30px 22px calc(30px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 420px;
  width: 100%;
  align-self: center;

  @media (min-width: 768px) {
    padding: 34px;
    box-shadow: 0 24px 50px rgba(0, 0, 0, 0.45);
  }
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  text-align: center;
`;

const Desc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
  color: ${({ theme }) => theme.colors.secondaryText};
`;

const Notice = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  text-align: center;
  background: rgba(79, 140, 255, 0.12);
  color: ${({ theme }) => theme.colors.primary};
`;

const NaverButton = styled.button`
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

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const NaverLogo = styled.span`
  font-weight: 900;
  font-size: 18px;
`;

export default LinkView;
