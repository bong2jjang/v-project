/**
 * Template 전용 Product Tour 스텝 정의
 *
 * Driver.js 기반 투어 설정
 * 모든 element 셀렉터는 실제 DOM의 data-tour 속성과 매칭
 */

import { DriveStep } from "driver.js";

/**
 * 메인 투어 (5 steps)
 *
 * 처음 방문한 사용자에게 앱 전체 구조를 안내
 */
export const mainTourSteps: DriveStep[] = [
  {
    popover: {
      title: "v-platform에 오신 것을 환영합니다!",
      description:
        "v-platform 기반 앱입니다. 인증, 권한 관리, 감사 로그 등 플랫폼 공통 기능이 내장되어 있습니다.<br><br>주요 기능을 함께 살펴보겠습니다.<span class='tour-hint'>언제든 ESC를 눌러 투어를 종료할 수 있습니다.</span>",
    },
  },
  {
    element: "[data-tour='sidebar']",
    popover: {
      title: "사이드바 메뉴",
      description:
        "왼쪽 메뉴에서 각 기능으로 이동할 수 있습니다.<ul><li>대시보드 — 시스템 상태 모니터링</li><li>설정 — 테마, 보안, 시스템</li><li>사용자 관리 — 계정 관리 (관리자)</li><li>권한/메뉴 관리 — 접근 제어 (관리자)</li></ul>",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='welcome-card']",
    popover: {
      title: "대시보드",
      description:
        "현재 로그인한 사용자 정보와 앱 개요를 확인할 수 있습니다.<br><br>이 영역에 앱별 위젯을 추가하여 필요한 정보를 한눈에 볼 수 있습니다.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='system-health']",
    popover: {
      title: "시스템 상태",
      description:
        "플랫폼, 데이터베이스, Redis 등 인프라 서비스의 연결 상태와 응답 시간을 모니터링합니다.<br><br>정상이면 초록, 오류 시 빨간 배지로 표시됩니다.",
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
