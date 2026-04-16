/**
 * AppManagement — 포탈 앱 등록/수정/삭제 관리 페이지
 *
 * system_admin 전용. DB 기반 앱 CRUD.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  GripVertical,
  ExternalLink,
  MessageSquare,
  Ticket,
  LayoutDashboard,
  Settings,
  Box,
  Globe,
  Shield,
  Zap,
  Database,
  BarChart3,
  Users,
  FileText,
  Bell,
  Mail,
} from "lucide-react";
import { ContentHeader } from "../../components/layout/ContentHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal, ModalFooter } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import type {
  PortalApp,
  AppCreateRequest,
  AppUpdateRequest,
} from "../../lib/api/portal";
import {
  getAllApps,
  createApp,
  updateApp,
  deleteApp,
} from "../../lib/api/portal";
import { createSsoRelay } from "@v-platform/core/api/auth";
import { useAuthStore } from "../../store/auth";

// ── Lucide 아이콘 맵 ──────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-5 h-5" />,
  Ticket: <Ticket className="w-5 h-5" />,
  LayoutDashboard: <LayoutDashboard className="w-5 h-5" />,
  Settings: <Settings className="w-5 h-5" />,
  Server: <Server className="w-5 h-5" />,
  Box: <Box className="w-5 h-5" />,
  Globe: <Globe className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Database: <Database className="w-5 h-5" />,
  BarChart3: <BarChart3 className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  Bell: <Bell className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

// ── 초기 폼 상태 ──────────────────────────────────────────────────

interface FormState {
  app_id: string;
  display_name: string;
  description: string;
  icon: string;
  frontend_url: string;
  api_url: string;
  health_endpoint: string;
  sort_order: number;
  is_active: boolean;
}

const INITIAL_FORM: FormState = {
  app_id: "",
  display_name: "",
  description: "",
  icon: "Box",
  frontend_url: "",
  api_url: "",
  health_endpoint: "/api/health",
  sort_order: 0,
  is_active: true,
};

export default function AppManagement() {
  const [apps, setApps] = useState<PortalApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);

  const { token } = useAuthStore();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<PortalApp | null>(null);
  const [deleting, setDeleting] = useState(false);

  // SSO Relay로 앱 열기 (Portal.tsx와 동일한 패턴)
  const handleLaunchApp = async (app: PortalApp) => {
    if (!token) {
      window.open(app.frontend_url, "_blank");
      return;
    }
    setLaunchingAppId(app.app_id);
    try {
      const { code } = await createSsoRelay();
      window.open(
        `${app.frontend_url}?sso_code=${encodeURIComponent(code)}`,
        "_blank",
      );
    } catch {
      // Relay 실패 시 토큰 없이 열기 (앱 자체 로그인으로 폴백)
      window.open(app.frontend_url, "_blank");
    } finally {
      setLaunchingAppId(null);
    }
  };

  const loadApps = useCallback(async () => {
    try {
      const data = await getAllApps();
      setApps(data);
    } catch (e) {
      console.error("Failed to load apps:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // ── Form helpers ──────────────────────────────────────────────

  const openCreateModal = () => {
    setForm(INITIAL_FORM);
    setEditingAppId(null);
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (app: PortalApp) => {
    setForm({
      app_id: app.app_id,
      display_name: app.display_name,
      description: app.description || "",
      icon: app.icon || "Box",
      frontend_url: app.frontend_url,
      api_url: app.api_url,
      health_endpoint: app.health_endpoint || "/api/health",
      sort_order: app.sort_order ?? 0,
      is_active: app.is_active ?? true,
    });
    setEditingAppId(app.app_id);
    setErrors({});
    setModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.app_id.trim()) newErrors.app_id = "앱 ID는 필수입니다.";
    if (!form.display_name.trim()) newErrors.display_name = "표시 이름은 필수입니다.";
    if (!form.frontend_url.trim()) newErrors.frontend_url = "프론트엔드 URL은 필수입니다.";
    if (!form.api_url.trim()) newErrors.api_url = "API URL은 필수입니다.";

    if (form.app_id && !/^[a-z0-9-]+$/.test(form.app_id)) {
      newErrors.app_id = "소문자, 숫자, 하이픈만 사용 가능합니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingAppId) {
        const payload: AppUpdateRequest = {
          display_name: form.display_name,
          description: form.description,
          icon: form.icon,
          frontend_url: form.frontend_url,
          api_url: form.api_url,
          health_endpoint: form.health_endpoint,
          sort_order: form.sort_order,
          is_active: form.is_active,
        };
        await updateApp(editingAppId, payload);
      } else {
        const payload: AppCreateRequest = {
          app_id: form.app_id,
          display_name: form.display_name,
          description: form.description,
          icon: form.icon,
          frontend_url: form.frontend_url,
          api_url: form.api_url,
          health_endpoint: form.health_endpoint,
          sort_order: form.sort_order,
          is_active: form.is_active,
        };
        await createApp(payload);
      }
      setModalOpen(false);
      await loadApps();
    } catch (e: any) {
      const detail = e?.body?.detail || e?.message || "저장에 실패했습니다.";
      setErrors({ app_id: detail });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteApp(deleteTarget.app_id);
      setDeleteTarget(null);
      await loadApps();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <ContentHeader
        title="앱 관리"
        description="포탈에 등록된 앱을 관리합니다."
        actions={
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            앱 등록
          </Button>
        }
      />

      <div className="page-container">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : apps.length === 0 ? (
          <EmptyState
            title="등록된 앱이 없습니다"
            description="새 앱을 등록하여 포탈에서 관리하세요."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <Card key={app.app_id} className="group relative">
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                        {ICON_MAP[app.icon] || <Server className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-body-base font-semibold text-content-primary">
                          {app.display_name}
                        </h3>
                        <p className="text-caption text-content-tertiary font-mono">
                          {app.app_id}
                        </p>
                      </div>
                    </div>
                    <Badge variant={app.is_active ? "success" : "default"}>
                      {app.is_active ? "활성" : "비활성"}
                    </Badge>
                  </div>

                  {app.description && (
                    <p className="text-body-sm text-content-secondary mb-3 line-clamp-2">
                      {app.description}
                    </p>
                  )}

                  <div className="space-y-1.5 text-caption text-content-tertiary">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{app.frontend_url}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{app.api_url}</span>
                    </div>
                    {app.sort_order !== undefined && app.sort_order !== 0 && (
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 shrink-0" />
                        <span>정렬: {app.sort_order}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-line">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(app)}
                      className="flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      수정
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget(app)}
                      className="flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </Button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => handleLaunchApp(app)}
                      disabled={launchingAppId === app.app_id}
                      className="p-1.5 rounded-button text-content-tertiary hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="앱 열기 (SSO)"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAppId ? "앱 수정" : "앱 등록"}
        size="lg"
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onConfirm={handleSave}
            confirmText={editingAppId ? "수정" : "등록"}
            loading={saving}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="앱 ID"
              value={form.app_id}
              onChange={(e) => setField("app_id", e.target.value)}
              placeholder="my-app"
              disabled={!!editingAppId}
              error={errors.app_id}
              helperText="소문자, 숫자, 하이픈만 사용"
              required
            />
            <Input
              label="표시 이름"
              value={form.display_name}
              onChange={(e) => setField("display_name", e.target.value)}
              placeholder="My Application"
              error={errors.display_name}
              required
            />
          </div>

          <Textarea
            label="설명"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="앱에 대한 간단한 설명"
            rows={2}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="프론트엔드 URL"
              value={form.frontend_url}
              onChange={(e) => setField("frontend_url", e.target.value)}
              placeholder="http://127.0.0.1:5173"
              error={errors.frontend_url}
              required
            />
            <Input
              label="API URL"
              value={form.api_url}
              onChange={(e) => setField("api_url", e.target.value)}
              placeholder="http://backend:8000"
              error={errors.api_url}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="헬스 엔드포인트"
              value={form.health_endpoint}
              onChange={(e) => setField("health_endpoint", e.target.value)}
              placeholder="/api/health"
            />
            <Input
              label="정렬 순서"
              type="number"
              value={String(form.sort_order)}
              onChange={(e) => setField("sort_order", Number(e.target.value) || 0)}
              helperText="숫자가 작을수록 먼저 표시"
            />
          </div>

          {/* 아이콘 선택 */}
          <div className="space-y-1">
            <label className="block text-heading-sm text-content-primary">
              아이콘
            </label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setField("icon", iconName)}
                  className={`p-2 rounded-lg border transition-colors ${
                    form.icon === iconName
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600"
                      : "border-line hover:border-line-heavy text-content-secondary hover:text-content-primary"
                  }`}
                  title={iconName}
                >
                  {ICON_MAP[iconName]}
                </button>
              ))}
            </div>
          </div>

          {/* 활성 토글 */}
          <Toggle
            checked={form.is_active}
            onChange={(v) => setField("is_active", v)}
            label="활성 상태"
          />
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ───────────────────────────────── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="앱 삭제"
        size="sm"
        footer={
          <ModalFooter
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            confirmText="삭제"
            confirmVariant="danger"
            loading={deleting}
          />
        }
      >
        <p className="text-body-base text-content-secondary">
          <strong className="text-content-primary">{deleteTarget?.display_name}</strong>
          {" "}({deleteTarget?.app_id})을(를) 삭제하시겠습니까?
        </p>
        <p className="text-body-sm text-content-tertiary mt-2">
          이 작업은 되돌릴 수 없습니다. 포탈에서 해당 앱이 제거됩니다.
        </p>
      </Modal>
    </>
  );
}
