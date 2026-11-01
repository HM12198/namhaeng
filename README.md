# 남행열차 회원 사이트 + 운영진 방

카카오로 로그인하고, 방장·운영진이 승인한 사람만 들어오는 사이트 두 개.

| 주소 | 누가 | 할 수 있는 것 |
|---|---|---|
| `/` 회원 사이트 | 회원·운영진·방장 | 공지 보기, 직관 모임·자유 게시판 글쓰기, 닉네임 설정 |
| `/staff/` 운영진 방 | 운영진·방장 | 가입 승인·거절, 강퇴·해제, 메모(접수코드), 운영진 게시판 |

역할: 승인 대기 → 회원 → 운영진 → 방장. 강퇴되면 아무것도 못 봄. 운영진 임명·해임은 방장만.
공지는 운영진·방장만 쓰고 상단 고정 가능. 글 삭제는 본인 또는 운영진.

주소: https://hm12198.github.io/namhaeng/ (회원) · https://hm12198.github.io/namhaeng/staff/ (운영진)

## 파일
- 저장소 루트가 그대로 사이트 (GitHub Pages, main 브랜치). 서버 값은 `config.js`에만 있음.
- `supabase/schema.sql` DB·권한 규칙 (Supabase 프로젝트 namhaeng에 적용됨).
- `assets/app-icon-tigers.png` 카카오 앱 아이콘.

## 준비 순서
1. **Supabase**: 가입 → 새 프로젝트(지역 Seoul) → SQL Editor에 `schema.sql` 실행.
   Claude에 Supabase 커넥터를 연결하면 이 단계는 Claude가 대신 함.
2. **카카오 디벨로퍼스** (developers.kakao.com): 내 애플리케이션 → 앱 추가
   - 앱 키 > REST API 키 → Supabase Authentication > Providers > Kakao 의 Client ID
   - 보안 > Client Secret 코드 생성·활성화 → Supabase 의 Client Secret
   - 카카오 로그인 활성화, Redirect URI 에 `https://<프로젝트>.supabase.co/auth/v1/callback`
   - 동의항목: 닉네임·프로필 사진만 (이메일은 비즈 앱이라 생략). Supabase Kakao 설정에서 "이메일 없는 사용자 허용"을 켬
   - 플랫폼 > Web 에 사이트 주소 등록
3. **호스팅**: 이 저장소를 GitHub Pages(공개 저장소)나 Cloudflare Pages 등에 올림.
   Supabase Authentication > URL Configuration 에 사이트 주소를 Site URL·Redirect URL 로 등록.
4. `config.js` 에 Supabase Project URL 과 anon 키 입력 (Settings > API).
5. 방장이 카카오로 한 번 로그인 → SQL Editor에서 본인을 방장으로 (schema.sql 맨 아래 주석).

## 테스트한 것
- 로컬 Postgres에서 권한 규칙: 회원 자가 승격 차단, 운영진의 방장 강퇴 차단, 대기·강퇴 회원 글 읽기/쓰기 차단,
  회원의 공지·운영진 게시판 글쓰기 차단, 메모는 운영진만 열람, 강퇴 즉시 글 0개.
- 가짜 백엔드로 화면: 로그인 전 / 승인 대기 / 회원 게시판 / 회원의 운영진 방 접근 차단 / 방장의 승인·회원 관리.
- 실제 카카오 로그인은 계정 연결 후 확인 필요.
