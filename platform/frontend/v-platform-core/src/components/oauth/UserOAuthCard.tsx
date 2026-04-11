/**
 * UserOAuthCard Component
 *
 * 개별 OAuth 연동 상태 카드
 */

import {
  Link2Off,
  ExternalLink,
  Info,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import type { OAuthStatus } from "../../api/user-oauth";

/** 현재 사용자 OAuth를 지원하는 플랫폼 */
const OAUTH_SUPPORTED_PLATFORMS = new Set(["teams"]);

interface UserOAuthCardProps {
  oauth: OAuthStatus;
  onConnect: (accountId: number) => void;
  onDisconnect: (accountId: number) => void;
  isDisconnecting?: boolean;
}

export function UserOAuthCard({
  oauth,
  onConnect,
  onDisconnect,
  isDisconnecting = false,
}: UserOAuthCardProps) {
  const platformLabel = oauth.platform === "slack" ? "Slack" : "Teams";
  const platformColor =
    oauth.platform === "slack" ? "text-purple-500" : "text-blue-500";
  const platformBg =
    oauth.platform === "slack"
      ? "bg-purple-500/10 dark:bg-purple-500/20"
      : "bg-blue-500/10 dark:bg-blue-500/20";
  const oauthSupported = OAUTH_SUPPORTED_PLATFORMS.has(oauth.platform);

  return (
    <div className="p-5 bg-surface-card border border-line rounded-lg hover:border-brand-500/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* 헤더: 계정 이름 + 플랫폼 + 상태 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${platformBg}`}
            >
              <span className={`text-sm font-bold ${platformColor}`}>
                {oauth.platform === "slack" ? "S" : "T"}
              </span>
            </span>
            <h4 className="text-heading-sm text-content-primary">
              {oauth.account_name}
            </h4>
            {oauth.token_status === "active" ? (
              <Badge variant="success" dot>
                연동됨
              </Badge>
            ) : oauth.token_status === "expired_refreshable" ? (
              <Badge variant="info" dot>
                자동 갱신 예정
              </Badge>
            ) : oauth.token_status === "inactive" ? (
              <Badge variant="danger" dot>
                재연동 필요
              </Badge>
            ) : oauthSupported ? (
              <Badge variant="warning">미연동</Badge>
            ) : (
              <Badge variant="default">OAuth 불필요</Badge>
            )}
          </div>

          {/* 연동 정보 */}
          {oauth.is_connected || oauth.token_status === "inactive" ? (
            <div className="space-y-1.5 text-sm">
              {/* 토큰 상태 표시 */}
              {oauth.token_status === "active" && (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">OAuth 연동 완료</span>
                </div>
              )}
              {oauth.token_status === "expired_refreshable" && (
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    토큰 만료 — 다음 사용 시 자동 갱신됩니다
                  </span>
                </div>
              )}
              {oauth.token_status === "inactive" && (
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    갱신 토큰 만료 — 재연동이 필요합니다
                  </span>
                </div>
              )}
              {oauth.platform_user_name && (
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-20 flex-shrink-0">
                    사용자:
                  </span>
                  <span className="text-content-primary truncate">
                    {oauth.platform_user_name}
                  </span>
                </div>
              )}
              {oauth.platform_email && (
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-20 flex-shrink-0">
                    이메일:
                  </span>
                  <span className="text-content-secondary truncate">
                    {oauth.platform_email}
                  </span>
                </div>
              )}
              {oauth.token_expires_at && (
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-20 flex-shrink-0">
                    토큰 만료:
                  </span>
                  <span
                    className={
                      oauth.token_status === "active"
                        ? "text-content-secondary"
                        : oauth.token_status === "expired_refreshable"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-red-600 dark:text-red-400"
                    }
                  >
                    {new Date(oauth.token_expires_at).toLocaleDateString(
                      "ko-KR",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                    {oauth.token_status === "expired_refreshable" &&
                      " (자동 갱신 예정)"}
                    {oauth.token_status === "inactive" && " (만료됨)"}
                  </span>
                </div>
              )}
              {oauth.last_used_at && (
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-20 flex-shrink-0">
                    마지막 사용:
                  </span>
                  <span className="text-content-secondary">
                    {new Date(oauth.last_used_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-content-tertiary">
              {oauthSupported
                ? `${platformLabel} 계정을 연동하면 내 이름으로 메시지를 보낼 수 있습니다.`
                : `${platformLabel}은 Bot Token 방식으로 동작하여 개별 OAuth 연동이 필요하지 않습니다.`}
            </p>
          )}
        </div>

        {/* 액션 버튼: 토큰 상태에 따라 분기 */}
        <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
          {oauth.token_status === "active" ||
          oauth.token_status === "expired_refreshable" ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDisconnect(oauth.account_id)}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Link2Off className="w-4 h-4 mr-1" />
              )}
              연동 해제
            </Button>
          ) : oauth.token_status === "inactive" ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConnect(oauth.account_id)}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              재연동
            </Button>
          ) : oauthSupported ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConnect(oauth.account_id)}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              연동하기
            </Button>
          ) : (
            <Tooltip
              content={`${platformLabel}은 Bot Token 방식으로 동작하여 개별 OAuth가 불필요합니다.`}
              side="left"
            >
              <span className="inline-flex items-center gap-1 text-xs text-content-tertiary">
                <Info className="w-3.5 h-3.5" />
                지원 안 함
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
