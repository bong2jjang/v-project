/**
 * 알림 관리 페이지 (관리자)
 *
 * 알림 전송, 목록 조회, scope 수정/삭제
 * - global: 🌐 전역 배지
 * - app: 📱 앱 배지
 * - role: 🔒 역할 배지
 * - user: 👤 사용자 배지
 */

import { useEffect, useState, useCallback } from "react";
import {
  Bell, Plus, Send, Trash2, Pencil, Globe, Shield, User, Smartphone,
  RefreshCw, X, CheckCircle, AlertTriangle, Info, AlertCircle, XCircle,
} from "lucide-react";
import { ContentHeader } from "../../components/layout/ContentHeader";
import { Card, CardHeader, CardTitle, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useNotificationStore } from "../../stores/notification";
import type {
  PersistentNotification,
  NotificationCreate,
  NotificationUpdate,
} from "../../api/persistentNotifications";
import {
  listNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
} from "../../api/persistentNotifications";

const SCOPE_BADGES: Record<string, { icon: React.ReactNode; label: string; variant: string }> = {
  global: { icon: <Globe className="w-3 h-3" />, label: "전역", variant: "warning" },
  app: { icon: <Smartphone className="w-3 h-3" />, label: "이 앱", variant: "info" },
  role: { icon: <Shield className="w-3 h-3" />, label: "역할", variant: "default" },
  user: { icon: <User className="w-3 h-3" />, label: "사용자", variant: "default" },
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <XCircle className="w-4 h-4 text-red-600" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
};

function ScopeBadge({ scope }: { scope: string }) {
  const config = SCOPE_BADGES[scope] || SCOPE_BADGES.app;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
      scope === "global"
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : scope === "role"
          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
          : scope === "user"
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    }`}>
      {config.icon} {config.label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-section-gap">
      <SkeletonCard />
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export default function NotificationManagement() {
  const [notifications, setNotifications] = useState<PersistentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { addToast } = useNotificationStore();

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [scope, setScope] = useState("app");
  const [targetRole, setTargetRole] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const loadData = useCallback(async () => {
    try {
      const resp = await listNotifications({ limit: 100, admin_view: true });
      setNotifications(resp.notifications);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setTitle(""); setMessage(""); setSeverity("info"); setScope("app");
    setTargetRole(""); setTargetUserId(""); setLink(""); setExpiresAt("");
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) return;

    try {
      if (editingId) {
        const update: NotificationUpdate = {
          title, message, severity, scope,
          target_role: scope === "role" ? targetRole : undefined,
          target_user_id: scope === "user" ? Number(targetUserId) : undefined,
          link: link || undefined,
          expires_at: expiresAt || undefined,
        };
        await updateNotification(editingId, update);
        addToast({
          id: `notif-updated-${Date.now()}`, timestamp: new Date().toISOString(),
          severity: "success", category: "system", title: "알림 수정 완료",
          message: "알림이 수정되었습니다.", source: "notification_management",
          dismissible: true, persistent: false, read: false,
        });
      } else {
        const data: NotificationCreate = {
          title, message, severity, scope,
          target_role: scope === "role" ? targetRole : undefined,
          target_user_id: scope === "user" ? Number(targetUserId) : undefined,
          link: link || undefined,
          expires_at: expiresAt || undefined,
        };
        await createNotification(data);
        addToast({
          id: `notif-sent-${Date.now()}`, timestamp: new Date().toISOString(),
          severity: "success", category: "system", title: "알림 전송 완료",
          message: `${SCOPE_BADGES[scope]?.label || scope} 대상으로 알림이 전송되었습니다.`,
          source: "notification_management",
          dismissible: true, persistent: false, read: false,
        });
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (e) {
      addToast({
        id: `notif-error-${Date.now()}`, timestamp: new Date().toISOString(),
        severity: "error", category: "system", title: "알림 처리 실패",
        message: String(e), source: "notification_management",
        dismissible: true, persistent: false, read: false,
      });
    }
  };

  const handleEdit = (n: PersistentNotification) => {
    setTitle(n.title); setMessage(n.message); setSeverity(n.severity);
    setScope(n.scope); setTargetRole(n.target_role || "");
    setTargetUserId(n.target_user_id?.toString() || "");
    setLink(n.link || ""); setExpiresAt(n.expires_at || "");
    setEditingId(n.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 알림을 삭제하시겠습니까?")) return;
    await deleteNotification(id);
    loadData();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <ContentHeader
        title="알림 관리"
        description="앱 알림 전송, 전역 공지, 역할별/사용자별 알림 관리"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadData} className="flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> 새로고침
            </Button>
            <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1">
              <Plus className="w-4 h-4" /> 새 알림
            </Button>
          </div>
        }
      />
      <div className="page-container">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-section-gap">
            {/* 알림 목록 */}
            <Card>
              <CardBody className="p-0">
                {notifications.length === 0 ? (
                  <div className="p-8">
                    <EmptyState title="알림이 없습니다" description="새 알림을 전송해보세요." />
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary">범위</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary">심각도</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary">제목</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary">대상</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary">시간</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary">상태</th>
                        <th className="px-4 py-3 text-right text-caption font-medium text-content-tertiary">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {notifications.map((n) => (
                        <tr key={n.id} className="hover:bg-surface-raised transition-colors">
                          <td className="px-4 py-3"><ScopeBadge scope={n.scope} /></td>
                          <td className="px-4 py-3">{SEVERITY_ICONS[n.severity] || SEVERITY_ICONS.info}</td>
                          <td className="px-4 py-3">
                            <div className="text-body-sm font-medium text-content-primary">{n.title}</div>
                            <div className="text-caption text-content-tertiary truncate max-w-xs">{n.message}</div>
                          </td>
                          <td className="px-4 py-3 text-body-sm text-content-secondary">
                            {n.scope === "global" && "모든 앱"}
                            {n.scope === "app" && (n.app_id || "이 앱")}
                            {n.scope === "role" && `역할: ${n.target_role}`}
                            {n.scope === "user" && `사용자 #${n.target_user_id}`}
                          </td>
                          <td className="px-4 py-3 text-caption text-content-tertiary whitespace-nowrap">
                            {formatDate(n.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={async () => {
                                  await updateNotification(n.id, { is_active: !n.is_active });
                                  loadData();
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                                  n.is_active
                                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                                }`}
                                title={n.is_active ? "클릭하여 비활성화" : "클릭하여 활성화"}
                              >
                                {n.is_active ? "활성" : "비활성"}
                              </button>
                              {n.is_system && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                  SYSTEM
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(n)} className="p-1 hover:bg-surface-hover rounded" title="범위 수정">
                                <Pencil className="w-4 h-4 text-content-tertiary" />
                              </button>
                              {!n.is_system && (
                                <button onClick={() => handleDelete(n.id)} className="p-1 hover:bg-surface-hover rounded" title="삭제">
                                  <Trash2 className="w-4 h-4 text-status-danger" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* 전송/수정 모달 */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? "알림 수정" : "새 알림 전송"} size="lg">
        <div className="space-y-4">
          {/* Scope 선택 */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">전송 범위</label>
            <div className="grid grid-cols-4 gap-2">
              {(["global", "app", "role", "user"] as const).map((s) => {
                const cfg = SCOPE_BADGES[s];
                return (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      scope === s
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600"
                        : "border-line bg-surface-card text-content-secondary hover:border-brand-300"
                    }`}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 역할 선택 (role scope) */}
          {scope === "role" && (
            <Select
              label="대상 역할"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              options={[
                { value: "system_admin", label: "시스템 관리자" },
                { value: "org_admin", label: "조직 관리자" },
                { value: "user", label: "일반 사용자" },
              ]}
            />
          )}

          {/* 사용자 ID (user scope) */}
          {scope === "user" && (
            <Input
              label="대상 사용자 ID"
              type="number"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="사용자 ID 입력"
            />
          )}

          {/* 심각도 */}
          <Select
            label="심각도"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            options={[
              { value: "info", label: "ℹ️ 정보" },
              { value: "success", label: "✅ 성공" },
              { value: "warning", label: "⚠️ 경고" },
              { value: "error", label: "❌ 오류" },
              { value: "critical", label: "🚨 긴급" },
            ]}
          />

          {/* 제목 */}
          <Input
            label="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="알림 제목"
          />

          {/* 내용 */}
          <Textarea
            label="내용"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="알림 내용을 입력하세요"
            rows={3}
          />

          {/* 링크 (선택) */}
          <Input
            label="링크 (선택)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
          />

          {/* 만료 시간 (선택) */}
          <Input
            label="만료 시간 (선택)"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />

          {/* 전송 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!title.trim() || !message.trim()}
              className="flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
              {editingId ? "수정" : "전송"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
