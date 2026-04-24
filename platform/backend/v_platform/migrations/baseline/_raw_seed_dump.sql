--
-- PostgreSQL database dump
--

\restrict Nj8FCZ8s6ujjHwF7LT4PRHNLippZYKgE8xi7VtaXjVWu7sEkKKUEmojcwGx5oZT

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2442, 'itsm_group_personal', '개인 설정', 'UserCog', '#itsm_group_personal', 'menu_group', NULL, NULL, NULL, NULL, 900, 'basic', 'v-itsm', false, NULL, 5, '2026-04-22 19:53:48.422004+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2314, 'ui_builder_help', '도움말', 'HelpCircle', '/help', 'built_in', NULL, NULL, NULL, NULL, 700, 'basic', 'v-ui-builder', true, NULL, NULL, '2026-04-19 12:43:55.147737+00', '2026-04-19 12:43:55.147737+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2436, 'platform_group_observability', '감사 & 모니터링', 'Activity', '#platform_group_observability', 'menu_group', NULL, NULL, NULL, NULL, 1150, 'admin', NULL, true, NULL, 5, '2026-04-22 19:53:46.673797+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (14, 'organizations', '조직 관리', 'Building2', '/admin/organizations', 'built_in', NULL, NULL, false, 'platform_group_admin', 710, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:10.776933+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (8, 'users', '사용자 관리', 'Users', '/users', 'built_in', NULL, NULL, false, 'platform_group_admin', 720, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (6, 'settings', '설정', 'Settings', '/settings', 'built_in', NULL, NULL, false, NULL, 910, 'basic', NULL, true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-22 19:57:51.751184+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (13, 'permission_groups', '권한 그룹', 'UserCog', '/admin/permission-groups', 'built_in', NULL, NULL, false, 'platform_group_admin', 730, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:10.776933+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2339, 'dashboard', '대시보드', 'LayoutDashboard', '/', 'built_in', NULL, NULL, NULL, NULL, 100, 'basic', 'v-platform-template', true, NULL, NULL, '2026-04-19 12:59:30.446987+00', '2026-04-19 12:59:30.446987+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2340, 'portal_home', '포털 홈', 'LayoutDashboard', '/', 'built_in', NULL, NULL, NULL, NULL, 100, 'basic', 'v-platform-portal', true, NULL, NULL, '2026-04-19 12:59:30.447847+00', '2026-04-19 12:59:30.447847+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2342, 'help', '도움말', 'HelpCircle', '/help', 'built_in', NULL, NULL, NULL, NULL, 700, 'basic', 'v-platform-template', true, NULL, NULL, '2026-04-19 12:59:30.446987+00', '2026-04-19 12:59:30.446987+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2341, 'portal_help', '도움말', 'HelpCircle', '/help', 'built_in', NULL, NULL, NULL, NULL, 700, 'basic', 'v-platform-portal', true, NULL, NULL, '2026-04-19 12:59:30.447847+00', '2026-04-19 12:59:30.447847+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2271, 'ui_builder_sandpack', 'Sandpack 프로젝트', 'Code2', '/', 'built_in', NULL, NULL, NULL, NULL, 100, 'basic', 'v-ui-builder', true, NULL, NULL, '2026-04-19 11:59:53.731799+00', '2026-04-19 11:59:53.731799+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2272, 'ui_builder_genui', 'Generative UI 프로젝트', 'Sparkles', '/genui', 'built_in', NULL, NULL, NULL, NULL, 110, 'basic', 'v-ui-builder', true, NULL, NULL, '2026-04-19 11:59:53.731799+00', '2026-04-19 11:59:53.731799+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2443, 'itsm_group_integrations', '외부 연동', 'Plug', '#itsm_group_integrations', 'menu_group', NULL, NULL, NULL, NULL, 800, 'admin', 'v-itsm', true, NULL, 5, '2026-04-22 19:53:48.422004+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2449, 'itsm_my_work', '내 업무', 'Inbox', '/my-work', 'built_in', NULL, NULL, NULL, 'itsm_group_operations', 105, 'basic', 'v-itsm', true, NULL, NULL, '2026-04-24 02:03:11.443825+00', '2026-04-24 02:38:44.572911+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2450, 'itsm_admin_all_work', '통합 업무 관리', 'ClipboardList', '/admin/all-work', 'built_in', NULL, NULL, NULL, 'itsm_group_operations', 145, 'basic', 'v-itsm', true, NULL, NULL, '2026-04-24 02:03:11.443825+00', '2026-04-24 02:38:44.572911+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (12, 'permission_management', '권한 관리', 'Shield', '/admin/permissions', 'built_in', NULL, NULL, false, 'platform_group_admin', 740, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (11, 'menu_management', '메뉴 관리', 'ListTree', '/admin/menus', 'built_in', NULL, NULL, false, 'platform_group_admin', 750, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (9, 'audit_logs', '감사 로그', 'FileText', '/audit-logs', 'built_in', NULL, NULL, false, 'platform_group_observability', 1160, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2368, 'dashboard', '대시보드', 'LayoutDashboard', '/', 'built_in', NULL, NULL, NULL, NULL, 100, 'basic', 'v-channel-bridge', true, NULL, NULL, '2026-04-19 13:00:09.897602+00', '2026-04-19 13:00:09.897602+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2369, 'help', '도움말', 'HelpCircle', '/help', 'built_in', NULL, NULL, NULL, NULL, 700, 'basic', 'v-channel-bridge', true, NULL, NULL, '2026-04-19 13:00:09.897602+00', '2026-04-19 13:00:09.897602+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (214, 'custom_menu_test01', '커스텀 메뉴 01', NULL, '/custom/menu/test01', 'custom_iframe', 'https://www.naver.com/', true, false, NULL, 10000, 'custom', 'v-platform-template', true, 5, 5, '2026-04-12 12:20:47.07166+00', '2026-04-19 13:31:43.308296+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (10, 'monitoring', '모니터링', 'Activity', '/monitoring', 'built_in', NULL, NULL, false, 'platform_group_observability', 1170, 'admin', NULL, true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2438, 'itsm_group_operations', '업무', 'LayoutDashboard', '#itsm_group_operations', 'menu_group', NULL, NULL, NULL, NULL, 100, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:53:48.422004+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2439, 'itsm_group_masters', '마스터', 'Database', '#itsm_group_masters', 'menu_group', NULL, NULL, NULL, NULL, 200, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:53:48.422004+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2440, 'itsm_group_policies', '정책', 'ShieldCheck', '#itsm_group_policies', 'menu_group', NULL, NULL, NULL, NULL, 300, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:53:48.422004+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2435, 'platform_group_admin', '관리자 콘솔', 'ShieldCheck', '#platform_group_admin', 'menu_group', NULL, NULL, NULL, NULL, 700, 'admin', NULL, true, NULL, 5, '2026-04-22 19:53:46.673797+00', '2026-04-24 02:38:39.400433+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2441, 'itsm_group_system', '운영', 'Wrench', '#itsm_group_system', 'menu_group', NULL, NULL, NULL, NULL, 400, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:53:48.422004+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2, 'channels', '채널 관리', 'Radio', '/channels', 'built_in', NULL, NULL, false, NULL, 200, 'basic', 'v-channel-bridge', true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-12 05:27:19.01844+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (5, 'integrations', '연동 관리', 'Link', '/integrations', 'built_in', NULL, NULL, false, NULL, 200, 'basic', 'v-channel-bridge', true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-12 05:27:19.01844+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (3, 'messages', '메시지 히스토리', 'MessageSquare', '/messages', 'built_in', NULL, NULL, false, NULL, 300, 'basic', 'v-channel-bridge', true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-12 10:57:00.434956+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (4, 'statistics', '통계', 'BarChart3', '/statistics', 'built_in', NULL, NULL, false, NULL, 500, 'basic', 'v-channel-bridge', true, NULL, 5, '2026-04-12 05:15:09.928839+00', '2026-04-12 10:57:00.434986+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (553, 'app_management', '앱 관리', 'Box', '/admin/apps', 'built_in', NULL, NULL, false, NULL, 1500, 'admin', 'v-platform-portal', true, NULL, NULL, '2026-04-12 15:34:26.142848+00', '2026-04-12 15:34:26.142848+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2417, 'itsm_kanban', '칸반 보드', 'Kanban', '/kanban', 'built_in', NULL, NULL, NULL, 'itsm_group_operations', 110, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 22:14:56.148781+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2416, 'itsm_tickets', '티켓', 'Ticket', '/tickets', 'built_in', NULL, NULL, NULL, 'itsm_group_operations', 120, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 22:14:56.148781+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2418, 'itsm_sla_monitor', 'SLA 모니터', 'Timer', '/sla', 'built_in', NULL, NULL, NULL, 'itsm_group_operations', 130, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 22:14:56.148781+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2419, 'itsm_kpi', 'KPI 대시보드', 'BarChart3', '/kpi', 'built_in', NULL, NULL, NULL, 'itsm_group_operations', 140, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 22:14:56.148781+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2411, 'itsm_customers', '고객 관리', 'Building2', '/admin/customers', 'built_in', NULL, NULL, NULL, 'itsm_group_masters', 210, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 20:55:27.461675+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2412, 'itsm_products', '제품 관리', 'Package', '/admin/products', 'built_in', NULL, NULL, NULL, 'itsm_group_masters', 220, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 20:55:27.461675+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2413, 'itsm_sla_tiers', 'SLA 티어', 'Gauge', '/admin/sla-tiers', 'built_in', NULL, NULL, NULL, 'itsm_group_masters', 230, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 20:55:27.461675+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2432, 'itsm_notification_logs', '알림 로그', 'ScrollText', '/admin/notification-logs', 'built_in', NULL, NULL, NULL, 'itsm_group_system', 420, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:26:24.222027+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2431, 'itsm_integrations', '통합 설정', 'Plug', '/admin/integrations', 'built_in', NULL, NULL, NULL, 'itsm_group_integrations', 810, 'admin', 'v-itsm', true, NULL, 5, '2026-04-22 19:26:24.222027+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2433, 'itsm_my_notification_pref', '내 알림 설정', 'BellDot', '/me/notification-pref', 'built_in', NULL, NULL, NULL, 'itsm_group_personal', 910, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:26:24.222027+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2402, 'help', '도움말', 'HelpCircle', '/help', 'built_in', NULL, NULL, NULL, NULL, 850, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 13:26:08.354026+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2414, 'itsm_contracts', '계약 관리', 'FileSignature', '/admin/contracts', 'built_in', NULL, NULL, NULL, 'itsm_group_masters', 240, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 20:55:27.461675+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2428, 'itsm_sla_policies', 'SLA 정책', 'Timer', '/admin/sla-policies', 'built_in', NULL, NULL, NULL, 'itsm_group_policies', 310, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:26:24.222027+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2429, 'itsm_sla_notification_policies', 'SLA 알림 정책', 'BellRing', '/admin/sla-notification-policies', 'built_in', NULL, NULL, NULL, 'itsm_group_policies', 320, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:26:24.222027+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2415, 'itsm_scope_grants', '접근 범위', 'ShieldCheck', '/admin/scope-grants', 'built_in', NULL, NULL, NULL, 'itsm_group_policies', 330, 'basic', 'v-itsm', true, NULL, 5, '2026-04-21 20:55:27.461675+00', '2026-04-24 02:38:42.09322+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2456, 'itsm_workspaces', '워크스페이스', 'Layers', '/workspaces', 'built_in', NULL, NULL, NULL, 'itsm_group_personal', 905, 'basic', 'v-itsm', true, NULL, NULL, '2026-04-24 02:38:45.10649+00', '2026-04-24 02:38:45.10649+00');
INSERT INTO public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, iframe_fullscreen, open_in_new_tab, parent_key, sort_order, section, app_id, is_active, created_by, updated_by, created_at, updated_at) VALUES (2430, 'itsm_scheduler', '스케줄러', 'Clock', '/admin/scheduler', 'built_in', NULL, NULL, NULL, 'itsm_group_system', 410, 'basic', 'v-itsm', true, NULL, 5, '2026-04-22 19:26:24.222027+00', '2026-04-24 02:38:42.09322+00');


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (1, '비밀번호 변경 권장', '90일 이상 비밀번호를 변경하지 않은 사용자에게 자동 발송됩니다.', 'warning', 'user', 'user', NULL, NULL, NULL, 'system', NULL, NULL, true, true, 'toast', NULL, NULL, '2026-04-12 05:15:11.94244+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (2, '새 사용자 가입 알림', '새로운 사용자가 가입하면 관리자에게 자동 발송됩니다.', 'info', 'user', 'role', NULL, NULL, NULL, 'system', NULL, NULL, true, true, 'toast', NULL, NULL, '2026-04-12 05:15:11.94244+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (3, '시스템 헬스 경고', 'DB, Redis 등 인프라 서비스 연결 이상 시 관리자에게 자동 발송됩니다.', 'critical', 'service', 'role', NULL, NULL, NULL, 'system', NULL, NULL, true, true, 'toast', NULL, NULL, '2026-04-12 05:15:11.94244+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (4, '세션 만료 경고', '사용자 세션이 곧 만료될 때 해당 사용자에게 자동 발송됩니다.', 'warning', 'session', 'user', NULL, NULL, NULL, 'system', NULL, NULL, true, true, 'toast', NULL, NULL, '2026-04-12 05:15:11.94244+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (5, '시스템 점검 공지', '시스템 점검 예정 시 전체 사용자에게 발송됩니다.', 'info', 'system', 'global', NULL, NULL, NULL, 'system', NULL, NULL, true, true, 'toast', NULL, NULL, '2026-04-12 05:15:11.94244+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (6, '보안 경고', '비정상 로그인 시도 등 보안 이벤트 발생 시 관리자에게 발송됩니다.', 'error', 'system', 'role', NULL, NULL, NULL, 'system', NULL, NULL, true, true, 'toast', NULL, NULL, '2026-04-12 05:15:11.94244+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (7, '새알림 테스트 01', '
# 공지.....
새알림 테스트 중입니다.', 'info', 'system', 'app', 'v-platform-template', 'system_admin', NULL, 'admin', NULL, NULL, true, false, 'both', '2026-04-13 23:08:00+00', 5, '2026-04-12 13:59:32.703785+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (8, '새 알림 테스트 02', '새 알림 테스트 02', 'info', 'system', 'app', 'v-platform-template', NULL, NULL, 'admin', NULL, NULL, true, false, 'both', '2026-04-13 23:09:00+00', 5, '2026-04-12 14:09:12.39478+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (9, '새 알림 테스트 03', '새 알림 테스트 03
**새 알림 테스트 03**', 'info', 'system', 'app', 'v-platform-template', NULL, NULL, 'admin', NULL, NULL, true, false, 'toast', '2026-04-19 23:19:00+00', 5, '2026-04-12 14:19:31.007943+00');
INSERT INTO public.notifications (id, title, message, severity, category, scope, app_id, target_role, target_user_id, source, link, metadata, is_active, is_system, delivery_type, expires_at, created_by, created_at) VALUES (10, '새 알림 테스트 04', '새 알림 테스트 04', 'info', 'system', 'app', 'v-platform-template', NULL, NULL, 'admin', NULL, NULL, true, false, 'both', '2026-04-14 23:33:00+00', 5, '2026-04-12 14:33:15.421273+00');


--
-- Data for Name: notification_app_overrides; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notification_app_overrides (id, notification_id, app_id, is_active, updated_at) VALUES (1, 4, 'v-platform-portal', false, '2026-04-12 10:38:56.687034+00');
INSERT INTO public.notification_app_overrides (id, notification_id, app_id, is_active, updated_at) VALUES (2, 4, 'v-platform-template', false, '2026-04-12 10:39:21.162399+00');
INSERT INTO public.notification_app_overrides (id, notification_id, app_id, is_active, updated_at) VALUES (3, 4, 'v-channel-bridge', false, '2026-04-12 13:58:12.368118+00');
INSERT INTO public.notification_app_overrides (id, notification_id, app_id, is_active, updated_at) VALUES (4, 4, 'v-ui-builder', false, '2026-04-19 04:15:15.269744+00');
INSERT INTO public.notification_app_overrides (id, notification_id, app_id, is_active, updated_at) VALUES (5, 4, 'v-itsm', false, '2026-04-21 14:54:17.401883+00');


--
-- Data for Name: permission_groups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (4, '사용자정의그룹-1', '테스트 그룹 1', false, true, NULL, 5, '2026-04-09 13:34:45.213807+00', '2026-04-09 16:29:27.679438+00');
INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (5, '사용자정의그룹-2', '테스트 그룹 2', false, true, NULL, 5, '2026-04-09 15:12:55.630528+00', '2026-04-09 15:12:55.630535+00');
INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (13, '데모그룹-운영', '운영 부서 전용 — 기본 메뉴 write + 관리 메뉴 일부 read', false, true, NULL, 5, '2026-04-12 09:02:25.929091+00', '2026-04-12 09:02:25.929091+00');
INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (14, '데모그룹-뷰어', '외부 조직용 — 대시보드 + 도움말 read only', false, true, NULL, 5, '2026-04-12 09:02:25.929091+00', '2026-04-12 09:02:25.929091+00');
INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (1, '시스템 관리자', '모든 메뉴에 대한 write 권한 (system_admin)', true, true, NULL, NULL, '2026-04-12 05:15:10.559883+00', '2026-04-24 02:38:35.794894+00');
INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (2, '조직 관리자', '기본 메뉴 write + 관리 메뉴 read 권한 (org_admin)', true, true, NULL, NULL, '2026-04-12 05:15:10.559883+00', '2026-04-24 02:38:35.794894+00');
INSERT INTO public.permission_groups (id, name, description, is_default, is_active, app_id, created_by, created_at, updated_at) VALUES (3, '일반 사용자', '기본 메뉴 read 전용 권한 (user)', true, true, NULL, NULL, '2026-04-12 05:15:10.559883+00', '2026-04-24 02:38:35.794894+00');


--
-- Data for Name: permission_group_grants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (13137, 1, 2449, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (13138, 1, 2450, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (28, 1, 2, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (29, 1, 3, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (30, 1, 5, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (31, 1, 6, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (33, 1, 4, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (34, 1, 8, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (35, 1, 9, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (36, 1, 10, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (37, 1, 11, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (38, 1, 12, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (39, 1, 13, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (40, 1, 14, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (43, 2, 2, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (44, 2, 3, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (45, 2, 5, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (46, 2, 6, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (48, 2, 4, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (49, 2, 8, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (50, 2, 9, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (51, 2, 10, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (52, 2, 11, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (53, 2, 12, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (54, 2, 13, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (55, 2, 14, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (58, 3, 2, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (59, 3, 3, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (60, 3, 5, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (61, 3, 6, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (63, 3, 4, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (65, 4, 2, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (66, 4, 3, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (67, 4, 5, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (68, 4, 6, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (70, 4, 4, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (139, 13, 6, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (141, 13, 8, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (142, 13, 14, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6962, 13, 2271, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6963, 1, 2271, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6964, 2, 2271, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6965, 3, 2271, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6966, 4, 2271, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6967, 14, 2271, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6968, 13, 2272, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6969, 1, 2272, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6970, 2, 2272, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6971, 3, 2272, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6972, 4, 2272, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (6973, 14, 2272, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (143, 13, 10, 'read');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10756, 1, 2414, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10757, 1, 2415, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10758, 1, 2411, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10759, 1, 2412, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10760, 1, 2413, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10933, 1, 2416, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10934, 1, 2417, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10935, 1, 2418, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (10936, 1, 2419, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (12190, 1, 2428, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (12191, 1, 2429, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (12192, 1, 2430, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (135, 13, 2, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (12193, 1, 2431, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (12194, 1, 2432, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (136, 13, 3, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (137, 13, 4, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (138, 13, 5, 'write');
INSERT INTO public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) VALUES (13784, 1, 2456, 'write');


--
-- Data for Name: portal_apps; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.portal_apps (id, app_id, display_name, description, icon, frontend_url, api_url, health_endpoint, sort_order, is_active, created_by, updated_by, created_at, updated_at) VALUES (1, 'v-channel-bridge', 'Channel Bridge', 'Slack ↔ Teams 메시지 브리지', 'MessageSquare', 'http://192.168.1.216:5173', 'http://v-project-bridge-backend:8000', '/api/health', 0, true, NULL, 5, '2026-04-12 15:21:44.624831+00', '2026-04-15 02:21:09.326125+00');
INSERT INTO public.portal_apps (id, app_id, display_name, description, icon, frontend_url, api_url, health_endpoint, sort_order, is_active, created_by, updated_by, created_at, updated_at) VALUES (2, 'v-platform-template', 'Platform Template', '플랫폼 템플릿 앱', 'LayoutDashboard', 'http://192.168.1.216:5174', 'http://v-project-template-backend:8000', '/api/health', 10, true, NULL, 5, '2026-04-12 15:21:44.624846+00', '2026-04-15 02:21:27.410827+00');
INSERT INTO public.portal_apps (id, app_id, display_name, description, icon, frontend_url, api_url, health_endpoint, sort_order, is_active, created_by, updated_by, created_at, updated_at) VALUES (4, 'v-ui-builder', 'AI UI Builder', 'AI 기반의 UI Builder', 'Box', 'http://192.168.1.216:5181', 'http://v-ui-builder-backend:8000', '/api/health', 0, true, 5, 5, '2026-04-19 13:48:05.612377+00', '2026-04-19 13:50:30.68813+00');
INSERT INTO public.portal_apps (id, app_id, display_name, description, icon, frontend_url, api_url, health_endpoint, sort_order, is_active, created_by, updated_by, created_at, updated_at) VALUES (5, 'v-itsm', 'ITSM', 'ITSM', 'route', 'http://192.168.1.216:5182', 'http://itsm-backend:8000', '/api/health', 0, true, 5, 5, '2026-04-22 01:07:25.60422+00', '2026-04-22 01:07:25.604307+00');


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page, app_title, app_description, app_logo_url, app_id) VALUES (1, true, 'http://127.0.0.1:3000/docs', NULL, NULL, '/', NULL, NULL, NULL, NULL);
INSERT INTO public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page, app_title, app_description, app_logo_url, app_id) VALUES (2, true, 'http://192.168.1.216:3000', NULL, NULL, '/', 'channel-bridge', 'Slack ↔ Teams 메시지 브리지', NULL, 'v-channel-bridge');
INSERT INTO public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page, app_title, app_description, app_logo_url, app_id) VALUES (4, true, 'http://192.168.1.216:3000', NULL, NULL, '/', 'v-platform-template', '플랫폼 템플릿 앱', NULL, 'v-platform-template');
INSERT INTO public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page, app_title, app_description, app_logo_url, app_id) VALUES (5, true, 'http://192.168.1.216:3000/docs', NULL, NULL, '/', 'AI UI Builder', 'AI 기반의 UI Builder 서비스', NULL, 'v-ui-builder');
INSERT INTO public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page, app_title, app_description, app_logo_url, app_id) VALUES (6, true, 'http://192.168.1.216:3000/docs', NULL, NULL, '/', 'ITSM', 'ITSM(IT Service Management)', NULL, 'v-itsm');
INSERT INTO public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page, app_title, app_description, app_logo_url, app_id) VALUES (3, true, 'http://192.168.1.216:3000', NULL, NULL, '/', 'Portal', '통합 관리 플랫폼', NULL, 'v-platform-portal');


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 2456, true);


--
-- Name: notification_app_overrides_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notification_app_overrides_id_seq', 5, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 10, true);


--
-- Name: permission_group_grants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permission_group_grants_id_seq', 13784, true);


--
-- Name: permission_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permission_groups_id_seq', 776, true);


--
-- Name: portal_apps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.portal_apps_id_seq', 5, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 6, true);


--
-- PostgreSQL database dump complete
--

\unrestrict Nj8FCZ8s6ujjHwF7LT4PRHNLippZYKgE8xi7VtaXjVWu7sEkKKUEmojcwGx5oZT

