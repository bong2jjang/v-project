import { Settings } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";

export default function WsSettings() {
  const { currentWorkspace } = useWorkspaceStore();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-content-secondary" />
        <h1 className="text-heading-md font-bold text-content-primary">
          워크스페이스 설정
        </h1>
      </div>
      <p className="text-body-sm text-content-secondary">
        {currentWorkspace?.name ?? "—"} — 설정 페이지 (W7 구현 예정)
      </p>
    </div>
  );
}
