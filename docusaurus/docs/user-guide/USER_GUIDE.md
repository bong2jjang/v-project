---
id: user-guide
title: VMS Chat Ops 사용자 가이드
sidebar_position: 1
tags: [guide, user]
---

# VMS Chat Ops 사용자 가이드

**버전**: 3.1.0
**최종 업데이트**: 2026-04-10

---

## 소개

VMS Chat Ops는 Slack과 Microsoft Teams 간 메시지를 양방향으로 브리지하는 서비스입니다. Light-Zowe Provider Pattern 아키텍처를 기반으로 하며, 웹 관리 UI를 통해 Route 관리, 메시지 모니터링, 통계 조회 등을 제공합니다.

### 주요 기능

- **양방향 메시지 브리지**: Slack ↔ Teams 실시간 메시지 전달
- **파일/이미지 전달**: 인라인 이미지, 첨부파일 크로스 플랫폼 전송
- **동적 Route 관리**: 재시작 없이 라우팅 규칙 추가/삭제
- **메시지 히스토리**: 전송된 메시지 기록 조회, 검색, 내보내기 (CSV/JSON)
- **통계 대시보드**: 메시지 통계, 채널별 분석, 시간대별 패턴
- **감사 로그**: 관리 작업 이력 추적
- **Provider 계정 관리**: UI에서 Slack/Teams 계정 추가·수정
- **SSO 로그인**: Microsoft Entra ID, OIDC 통합 인증
- **RBAC 권한 관리**: 3단계 역할 기반 접근 제어
- **OAuth 연동 관리**: 사용자별 OAuth 토큰 관리
- **커스텀 메뉴**: 관리자가 사이드바 메뉴를 커스터마이징

---

## 시작하기

### 1. 웹 UI 접속

브라우저에서 접속합니다:

```
http://localhost:5173
```

또는 서버 IP 주소:

```
http://<서버IP>:5173
```

### 2. 로그인

#### 로컬 계정 로그인

기본 관리자 계정으로 로그인합니다:

- **사용자명**: `admin`
- **비밀번호**: 초기 설정값 (관리자에게 문의)

#### SSO 로그인

SSO가 설정된 환경에서는 로그인 화면에 SSO 버튼이 표시됩니다:

1. **"Microsoft로 로그인"** 또는 **"SSO로 로그인"** 버튼 클릭
2. 해당 IdP(Identity Provider)의 로그인 페이지로 리다이렉트
3. 인증 완료 후 자동으로 VMS Chat Ops에 로그인

SSO 사용자는 처음 로그인 시 자동으로 계정이 생성됩니다. 인증 방식(local/sso/hybrid)은 관리자가 설정합니다.

### 3. 화면 구성

왼쪽 사이드바 메뉴 (서버에서 RBAC 권한에 따라 필터링되어 표시):

| 메뉴 | 설명 | 접근 권한 |
|------|------|----------|
| **Dashboard** | 브리지 상태, 연결 상태, 실시간 모니터링 | 전체 |
| **Routes** | Slack ↔ Teams 채널 라우팅 규칙 관리 | 전체 |
| **Messages** | 메시지 히스토리 조회 및 검색 | 전체 |
| **Statistics** | 메시지 통계 대시보드 | 전체 |
| **Integrations** | OAuth 연동 관리 | 전체 |
| **Profile** | 내 프로필 및 비밀번호 변경 | 전체 |
| **Audit Logs** | 관리 작업 감사 로그 | 관리자 |
| **User Management** | 사용자 관리, RBAC | 관리자 |
| **Settings** | 시스템 설정, Provider, SSO, 메뉴 관리 | 관리자 |
| **커스텀 메뉴** | 관리자가 추가한 iframe/링크 메뉴 | 설정에 따름 |

---

## Dashboard

Dashboard는 시스템의 현재 상태를 한눈에 확인하는 메인 화면입니다.

### 브리지 상태

상단에 현재 브리지 연결 상태가 표시됩니다:

- **Connected**: 정상 연결 중 (Slack/Teams Provider 활성)
- **Disconnected**: 연결 끊김
- **Partial**: 일부 Provider만 연결

### 연결된 Provider

활성 Provider 목록과 각 Provider의 상태를 확인할 수 있습니다:

- **Slack** — Socket Mode 연결 상태
- **Teams** — Bot Framework / Graph API 연결 상태

### 시스템 상태 팝업

상단 바의 시스템 상태 아이콘을 클릭하면 각 서비스별 상세 헬스 정보를 확인할 수 있습니다:

- Database (PostgreSQL)
- Redis
- Slack Provider
- Teams Provider

---

## Routes 관리

Routes 페이지에서 Slack과 Teams 채널 간의 메시지 라우팅 규칙을 관리합니다.

### 1. Route 목록 보기

현재 설정된 모든 Route가 카드 또는 테이블 형태로 표시됩니다.

**표시 정보**:
- **소스 채널**: 발신 플랫폼 및 채널명
- **대상 채널**: 수신 플랫폼 및 채널명
- **방향**: 양방향(↔) 또는 단방향(→)
- **모드**: sender_info (발신자 정보 포함) 등
- **상태**: 활성화/비활성화

### 2. 새 Route 추가

1. **"+ Add Route" 버튼 클릭**
2. **소스 플랫폼 선택** (Slack 또는 Teams)
3. **소스 채널 선택** — 드롭다운에서 채널 목록 자동 로드
4. **대상 플랫폼 선택**
5. **대상 채널 선택**
6. **옵션 설정**:
   - **양방향**: 양쪽 모두 메시지 전달 (기본: 활성)
   - **모드**: `sender_info` (발신자 이름 표시) 또는 `editable`
7. **"Create" 클릭**

Route는 즉시 적용됩니다 (서비스 재시작 불필요).

### 3. Route 삭제

Route 카드의 삭제 버튼 클릭 → 확인 다이얼로그 → 즉시 삭제됩니다.

### 4. Route 활성화/비활성화

Route를 일시적으로 중지하려면 토글 스위치를 사용합니다.

---

## Messages (메시지 히스토리)

Messages 페이지에서 브리지를 통해 전달된 모든 메시지 기록을 조회합니다.

### 1. 메시지 카드

각 메시지는 카드 형태로 표시됩니다:

- **발신자 아바타 및 이름**: 원본 메시지 작성자
- **상대 시간**: "방금 전", "5분 전", "2시간 전" 등
- **메시지 본문**: 긴 메시지는 접기/펼치기 지원
- **첨부파일**: 파일명, 타입, 크기 표시
- **전송 상태**: 전송 완료(초록), 전송 실패(빨강), 대기 중(노랑), 재시도 중
- **Route 흐름**: 소스 플랫폼 → 대상 플랫폼 (채널명 표시)
- **재시도 횟수**: 실패 후 재시도한 경우 횟수 표시
- **에러 메시지**: 실패 시 원인 표시

### 2. 메시지 검색 및 필터

상단 검색 바와 필터를 사용하여 메시지를 찾습니다:

- **텍스트 검색**: 메시지 내용 키워드 검색
- **Gateway 필터**: slack→teams, teams→slack 등
- **채널 필터**: 소스 또는 대상 채널 선택
- **Route 필터**: 특정 Route의 메시지만 조회
- **사용자 필터**: 특정 발신자의 메시지만 표시
- **상태 필터**: sent, failed, pending, retrying
- **날짜 범위**: 기간별 조회

### 3. 메시지 내보내기

필터링된 메시지를 파일로 내보낼 수 있습니다:

- **CSV 내보내기**: Excel 호환 (한글 지원, UTF-8 BOM)
  - 포함 컬럼: ID, 시간, Gateway, 소스 채널, 발신자, 대상 채널, 메시지, 상태, 첨부파일 정보
- **JSON 내보내기**: 전체 메시지 데이터 (메타데이터 포함)

### 4. 메시지 삭제 (관리자)

관리자는 개별 메시지 삭제, 필터 기반 일괄 삭제, 전체 삭제가 가능합니다.

---

## Statistics (통계 대시보드)

Statistics 페이지에서 메시지 전송 현황을 시각적으로 분석합니다.

### 통계 항목

- **전체 메시지 수**: 기간 내 총 메시지 수
- **Gateway별 분포**: Slack→Teams vs Teams→Slack 비율
- **채널별 통계**: 가장 활발한 채널
- **시간대별 패턴**: 시간별/요일별 메시지 분포
- **상태별 분포**: 성공/실패/재시도 비율
- **첨부파일 통계**: 첨부파일 포함 메시지 수, 파일 타입별 분포

### 기간 선택

- 오늘 / 최근 7일 / 최근 30일 / 사용자 정의 범위

---

## Audit Logs (감사 로그)

관리 작업의 이력을 추적합니다. 누가, 언제, 무엇을 변경했는지 확인할 수 있습니다.

### 기록되는 작업

- Route 추가/삭제/수정
- Provider 계정 변경
- 사용자 관리 (생성, 삭제, 역할 변경)
- 시스템 설정 변경
- 로그인/로그아웃

### 필터

- 사용자별 / 작업 유형별 / 리소스별 / 기간별

### 내보내기

감사 로그를 CSV로 내보낼 수 있습니다.

---

## Integrations (연동 관리)

Integrations 페이지에서 OAuth 연동 상태를 관리합니다.

### 내 OAuth 토큰

현재 연결된 OAuth 토큰 목록을 확인하고 관리합니다:

- **토큰 상태**: 활성/만료/취소 상태 확인
- **연결 해제**: 더 이상 사용하지 않는 연동 제거
- **Microsoft 위임**: Teams Provider에 대한 사용자 위임 연결

### 관리자 OAuth 개요 (관리자만)

관리자는 전체 사용자의 OAuth 연동 현황을 확인할 수 있습니다.

---

## Profile (프로필)

Profile 페이지에서 내 계정 정보를 관리합니다:

- **프로필 정보 수정**: 이름, 이메일 등
- **비밀번호 변경**: 현재 비밀번호 확인 후 변경 (로컬 계정만)
- **인증 방식 확인**: local / sso / hybrid 상태

---

## Settings (설정)

### Provider 관리

Settings 페이지에서 Slack, Teams Provider 계정을 관리합니다:

- **Slack 계정**: Bot Token, App Token 설정
- **Teams 계정**: Tenant ID, App ID, App Password 설정
- **연결 테스트**: 설정 후 연결 테스트 버튼으로 검증
- **기능 관리**: 플랫폼별 사용 가능 기능(파일 전송, 스레드 등) 확인

### SSO 설정 (관리자)

SSO(Single Sign-On) Provider를 설정합니다:

- **Microsoft Entra ID**: Tenant ID, Client ID, Client Secret 설정
- **Generic OIDC**: Issuer URL, Client ID, Client Secret 설정
- **인증 방식**: local(로컬만) / sso(SSO만) / hybrid(둘 다 허용)

### 메뉴 관리 (관리자)

사이드바 커스텀 메뉴를 관리합니다:

- **커스텀 iframe**: 외부 페이지를 iframe으로 임베드
- **커스텀 링크**: 외부 URL 링크 추가
- **메뉴 그룹**: 메뉴 항목을 그룹화
- **순서 변경**: 드래그앤드롭으로 메뉴 순서 조정
- **권한 설정**: 메뉴별 접근 가능 역할 지정

### 시스템 설정

일반 시스템 설정을 관리합니다.

---

## FAQ

### Q1. 메시지가 전달되지 않아요

**체크리스트**:
- Dashboard에서 브리지 상태가 "Connected"인가?
- Routes 페이지에서 해당 Route가 활성화 상태인가?
- Slack Bot이 소스 채널에 초대되었나?
- Teams Bot이 대상 채널에 추가되었나?

**해결 방법**:
1. Dashboard에서 Provider 연결 상태 확인
2. Routes 페이지에서 Route 확인
3. Messages 페이지에서 실패 메시지의 에러 메시지 확인
4. Settings에서 Provider 연결 테스트 실행

### Q2. 특정 채널만 동기화를 중단하고 싶어요

Routes 페이지에서 해당 Route의 토글을 비활성화하거나 삭제합니다. 즉시 적용됩니다.

### Q3. 이미지가 전달되지 않아요

인라인 이미지와 첨부파일 전달은 지원됩니다:
- **Slack → Teams**: 파일 다운로드 후 `hostedContents`로 인라인 전송
- **Teams → Slack**: Graph API에서 이미지 다운로드 후 `files.upload`로 전송

이미지 전달 실패 시 Messages 페이지에서 에러 메시지를 확인하세요.

### Q4. CSV 내보내기에서 한글이 깨져요

CSV 내보내기는 UTF-8 BOM이 포함되어 있어 Excel에서 정상적으로 한글이 표시됩니다. 다른 프로그램에서 깨지는 경우 파일 인코딩을 UTF-8로 설정하세요.

### Q5. 메시지 전송 기록을 확인하고 싶어요

Messages 페이지에서 다양한 필터로 메시지를 검색할 수 있습니다. CSV 또는 JSON으로 내보내기도 가능합니다.

### Q6. SSO 로그인이 안 돼요

**체크리스트**:
- Settings > SSO에서 Provider가 설정되어 있는가?
- SSO Provider의 Redirect URI가 올바른가? (`http://localhost:8000/api/auth/sso/callback/{provider}`)
- 인증 방식이 `sso` 또는 `hybrid`로 설정되어 있는가?

### Q7. 접근 권한이 부족하다고 나와요

사용자 역할(SYSTEM_ADMIN, ORG_ADMIN, USER)에 따라 접근 가능한 메뉴가 다릅니다. 관리자에게 권한 변경을 요청하세요.

---

## 관련 문서

- [관리자 가이드](../admin-guide/admin-guide) — 시스템 관리
- [트러블슈팅](../admin-guide/troubleshooting) — 문제 해결
- [API 문서](../api/api) — REST API 레퍼런스

---

**최종 업데이트**: 2026-04-10
**문서 버전**: 3.1
