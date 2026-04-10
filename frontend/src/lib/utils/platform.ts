/**
 * 플랫폼 관련 유틸리티 함수
 */

import type { Platform, PlatformConfig, PlatformGuide } from "../api/types";

/**
 * 플랫폼 설정
 */
export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  slack: {
    label: "Slack",
    icon: "📱",
    accountPrefix: "slack.",
    channelPlaceholder: "예: general, C07CJ638B97",
    channelHelper:
      'Slack에서 채널 우클릭 > "링크 복사" > URL에서 마지막 부분이 채널 ID입니다',
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  teams: {
    label: "Microsoft Teams",
    icon: "💼",
    accountPrefix: "teams.",
    channelPlaceholder: "예: 19:abc123def456@thread.tacv2",
    channelHelper:
      'Teams에서 채널 우클릭 > "채널에 대한 링크 가져오기" > URL의 threadId 값을 복사하세요',
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  unknown: {
    label: "Unknown",
    icon: "❓",
    accountPrefix: "",
    channelPlaceholder: "",
    channelHelper: "",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
};

/**
 * 플랫폼별 상세 가이드
 */
export const PLATFORM_GUIDE: Record<Platform, PlatformGuide> = {
  slack: {
    accountNameExample: "myworkspace",
    accountNameHelper:
      "Slack 워크스페이스 이름을 입력하세요. 워크스페이스 URL (예: myworkspace.slack.com)에서 확인할 수 있습니다.",
    channelExample: "general 또는 C07CJ638B97",
    channelSteps: [
      "Slack 앱에서 채널을 엽니다",
      '채널 이름을 우클릭하고 "링크 복사"를 선택합니다',
      "복사한 URL의 마지막 부분이 채널 ID입니다",
      "예: https://myworkspace.slack.com/archives/C07CJ638B97",
      '위 URL에서 "C07CJ638B97"이 채널 ID입니다',
      '또는 채널 이름(예: "general")을 직접 입력할 수도 있습니다',
    ],
  },
  teams: {
    accountNameExample: "myteam",
    accountNameHelper:
      "Microsoft Teams 팀 이름을 입력하세요. 임의의 식별자로 사용됩니다.",
    channelExample: "19:abc123def456@thread.tacv2",
    channelSteps: [
      "Microsoft Teams에서 채널을 엽니다",
      '채널 이름 옆의 "..." 메뉴를 클릭합니다',
      '"채널에 대한 링크 가져오기"를 선택합니다',
      '복사한 URL에서 "threadId=" 다음 값을 찾습니다',
      "예: https://teams.microsoft.com/l/channel/19%3Aabc123def456%40thread.tacv2/...",
      'URL 인코딩된 값(%3A, %40)을 디코딩하면: "19:abc123def456@thread.tacv2"',
      "이 값을 채널 ID로 입력하세요",
    ],
  },
  unknown: {
    accountNameExample: "",
    accountNameHelper: "",
    channelExample: "",
    channelSteps: [],
  },
};

/**
 * account 문자열에서 플랫폼 감지
 * @param account - "slack.myslack" 형식의 계정 문자열
 * @returns 플랫폼 타입
 */
export function getPlatform(account: string): Platform {
  if (account.startsWith("slack.")) return "slack";
  if (account.startsWith("teams.")) return "teams";
  return "unknown";
}

/**
 * account 문자열에서 계정 이름 추출
 * @param account - "slack.myslack" 형식의 계정 문자열
 * @returns 계정 이름 ("myslack")
 */
export function getAccountName(account: string): string {
  const parts = account.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : account;
}

/**
 * 플랫폼과 계정 이름으로 전체 account 문자열 생성
 * @param platform - 플랫폼
 * @param accountName - 계정 이름
 * @returns "protocol.name" 형식의 계정 문자열
 */
export function buildAccount(platform: Platform, accountName: string): string {
  if (platform === "unknown") return accountName;
  return `${PLATFORM_CONFIG[platform].accountPrefix}${accountName}`;
}

/**
 * account 형식 유효성 검사
 * @param account - 검사할 계정 문자열
 * @returns 유효한 경우 null, 아니면 에러 메시지
 */
export function validateAccount(account: string): string | null {
  if (!account.trim()) {
    return "계정을 입력해주세요";
  }

  if (!account.includes(".")) {
    return '계정 형식은 "protocol.name" 이어야 합니다 (예: slack.myslack)';
  }

  const platform = getPlatform(account);
  if (platform === "unknown") {
    return "지원하지 않는 플랫폼입니다 (slack 또는 teams만 사용 가능)";
  }

  const accountName = getAccountName(account);
  if (!accountName) {
    return "계정 이름을 입력해주세요";
  }

  return null;
}
