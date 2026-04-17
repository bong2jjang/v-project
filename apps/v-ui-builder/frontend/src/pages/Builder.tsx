/**
 * Builder — 3-pane IDE (Chat | Code | Preview).
 *
 * URL 의 projectId 로 프로젝트 상세(메시지 + 최신 아티팩트)를 불러와 store 를 초기화.
 * 이후 ChatPane 의 SSE 훅이 store 를 실시간 갱신한다.
 */

import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { ChatPane } from "../components/builder/ChatPane";
import { CodePane } from "../components/builder/CodePane";
import { PreviewPane } from "../components/builder/PreviewPane";
import { uiBuilderApi } from "../lib/api/ui-builder";
import { useBuilderStore } from "../store/builder";

export default function Builder() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useBuilderStore((s) => s.project);
  const setProject = useBuilderStore((s) => s.setProject);
  const setMessages = useBuilderStore((s) => s.setMessages);
  const setArtifacts = useBuilderStore((s) => s.setArtifacts);

  useEffect(() => {
    if (!projectId || projectId === "new") return;
    let alive = true;

    // 이전 프로젝트 잔상 제거
    setProject(null);
    setMessages([]);

    (async () => {
      try {
        const detail = await uiBuilderApi.getProject(projectId);
        if (!alive) return;
        setProject(detail);
        setMessages(detail.messages ?? []);
        setArtifacts(detail.artifacts ?? []);
      } catch (err) {
        console.error("[Builder] Failed to load project", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [projectId, setProject, setMessages, setArtifacts]);

  if (!projectId || projectId === "new") {
    return (
      <div className="p-6 text-sm text-content-secondary">
        대시보드에서 프로젝트를 선택하거나 새로 만드세요.
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-sm text-content-secondary">
        프로젝트를 불러오는 중…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-[360px_1fr_1fr] gap-2 p-2">
      <ChatPane projectId={projectId} />
      <CodePane />
      <PreviewPane />
    </div>
  );
}
