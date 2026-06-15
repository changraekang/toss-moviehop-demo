# 네이버 로그인 설정 (implicit SDK 방식)

lckfantasy 와 동일하게 **네이버 JavaScript SDK(implicit)** 로 동작합니다.
프론트가 access_token 을 직접 받아 백엔드로 전달하므로, 백엔드에는
Client Secret 이 필요 없습니다.

## 1. 네이버 개발자센터 앱 등록
1. https://developers.naver.com/apps/#/register 에서 애플리케이션 등록
2. 사용 API: **네이버 로그인**
3. 환경: **PC 웹** (+ 필요 시 모바일 웹)
4. 서비스 URL: 배포 도메인 (예: `https://your-domain.com`)
5. **Callback URL**: 사이트 루트로 등록
   - 배포: `https://your-domain.com`
   - 로컬: `http://localhost:5173`
   - (implicit 방식은 토큰을 URL 해시로 돌려주므로 별도 콜백 경로/SPA 폴백이 필요 없습니다.)
6. 발급되는 **Client ID** 를 프론트 env 에 입력

## 2. 프론트엔드 환경변수 (`toss-moviehop-vite/.env`)
`.env.example` 복사 후:
```
VITE_API_BASE_URL=https://api.your-domain.com
VITE_NAVER_CLIENT_ID=발급받은_Client_ID
VITE_NAVER_CALLBACK_URL=https://your-domain.com
```

## 3. 동작 흐름 (lckfantasy 패턴)
1. `index.html` 이 네이버 implicit SDK(`naverLogin_implicit-1.0.3.js`) 로드
2. 로그인 화면에서 `naver_id_login` SDK 초기화 → `네이버로 로그인` 클릭
3. 네이버 인증 후 Callback URL 로 `#access_token=...&state=...` 해시와 함께 복귀
4. 앱이 해시에서 access_token 파싱 → `POST /auth/naver { access_token, token_type, state }`
5. 백엔드가 `https://openapi.naver.com/v1/nid/me` 로 프로필 조회 → 사용자 upsert → JWT 발급
6. 프론트는 JWT 를 localStorage 에 저장하고 로그인 완료

## 4. 플랫폼 분기 (현재: 웹=네이버 전용)
- 이번 배포(웹)는 **네이버 로그인 전용**입니다.
- 모바일=Toss / 웹=Naver 분기는 추후 확장용 진입점만 남겨둔 상태입니다.
  (백엔드 Toss 엔드포인트 `/auth/toss/*` 와 `/auth/login` 의 tossUserInfo 분기는 그대로 유지)
- Toss 사용자 대상 "네이버 연동 이메일" 발송은 추후 AWS SES(nodemailer)로 추가 예정.

## 5. 별점 게이팅 동작
- **미로그인** 상태에서 별점 클릭 → 로그인 화면으로 이동
- **로그인** 상태에서 별점 클릭 → 해당 영화 퀴즈를 풀고(정답 시) → 별점 등록
- 이미 퀴즈를 푼 영화는 바로 별점 수정 가능

---

## 6. Toss 계정 ↔ 네이버 연동 (이메일 인증)

Toss(모바일) 사용자가 자신의 계정에 네이버 로그인을 연결하는 흐름입니다.

### 동작
1. (모바일/Toss) 로그인된 사용자가 이메일을 입력해 연동을 요청
   → `POST /auth/link/send-code` (JWT 필요) → 6자리 인증코드 메일 발송(SES)
2. 메일의 링크(`WEB_BASE_URL/?link=1`)로 웹 접속 → 연동 화면에서 코드 입력
3. `네이버 로그인하고 연동하기` 클릭 → 네이버 로그인(implicit) 완료
4. 콜백에서 `POST /auth/link/verify { code, access_token }` 호출
   → 코드 검증 + 네이버 프로필 조회 → 기존 Toss 계정에 `naverUserId`/`naverCi` 병합
5. 이후 같은 사용자는 Toss / 네이버 어느 쪽으로 로그인해도 동일 계정

> 네이버 `ci`(연계정보)는 네이버 측 CI 제공 계약이 있는 앱에서만 내려옵니다.
> 계약 전에는 `ci`가 null 이며, 식별은 네이버 고유 `id`(naverUserId)로 이뤄집니다.

### 백엔드 .env (SES / IAM 액세스키 — lckfantasy 동일)
```
Accesskey=발급받은_IAM_AccessKeyID
SecretAccesskey=발급받은_IAM_SecretAccessKey
AWS_REGION=ap-northeast-2
SES_MAIL_FROM=인증한_발신주소@yourdomain.com   # SES 자격 증명에서 인증 필요
WEB_BASE_URL=https://your-web-domain.com        # 연동 메일에 넣을 웹 주소
```

### 의존성
백엔드에 `nodemailer`, `aws-sdk` 추가됨 → `npm install` 후 사용.
SES 키/발신주소 인증이 끝나면 바로 메일이 발송됩니다.
