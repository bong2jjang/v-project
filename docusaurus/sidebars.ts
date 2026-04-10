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
        description: '일반 사용자를 위한 VMS Chat Ops 사용 가이드',
      },
      collapsed: false,
      items: [
        'user-guide/user-guide',
      ],
    },
    {
      type: 'category',
      label: '관리자 가이드',
      link: {
        type: 'generated-index',
        title: '관리자 가이드',
        description: '시스템 관리자를 위한 배포 및 운영 가이드',
      },
      items: [
        'admin-guide/admin-guide',
        'admin-guide/deployment',
        'admin-guide/monitoring-setup',
        'admin-guide/slack-setup',
        'admin-guide/teams-setup',
        'admin-guide/email-setup',
        'admin-guide/ssl-tls-setup',
        'admin-guide/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: '개발자 가이드',
      link: {
        type: 'generated-index',
        title: '개발자 가이드',
        description: '개발 환경 설정 및 기여 가이드',
      },
      items: [
        'developer-guide/development',
        'developer-guide/testing-guide',
        'developer-guide/architecture',
        'developer-guide/design-system',
        'developer-guide/execution-plan',
        'developer-guide/page-layout-guide',
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
        description: 'VMS Chat Ops의 기술적 성취와 비즈니스 가치를 정리한 기술 자료',
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
