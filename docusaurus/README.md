# VMS Channel Bridge 문서

Docusaurus 기반 VMS Channel Bridge 프로젝트 문서 사이트

## 🚀 빠른 시작

### 헬퍼 스크립트 사용 (권장)

**Linux/Mac:**
```bash
# 개발 서버 시작 (자동으로 로그 확인)
./scripts/dev.sh

# 프로덕션 빌드 테스트
./scripts/build.sh

# 로그 확인
./scripts/logs.sh

# 서버 중지
./scripts/stop.sh

# 완전 초기화 (컨테이너, 캐시, node_modules 삭제)
./scripts/clean.sh
```

**Windows:**
```cmd
# 개발 서버 시작 (자동으로 로그 확인)
scripts\dev.bat

# 프로덕션 빌드 테스트
scripts\build.bat

# 로그 확인
scripts\logs.bat

# 서버 중지
scripts\stop.bat

# 완전 초기화 (컨테이너, 캐시, node_modules 삭제)
scripts\clean.bat
```

### Docker Compose 직접 사용

```bash
# 개발 서버 실행
docker compose up -d

# 로그 확인
docker compose logs -f

# 서버 중지
docker compose down

# 브라우저에서 http://localhost:3000 접속
```

### 로컬 개발 (pnpm)

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm start

# 프로덕션 빌드
pnpm run build

# 빌드 결과 미리보기
pnpm run serve
```

## 📚 문서 마이그레이션

기존 docs 디렉토리의 문서를 Docusaurus 포맷으로 마이그레이션:

```bash
cd scripts
python migrate-to-docusaurus.py
```

## 🏗️ 프로젝트 구조

```
vms-channel-bridge-docs/
├── docs/                    # 문서 마크다운 파일
│   ├── intro.md
│   ├── user-guide/
│   ├── admin-guide/
│   ├── developer-guide/
│   └── api/
├── blog/                    # 블로그 (설계 문서, 진행 보고)
├── src/
│   ├── components/          # React 컴포넌트
│   ├── css/                 # 커스텀 CSS
│   └── pages/               # 커스텀 페이지
├── static/                  # 정적 파일 (이미지 등)
├── docusaurus.config.ts     # Docusaurus 설정
├── sidebars.ts              # 사이드바 구조
└── package.json
```

## 🔧 설정

- **Docusaurus 버전**: 3.1.0
- **Node.js**: 18+
- **패키지 매니저**: pnpm 10.32.1+
- **다국어**: 한국어 (기본), 영어

## 💡 개발 워크플로우

### 메인 프로젝트와 분리된 독립 실행

이 문서 프로젝트는 메인 VMS Channel Bridge 프로젝트와 완전히 독립적으로 실행됩니다.

**메인 프로젝트 개발 시:**
- 메인 프로젝트만 실행하면 docs는 빌드되지 않음
- 빌드 시간 단축 효과

**Docs만 개발 시:**
- 이 디렉토리에서만 스크립트 실행
- 메인 프로젝트 영향 없음
- 포트 3000에서 독립 실행

### 빌드 성능 최적화

- **Docker 빌드 캐시**: pnpm store 볼륨 마운트로 재빌드 시간 단축
- **Hot Reload**: 소스 파일 수정 시 자동 반영
- **독립 실행**: 메인 프로젝트와 빌드 분리로 효율성 향상

## 📖 추가 정보

자세한 내용은 [DOCUSAURUS_INTEGRATION_PLAN.md](../docs/design/proposals/DOCUSAURUS_INTEGRATION_PLAN.md) 참조

## 🤝 기여

문서 개선 사항이 있으시면 PR을 보내주세요!
