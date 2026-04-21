/**
 * PreviewPane — Sandpack react-ts 즉시 미리보기 (content-only).
 *
 * store.fileMap 을 Sandpack files prop 으로 전달하여 코드가 변경될 때마다 iframe 이
 * 자동으로 재컴파일된다. 외곽 컨테이너는 CanvasPane 이 담당하므로 이 컴포넌트는
 * Sandpack 만 렌더한다. Tailwind Play CDN 을 `/public/index.html` 에 주입하여
 * Sandpack 샌드박스 안에서도 Tailwind 클래스가 동작하도록 한다.
 */

import { memo, useMemo } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import { Loader2 } from "lucide-react";

import { useBuilderStore } from "../../store/builder";
import { presetFiles, presetDependencies } from "../../sandpack/preset";

const DEFAULT_APP = `export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>v-ui-builder</h1>
      <p style={{ color: "#64748b" }}>
        채팅에 UI 요청을 입력하면 여기에 결과가 미리보기됩니다.
      </p>
    </div>
  );
}
`;

// Tailwind Play CDN — Sandpack 샌드박스에서 빌드 없이 Tailwind 사용
const TAILWIND_INDEX_HTML = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

/**
 * Sandpack react-ts 템플릿은 루트 레이아웃(`/App.tsx`, `/index.tsx`)을 사용한다.
 * 과거 프롬프트로 `/src/*` 파일이 저장된 프로젝트를 위해 `/src/` 접두사를 벗겨
 * 루트 경로로 정규화한다.
 */
function normalize(fileMap: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(fileMap)) {
    const normalized = path.startsWith("/src/") ? path.slice(4) : path;
    out[normalized] = content;
  }
  return out;
}

function SkeletonPreview({ hint }: { hint: string }) {
  return (
    <div className="h-full min-h-0 bg-surface-page p-3">
      <div className="h-full min-h-0 rounded-card border border-line overflow-hidden shadow-card bg-surface-card flex flex-col">
        <div className="shrink-0 h-9 border-b border-line bg-surface-chrome flex items-center px-3 gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-surface-raised animate-pulse" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-raised animate-pulse" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-raised animate-pulse" />
          <span className="ml-3 h-3 w-48 rounded-sm bg-surface-raised animate-pulse" />
        </div>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-content-tertiary">
          <Loader2 size={20} className="animate-spin text-brand-500" />
          <span className="text-[12px]">{hint}</span>
          <div className="w-[60%] max-w-sm space-y-2 mt-2">
            <span className="block h-3 w-full rounded-sm bg-surface-raised animate-pulse" />
            <span className="block h-3 w-4/5 rounded-sm bg-surface-raised animate-pulse" />
            <span className="block h-3 w-3/5 rounded-sm bg-surface-raised animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Sandpack props 는 참조 동일성이 중요하다. 드래그·스트리밍 중 새 객체가 들어오면
// SandpackProvider 내부 diff 가 매번 돌며 iframe 재번들 트리거가 된다.
const SANDPACK_OPTIONS = { recompileMode: "delayed", recompileDelay: 400 } as const;
const SANDPACK_DEPENDENCIES: Record<string, string> = {
  react: "^18.2.0",
  "react-dom": "^18.2.0",
  recharts: "^2.12.0",
  "lucide-react": "^0.460.0",
  clsx: "^2.1.0",
  "framer-motion": "^11.0.0",
  "date-fns": "^3.6.0",
  ...presetDependencies,
};
const SANDPACK_CUSTOM_SETUP = { dependencies: SANDPACK_DEPENDENCIES } as const;
const SANDPACK_LAYOUT_STYLE = { height: "100%", border: "none", borderRadius: 0 } as const;
const SANDPACK_PREVIEW_STYLE = { height: "100%", flex: 1 } as const;

function PreviewPaneImpl() {
  const project = useBuilderStore((s) => s.project);
  const fileMap = useBuilderStore((s) => s.fileMap);
  const isStreaming = useBuilderStore((s) => s.isStreaming);

  const files = useMemo(() => {
    const userFiles = normalize(fileMap);
    const merged: Record<string, string> = { ...presetFiles, ...userFiles };
    if (!merged["/App.tsx"]) merged["/App.tsx"] = DEFAULT_APP;
    if (!merged["/public/index.html"]) merged["/public/index.html"] = TAILWIND_INDEX_HTML;
    return merged;
  }, [fileMap]);

  if (!project) {
    return <SkeletonPreview hint="프로젝트 불러오는 중…" />;
  }
  if (Object.keys(fileMap).length === 0 && isStreaming) {
    return <SkeletonPreview hint="프리뷰 생성 중…" />;
  }

  return (
    <div className="h-full min-h-0 bg-surface-page p-3">
      <div className="ui-builder-sandpack h-full min-h-0 rounded-card border border-line overflow-hidden shadow-card bg-surface-card">
        <SandpackProvider
          template="react-ts"
          files={files}
          options={SANDPACK_OPTIONS}
          customSetup={SANDPACK_CUSTOM_SETUP}
        >
          <SandpackLayout style={SANDPACK_LAYOUT_STYLE}>
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton
              style={SANDPACK_PREVIEW_STYLE}
            />
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}

export const PreviewPane = memo(PreviewPaneImpl);
