/**
 * 알림 관리 페이지 (관리자)
 *
 * SYSTEM 알림 + 커스텀 알림 (해당 앱 한정) 관리
 */

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Send, Trash2, Pencil, Megaphone, MessageSquare,
  RefreshCw, CheckCircle, AlertTriangle, Info, AlertCircle, XCircle,
} from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { ContentHeader } from "../../components/layout/ContentHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { SimpleMarkdown } from "../../components/ui/SimpleMarkdown";
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
  uploadNotificationImage,
} from "../../api/persistentNotifications";

const SCOPE_LABELS: Record<string, string> = {
  global: "전역",
  app: "이 앱",
  role: "역할",
  user: "사용자",
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <XCircle className="w-4 h-4 text-red-600" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "긴급",
  error: "오류",
  warning: "경고",
  info: "정보",
  success: "성공",
};

const SCOPE_SORT_ORDER: Record<string, number> = {
  global: 0,
  role: 1,
  user: 2,
  app: 3,
};

const ROLE_LABELS: Record<string, string> = {
  system_admin: "시스템 관리자",
  org_admin: "조직 관리자",
  user: "일반 사용자",
};

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  toast: "토스트",
  announcement: "공지사항",
  both: "토스트 + 공지사항",
};

function getTargetDisplay(n: PersistentNotification): string {
  if (n.is_system) {
    if (n.scope === "global") return "모든 앱 · 전체 사용자";
    if (n.scope === "role") return "각 앱 · 시스템 관리자, 조직 관리자";
    if (n.scope === "user") return "각 앱 · 일반 사용자 (본인)";
  }
  if (n.scope === "global") return "모든 앱";
  if (n.scope === "app") return n.app_id || "이 앱";
  if (n.scope === "role") return n.target_role ? `역할: ${ROLE_LABELS[n.target_role] || n.target_role}` : "미지정";
  if (n.scope === "user") return n.target_user_id ? `사용자 #${n.target_user_id}` : "미지정";
  return "미지정";
}

function ScopeBadge({ scope }: { scope: string }) {
  const label = SCOPE_LABELS[scope] || SCOPE_LABELS.app;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
      scope === "global"
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : scope === "role"
          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
          : scope === "user"
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    }`}>
      {label}
    </span>
  );
}

function DeliveryBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
      type === "announcement"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        : type === "both"
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
    }`}>
      {(type === "announcement" || type === "both") && <Megaphone className="w-3 h-3" />}
      {(type === "toast" || type === "both") && <MessageSquare className="w-3 h-3" />}
      {DELIVERY_TYPE_LABELS[type] || "토스트"}
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
  const [deliveryType, setDeliveryType] = useState<"toast" | "announcement" | "both">("toast");

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
    setDeliveryType("toast"); setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) return;
    if (scope === "role" && !targetRole) {
      addToast({
        id: `notif-val-${Date.now()}`, timestamp: new Date().toISOString(),
        severity: "warning", category: "system", title: "대상 역할 필요",
        message: "역할 범위 알림은 대상 역할을 선택해야 합니다.", source: "notification_management",
        dismissible: true, persistent: false, read: false,
      });
      return;
    }
    if (scope === "user" && !targetUserId) {
      addToast({
        id: `notif-val-${Date.now()}`, timestamp: new Date().toISOString(),
        severity: "warning", category: "system", title: "대상 사용자 필요",
        message: "사용자 범위 알림은 대상 사용자 ID를 입력해야 합니다.", source: "notification_management",
        dismissible: true, persistent: false, read: false,
      });
      return;
    }

    try {
      if (editingId) {
        const update: NotificationUpdate = {
          title, message, severity, scope,
          target_role: scope === "role" ? targetRole || undefined : undefined,
          target_user_id: scope === "user" ? Number(targetUserId) || undefined : undefined,
          link: link || undefined,
          expires_at: expiresAt || undefined,
          delivery_type: deliveryType,
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
          target_role: scope === "role" ? targetRole || undefined : undefined,
          target_user_id: scope === "user" ? Number(targetUserId) || undefined : undefined,
          link: link || undefined,
          expires_at: expiresAt || undefined,
          delivery_type: deliveryType,
        };
        await createNotification(data);
        addToast({
          id: `notif-sent-${Date.now()}`, timestamp: new Date().toISOString(),
          severity: "success", category: "system", title: "알림 전송 완료",
          message: `${SCOPE_LABELS[scope] || scope} 대상으로 알림이 전송되었습니다.`,
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
    setLink(n.link || "");
    // datetime-local input은 "YYYY-MM-DDTHH:mm" 형식 필요 — ISO 8601에서 변환
    setExpiresAt(n.expires_at ? n.expires_at.slice(0, 16) : "");
    setDeliveryType(n.delivery_type || "toast");
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

  const systemNotifications = notifications.filter((n) => n.is_system)
    .sort((a, b) => (SCOPE_SORT_ORDER[a.scope] ?? 99) - (SCOPE_SORT_ORDER[b.scope] ?? 99));
  const customNotifications = notifications.filter((n) => !n.is_system)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
            {/* ── 시스템 기본 알림 ── */}
            <Card>
              <CardBody className="p-0">
                <div className="px-5 py-3.5 border-b border-line">
                  <h3 className="text-body-sm font-semibold text-content-primary">시스템 기본 알림</h3>
                  <p className="text-caption text-content-tertiary mt-0.5">자동 발생 알림 — 활성/비활성만 조정 가능</p>
                </div>
                <div className="divide-y divide-line">
                  {systemNotifications.map((n) => (
                    <div key={n.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-raised/50 transition-colors">
                      {/* 심각도 아이콘 */}
                      <span className="flex-shrink-0" title={SEVERITY_LABELS[n.severity]}>
                        {SEVERITY_ICONS[n.severity] || SEVERITY_ICONS.info}
                      </span>
                      {/* 범위 배지 */}
                      <ScopeBadge scope={n.scope} />
                      {/* 제목 + 설명 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-content-primary truncate">{n.title}</div>
                        <div className="text-xs text-content-tertiary truncate">{n.message}</div>
                      </div>
                      {/* 대상 */}
                      <span className="hidden sm:block text-xs text-content-tertiary whitespace-nowrap">
                        {getTargetDisplay(n)}
                      </span>
                      {/* 활성 토글 */}
                      <button
                        onClick={async () => {
                          await updateNotification(n.id, { is_active: !n.is_active });
                          loadData();
                        }}
                        className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                          n.is_active
                            ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                        title={n.is_active ? "클릭하여 비활성화" : "클릭하여 활성화"}
                      >
                        {n.is_active ? "활성" : "비활성"}
                      </button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* ── 커스텀 알림 ── */}
            <Card>
              <CardBody className="p-0">
                <div className="px-5 py-3.5 border-b border-line">
                  <h3 className="text-body-sm font-semibold text-content-primary">커스텀 알림</h3>
                  <p className="text-caption text-content-tertiary mt-0.5">관리자가 수동 작성한 알림 — 이 앱 사용자에게만 전달</p>
                </div>
                {customNotifications.length === 0 ? (
                  <div className="p-8">
                    <EmptyState title="커스텀 알림이 없습니다" description="새 알림 버튼으로 직접 알림을 전송해보세요." />
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {customNotifications.map((n) => (
                      <div key={n.id} className="group flex items-start gap-3 px-5 py-3.5 hover:bg-surface-raised/50 transition-colors">
                        {/* 심각도 아이콘 */}
                        <span className="flex-shrink-0 mt-0.5" title={SEVERITY_LABELS[n.severity]}>
                          {SEVERITY_ICONS[n.severity] || SEVERITY_ICONS.info}
                        </span>
                        {/* 본문 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-content-primary">{n.title}</span>
                            <ScopeBadge scope={n.scope} />
                            <DeliveryBadge type={n.delivery_type} />
                          </div>
                          <div className="text-xs text-content-tertiary mt-1 line-clamp-2">
                            <SimpleMarkdown content={n.message} />
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-content-tertiary">
                            <span>{getTargetDisplay(n)}</span>
                            <span className="text-content-tertiary/50">·</span>
                            <span>{formatDate(n.created_at)}</span>
                            {n.link && (
                              <>
                                <span className="text-content-tertiary/50">·</span>
                                <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">링크</a>
                              </>
                            )}
                          </div>
                        </div>
                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              await updateNotification(n.id, { is_active: !n.is_active });
                              loadData();
                            }}
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                              n.is_active
                                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                            title={n.is_active ? "클릭하여 비활성화" : "클릭하여 활성화"}
                          >
                            {n.is_active ? "활성" : "비활성"}
                          </button>
                          <button onClick={() => handleEdit(n)} className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors" title="수정">
                            <Pencil className="w-3.5 h-3.5 text-content-tertiary" />
                          </button>
                          <button onClick={() => handleDelete(n.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="삭제">
                            <Trash2 className="w-3.5 h-3.5 text-status-danger" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* ── 전송/수정 모달 ── */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? "알림 수정" : "새 알림"} size="lg">
        <div className="space-y-5">
          {/* 1행: 대상 + 전달 방식 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 대상 범위 */}
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">대상</label>
              <div className="flex gap-1.5">
                {([
                  { value: "app", label: "앱 전체" },
                  { value: "role", label: "역할 지정" },
                  { value: "user", label: "사용자 지정" },
                ] as const).map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      setScope(s.value);
                      if (s.value === "role" && !targetRole) setTargetRole("system_admin");
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      scope === s.value
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600"
                        : "border-line bg-surface-card text-content-secondary hover:border-brand-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {/* 역할/사용자 하위 선택 */}
              {scope === "role" && (
                <div className="mt-2">
                  <Select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    options={[
                      { value: "system_admin", label: "시스템 관리자" },
                      { value: "org_admin", label: "조직 관리자" },
                      { value: "user", label: "일반 사용자" },
                    ]}
                  />
                </div>
              )}
              {scope === "user" && (
                <div className="mt-2">
                  <Input
                    type="number"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="사용자 ID 번호"
                  />
                </div>
              )}
            </div>

            {/* 전달 방식 */}
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">전달 방식</label>
              <div className="flex gap-1.5">
                {([
                  { value: "toast" as const, label: "토스트", icon: <MessageSquare className="w-3.5 h-3.5" /> },
                  { value: "announcement" as const, label: "공지사항", icon: <Megaphone className="w-3.5 h-3.5" /> },
                  { value: "both" as const, label: "둘 다", icon: <><MessageSquare className="w-3 h-3" /><Megaphone className="w-3 h-3" /></> },
                ]).map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDeliveryType(d.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      deliveryType === d.value
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600"
                        : "border-line bg-surface-card text-content-secondary hover:border-brand-300"
                    }`}
                  >
                    <span className="flex items-center gap-0.5">{d.icon}</span>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2행: 심각도 */}
          <Select
            label="심각도"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            options={[
              { value: "info", label: "정보" },
              { value: "success", label: "성공" },
              { value: "warning", label: "경고" },
              { value: "error", label: "오류" },
              { value: "critical", label: "긴급" },
            ]}
          />

          {/* 3행: 제목 */}
          <Input
            label="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="알림 제목을 입력하세요"
          />

          {/* 4행: 내용 (MDEditor) */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">내용</label>
            <div
              data-color-mode={document.documentElement.classList.contains("dark") ? "dark" : "light"}
              onPaste={async (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (!file) return;
                    try {
                      const url = await uploadNotificationImage(file);
                      setMessage((prev) => `${prev}\n![image](${url})\n`);
                    } catch {
                      addToast({
                        id: `upload-err-${Date.now()}`, timestamp: new Date().toISOString(),
                        severity: "error", category: "system", title: "이미지 업로드 실패",
                        message: "이미지를 업로드할 수 없습니다.", source: "notification_management",
                        dismissible: true, persistent: false, read: false,
                      });
                    }
                    return;
                  }
                }
              }}
            >
              <MDEditor
                value={message}
                onChange={(val) => setMessage(val || "")}
                height={250}
                preview="edit"
                textareaProps={{
                  placeholder: "알림 내용을 입력하세요\n\n마크다운 사용 가능: **굵게**, *기울임*, # 제목, - 목록, > 인용",
                }}
              />
            </div>
          </div>

          {/* 5행: 부가 옵션 */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="링크 (선택)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/path 또는 URL"
            />
            <Input
              label="만료 시간 (선택)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* 전송 버튼 */}
          <div className="flex justify-end gap-2 pt-1 border-t border-line">
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
