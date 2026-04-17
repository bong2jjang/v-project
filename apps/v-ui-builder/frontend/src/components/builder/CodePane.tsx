/**
 * CodePane — Monaco Editor 기반 파일 탭 + 읽기 전용 뷰어.
 *
 * store.fileMap 이 SSE 에 의해 실시간 갱신되면 현재 선택된 파일이 함께 업데이트된다.
 */

import Editor from "@monaco-editor/react";

import { useBuilderStore } from "../../store/builder";

function languageFromPath(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "typescript";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  return "plaintext";
}

export function CodePane() {
  const fileMap = useBuilderStore((s) => s.fileMap);
  const activeFile = useBuilderStore((s) => s.activeFile);
  const setActiveFile = useBuilderStore((s) => s.setActiveFile);

  const files = Object.keys(fileMap).sort();
  const current = activeFile && fileMap[activeFile] !== undefined ? activeFile : files[0] ?? null;
  const content = current ? fileMap[current] ?? "" : "";

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center gap-1 overflow-x-auto">
        <h2 className="text-sm font-semibold mr-3 shrink-0">Code</h2>
        {files.length === 0 ? (
          <span className="text-xs text-gray-400">
            파일이 생성되면 여기에 탭으로 표시됩니다.
          </span>
        ) : (
          files.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => setActiveFile(path)}
              className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                path === current
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {path}
            </button>
          ))
        )}
      </div>

      <div className="flex-1 min-h-0">
        {current ? (
          <Editor
            height="100%"
            language={languageFromPath(current)}
            value={content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-gray-400">
            아직 생성된 파일이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
