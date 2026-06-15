import styled from "styled-components";

const LOGO = "https://assets.movie-hop.com/logo/naver-movie-hop-logo.png";

// 상단 헤더 (로고 이미지 + 로그인 상태). 스티키 + 블러.
function Header({ user, isLoggedIn, onHome, onLogin, onLogout }) {
  return (
    <Bar>
      <Inner>
        <Logo type="button" onClick={onHome} aria-label="홈으로">
          <img src={LOGO} alt="MovieHop" />
          <Wordmark>MovieHop</Wordmark>
        </Logo>

        <Right>
          {isLoggedIn ? (
            <>
              <UserName>{user?.username || user?.email || "회원"}</UserName>
              <GhostButton type="button" onClick={onLogout}>
                로그아웃
              </GhostButton>
            </>
          ) : (
            <PrimaryButton type="button" onClick={onLogin}>
              로그인
            </PrimaryButton>
          )}
        </Right>
      </Inner>
    </Bar>
  );
}

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 200;
  background: rgba(10, 11, 15, 0.72);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: env(safe-area-inset-top);
`;

const Inner = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @media (min-width: 768px) {
    height: 64px;
    padding: 0 24px;
  }
`;

const Logo = styled.button`
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;

  img {
    height: 30px;
    width: 30px;
    border-radius: 8px;
    object-fit: cover;
  }
`;

const Wordmark = styled.span`
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.text};
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const UserName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondaryText};
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 480px) {
    display: none;
  }
`;

const PrimaryButton = styled.button`
  border: none;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  min-height: 38px;

  &:active {
    transform: translateY(1px);
  }
`;

const GhostButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-height: 38px;
`;

export default Header;
