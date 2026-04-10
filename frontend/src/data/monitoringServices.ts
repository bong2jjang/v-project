/**
 * 모니터링 서비스 정의
 */

import type { MonitoringService, UsageGuide } from "@/types/monitoring";

export const monitoringServices: MonitoringService[] = [
  {
    id: "prometheus",
    name: "Prometheus",
    icon: "📊",
    category: "metrics",
    description: "메트릭 수집 및 시계열 데이터 저장",
    url: "http://localhost:9090",
    port: 9090,
    healthEndpoint: "/api/v1/status/runtimeinfo",
    hasUI: true,
    status: "unknown",
    features: ["PromQL 쿼리 지원", "알림 규칙 관리", "메트릭 탐색 및 시각화"],
  },
  {
    id: "grafana",
    name: "Grafana",
    icon: "📈",
    category: "visualization",
    description: "메트릭 및 로그 시각화 대시보드",
    url: "http://localhost:3001",
    port: 3001,
    healthEndpoint: "/api/health",
    hasUI: true,
    status: "unknown",
    features: [
      "대시보드 생성 및 관리",
      "다양한 데이터소스 지원",
      "알림 설정 및 관리",
    ],
  },
  {
    id: "loki",
    name: "Loki",
    icon: "📝",
    category: "logs",
    description: "로그 수집 및 저장 (API 전용)",
    url: "http://localhost:3100",
    port: 3100,
    healthEndpoint: "/ready",
    hasUI: false,
    status: "unknown",
    features: ["LogQL 쿼리 지원", "로그 스트림 관리", "Grafana 통합"],
  },
  {
    id: "cadvisor",
    name: "cAdvisor",
    icon: "🐳",
    category: "container",
    description: "Docker 컨테이너 리소스 사용량 수집",
    url: "http://localhost:8081",
    port: 8081,
    healthEndpoint: "/healthz",
    hasUI: true,
    status: "unknown",
    features: [
      "CPU/메모리 모니터링",
      "네트워크 사용량 추적",
      "컨테이너별 리소스 분석",
    ],
  },
  {
    id: "node_exporter",
    name: "Node Exporter",
    icon: "🖥️",
    category: "metrics",
    description: "호스트 시스템 메트릭 수집",
    url: "http://localhost:9100",
    port: 9100,
    hasUI: false,
    status: "unknown",
    features: [
      "CPU/메모리 메트릭",
      "디스크 I/O 모니터링",
      "네트워크 인터페이스 통계",
    ],
  },
];

export const usageGuides: UsageGuide[] = [
  {
    serviceId: "prometheus",
    title: "Prometheus 사용법",
    steps: [
      "Graph 메뉴에서 PromQL 쿼리 작성",
      "Alerts 메뉴에서 활성 알림 확인",
      "Status > Targets에서 수집 대상 확인",
    ],
    queries: [
      {
        title: "Backend 서비스 상태",
        query: 'up{job="backend"}',
        description: "Backend 서비스가 정상 작동 중인지 확인",
      },
      {
        title: "HTTP 요청률",
        query: "rate(http_requests_total[5m])",
        description: "최근 5분간 초당 HTTP 요청 수",
      },
      {
        title: "컨테이너 메모리 사용량",
        query: "container_memory_usage_bytes",
        description: "각 컨테이너의 메모리 사용량",
      },
    ],
  },
  {
    serviceId: "grafana",
    title: "Grafana 사용법",
    steps: [
      "좌측 메뉴 > Dashboards에서 대시보드 탐색",
      "Explore 메뉴에서 Loki/Prometheus 데이터 조회",
      "Configuration > Data sources에서 데이터소스 관리",
    ],
    queries: [
      {
        title: "Backend 로그 조회",
        query: '{container_name="vms-backend-dev"}',
        description: "Backend 컨테이너의 모든 로그 (Loki)",
      },
      {
        title: "에러 로그 필터링",
        query: '{container_name=~"vms-.*"} |= "error"',
        description: "모든 VMS 컨테이너의 에러 로그 (Loki)",
      },
      {
        title: "JSON 로그 파싱",
        query: '{container_name="vms-chat-ops-dev"} | json',
        description: "Matterbridge JSON 로그 파싱 (Loki)",
      },
    ],
  },
  {
    serviceId: "loki",
    title: "Loki 사용법",
    steps: [
      "Loki는 웹 UI가 없으며, Grafana를 통해 접근해야 합니다",
      "Grafana > Explore > Loki 데이터소스 선택",
      "LogQL 쿼리를 작성하여 로그 조회",
    ],
  },
  {
    serviceId: "cadvisor",
    title: "cAdvisor 사용법",
    steps: [
      "메인 페이지에서 전체 컨테이너 목록 확인",
      "특정 컨테이너를 클릭하여 상세 리소스 사용량 확인",
      "CPU, 메모리, 네트워크, 디스크 I/O 차트 분석",
    ],
  },
  {
    serviceId: "node_exporter",
    title: "Node Exporter 사용법",
    steps: [
      "Node Exporter는 웹 UI가 없으며, 메트릭만 제공합니다",
      "Prometheus가 자동으로 메트릭을 수집합니다",
      "Grafana에서 Node Exporter 대시보드로 시각화",
    ],
  },
];
