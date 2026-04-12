/**
 * Portal 전용 Product Tour 스텝 정의
 *
 * Driver.js 기반 투어 설정
 * 모든 element 셀렉터는 실제 DOM의 data-tour 속성과 매칭
 */

import { DriveStep } from "driver.js";

/**
 * 메인 투어 (6 steps)
 *
 * 처음 방문한 사용자에게 포탈 전체 구조를 안내
 */
export const mainTourSteps: DriveStep[] = [
  {
    popover: {
      title: "v-platform Portal에 오신 것을 환영합니다!",
      description:
        "여러 앱을 한곳에서 관리하고 SSO로 원클릭 접속할 수 있는 통합 포탈입니다.<br><br>주요 기능을 함께 살펴보겠습니다.<span class='tour-hint'>언제든 ESC를 눌러 투어를 종료할 수 있습니다.</span>",
    },
  },
  {
    element: "[data-tour='sidebar']",
    popover: {
      title: "사이드바 메뉴",
      description:
        "왼쪽 메뉴에서 각 기능으로 이동할 수 있습니다.<ul><li>앱 포탈 — 앱 런처, 상태 모니터링</li><li>설정 — 테마, 보안, 시스템</li><li>사용자 관리 — 계정 관리 (관리자)</li><li>권한/메뉴 관리 — 접근 제어 (관리자)</li><li>앱 관리 — 앱 등록/수정 (관리자)</li></ul>",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='app-launcher']",
    popover: {
      title: "앱 런처",
      description:
        "등록된 앱이 카드 형태로 표시됩니다.<br><br>카드를 클릭하면 SSO 토큰이 자동 전달되어 별도 로그인 없이 앱이 열립니다. 각 앱의 온라인/오프라인 상태와 응답 시간도 확인할 수 있습니다.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='system-status']",
    popover: {
      title: "시스템 상태",
      description:
        "모든 앱의 상태를 테이블로 한눈에 확인합니다.<br><br>앱별 온라인 상태, 개별 서비스(DB, Redis 등) 상태, 응답 시간이 표시됩니다.",
      side: "top",
      align: "start",
    },
  },
  {
    element: "[data-tour='sitemap']",
    popover: {
      title: "사이트맵",
      description:
        "각 앱에 등록된 메뉴 항목을 앱별로 모아서 보여줍니다.<br><br>전체 시스템의 메뉴 구조를 한눈에 파악할 수 있습니다.",
      side: "top",
      align: "start",
    },
  },
  {
    element: "[data-tour='theme-toggle']",
    popover: {
      title: "테마 전환",
      description:
        "클릭하면 라이트/다크/시스템 테마를 순환합니다.<br><br>설정 페이지에서 브랜드 색상도 변경할 수 있습니다.",
      side: "left",
      align: "end",
    },
  },
];

/**
 * 설정 페이지 투어
 */
export const settingsTourSteps: DriveStep[] = [
  {
    popover: {
      title: "설정",
      description:
        "테마, 세션 등 시스템 설정을 관리합니다.<br><br>관리자는 보안, 시스템 설정 탭을 추가로 사용할 수 있습니다.",
    },
  },
  {
    element: "[data-tour='settings-tabs']",
    popover: {
      title: "설정 탭",
      description:
        "탭을 클릭해 각 설정 영역으로 이동합니다.<ul><li>테마 — 라이트/다크 모드, 브랜드 색상</li><li>개요 — 사용자/시스템 정보</li><li>세션 — 로그인 세션 관리</li><li>보안/시스템 설정 (관리자)</li></ul>",
      side: "bottom",
      align: "start",
    },
  },
];
