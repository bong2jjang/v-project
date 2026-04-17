/**
 * Builder 페이지 — 3-pane IDE (Chat | Code | Preview).
 *
 * Sandpack 통합은 P1.2 에서. 이 파일은 스캐폴딩 단계 스텁.
 */
import { ChatPane } from "../components/builder/ChatPane";
import { CodePane } from "../components/builder/CodePane";
import { PreviewPane } from "../components/builder/PreviewPane";

export default function Builder() {
  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-[360px_1fr_1fr] gap-2 p-2">
      <ChatPane />
      <CodePane />
      <PreviewPane />
    </div>
  );
}
