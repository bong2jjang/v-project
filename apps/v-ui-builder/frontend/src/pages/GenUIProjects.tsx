/**
 * GenUIProjects — Generative UI(`project_type='genui'`) 프로젝트 목록 + 생성.
 *
 * Dashboard.tsx 의 sandpack 버전과 형제 페이지. 목록은 `?type=genui` 로 필터링되고,
 * 생성 후에는 `/genui/:projectId` 의 GenUIBuilder 로 이동한다.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";

import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/auth";
import {
  uiBuilderApi,
  type LLMProvider,
  type Project,
  type ProjectCreateRequest,
} from "../lib/api/ui-builder";

const PROJECTS_KEY = ["ui-builder", "projects", "genui"] as const;

export default function GenUIProjects() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => uiBuilderApi.listProjects("genui"),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectCreateRequest>({
    name: "",
    description: "",
    project_type: "genui",
    template: "react-ts",
    llm_provider: "openai",
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectCreateRequest) => uiBuilderApi.createProject(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      setShowForm(false);
      setForm({
        name: "",
        description: "",
        project_type: "genui",
        template: "react-ts",
        llm_provider: "openai",
      });
      navigate(`/genui/${created.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate(form);
  };

  return (
    <div className="page-container">
      <div className="space-y-section-gap">
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-content-primary">
                  {user?.username || "사용자"}님, 어떤 대시보드를 만들어 볼까요?
                </h2>
                <p className="mt-1 text-content-secondary">
                  대화로 위젯을 고정하고 자유롭게 배치하는 Generative UI 프로젝트입니다.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "취소" : "새 프로젝트"}
              </Button>
            </div>

            {showForm && (
              <form
                onSubmit={handleSubmit}
                className="mt-4 space-y-3 border-t pt-4"
              >
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="예: 시장 모니터링 대시보드"
                    required
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">
                    설명 (선택)
                  </label>
                  <input
                    type="text"
                    value={form.description ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">
                    LLM Provider
                  </label>
                  <select
                    value={form.llm_provider}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        llm_provider: e.target.value as LLMProvider,
                      }))
                    }
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>

                {createMutation.isError && (
                  <div className="text-xs text-red-500">
                    생성 실패:{" "}
                    {(createMutation.error as Error)?.message ?? "Unknown"}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={createMutation.isPending || !form.name.trim()}
                  >
                    {createMutation.isPending ? "생성 중…" : "생성"}
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 대시보드</CardTitle>
          </CardHeader>
          <CardBody>
            {isLoading && (
              <p className="text-sm text-content-secondary">불러오는 중…</p>
            )}

            {!isLoading && (!projects || projects.length === 0) && (
              <p className="text-sm text-content-secondary">
                아직 대시보드가 없습니다. 새 프로젝트를 만들어 시작하세요.
              </p>
            )}

            {projects && projects.length > 0 && (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {projects.map((p: Project) => (
                  <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      to={`/genui/${p.id}`}
                      className="flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -mx-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <LayoutDashboard
                            size={12}
                            className="shrink-0 text-brand-500"
                          />
                          <span className="text-sm font-medium text-content-primary truncate">
                            {p.name}
                          </span>
                        </div>
                        {p.description ? (
                          <div className="text-xs text-content-secondary mt-0.5 truncate">
                            {p.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-xs text-content-secondary shrink-0">
                        {p.llm_provider} · {new Date(p.updated_at).toLocaleDateString()}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
