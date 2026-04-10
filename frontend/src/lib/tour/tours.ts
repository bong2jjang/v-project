/**
 * Product Tour 스텝 정의
 *
 * Driver.js 기반 투어 설정
 * 모든 element 셀렉터는 실제 DOM의 data-tour 속성과 매칭
 */

import { DriveStep } from "driver.js";

/**
 * 메인 투어 (7 steps)
 *
 * 처음 방문한 사용자에게 전체 앱 구조를 안내
 */
export const mainTourSteps: DriveStep[] = [
  {
    popover: {
      title: "VMS Chat Ops에 오신 것을 환영합니다!",
      description:
        "Slack과 Microsoft Teams 간 메시지를 실시간으로 연동하는 시스템입니다.<br><br>주요 기능을 함께 살펴보겠습니다.<span class='tour-hint'>언제든 ESC를 눌러 투어를 종료할 수 있습니다.</span>",
    },
  },
  {
    element: "[data-tour='sidebar']",
    popover: {
      title: "사이드바 메뉴",
      description:
        "왼쪽 메뉴에서 각 기능으로 이동할 수 있습니다.<ul><li>대시보드 — 실시간 상태 모니터링</li><li>채널 관리 — 메시지 Route 설정</li><li>메시지 — 전송 이력 검색</li><li>통계 — 사용량 분석 차트</li><li>연동 관리 — 플랫폼 연동, OAuth</li><li>설정 — 테마, 보안</li></ul>",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='provider-status']",
    popover: {
      title: "Provider 연결 상태",
      description:
        "Slack과 Teams의 현재 연결 상태를 확인할 수 있습니다.<br><br>연결됨(초록), 연결 끊김(빨강)으로 표시되며 활성 Route 수와 최근 메시지 수도 함께 보여줍니다.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='realtime-metrics']",
    popover: {
      title: "실시간 메시지 처리량",
      description:
        "시간대별 메시지 전송 추이를 실시간 차트로 확인합니다.<br><br>기간 프리셋(1시간~24시간)을 선택하거나 새로고침 버튼으로 최신 데이터를 불러올 수 있습니다.",
      side: "top",
      align: "start",
    },
  },
  {
    element: "[data-tour='log-viewer']",
    popover: {
      title: "시스템 로그",
      description:
        "백엔드에서 발생하는 이벤트 로그를 실시간으로 확인할 수 있습니다.<br><br>메시지 전송, Route 변경, 에러 등 모든 활동이 기록됩니다. 로그 레벨별 필터링도 가능합니다.",
      side: "top",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-channels']",
    popover: {
      title: "채널 관리 (Route)",
      description:
        "Slack과 Teams 채널 간 메시지 연동 경로(Route)를 설정하는 곳입니다.<br><br>어떤 Slack 채널의 메시지를 어떤 Teams 채널로 보낼지 설정할 수 있습니다.",
      side: "right",
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
 * 채널 관리 페이지 투어
 */
export const channelsTourSteps: DriveStep[] = [
  {
    popover: {
      title: "채널 관리 (Route)",
      description:
        "Slack과 Teams 간 메시지 연동 경로(Route)를 추가하고 관리합니다.<br><br>Route를 설정하면 한쪽 채널의 메시지가 자동으로 다른 채널로 전달됩니다.",
    },
  },
  {
    element: "[data-tour='add-route-btn']",
    popover: {
      title: "Route 추가",
      description:
        "새 Route를 만들려면 이 버튼을 클릭하세요.<br><br>소스 채널과 대상 채널을 선택하고, 양방향 여부와 전송 모드를 설정합니다.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "[data-tour='route-list']",
    popover: {
      title: "Route 목록",
      description:
        "등록된 모든 Route를 확인할 수 있습니다.<ul><li>양방향 배지 — 양쪽 모두 메시지 전달</li><li>수정/삭제 — 더보기 메뉴에서 관리</li></ul><span class='tour-hint'>Provider 미연결 Route는 비활성으로 표시됩니다.</span>",
      side: "top",
      align: "start",
    },
  },
];

/**
 * 메시지 히스토리 페이지 투어
 */
export const messagesTourSteps: DriveStep[] = [
  {
    popover: {
      title: "메시지 히스토리",
      description:
        "브리지를 통해 전송된 모든 메시지를 조회하고 분석할 수 있습니다.<br><br>검색, 필터, 상태별 분류, 내보내기 기능을 제공합니다.",
    },
  },
  {
    element: "[data-tour='message-search']",
    popover: {
      title: "검색 및 필터",
      description:
        "키워드, 날짜, Route, 채널, 발신자 등 다양한 조건으로 메시지를 검색할 수 있습니다.<br><br>검색어 입력 후 Enter 또는 검색 버튼을 클릭하세요.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='message-stats']",
    popover: {
      title: "요약 통계",
      description:
        "현재 검색 결과의 요약 정보입니다.<br><br>전체 건수, 성공/실패 수, 첨부파일 수, 전송 성공률을 한눈에 확인합니다.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='message-list']",
    popover: {
      title: "메시지 목록",
      description:
        "발신자, 내용, 전송 상태, 시간이 카드 형태로 표시됩니다.<br><br>상단 탭으로 상태별 필터링, 페이지당 표시 건수 조절이 가능합니다.",
      side: "top",
      align: "start",
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
        "테마, 세션 등 시스템 설정을 관리합니다.<br><br>관리자는 보안, 시스템 설정 탭을 추가로 사용할 수 있습니다. 플랫폼 연동은 연동 관리 메뉴를 이용하세요.",
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

/**
 * 통계 페이지 투어
 */
export const statisticsTourSteps: DriveStep[] = [
  {
    popover: {
      title: "통계 대시보드",
      description:
        "메시지 전송 통계를 다양한 차트와 수치로 분석합니다.<br><br>기간별, 채널별, 플랫폼별 추이를 확인하세요.",
    },
  },
  {
    element: "[data-tour='stats-date-filter']",
    popover: {
      title: "기간 선택",
      description:
        "프리셋(오늘, 7일, 30일, 전체)으로 빠르게 기간을 선택하거나 직접 날짜를 입력합니다.<br><br>기간 변경 시 모든 차트가 자동으로 업데이트됩니다.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='stats-summary']",
    popover: {
      title: "핵심 지표",
      description:
        "총 메시지 수, 성공률, 실패/재시도 건수, 첨부파일 수를 요약합니다.<br><br>카드에 마우스를 올리면 상세 설명을 확인할 수 있습니다.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='stats-charts']",
    popover: {
      title: "분석 차트",
      description:
        "일별 추세, 상태 분포, 플랫폼별 방향, 시간대별 패턴 등을 차트로 확인합니다.<br><br>차트 제목 옆 아이콘에 마우스를 올리면 해석 방법이 표시됩니다.",
      side: "top",
      align: "start",
    },
  },
];
