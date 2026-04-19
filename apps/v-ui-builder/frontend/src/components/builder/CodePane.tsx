/**
 * CodePane — Monaco Editor 본체.
 *
 * 활성 파일을 편집 가능한 상태로 열어 코드를 수정/붙여넣기하면 즉시
 * store.updateFile() 에 반영되어 Sandpack 프리뷰가 재컴파일된다.
 * 파일이 아직 없을 때는 붙여넣기 전용 빈 상태 UI 를 보여준다.
 */

import { useState } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import { FilePlus2 } from "lucide-react";

import { useBuilderStore } from "../../store/builder";
import { useTheme } from "../../hooks/useTheme";

/**
 * Monaco 의 TS/JS 진단을 끈다. 실제 컴파일은 Sandpack 이 담당하므로,
 * 에디터에서 "Cannot find module 'react'" 같은 모듈 해석 오류 밑줄이 뜨지 않도록 한다.
 */
const configureMonaco: BeforeMount = (monaco) => {
  const diagnostics = {
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnostics);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnostics);

  const compiler = {
    allowNonTsExtensions: true,
    allowJs: true,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    esModuleInterop: true,
    isolatedModules: true,
    resolveJsonModule: true,
  };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compiler);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compiler);
};

function languageFromPath(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "typescript";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  return "plaintext";
}

function EmptyPasteArea() {
  const updateFile = useBuilderStore((s) => s.updateFile);
  const setActiveFile = useBuilderStore((s) => s.setActiveFile);

  const [path, setPath] = useState("/App.tsx");
  const [value, setValue] = useState("");

  const canCreate = path.trim().length > 0 && value.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    updateFile(normalized, value);
    setActiveFile(normalized);
  };

  return (
    <div className="h-full min-h-0 bg-surface-card flex flex-col p-3 gap-2">
      <div className="flex items-center gap-2 text-[11px] text-content-tertiary">
        <FilePlus2 size={14} className="text-brand-500" />
        <span>코드를 붙여넣어 프리뷰를 즉시 생성하세요.</span>
      </div>
      <input
        value={path}
        onChange={(e) => setPath(e.target.value)}
        spellCheck={false}
        placeholder="/App.tsx"
        className="shrink-0 rounded-input border border-line-heavy bg-surface-page text-content-primary placeholder:text-content-tertiary px-2 py-1 text-[12px] font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40"
      />
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        placeholder={`예시)\nexport default function App() {\n  return <div className="p-6 text-xl">Hello</div>;\n}`}
        className="flex-1 min-h-0 resize-none rounded-input border border-line-heavy bg-surface-page text-content-primary placeholder:text-content-tertiary px-2 py-1.5 text-[12px] font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="rounded-button bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 text-[11px] font-medium text-content-inverse transition-colors"
        >
          프리뷰 생성
        </button>
      </div>
    </div>
  );
}

export function CodePane() {
  const fileMap = useBuilderStore((s) => s.fileMap);
  const activeFile = useBuilderStore((s) => s.activeFile);
  const updateFile = useBuilderStore((s) => s.updateFile);
  const isStreaming = useBuilderStore((s) => s.isStreaming);
  const { isDark } = useTheme();

  const files = Object.keys(fileMap).sort();
  const current =
    activeFile && fileMap[activeFile] !== undefined
      ? activeFile
      : files[0] ?? null;
  const content = current ? fileMap[current] ?? "" : "";

  if (!current) {
    return <EmptyPasteArea />;
  }

  return (
    <div className="h-full min-h-0 bg-surface-card">
      <Editor
        height="100%"
        path={current}
        language={languageFromPath(current)}
        value={content}
        beforeMount={configureMonaco}
        onChange={(next) => {
          if (typeof next === "string") updateFile(current, next);
        }}
        theme={isDark ? "vs-dark" : "light"}
        options={{
          readOnly: isStreaming,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily:
            "Menlo, Monaco, 'Courier New', 'D2Coding', Consolas, monospace",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          smoothScrolling: true,
          renderLineHighlight: "line",
          lineNumbersMinChars: 3,
          padding: { top: 6, bottom: 6 },
        }}
      />
    </div>
  );
}
