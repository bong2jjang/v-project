import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import path from 'path';

const config: Config = {
  title: 'VMS Docs',
  tagline: 'Slack ↔ Microsoft Teams 양방향 메시지 동기화',
  favicon: 'img/favicon.png',

  url: 'https://docs.vms-chat-ops.com',
  baseUrl: '/',

  organizationName: 'vms-chat-ops',
  projectName: 'vms-chat-ops-docs',

  onBrokenLinks: 'warn',

  markdown: {
    mermaid: true,
  },

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    localeConfigs: {
      ko: {
        label: '한국어',
        direction: 'ltr',
      },
      en: {
        label: 'English',
        direction: 'ltr',
      },
    },
  },

  themes: [
    // Search plugin only in production mode (to save memory in development)
    ...(process.env.NODE_ENV === 'production'
      ? [
          [
            '@easyops-cn/docusaurus-search-local',
            {
              hashed: true,
              language: ['en', 'zh', 'ja'],
              highlightSearchTermsOnTargetPage: true,
              explicitSearchResultPath: true,
              indexBlog: true,
              docsRouteBasePath: '/docs',
              searchBarShortcutHint: false,
              ignoreFiles: [],
            },
          ],
        ]
      : []),
  ],

  plugins: [
    'docusaurus-plugin-sass',
    async function tailwindPlugin(context: any, options: any) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions: any) {
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/bong2jjang/vms-chat-ops/tree/main/docs/',
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: {
          showReadingTime: true,
          blogTitle: '개발 일지 & 설계 문서',
          blogDescription: 'VMS Chat Ops 개발 과정 및 설계 문서',
          blogSidebarTitle: '최근 문서',
          blogSidebarCount: 10,
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
        },
        theme: {
          customCss: [
            './node_modules/remixicon/fonts/remixicon.css',
            './src/css/custom.scss',
          ]
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/vms-chat-ops-social-card.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'VMS Docs',
      hideOnScroll: false,
      logo: {
        alt: 'VMS Docs Logo',
        src: 'img/logo.png',
        href: '/docs',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '문서',
        },
        {to: '/blog', label: '개발 일지', position: 'left'},
        // {
        //   type: 'localeDropdown',
        //   position: 'right',
        // },
        // {
        //   href: 'https://github.com/bong2jjang/vms-chat-ops',
        //   label: 'GitHub',
        //   position: 'right',
        // },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '문서',
          items: [
            {
              label: '시작하기',
              to: '/docs',
            },
            {
              label: '사용자 가이드',
              to: '/docs/user-guide/user-guide',
            },
            {
              label: 'API 레퍼런스',
              to: '/docs/api',
            },
          ],
        },
        {
          title: '커뮤니티',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/bong2jjang/vms-chat-ops/issues',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/bong2jjang/vms-chat-ops/discussions',
            },
          ],
        },
        {
          title: '더 보기',
          items: [
            {
              label: '개발 일지',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/bong2jjang/vms-chat-ops',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} VMS Chat Ops Team. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'python', 'typescript', 'yaml', 'docker', 'toml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
