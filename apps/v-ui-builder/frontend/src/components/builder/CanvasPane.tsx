/**
 * CanvasPane — VS Code 에디터 영역 룩.
 *
 * 상단 탭 바: [Preview] [file1.tsx] [file2.tsx] ... 를 단일 레일로 표시한다.
 * Preview 탭은 가상 탭, 나머지는 실제 파일 탭(클릭 시 해당 파일을 Monaco 에 띄움).
 * 외곽 컨테이너는 Builder 가 담당하고, 이 컴포넌트는 tab bar + 콘텐츠만 책임진다.
 * 콘텐츠 영역은 자체 스크롤만 가지며 외부 스크롤을 만들지 않는다.
 */

import { useState } from "react";
import { Eye, FileCode2 } from "lucide-react";

import { CodePane } from "./CodePane";
import { PreviewPane } from "./PreviewPane";
import { useBuilderStore } from "../../store/builder";

export function CanvasPane() {
  const fileMap = useBuilderStore((s) => s.fileMap);
  const activeFile = useBuilderStore((s) => s.activeFile);
  const setActiveFile = useBuilderStore((s) => s.setActiveFile);

  const [showPreview, setShowPreview] = useState(true);

  const files = Object.keys(fileMap).sort();
  const hasFiles = files.length > 0;
  const currentFile =
    activeFile && fileMap[activeFile] !== undefined
      ? activeFile
      : files[0] ?? null;

  const activeKey: "preview" | "code" | string = showPreview
    ? "preview"
    : hasFiles
    ? currentFile ?? "preview"
    : "code";

  const openFile = (path: string) => {
    setActiveFile(path);
    setShowPreview(false);
  };

  const openCode = () => {
    setShowPreview(false);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface-page">
      <div
        className="flex items-stretch bg-[var(--color-surface-chrome)] h-9 overflow-x-auto whitespace-nowrap border-b border-[var(--color-surface-chrome-border)]"
        style={{ scrollbarWidth: "thin" }}
      >
        <VsTab
          active={activeKey === "preview"}
          icon={<Eye size={14} />}
          label="Preview"
          onClick={() => setShowPreview(true)}
        />
        {!hasFiles && (
          <VsTab
            active={activeKey === "code"}
            icon={<FileCode2 size={14} />}
            label="Code"
            onClick={openCode}
          />
        )}
        {files.map((path) => (
          <VsTab
            key={path}
            active={activeKey === path}
            icon={<FileCode2 size={14} />}
            label={path.split("/").pop() ?? path}
            title={path}
            onClick={() => openFile(path)}
          />
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeKey === "preview" ? <PreviewPane /> : <CodePane />}
      </div>
    </div>
  );
}

interface VsTabProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
}

function VsTab({ active, icon, label, title, onClick }: VsTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`relative h-full px-3 inline-flex items-center gap-2 text-[12px] border-r border-[var(--color-surface-chrome-border)] shrink-0 transition-colors ${
        active
          ? "bg-surface-page text-content-primary"
          : "bg-[var(--color-surface-chrome)] text-content-tertiary hover:text-content-primary"
      }`}
    >
      {active && (
        <span className="absolute top-0 left-0 right-0 h-[2px] bg-brand-600" />
      )}
      <span className={active ? "text-brand-500" : "text-content-tertiary"}>
        {icon}
      </span>
      <span className="max-w-[180px] truncate">{label}</span>
    </button>
  );
}
