# Database Migrations

이 디렉토리는 수동 데이터베이스 마이그레이션 스크립트를 포함합니다.

## 실행 방법

마이그레이션 스크립트는 Docker 컨테이너 내에서 실행해야 합니다:

```bash
# 마이그레이션 실행
docker exec vms-channel-bridge-backend python migrations/001_add_message_delivery_status.py

# 롤백 (필요시)
docker exec vms-channel-bridge-backend python migrations/001_add_message_delivery_status.py --rollback
```

## 마이그레이션 목록

### 001_add_message_delivery_status.py
- **날짜**: 2026-04-03
- **목적**: 메시지 전송 상태 추적 기능 추가
- **변경사항**:
  - `status` 컬럼 추가 (VARCHAR(20), default='pending')
  - `error_message` 컬럼 추가 (TEXT)
  - `retry_count` 컬럼 추가 (INTEGER, default=0)
  - `delivered_at` 컬럼 추가 (TIMESTAMP)
  - `idx_status` 인덱스 생성
- **기존 데이터 처리**: 기존 메시지는 status='sent'로 설정

## 주의사항

1. **프로덕션 환경**: 마이그레이션 실행 전 반드시 데이터베이스 백업을 수행하세요
2. **테스트 환경**: 먼저 개발 환경에서 마이그레이션을 테스트한 후 프로덕션에 적용하세요
3. **롤백**: 문제 발생 시 `--rollback` 옵션으로 변경사항을 되돌릴 수 있습니다
4. **멱등성**: 각 마이그레이션은 여러 번 실행해도 안전합니다 (이미 적용된 경우 스킵)

## 새 마이그레이션 작성

새 마이그레이션을 작성할 때는 다음 규칙을 따르세요:

1. 파일명: `00X_descriptive_name.py` (예: `002_add_user_preferences.py`)
2. docstring에 변경 내역과 실행 방법 명시
3. 롤백 기능 구현
4. 컬럼 존재 여부 확인 (멱등성 보장)
5. 트랜잭션 사용 (원자성 보장)
