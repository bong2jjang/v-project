/**
 * RecentActivityStream Component
 *
 * 최근 활동을 통합 타임라인으로 표시
 * - 감사 로그
 * - 최근 메시지
 * - 시스템 이벤트
 */

import { useState, useEffect } from "react";
import { Card, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { getAuditLogs } from "../../lib/api/auditLogs";
import { searchMessages } from "../../lib/api/messages";
import { useAuthStore } from "../../store/auth";
import { isAdminRole } from "../../lib/api/types";
import {
  Loader2,
  Clock,
  RefreshCw,
  User,
  MessageSquare,
  Settings,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";

type ActivityType = "audit" | "message" | "system";

interface Activity {
  id: string;
  type: ActivityType;
  timestamp: string;
  title: string;
  description: string;
  user?: string;
  status?: "success" | "error" | "info";
  icon: React.ReactNode;
}

export const RecentActivityStream = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = useAuthStore((s) => isAdminRole(s.user?.role));

  const fetchActivities = async () => {
    try {
      setError(null);

      // 감사 로그는 관리자만 요청 (일반 사용자는 403)
      const [auditLogs, recentMessages] = await Promise.all([
        isAdmin
          ? getAuditLogs({ per_page: 10, page: 1 }).catch(() => ({
              logs: [],
              total: 0,
              page: 1,
              per_page: 10,
              total_pages: 0,
            }))
          : Promise.resolve({
              logs: [],
              total: 0,
              page: 1,
              per_page: 10,
              total_pages: 0,
            }),
        searchMessages({ per_page: 10, sort: "timestamp_desc" }).catch(() => ({
          messages: [],
          total: 0,
          page: 1,
          per_page: 10,
          total_pages: 0,
        })),
      ]);

      // 활동 변환
      const auditActivities: Activity[] = auditLogs.logs.map((log) => ({
        id: `audit-${log.id}`,
        type: "audit" as ActivityType,
        timestamp: log.timestamp,
        title: formatAuditAction(log.action),
        description: log.description || log.action,
        user: log.user_email || undefined,
        status:
          log.status === "success"
            ? "success"
            : log.status === "error"
              ? "error"
              : "info",
        icon: getAuditIcon(log.action, log.status),
      }));

      const messageActivities: Activity[] = recentMessages.messages
        .slice(0, 5)
        .map((msg) => {
          const userName =
            msg.source.display_name ||
            msg.source.user_name ||
            msg.source.user ||
            "Unknown";
          const srcChannel =
            msg.source.channel_name || msg.source.account || "";
          const dstChannel =
            msg.destination.channel_name || msg.destination.account || "";
          const route = `${srcChannel} → ${dstChannel}`;

          return {
            id: `message-${msg.id}`,
            type: "message" as ActivityType,
            timestamp: msg.timestamp,
            title: route,
            description:
              msg.text.substring(0, 100) + (msg.text.length > 100 ? "..." : ""),
            user: userName,
            icon: <MessageSquare className="w-4 h-4" />,
          };
        });

      // 시간순 정렬 (최신순)
      const allActivities = [...auditActivities, ...messageActivities].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setActivities(allActivities.slice(0, 15)); // 최대 15개
    } catch (err: any) {
      setError(err.message || "활동 정보를 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardBody>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <Clock className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-heading-md font-semibold text-content-primary">
                  최근 활동
                </h3>
                <InfoTooltip
                  title="최근 활동"
                  description="감사 로그(로그인, 설정 변경 등)와 최근 메시지 전송 내역을 시간순으로 통합 표시합니다. 각 항목에 Route 경로와 메시지 미리보기가 포함됩니다."
                  hint="관리자 계정이면 감사 로그도 함께 표시됩니다. 30초마다 자동 갱신됩니다."
                  side="bottom"
                />
              </div>
              <p className="text-body-sm text-content-tertiary">
                시스템 및 메시지 활동 타임라인
              </p>
            </div>
          </div>

          {/* 새로고침 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchActivities()}
            disabled={isLoading}
            className="p-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {/* 콘텐츠 */}
        {error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-body text-content-error mb-2">
                활동 정보를 불러올 수 없습니다
              </p>
              <p className="text-body-sm text-content-tertiary mb-4">{error}</p>
              <Button
                onClick={() => fetchActivities()}
                variant="secondary"
                size="sm"
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : isLoading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-content-tertiary" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-body text-content-tertiary">
                최근 활동이 없습니다
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className={`
                  relative pl-8 pb-3
                  ${index !== activities.length - 1 ? "border-l-2 border-border ml-2" : "ml-2"}
                `}
              >
                {/* 타임라인 아이콘 */}
                <div
                  className={`
                    absolute left-0 top-0 -translate-x-1/2
                    w-6 h-6 rounded-full border-2 border-surface-card
                    flex items-center justify-center
                    ${
                      activity.status === "success"
                        ? "bg-status-success-light text-status-success"
                        : activity.status === "error"
                          ? "bg-status-danger-light text-status-danger"
                          : "bg-surface-secondary text-content-secondary"
                    }
                  `}
                >
                  {activity.icon}
                </div>

                {/* 활동 내용 */}
                <div className="bg-surface-secondary rounded-lg p-3 border border-border">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-body-sm font-medium text-content-primary truncate">
                        {activity.title}
                      </h4>
                      {activity.user && (
                        <p className="text-caption text-content-tertiary flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          {activity.user}
                        </p>
                      )}
                    </div>
                    <span className="text-caption text-content-tertiary whitespace-nowrap ml-2">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-caption text-content-secondary line-clamp-2">
                    {activity.description}
                  </p>
                  {activity.status && (
                    <div className="mt-2">
                      <Badge
                        variant={
                          activity.status === "success"
                            ? "success"
                            : activity.status === "error"
                              ? "danger"
                              : "info"
                        }
                        className="text-caption"
                      >
                        {activity.status === "success"
                          ? "성공"
                          : activity.status === "error"
                            ? "실패"
                            : "정보"}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

/**
 * 감사 로그 액션을 한글로 변환
 */
function formatAuditAction(action: string): string {
  const actionMap: Record<string, string> = {
    login: "로그인",
    logout: "로그아웃",
    "matterbridge.start": "Matterbridge 시작",
    "matterbridge.stop": "Matterbridge 중지",
    "matterbridge.restart": "Matterbridge 재시작",
    "config.update": "설정 변경",
    "config.backup": "설정 백업",
    "config.restore": "설정 복원",
    "gateway.create": "Gateway 생성",
    "gateway.update": "Gateway 수정",
    "gateway.delete": "Gateway 삭제",
    "user.create": "사용자 생성",
    "user.update": "사용자 정보 수정",
    "user.delete": "사용자 삭제",
  };

  return actionMap[action] || action;
}

/**
 * 감사 로그 액션에 따른 아이콘 반환
 */
function getAuditIcon(action: string, status: string): React.ReactNode {
  if (status === "error") {
    return <AlertCircle className="w-4 h-4" />;
  }

  if (action.includes("matterbridge")) {
    return <Settings className="w-4 h-4" />;
  }

  if (
    action.includes("login") ||
    action.includes("logout") ||
    action.includes("user")
  ) {
    return <User className="w-4 h-4" />;
  }

  if (status === "success") {
    return <CheckCircle className="w-4 h-4" />;
  }

  return <Info className="w-4 h-4" />;
}
