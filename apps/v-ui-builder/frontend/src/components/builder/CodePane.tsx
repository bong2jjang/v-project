/**
 * CodePane — Monaco Editor 본체 + 파일 탭 + 에디터 툴바.
 *
 * 활성 파일을 편집 가능한 상태로 열어 코드를 수정/붙여넣기하면 즉시
 * store.updateFile() 에 반영되어 Sandpack 프리뷰가 재컴파일된다.
 * Monaco 의 path-based model cache 를 활용해 파일별 undo/redo 가 보존된다.
 */

import { useEffect, useRef, useState } from "react";
import type * as MonacoT from "monaco-editor";
import Editor, {
  type BeforeMount,
  type OnMount,
} from "@monaco-editor/react";
import { FilePlus2, Loader2, Search, Replace, WrapText } from "lucide-react";

import { useBuilderStore } from "../../store/builder";
import { useTheme } from "../../hooks/useTheme";

/**
 * 커스텀 테마 — 디자인 토큰(index.css)과 동일한 색상으로 에디터 배경/라인 정렬.
 * base 테마를 상속해 토큰/문법 하이라이트는 VS Code 기본을 재사용한다.
 */
function defineVThemes(monaco: typeof MonacoT) {
  monaco.editor.defineTheme("v-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#cccccc",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#cccccc",
      "editor.lineHighlightBackground": "#2a2d2e",
      "editor.lineHighlightBorder": "#00000000",
      "editorCursor.foreground": "#4da6ff",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#3a3d41",
      "editorIndentGuide.background": "#2b2b2b",
      "editorIndentGuide.activeBackground": "#3e3e3e",
      "editorWidget.background": "#252526",
      "editorWidget.border": "#3e3e3e",
      "scrollbarSlider.background": "#4d4d4d40",
      "scrollbarSlider.hoverBackground": "#5a5a5a60",
      "scrollbarSlider.activeBackground": "#6a6a6a80",
    },
  });
  monaco.editor.defineTheme("v-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#333333",
      "editorLineNumber.foreground": "#a0a0a0",
      "editorLineNumber.activeForeground": "#333333",
      "editor.lineHighlightBackground": "#f5f5f5",
      "editor.lineHighlightBorder": "#00000000",
      "editorCursor.foreground": "#0078d4",
      "editor.selectionBackground": "#add6ff",
      "editor.inactiveSelectionBackground": "#e5ebf1",
      "editorIndentGuide.background": "#e8e8e8",
      "editorIndentGuide.activeBackground": "#cccccc",
      "editorWidget.background": "#f3f3f3",
      "editorWidget.border": "#cccccc",
    },
  });
}

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

  defineVThemes(monaco);
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

function SkeletonCodePane({ hint }: { hint: string }) {
  const widths = [72, 40, 88, 56, 64, 80, 48, 36, 72, 60];
  return (
    <div className="h-full min-h-0 bg-surface-card flex flex-col">
      <div className="shrink-0 flex items-stretch bg-surface-chrome border-b border-line h-[30px]">
        <div className="relative h-full px-3 inline-flex items-center gap-2 border-r border-line">
          <span className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-brand-500/60" />
          <span className="h-3 w-20 rounded-sm bg-surface-raised animate-pulse" />
        </div>
        <div className="h-full px-3 inline-flex items-center border-r border-line">
          <span className="h-3 w-14 rounded-sm bg-surface-raised/70 animate-pulse" />
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 px-2 py-1 bg-surface-chrome border-b border-line text-[11px] text-content-tertiary">
        <Loader2 size={12} className="animate-spin text-brand-500" />
        <span>{hint}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden px-3 py-3 space-y-2">
        {widths.map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-5 text-right text-[11px] font-mono text-content-tertiary/50">
              {i + 1}
            </span>
            <span
              className="h-3 rounded-sm bg-surface-raised animate-pulse"
              style={{ width: `${w}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
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

interface EditorToolbarProps {
  onFind: () => void;
  onReplace: () => void;
  wordWrap: boolean;
  onToggleWrap: () => void;
}

function EditorToolbar({
  onFind,
  onReplace,
  wordWrap,
  onToggleWrap,
}: EditorToolbarProps) {
  return (
    <div className="shrink-0 flex items-center justify-end gap-1 px-2 py-1 bg-surface-chrome border-b border-line text-[11px]">
      <button
        type="button"
        onClick={onFind}
        title="찾기 (Ctrl+F)"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-button text-content-secondary hover:text-content-primary hover:bg-surface-raised transition-colors"
      >
        <Search size={12} />
        <span>찾기</span>
      </button>
      <button
        type="button"
        onClick={onReplace}
        title="바꾸기 (Ctrl+H)"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-button text-content-secondary hover:text-content-primary hover:bg-surface-raised transition-colors"
      >
        <Replace size={12} />
        <span>바꾸기</span>
      </button>
      <button
        type="button"
        onClick={onToggleWrap}
        title="줄바꿈 토글"
        className={[
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-button transition-colors",
          wordWrap
            ? "text-brand-500 hover:bg-surface-raised"
            : "text-content-secondary hover:text-content-primary hover:bg-surface-raised",
        ].join(" ")}
      >
        <WrapText size={12} />
        <span>줄바꿈</span>
      </button>
    </div>
  );
}

export function CodePane() {
  const project = useBuilderStore((s) => s.project);
  const fileMap = useBuilderStore((s) => s.fileMap);
  const activeFile = useBuilderStore((s) => s.activeFile);
  const updateFile = useBuilderStore((s) => s.updateFile);
  const isStreaming = useBuilderStore((s) => s.isStreaming);
  const { isDark } = useTheme();

  const editorRef = useRef<MonacoT.editor.IStandaloneCodeEditor | null>(null);
  const titleObserverRef = useRef<MutationObserver | null>(null);
  const [wordWrap, setWordWrap] = useState(true);

  useEffect(() => {
    return () => {
      titleObserverRef.current?.disconnect();
      titleObserverRef.current = null;
    };
  }, []);

  const files = Object.keys(fileMap).sort();
  const current =
    activeFile && fileMap[activeFile] !== undefined
      ? activeFile
      : files[0] ?? null;
  const content = current ? fileMap[current] ?? "" : "";

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Monaco 내장 Find/Replace 위젯 버튼의 native `title` 툴팁이 버튼 위에 떠
    // 클릭을 방해한다. title 을 제거하고 aria-label 은 유지해 스크린리더 접근성은 보존.
    // Find 위젯은 lazy 로 mount 되므로 MutationObserver 로 지속 감시해야 한다.
    const dom = editor.getDomNode();
    if (dom) {
      const TOOLTIP_HOST_SELECTORS = [
        ".find-widget",
        ".editor-widget",
        ".monaco-action-bar",
      ];
      const strip = (root: ParentNode) => {
        TOOLTIP_HOST_SELECTORS.forEach((sel) => {
          root.querySelectorAll(`${sel} [title]`).forEach((el) => {
            const title = el.getAttribute("title");
            if (!title) return;
            if (!el.getAttribute("aria-label")) {
              el.setAttribute("aria-label", title);
            }
            el.removeAttribute("title");
          });
        });
      };
      strip(dom);
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.target instanceof Element) {
            if (m.target.hasAttribute("title")) strip(dom);
          } else if (m.type === "childList") {
            strip(dom);
          }
        }
      });
      observer.observe(dom, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["title"],
      });
      titleObserverRef.current?.disconnect();
      titleObserverRef.current = observer;
    }
  };

  const runAction = (id: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const action = editor.getAction(id);
    if (action) action.run();
  };

  if (!current) {
    if (!project) return <SkeletonCodePane hint="프로젝트 불러오는 중…" />;
    if (isStreaming)
      return <SkeletonCodePane hint="첫 파일을 받고 있습니다…" />;
    return <EmptyPasteArea />;
  }

  return (
    <div className="h-full min-h-0 bg-surface-card flex flex-col">
      <EditorToolbar
        onFind={() => runAction("actions.find")}
        onReplace={() => runAction("editor.action.startFindReplaceAction")}
        wordWrap={wordWrap}
        onToggleWrap={() => setWordWrap((v) => !v)}
      />
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          path={current}
          language={languageFromPath(current)}
          value={content}
          beforeMount={configureMonaco}
          onMount={handleMount}
          onChange={(next) => {
            if (typeof next === "string") updateFile(current, next);
          }}
          theme={isDark ? "v-dark" : "v-light"}
          options={{
            readOnly: isStreaming,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily:
              "Menlo, Monaco, 'Courier New', 'D2Coding', Consolas, monospace",
            scrollBeyondLastLine: false,
            wordWrap: wordWrap ? "on" : "off",
            automaticLayout: true,
            smoothScrolling: true,
            renderLineHighlight: "line",
            lineNumbersMinChars: 3,
            padding: { top: 6, bottom: 6 },
          }}
        />
      </div>
    </div>
  );
}
