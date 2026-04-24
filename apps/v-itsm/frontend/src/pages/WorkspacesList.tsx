import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Layers, Plus } from "lucide-react";
import Layout from "../components/Layout";
import { useWorkspaceStore } from "../stores/workspace";
import { useAuthStore } from "../store/auth";
import {
  Alert,
  Drawer,
  DrawerFooter,
  Input,
  Textarea,
} from "../components/ui";
import { createWorkspace } from "../lib/api/workspaces";

interface WorkspaceForm {
  name: string;
  slug: string;
  description: string;
  is_default: boolean;
}

const EMPTY_FORM: WorkspaceForm = {
  name: "",
  slug: "",
  description: "",
  is_default: false,
};

const SLUG_PATTERN = /^[a-z0-9_-]+$/;

export default function WorkspacesList() {
  const navigate = useNavigate();
  const { myWorkspaces, currentWorkspaceId, switchWorkspace, refreshMyWorkspaces } =
    useWorkspaceStore();
  const isAdmin = useAuthStore().isAdmin();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<WorkspaceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleEnter = async (wsId: string) => {
    if (wsId !== currentWorkspaceId) {
      await switchWorkspace(wsId);
    }
    navigate("/kanban");
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    const slug = form.slug.trim();
    if (!name) {
      setError("이름은 필수입니다.");
      return;
    }
    if (!slug) {
      setError("slug는 필수입니다.");
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setError("slug는 영소문자·숫자·하이픈(-)·언더스코어(_)만 가능합니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createWorkspace({
        name,
        slug,
        description: form.description.trim() || undefined,
        is_default: form.is_default,
      });
      setSuccess(`워크스페이스 "${name}"가 생성되었습니다.`);
      setDrawerOpen(false);
      await refreshMyWorkspaces();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`생성 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-heading-lg font-bold text-content-primary">
              워크스페이스
            </h1>
            <p className="text-body-sm text-content-secondary mt-1">
              접속할 워크스페이스를 선택하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={isAdmin ? openCreate : undefined}
            disabled={!isAdmin}
            className={
              isAdmin
                ? "flex items-center gap-2 px-4 py-2 rounded-button text-body-sm font-medium bg-brand-600 text-content-inverse hover:bg-brand-700 transition-colors"
                : "flex items-center gap-2 px-4 py-2 rounded-button text-body-sm font-medium bg-brand-600 text-content-inverse opacity-50 cursor-not-allowed"
            }
            title={isAdmin ? "새 워크스페이스 생성" : "시스템 관리자만 생성 가능"}
          >
            <Plus className="w-4 h-4" />
            새 워크스페이스
          </button>
        </div>

        {success && (
          <div className="mb-4">
            <Alert variant="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </div>
        )}

        {myWorkspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-content-tertiary gap-3">
            <Layers className="w-12 h-12 opacity-40" />
            <p className="text-body-sm">접근 가능한 워크스페이스가 없습니다.</p>
            <p className="text-caption">관리자에게 워크스페이스 초대를 요청하세요.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center justify-between p-5 bg-surface-card border border-line rounded-card hover:border-brand-300 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {ws.icon_url ? (
                    <img
                      src={ws.icon_url}
                      alt={ws.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 flex-shrink-0">
                      <Layers className="w-5 h-5 text-brand-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-body-base font-semibold text-content-primary truncate">
                        {ws.name}
                      </p>
                      {ws.id === currentWorkspaceId && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-caption font-medium bg-brand-50 text-brand-700">
                          현재
                        </span>
                      )}
                      {ws.is_default && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-caption font-medium bg-surface-raised text-content-secondary">
                          기본
                        </span>
                      )}
                    </div>
                    {ws.description && (
                      <p className="text-body-sm text-content-secondary truncate mt-0.5">
                        {ws.description}
                      </p>
                    )}
                    <p className="text-caption text-content-tertiary mt-0.5">
                      티켓 {ws.ticket_count.toLocaleString()}건 · {ws.my_role === "ws_admin" ? "관리자" : ws.my_role === "ws_member" ? "멤버" : "뷰어"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleEnter(ws.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-button text-body-sm font-medium bg-brand-600 text-content-inverse hover:bg-brand-700 transition-colors ml-4"
                >
                  접속
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="새 워크스페이스"
        size="md"
        footer={
          <DrawerFooter
            onCancel={() => setDrawerOpen(false)}
            onConfirm={() => void handleSubmit()}
            confirmText="생성"
            loading={saving}
          />
        }
      >
        <div className="space-y-4">
          {error && (
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Input
            label="이름 *"
            placeholder="예: 영업본부"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="slug *"
            placeholder="예: sales"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            helperText="영소문자·숫자·하이픈(-)·언더스코어(_)만 사용 가능"
          />
          <Textarea
            label="설명"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label className="flex items-center gap-2 text-body-sm text-content-primary">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="w-4 h-4 rounded border-line"
            />
            시스템 기본 워크스페이스로 지정
          </label>
        </div>
      </Drawer>
    </Layout>
  );
}
