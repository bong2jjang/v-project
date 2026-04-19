/**
 * PreviewPane — Sandpack react-ts 즉시 미리보기 (content-only).
 *
 * store.fileMap 을 Sandpack files prop 으로 전달하여 코드가 변경될 때마다 iframe 이
 * 자동으로 재컴파일된다. 외곽 컨테이너는 CanvasPane 이 담당하므로 이 컴포넌트는
 * Sandpack 만 렌더한다. Tailwind Play CDN 을 `/public/index.html` 에 주입하여
 * Sandpack 샌드박스 안에서도 Tailwind 클래스가 동작하도록 한다.
 */

import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from "@codesandbox/sandpack-react";

import { useBuilderStore } from "../../store/builder";

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

export function PreviewPane() {
  const fileMap = useBuilderStore((s) => s.fileMap);

  const files: Record<string, string> = normalize(fileMap);
  if (!files["/App.tsx"]) {
    files["/App.tsx"] = DEFAULT_APP;
  }
  if (!files["/public/index.html"]) {
    files["/public/index.html"] = TAILWIND_INDEX_HTML;
  }

  return (
    <div className="h-full min-h-0 bg-surface-page p-3">
      <div className="ui-builder-sandpack h-full min-h-0 rounded-card border border-line overflow-hidden shadow-card bg-surface-card">
        <SandpackProvider
          template="react-ts"
          files={files}
          options={{ recompileMode: "delayed", recompileDelay: 400 }}
          customSetup={{
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              recharts: "^2.12.0",
              "lucide-react": "^0.460.0",
              clsx: "^2.1.0",
              "framer-motion": "^11.0.0",
              "date-fns": "^3.6.0",
            },
          }}
        >
          <SandpackLayout style={{ height: "100%", border: "none", borderRadius: 0 }}>
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton
              style={{ height: "100%", flex: 1 }}
            />
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
