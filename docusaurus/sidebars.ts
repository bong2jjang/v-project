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
            'platform/admin-guide/ADMIN_GUIDE',
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
            'platform/developer-guide/seed-data-guide',
            'platform/developer-guide/sso-usage-and-testing',
            'platform/developer-guide/system-status-guide',
          ],
        },
        {
          type: 'category',
          label: '설계 문서',
          collapsed: true,
          items: [
            'platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE',
            'platform/design/MULTI_APP_DATA_ISOLATION',
            'platform/design/V_PLATFORM_PORTAL_DESIGN',
            'platform/design/NOTIFICATION_AND_MESSAGING_SYSTEM',
            'platform/design/MODULE_BOUNDARY_MAP',
            'platform/design/MENU_GROUP_AND_TAB_LAYOUT',
            'platform/design/PLATFORM_MONITORING_CENTRALIZATION',
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
            'apps/v-channel-bridge/admin-guide/SLACK_SETUP',
            'apps/v-channel-bridge/admin-guide/TEAMS_SETUP',
            'apps/v-channel-bridge/admin-guide/TROUBLESHOOTING',
          ],
        },
        {
          type: 'category',
          label: '개발자 가이드',
          items: [
            'apps/v-channel-bridge/developer-guide/DEVELOPMENT',
            'apps/v-channel-bridge/developer-guide/TESTING_GUIDE',
          ],
        },
        {
          type: 'category',
          label: '설계 문서',
          collapsed: true,
          items: [
            'apps/v-channel-bridge/design/CHAT_SUPPORT',
            'apps/v-channel-bridge/design/ADVANCED_MESSAGE_FEATURES',
            'apps/v-channel-bridge/design/ENV_VS_DATABASE_PROVIDERS',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '앱: v-platform-portal',
      link: {
        type: 'generated-index',
        title: 'v-platform-portal',
        description: '통합 앱 포털 — 앱 런처, SSO Relay, 사이트맵',
      },
      items: [
        'apps/v-platform-portal/getting-started',
        {
          type: 'category',
          label: '관리자 가이드',
          items: [
            'apps/v-platform-portal/admin-guide/APP_MANAGEMENT',
            'apps/v-platform-portal/admin-guide/SSO_RELAY',
            'apps/v-platform-portal/admin-guide/NOTIFICATIONS',
          ],
        },
        {
          type: 'category',
          label: '사용자 가이드',
          items: [
            'apps/v-platform-portal/user-guide/PORTAL_USAGE',
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
      label: '앱: v-ui-builder',
      link: {
        type: 'generated-index',
        title: 'v-ui-builder',
        description: 'AI UI Builder — 대화로 UI를 만들고 Sandpack 으로 즉시 미리보기',
      },
      items: [
        {
          type: 'category',
          label: '설계 문서',
          collapsed: true,
          items: [
            'apps/v-ui-builder/design/V_UI_BUILDER_DESIGN',
            'apps/v-ui-builder/design/V_UI_BUILDER_EDITOR_AND_UI_KIT_DESIGN',
            'apps/v-ui-builder/design/V_UI_BUILDER_GENERATIVE_UI_DESIGN',
            'apps/v-ui-builder/design/V_UI_BUILDER_DASHBOARD_CANVAS_DESIGN',
            'apps/v-ui-builder/design/V_UI_BUILDER_MANUAL_WIDGETS_DESIGN',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '앱: v-itsm',
      link: {
        type: 'generated-index',
        title: 'v-itsm',
        description: '업무 루프 관리 시스템 — 접수·분석·실행·검증·답변 5단계 루프 + ITSM 표준 프로세스',
      },
      items: [
        {
          type: 'category',
          label: '설계 문서',
          collapsed: true,
          items: [
            'apps/v-itsm/design/V_ITSM_DESIGN',
          ],
        },
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
        'design/USER_PROVIDER_MANAGEMENT',
        'design/TEAMS_DELEGATED_AUTH',
      ],
    },
    {
      type: 'category',
      label: 'API 레퍼런스',
      items: [
        'api/API',
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
