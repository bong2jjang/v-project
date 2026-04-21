-- =============================================================================
-- Backup Data Restore Script
-- Source: backups/vms_chat_ops_20260411.sql
-- Target: Current v_project DB (after clean migration)
--
-- 실행 방법:
--   cat backups/restore_from_backup.sql | docker exec -i v-project-postgres psql -U vmsuser -d v_project
--
-- 복원 내용:
--   - 회사/부서 조직 데이터
--   - 사용자 8명 (admin, bong78, 이춘봉, 김병희, 정구환, test users)
--   - 메뉴 커스터마이징 (section, sort_order, parent_key, 커스텀 메뉴)
--   - 권한 그룹 (사용자정의그룹 2개 추가)
--   - 권한 그룹 매핑 (permission_group_grants)
--   - 사용자-그룹 매핑 (user_group_memberships)
--   - 사용자 개별 권한 (user_permissions)
--   - 계정 설정 (Slack/Teams encrypted credentials)
--   - 시스템 설정
--   - 메시지 히스토리 (선택적)
--
-- 주의: 이 스크립트는 idempotent합니다 (ON CONFLICT 사용)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 회사 (Companies)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO companies (id, name, code, is_active, created_at, updated_at) VALUES
    (1, 'VMS', 'VMS-KR', true, '2026-04-09 12:46:54.163949+00', '2026-04-09 12:46:54.163955+00')
ON CONFLICT (id) DO NOTHING;

SELECT setval('companies_id_seq', GREATEST((SELECT MAX(id) FROM companies), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 부서 (Departments) — parent_id FK 순서 고려
-- ─────────────────────────────────────────────────────────────────────────────
-- 먼저 최상위 부서 (parent_id IS NULL)
INSERT INTO departments (id, company_id, name, code, parent_id, sort_order, is_active, created_at, updated_at) VALUES
    (4,  1, '대표이사',       NULL, NULL, 0,  true, '2026-04-09 15:35:15.412753+00', '2026-04-10 07:59:27.397539+00'),
    (7,  1, '경영지원실',     NULL, NULL, 20, true, '2026-04-10 07:58:49.865689+00', '2026-04-10 08:00:43.856238+00'),
    (9,  1, '외부조직',       NULL, NULL, 60, true, '2026-04-10 08:00:11.742619+00', '2026-04-10 08:00:43.872128+00'),
    (6,  1, '전략사업부',     NULL, NULL, 10, true, '2026-04-10 07:57:34.996974+00', '2026-04-10 08:00:43.881898+00'),
    (8,  1, '기획영업본부',   NULL, NULL, 50, true, '2026-04-10 07:59:02.993224+00', '2026-04-10 08:00:43.895643+00'),
    (1,  1, '솔루션사업본부', NULL, NULL, 40, true, '2026-04-09 12:47:30.389505+00', '2026-04-10 08:00:43.907304+00'),
    (5,  1, '글로벌사업부',   NULL, NULL, 30, true, '2026-04-10 07:57:16.334504+00', '2026-04-10 08:00:43.920822+00')
ON CONFLICT (id) DO NOTHING;

-- 하위 부서 (parent_id 참조)
INSERT INTO departments (id, company_id, name, code, parent_id, sort_order, is_active, created_at, updated_at) VALUES
    (2,  1, '제품사업그룹', NULL, 1, 0, true, '2026-04-09 12:47:47.310547+00', '2026-04-09 12:47:47.310556+00'),
    (3,  1, '제품팀',       NULL, 2, 0, true, '2026-04-09 12:48:12.94347+00',  '2026-04-09 13:13:12.915066+00'),
    (10, 1, '운영1그룹',    NULL, 1, 0, true, '2026-04-10 08:01:05.281288+00', '2026-04-10 08:01:05.281294+00'),
    (11, 1, '운영2그룹',    NULL, 1, 0, true, '2026-04-10 08:01:20.053684+00', '2026-04-10 08:01:20.053689+00'),
    (12, 1, '사업팀',       NULL, 2, 0, true, '2026-04-10 13:33:15.811335+00', '2026-04-10 13:33:15.811341+00')
ON CONFLICT (id) DO NOTHING;

SELECT setval('departments_id_seq', GREATEST((SELECT MAX(id) FROM departments), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 사용자 (Users)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO users (id, email, username, hashed_password, role, is_active, created_at, updated_at, last_login, company_id, department_id, sso_provider, sso_provider_id, auth_method, start_page, theme, color_preset) VALUES
    (5,  'admin@example.com',        'admin',      '$2b$12$/RDKJPGGyow0MSdTNSRqlOxs0o502wQz8VCe.wIII88QTsWZb9xw6', 'SYSTEM_ADMIN', true,
        '2026-03-30 04:44:30.60941+00',  '2026-04-10 15:29:59.046431+00', '2026-04-10 15:29:59.044632+00',
        1, NULL, NULL, NULL, 'local', '', 'system', 'indigo'),
    (6,  'bong78@vms-solutions.com',  'viktor',     '$2b$12$x7kU2bmq5UqVhG5uoFf8ZuoXAkTotM7dVISmf8Q/jdokupg336Spu', 'ORG_ADMIN', true,
        '2026-04-08 09:02:23.448835+00', '2026-04-10 15:24:05.880445+00', '2026-04-10 15:24:05.87951+00',
        1, 2, 'microsoft', 'fb9620e2-4a03-49f0-983a-8448780f8ebb', 'hybrid', '', 'system', 'rose'),
    (7,  'yichunbong@hotmail.com',    '이춘봉',     '$2b$12$1OWWCAeKCEIdTcW.udWvN.8z5EmSOwxI/tc.jMluv88inGT0w17P.', 'USER', true,
        '2026-04-09 14:07:41.199295+00', '2026-04-10 15:03:34.567284+00', '2026-04-10 15:03:34.566088+00',
        1, 3, NULL, NULL, 'local', '', 'system', 'blue'),
    (8,  'kbhee@vms-solutions.com',   '김병희',     '$2b$12$ZsnC9RLzkblS1KPyItodNe2oA01jRUPJpmlL.wN.Wu6oxfAUDTtje', 'USER', true,
        '2026-04-09 15:43:33.63936+00',  '2026-04-09 15:43:33.639368+00', NULL,
        1, 4, NULL, NULL, 'local', '', 'system', 'blue'),
    (9,  'chunggh@vms-solutions.com', '정구환',     '$2b$12$g/NU4mGbvbR9E1lWVlthOednhNg/QifI6xxHkjAo/uHaaQxoiwtim', 'ORG_ADMIN', true,
        '2026-04-09 15:44:47.028659+00', '2026-04-09 15:44:47.028663+00', NULL,
        1, 1, NULL, NULL, 'local', '', 'system', 'blue'),
    (10, 'first@test.com',           'firstuser',  '$2b$12$ursgT2tDmjRyZTxLAw9BDuuoHRjsbgT0t1vas920288JWYQqtDKly', 'USER', true,
        '2026-04-10 01:59:55.052163+00', '2026-04-10 01:59:55.052169+00', NULL,
        NULL, NULL, NULL, NULL, 'local', '', 'system', 'blue'),
    (11, 'second@test.com',          'seconduser', '$2b$12$y.RuL9lSEGZKv9NBHJEQJuc/uDByREDOWWYi8o18NU4DXGWMwd0pi', 'USER', true,
        '2026-04-10 06:47:41.586825+00', '2026-04-10 06:47:41.58683+00',  NULL,
        NULL, NULL, NULL, NULL, 'local', '', 'system', 'blue'),
    (12, 'admin@test.com',           'newuser',    '$2b$12$FAbFWvO.dZuHSR3Y8808c.3k.K9uDi5GULxSx6VwUUTuE4ijpwR/a', 'USER', true,
        '2026-04-10 06:47:42.387077+00', '2026-04-10 06:47:42.387087+00', NULL,
        NULL, NULL, NULL, NULL, 'local', '', 'system', 'blue')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 메뉴 아이템 커스터마이징
--    기존 시드 메뉴 업데이트 + 커스텀 메뉴 추가
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. 기존 시드 메뉴의 section, sort_order, parent_key, icon 등을 백업 상태로 업데이트
-- (section은 migration에서 세팅 안 됨, 백업 데이터가 원본)
UPDATE menu_items SET section = 'basic', sort_order = 100,  icon = 'LayoutDashboard', parent_key = NULL
    WHERE permission_key = 'dashboard';
UPDATE menu_items SET section = 'basic', sort_order = 200,  icon = 'Radio',           parent_key = NULL
    WHERE permission_key = 'channels';
UPDATE menu_items SET section = 'basic', sort_order = 300,  icon = 'MessageSquare',   parent_key = 'menu_group01'
    WHERE permission_key = 'messages';
UPDATE menu_items SET section = 'basic', sort_order = 200,  icon = 'Link',            parent_key = NULL
    WHERE permission_key = 'integrations';
UPDATE menu_items SET section = 'basic', sort_order = 600,  icon = 'Settings',        parent_key = NULL
    WHERE permission_key = 'settings';
UPDATE menu_items SET section = 'basic', sort_order = 400,  icon = 'HelpCircle',      parent_key = NULL
    WHERE permission_key = 'help';
UPDATE menu_items SET section = 'basic', sort_order = 500,  icon = 'BarChart3',       parent_key = 'menu_group01'
    WHERE permission_key = 'statistics';
UPDATE menu_items SET section = 'admin', sort_order = 900,  icon = 'Users',           parent_key = NULL
    WHERE permission_key = 'users';
UPDATE menu_items SET section = 'admin', sort_order = 1200, icon = 'FileText',        parent_key = 'menu_group_mgtmonitor'
    WHERE permission_key = 'audit_logs';
UPDATE menu_items SET section = 'admin', sort_order = 1300, icon = 'Activity',        parent_key = 'menu_group_mgtmonitor'
    WHERE permission_key = 'monitoring';
UPDATE menu_items SET section = 'admin', sort_order = 1400, icon = 'ListTree',        parent_key = 'admin'
    WHERE permission_key = 'menu_management';
UPDATE menu_items SET section = 'admin', sort_order = 1100, icon = 'Shield',          parent_key = 'admin'
    WHERE permission_key = 'permission_management';
UPDATE menu_items SET section = 'admin', sort_order = 1000, icon = 'UserCog',         parent_key = NULL
    WHERE permission_key = 'permission_groups';
UPDATE menu_items SET section = 'admin', sort_order = 800,  icon = 'Building2',       parent_key = NULL
    WHERE permission_key = 'organizations';

-- updated_by = admin user (id=5) for all updates
UPDATE menu_items SET updated_by = 5, updated_at = NOW()
    WHERE permission_key IN (
        'dashboard','channels','messages','integrations','settings','help',
        'statistics','users','audit_logs','monitoring','menu_management',
        'permission_management','permission_groups','organizations'
    );

-- 4b. 커스텀 메뉴 추가 (백업에만 있던 것들)
INSERT INTO menu_items (permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, is_active, created_by, updated_by, created_at, updated_at)
VALUES
    ('custom_manual', '메뉴얼 링크', NULL, '/custom/manual', 'custom_iframe',
     'http://127.0.0.1:3000/docs', true, false, NULL, 2100, 'custom',
     true, 5, 5, '2026-04-09 07:03:47.071009+00', '2026-04-09 07:55:37.575832+00'),
    ('menu_group01', '히스토리/통계', 'area-chart', '/group/menu_group01', 'menu_group',
     NULL, false, false, NULL, 300, 'basic',
     true, 5, 5, '2026-04-09 10:13:07.891711+00', '2026-04-09 16:04:44.679303+00'),
    ('menu_group_mgtmonitor', '모니터링', 'monitor', '/group/menu_group_mgtmonitor', 'menu_group',
     NULL, false, false, NULL, 8000, 'admin',
     true, 5, 5, '2026-04-09 12:45:35.451658+00', '2026-04-09 13:37:07.383507+00')
ON CONFLICT (permission_key) DO NOTHING;

SELECT setval('menu_items_id_seq', GREATEST((SELECT MAX(id) FROM menu_items), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 사용자 정의 권한 그룹 추가
--    (기본 3개는 마이그레이션에서 이미 생성됨: 시스템 관리자, 조직 관리자, 일반 사용자)
-- ─────────────────────────────────────────────────────────────────────────────
-- 기존 기본 그룹 이름/설명 업데이트 (백업 데이터 반영)
UPDATE permission_groups SET
    description = '모든 메뉴에 대한 write 권한 (system_admin)',
    updated_at = '2026-04-10 15:18:08.838445+00'
WHERE name = '시스템 관리자';

UPDATE permission_groups SET
    description = '기본 메뉴 write + 관리 메뉴 read 권한 (org_admin)',
    updated_at = '2026-04-10 15:18:08.838445+00'
WHERE name = '조직 관리자';

UPDATE permission_groups SET
    description = '기본 메뉴 read 전용 권한 (user)',
    updated_at = '2026-04-10 15:18:08.838445+00'
WHERE name = '일반 사용자';

-- 사용자 정의 그룹 추가
INSERT INTO permission_groups (name, description, is_default, is_active, created_by, created_at, updated_at)
VALUES
    ('사용자정의그룹-1', '테스트 그룹 1', false, true, 5,
     '2026-04-09 13:34:45.213807+00', '2026-04-09 16:29:27.679438+00'),
    ('사용자정의그룹-2', '테스트 그룹 2', false, true, 5,
     '2026-04-09 15:12:55.630528+00', '2026-04-09 15:12:55.630535+00')
ON CONFLICT (name) DO NOTHING;

SELECT setval('permission_groups_id_seq', GREATEST((SELECT MAX(id) FROM permission_groups), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 권한 그룹 매핑 (Permission Group Grants)
--    permission_key로 menu_item_id를 조회하여 매핑
--    permission_group 이름으로 group_id를 조회하여 매핑
-- ─────────────────────────────────────────────────────────────────────────────

-- 기존 마이그레이션 시드 grants 삭제 후 백업 데이터로 재생성
-- (시드 grants는 name 기반이 아니라 기본 section 기반이므로 백업 데이터가 더 정확)
DELETE FROM permission_group_grants;

-- 시스템 관리자: 모든 메뉴 write
INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
SELECT pg.id, mi.id, 'write'
FROM permission_groups pg, menu_items mi
WHERE pg.name = '시스템 관리자'
  AND mi.permission_key IN (
    'channels','integrations','settings','custom_manual','help','users',
    'menu_management','permission_management','audit_logs','permission_groups',
    'organizations','dashboard','monitoring','messages','statistics'
  )
ON CONFLICT (permission_group_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- 조직 관리자: 기본 메뉴 write + 관리 메뉴 read + custom_manual none
INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
SELECT pg.id, mi.id,
    CASE mi.permission_key
        WHEN 'channels'              THEN 'write'
        WHEN 'integrations'          THEN 'write'
        WHEN 'settings'              THEN 'write'
        WHEN 'help'                  THEN 'write'
        WHEN 'dashboard'             THEN 'write'
        WHEN 'messages'              THEN 'write'
        WHEN 'statistics'            THEN 'write'
        WHEN 'custom_manual'         THEN 'none'
        WHEN 'users'                 THEN 'read'
        WHEN 'menu_management'       THEN 'read'
        WHEN 'permission_management' THEN 'read'
        WHEN 'audit_logs'            THEN 'read'
        WHEN 'permission_groups'     THEN 'read'
        WHEN 'organizations'         THEN 'read'
        WHEN 'monitoring'            THEN 'read'
        ELSE 'none'
    END
FROM permission_groups pg, menu_items mi
WHERE pg.name = '조직 관리자'
  AND mi.permission_key IN (
    'channels','integrations','settings','custom_manual','help','users',
    'menu_management','permission_management','audit_logs','permission_groups',
    'organizations','dashboard','monitoring','messages','statistics'
  )
ON CONFLICT (permission_group_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- 일반 사용자: 기본 메뉴 read
INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
SELECT pg.id, mi.id, 'read'
FROM permission_groups pg, menu_items mi
WHERE pg.name = '일반 사용자'
  AND mi.permission_key IN ('dashboard','integrations','channels','messages','help','statistics','settings')
ON CONFLICT (permission_group_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- 사용자정의그룹-1: 기본 메뉴 read
INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
SELECT pg.id, mi.id, 'read'
FROM permission_groups pg, menu_items mi
WHERE pg.name = '사용자정의그룹-1'
  AND mi.permission_key IN ('dashboard','integrations','channels','messages','help','statistics','settings')
ON CONFLICT (permission_group_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

SELECT setval('permission_group_grants_id_seq', GREATEST((SELECT MAX(id) FROM permission_group_grants), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 사용자-그룹 매핑 (User Group Memberships)
-- ─────────────────────────────────────────────────────────────────────────────
-- Backup mapping (old_group_id → group_name):
--   2 → 시스템 관리자, 3 → 조직 관리자, 4 → 일반 사용자, 14 → 사용자정의그룹-1

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 5, pg.id, NULL, '2026-04-09 14:33:39.976094+00'
FROM permission_groups pg WHERE pg.name = '시스템 관리자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 6, pg.id, 5, '2026-04-09 15:33:03.280934+00'
FROM permission_groups pg WHERE pg.name = '조직 관리자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 6, pg.id, 5, '2026-04-09 15:33:03.28094+00'
FROM permission_groups pg WHERE pg.name = '사용자정의그룹-1'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 7, pg.id, NULL, '2026-04-09 14:33:39.976094+00'
FROM permission_groups pg WHERE pg.name = '일반 사용자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 8, pg.id, 5, '2026-04-09 15:43:33.893391+00'
FROM permission_groups pg WHERE pg.name = '사용자정의그룹-1'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 8, pg.id, NULL, '2026-04-09 15:53:54.583669+00'
FROM permission_groups pg WHERE pg.name = '일반 사용자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 9, pg.id, 5, '2026-04-09 15:44:47.059909+00'
FROM permission_groups pg WHERE pg.name = '조직 관리자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 10, pg.id, NULL, '2026-04-10 02:04:55.859778+00'
FROM permission_groups pg WHERE pg.name = '일반 사용자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

INSERT INTO user_group_memberships (user_id, permission_group_id, assigned_by, created_at)
SELECT 11, pg.id, NULL, '2026-04-10 07:17:14.249704+00'
FROM permission_groups pg WHERE pg.name = '일반 사용자'
ON CONFLICT (user_id, permission_group_id) DO NOTHING;

SELECT setval('user_group_memberships_id_seq', GREATEST((SELECT MAX(id) FROM user_group_memberships), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 사용자 개별 권한 (User Permissions)
--    user 6 (viktor): 모든 메뉴 write
--    user 9 (정구환): organizations write
--    user 8 (김병희): settings write
--    user 7 (이춘봉): settings write
-- ─────────────────────────────────────────────────────────────────────────────
-- user 6 (viktor) - 모든 메뉴 write
INSERT INTO user_permissions (user_id, menu_item_id, access_level, granted_by, created_at, updated_at)
SELECT 6, mi.id, 'write', 5, '2026-04-09 04:48:34.541323+00', '2026-04-09 04:48:34.541327+00'
FROM menu_items mi
WHERE mi.permission_key IN (
    'dashboard','channels','messages','statistics','integrations','settings','help',
    'users','audit_logs','monitoring','menu_management','permission_management',
    'organizations','permission_groups','custom_manual'
)
ON CONFLICT (user_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- user 9 (정구환) - organizations write
INSERT INTO user_permissions (user_id, menu_item_id, access_level, granted_by, created_at, updated_at)
SELECT 9, mi.id, 'write', 5, '2026-04-09 16:29:03.627248+00', '2026-04-09 16:29:03.627308+00'
FROM menu_items mi WHERE mi.permission_key = 'organizations'
ON CONFLICT (user_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- user 8 (김병희) - settings write
INSERT INTO user_permissions (user_id, menu_item_id, access_level, granted_by, created_at, updated_at)
SELECT 8, mi.id, 'write', 5, '2026-04-09 16:30:28.299757+00', '2026-04-09 16:30:28.299761+00'
FROM menu_items mi WHERE mi.permission_key = 'settings'
ON CONFLICT (user_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- user 7 (이춘봉) - settings write
INSERT INTO user_permissions (user_id, menu_item_id, access_level, granted_by, created_at, updated_at)
SELECT 7, mi.id, 'write', 5, '2026-04-09 16:30:28.32683+00', '2026-04-09 16:30:28.326833+00'
FROM menu_items mi WHERE mi.permission_key = 'settings'
ON CONFLICT (user_id, menu_item_id) DO UPDATE SET access_level = EXCLUDED.access_level;

SELECT setval('user_permissions_id_seq', GREATEST((SELECT MAX(id) FROM user_permissions), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. 계정 (Accounts) — Slack/Teams 암호화된 credentials 포함
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO accounts (id, platform, name, token, app_token, tenant_id, app_id, app_password,
    prefix_messages_with_nick, edit_suffix, edit_disable, use_username, no_send_join_part,
    use_api, debug, is_valid, validation_errors, enabled,
    created_at, updated_at, created_by, updated_by,
    enabled_features, team_id, ms_refresh_token, ms_token_expires_at, ms_user_id, webhook_url) VALUES
-- Slack account (id=15)
(15, 'slack', 'viktor-bot',
    'gAAAAABpzwml3ZodTDq0Pz0jSy3G19iplYZxghfUhcwzLZhc9i-6rP0M04S2szQusA3aVsB4Gm1InSrOGqyz-eYn_s339EGs_jKhpHhEeZe_fzU-WV5wolHUKxzZDXouGNCVVvQIRGvE11Zaw_8-KAr5XY-biD4zNw==',
    'gAAAAABpzwmmoltNSllMMVkqmuYFVc5xqak1vwNhVVSsci-BWNvSWIkgfxPnenJqK8YcRbXpeZuDerrPHqz4-ldatLyTtvDjNTv0D5gf1xBbinaOQE0yYaeWHAMLK3VYjFbNBqG9P6TqUhXEC8AD-Q8ltG3CixydZcNCCUh7csYSNUE3u4ba5MXFLR-32wT0YaTppeM3yx751LE4eppZQdoNIhtoGqTOAA==',
    NULL, NULL, NULL,
    true, ' (edited)', false, true, true, true, false,
    true, NULL, true,
    '2026-04-03 00:28:22.307495+00', '2026-04-06 15:22:35.076147+00', NULL, 5,
    NULL, NULL, NULL, NULL, NULL, NULL),
-- Teams account (id=20)
(20, 'teams', 'vms-channel-bot',
    NULL, NULL,
    'gAAAAABp08z8h1lLTg7e5SC13n6uxN2lW4Em7LMQHTUANvyIgevYv-tebzIvpjMU48jmSoS87jP_dsJi9YbuYzmEwFZMso0sMokybBIF5PI8a8zI_6_2S9vcM_H4n7d_fpPep7x3vpVn',
    'gAAAAABp088ZwDb8wcsqizQEorCg48iQndVRbFdqOh7BsJgd8E2b4yg0NHngru8BbM5ARXTJiQwin-_yerEYo66qop2G1OAx8Zt5o3XMP_Op6YHE6-fKmuZCFFbIFCsKUBltJO4NNouA',
    'gAAAAABp08z8Z_GWUlW2Z7KJ1gGTDmUwoMaRMrbvV3zVEFp8YIH65uHSRKc3MV3Rf3s0iFG7XZv-6o0LRSpPJAsGMxj5RxF0Z4_lf9YslCQWxQvgSXE6_O7Cy9rgszr3QbFzP5qTs8M-',
    true, ' (edited)', false, true, true, true, false,
    true, NULL, true,
    '2026-04-06 15:10:52.603772+00', '2026-04-10 07:45:44.144944+00', 5, 5,
    NULL,
    'gAAAAABp08z8MpTUDgMeXmuenM5jpCjK5FRZ9F6Y08RxTIsLiDHB2MB0FSpjCW8tKEoXgz5fPa_HlWt01rodOioFI1Awp0-iX15EyQfXYb7O7rp8CfmwfjMFAGjqxw-ZjR7t7MnsD5Kv',
    NULL, NULL, 'bong78@vms-solutions.com', NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval('accounts_id_seq', GREATEST((SELECT MAX(id) FROM accounts), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. 시스템 설정 (System Settings)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page)
VALUES (1, true, 'http://127.0.0.1:3000/docs', NULL, NULL, '/')
ON CONFLICT (id) DO UPDATE SET
    manual_enabled = EXCLUDED.manual_enabled,
    manual_url = EXCLUDED.manual_url,
    default_start_page = EXCLUDED.default_start_page;

SELECT setval('system_settings_id_seq', GREATEST((SELECT MAX(id) FROM system_settings), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. 메시지 히스토리 (Messages) — 테스트 메시지 데이터
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO messages (id, message_id, text, gateway, source_account, source_channel, source_user,
    destination_account, destination_channel, protocol, "timestamp", created_at,
    has_attachment, attachment_count, message_type, status, error_message, retry_count,
    delivered_at, source_user_name, source_user_display_name, attachment_details,
    message_format, source_channel_name, destination_channel_name) VALUES
(190, '1775500226288', '메시지 테스트 12', 'teams→slack', 'teams',
    'c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2',
    'fb9620e2-4a03-49f0-983a-8448780f8ebb', 'slack', 'C0APBT4G4UC', 'teams',
    '2026-04-06 18:30:26.288+00', '2026-04-06 18:30:34.067826+00',
    false, 0, 'text', 'sent', NULL, 0, '2026-04-06 18:31:06.649477+00',
    '이춘봉(Viktor)', '이춘봉(Viktor)', NULL, 'text',
    'c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2',
    'viktor-테스트-01'),
(201, '1775539374754', '슬랙에 보내기 테스트 2', 'teams→slack', 'teams',
    'c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2',
    'fb9620e2-4a03-49f0-983a-8448780f8ebb', 'slack', 'C0APBT4G4UC', 'teams',
    '2026-04-07 05:22:54.754+00', '2026-04-07 05:22:58.348907+00',
    false, 0, 'text', 'sent', NULL, 0, '2026-04-07 05:22:57.286266+00',
    '이춘봉(Viktor)', '이춘봉(Viktor)', NULL, 'text',
    'c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2',
    'viktor-테스트-01'),
(203, '1775539668697', '', 'teams→slack', 'teams',
    'c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2',
    'fb9620e2-4a03-49f0-983a-8448780f8ebb', 'slack', 'C0APBT4G4UC', 'teams',
    '2026-04-07 05:27:48.697+00', '2026-04-07 05:27:52.629891+00',
    false, 0, 'text', 'sent', NULL, 0, '2026-04-07 05:27:51.507132+00',
    '이춘봉(Viktor)', '이춘봉(Viktor)', NULL, 'text',
    '슬랙-팀즈 (테스트)', 'viktor-테스트-01')
ON CONFLICT (id) DO NOTHING;

SELECT setval('messages_id_seq', GREATEST((SELECT MAX(id) FROM messages), 1));

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. 나머지 시퀀스 리셋
-- ─────────────────────────────────────────────────────────────────────────────
SELECT setval('refresh_tokens_id_seq', 1, false);
SELECT setval('password_reset_tokens_id_seq', 1, false);
SELECT setval('audit_logs_id_seq', 1, false);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증 쿼리
-- ─────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '=== Restore Verification ==='
SELECT 'companies' AS table_name, count(*) AS rows FROM companies
UNION ALL SELECT 'departments', count(*) FROM departments
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'menu_items', count(*) FROM menu_items
UNION ALL SELECT 'permission_groups', count(*) FROM permission_groups
UNION ALL SELECT 'permission_group_grants', count(*) FROM permission_group_grants
UNION ALL SELECT 'user_group_memberships', count(*) FROM user_group_memberships
UNION ALL SELECT 'user_permissions', count(*) FROM user_permissions
UNION ALL SELECT 'accounts', count(*) FROM accounts
UNION ALL SELECT 'system_settings', count(*) FROM system_settings
UNION ALL SELECT 'messages', count(*) FROM messages
UNION ALL SELECT 'notifications', count(*) FROM notifications
ORDER BY table_name;

\echo ''
\echo '=== Users ==='
SELECT id, email, role, auth_method FROM users ORDER BY id;

\echo ''
\echo '=== Permission Groups ==='
SELECT id, name, is_default FROM permission_groups ORDER BY id;
