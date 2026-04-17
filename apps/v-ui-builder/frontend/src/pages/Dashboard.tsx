/**
 * Dashboard — 최근 프로젝트 목록 + 새 프로젝트 생성.
 *
 * TanStack Query 로 프로젝트 목록을 캐시하고 createProject 후 invalidate 로
 * 즉시 목록을 갱신한다. 생성 성공 시 새 프로젝트 Builder 로 이동.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/auth";
import {
  uiBuilderApi,
  type LLMProvider,
  type Project,
  type ProjectCreateRequest,
} from "../lib/api/ui-builder";

const PROJECTS_KEY = ["ui-builder", "projects"] as const;

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => uiBuilderApi.listProjects(),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectCreateRequest>({
    name: "",
    description: "",
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
        template: "react-ts",
        llm_provider: "openai",
      });
      navigate(`/builder/${created.id}`);
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
                  {user?.username || "사용자"}님, 무엇을 만들어 볼까요?
                </h2>
                <p className="mt-1 text-content-secondary">
                  대화로 UI를 만들고 Sandpack 으로 즉시 미리봅니다.
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
                    placeholder="예: 로그인 폼 실험"
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
            <CardTitle>최근 프로젝트</CardTitle>
          </CardHeader>
          <CardBody>
            {isLoading && (
              <p className="text-sm text-content-secondary">불러오는 중…</p>
            )}

            {!isLoading && (!projects || projects.length === 0) && (
              <p className="text-sm text-content-secondary">
                아직 프로젝트가 없습니다. 새 프로젝트를 만들어 시작하세요.
              </p>
            )}

            {projects && projects.length > 0 && (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {projects.map((p: Project) => (
                  <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      to={`/builder/${p.id}`}
                      className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -mx-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-content-primary">
                          {p.name}
                        </div>
                        {p.description && (
                          <div className="text-xs text-content-secondary mt-0.5">
                            {p.description}
                          </div>
                        )}
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
