import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  initNaverLogin,
  triggerNaverLogin,
  setPendingLinkCode,
} from "../naver.js";

// 네이버 계정 연동 화면
// 메일 버튼(?link=1&code=...)으로 진입하면 코드를 자동으로 보관하고,
// 사용자는 네이버 로그인만 누르면 콜백에서 기존(토스) 계정과 병합된다.
function LinkView({ notice }) {
  const [code] = useState(
    () => new URLSearchParams(window.location.search).get("code") || ""
  );

  useEffect(() => {
    initNaverLogin();
    // 메일에서 받은 코드를 미리 보관 (네이버 로그인 후 콜백에서 사용)
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
          이후에는 토스 / 네이버 어느 쪽으로도 로그인할 수 있어요.
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
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  font-size: 24px;
  font-weight: 700;
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

  &:hover:not(:disabled) {
    background: #02b150;
  }

  &:disabled {
    background: rgba(3, 199, 90, 0.5);
    cursor: not-allowed;
  }
`;

const NaverLogo = styled.span`
  font-weight: 900;
  font-size: 18px;
`;

export default LinkView;
