/**
 * PreviewPane — Sandpack react-ts 즉시 미리보기.
 *
 * store.fileMap 을 Sandpack files prop 으로 전달하여 코드가 변경될 때마다 iframe 이
 * 자동으로 재컴파일된다. 기본 엔트리 파일이 없으면 스텁을 주입한다.
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

export function PreviewPane() {
  const fileMap = useBuilderStore((s) => s.fileMap);

  const files: Record<string, string> = { ...fileMap };
  if (!files["/src/App.tsx"] && !files["/App.tsx"]) {
    files["/src/App.tsx"] = DEFAULT_APP;
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b">
        <h2 className="text-sm font-semibold">Preview</h2>
      </div>
      <div className="flex-1 min-h-0">
        <SandpackProvider
          template="react-ts"
          files={files}
          options={{ recompileMode: "delayed", recompileDelay: 400 }}
          customSetup={{
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
          }}
        >
          <SandpackLayout style={{ height: "100%", border: "none" }}>
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton
              style={{ height: "100%" }}
            />
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
