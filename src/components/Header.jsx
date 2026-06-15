import styled from "styled-components";

// 상단 헤더 (로고 + 로그인 상태)
function Header({ user, isLoggedIn, onHome, onLogin, onLogout }) {
  return (
    <Bar>
      <Logo type="button" onClick={onHome}>
        <span role="img" aria-hidden>
          🎬
        </span>
        MovieHop
      </Logo>

      <Right>
        {isLoggedIn ? (
          <>
            <UserName>
              {user?.username || user?.email || "회원"} 님
            </UserName>
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
    </Bar>
  );
}

const Bar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const Logo = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.text};
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondaryText};

  @media (max-width: 480px) {
    display: none;
  }
`;

const PrimaryButton = styled.button`
  border: none;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

const GhostButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  background: #fff;
  color: ${({ theme }) => theme.colors.text};
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: rgba(15, 23, 42, 0.04);
  }
`;

export default Header;
