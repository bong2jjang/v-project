import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '사용자 가이드',
      link: {
        type: 'generated-index',
        title: '사용자 가이드',
        description: 'v-project 사용자 가이드',
      },
      collapsed: false,
      items: [
        'user-guide/user-guide',
      ],
    },
    {
      type: 'category',
      label: '플랫폼 (v-platform)',
      link: {
        type: 'generated-index',
        title: 'v-platform',
        description: '인증, RBAC, 감사로그 등 범용 플랫폼 프레임워크',
      },
      items: [
        {
          type: 'category',
          label: '관리자 가이드',
          items: [
            'platform/admin-guide/admin-guide',
            'platform/admin-guide/deployment',
            'platform/admin-guide/monitoring-setup',
            'platform/admin-guide/email-setup',
            'platform/admin-guide/ssl-tls-setup',
          ],
        },
        {
          type: 'category',
          label: '개발자 가이드',
          items: [
            'platform/developer-guide/architecture',
            'platform/developer-guide/design-system',
            'platform/developer-guide/page-layout-guide',
            'platform/developer-guide/SEED_DATA_GUIDE',
            'platform/developer-guide/SSO_USAGE_AND_TESTING',
            'platform/developer-guide/SYSTEM_STATUS_GUIDE',
          ],
        },
        {
          type: 'category',
          label: '설계 문서',
          collapsed: true,
          items: [
            'platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE',
            'platform/design/V_PROJECT_MIGRATION_PLAN',
            'platform/design/MULTI_APP_DATA_ISOLATION',
            'platform/design/V_PLATFORM_PORTAL_DESIGN',
            'platform/design/NOTIFICATION_AND_MESSAGING_SYSTEM',
            'platform/design/RBAC_AND_CUSTOM_MENU_PLAN',
            'platform/design/HYBRID_SSO_LOGIN_PLAN',
            'platform/design/PLATFORM_FEATURE_PERMISSIONS_PLAN',
            'platform/design/PLATFORM_CONSOLIDATION_PLAN',
            'platform/design/MODULE_BOUNDARY_MAP',
            'platform/design/MENU_GROUP_AND_TAB_LAYOUT',
            'platform/design/APP_BRANDING_AND_CONTENT_SEPARATION',
            'platform/design/AUDIT_LOG_UX_IMPROVEMENT',
            'platform/design/PLATFORM_MONITORING_CENTRALIZATION',
            'platform/design/SELF_CORRECTION_LOOP_REVIEW',
            'platform/design/CLAUDE_CODE_TOKEN_OPTIMIZATION',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '앱: v-channel-bridge',
      link: {
        type: 'generated-index',
        title: 'v-channel-bridge',
        description: 'Slack ↔ Teams 메시지 브리지 앱',
      },
      items: [
        {
          type: 'category',
          label: '관리자 가이드',
          items: [
            'apps/v-channel-bridge/admin-guide/slack-setup',
            'apps/v-channel-bridge/admin-guide/teams-setup',
            'apps/v-channel-bridge/admin-guide/troubleshooting',
          ],
        },
        {
          type: 'category',
          label: '개발자 가이드',
          items: [
            'apps/v-channel-bridge/developer-guide/development',
            'apps/v-channel-bridge/developer-guide/testing-guide',
            'apps/v-channel-bridge/developer-guide/execution-plan',
            'apps/v-channel-bridge/developer-guide/migration-plan',
            'apps/v-channel-bridge/developer-guide/ZOWE_CHAT_MIGRATION_PLAN',
          ],
        },
        {
          type: 'category',
          label: '설계 문서',
          collapsed: true,
          items: [
            'apps/v-channel-bridge/design/CHAT_SUPPORT',
            'apps/v-channel-bridge/design/ADVANCED_MESSAGE_FEATURES',
            'apps/v-channel-bridge/design/MESSAGE_HISTORY_IMPROVEMENT',
            'apps/v-channel-bridge/design/MESSAGE_LATENCY_OPTIMIZATION',
            'apps/v-channel-bridge/design/CHAT_EXPERIENCE_IMPROVEMENT_PLAN',
            'apps/v-channel-bridge/design/PHASE1_PROVIDER_UI_PLAN',
            'apps/v-channel-bridge/design/ENV_VS_DATABASE_PROVIDERS',
            'apps/v-channel-bridge/design/MONITORING_IMPROVEMENT',
            'apps/v-channel-bridge/design/REMAINING_TASKS_ROADMAP',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '앱: v-platform-template',
      items: [
        'apps/v-platform-template/getting-started',
      ],
    },
    {
      type: 'category',
      label: '공통 설계',
      collapsed: true,
      link: {
        type: 'generated-index',
        title: '공통 설계 문서',
        description: '여러 앱에 걸친 공통 설계 문서',
      },
      items: [
        'design/USER_PERMISSION_REDESIGN_PLAN',
        'design/USER_PROVIDER_MANAGEMENT',
        'design/TEAMS_DELEGATED_AUTH',
        'design/STATISTICS_DASHBOARD_IMPROVEMENT',
        'design/PNPM_WORKSPACE_MIGRATION_PLAN',
      ],
    },
    {
      type: 'category',
      label: 'API 레퍼런스',
      items: [
        'api/api',
      ],
    },
    {
      type: 'category',
      label: '기술 포트폴리오',
      link: {
        type: 'generated-index',
        title: '기술 포트폴리오',
        description: 'v-project의 기술적 성취와 비즈니스 가치를 정리한 기술 자료',
      },
      items: [
        'tech-portfolio/technical-architecture',
        'tech-portfolio/development-readiness',
        'tech-portfolio/module-design',
        'tech-portfolio/platform-value-roadmap',
      ],
    },
  ],
};

export default sidebars;
