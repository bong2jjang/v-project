import type { ReactNode } from "react";
import Layout from "../Layout";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

interface WorkspaceLayoutProps {
  children: ReactNode;
}

export function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  return (
    <Layout>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2 bg-surface-raised/95 backdrop-blur-sm border-b border-line">
        <WorkspaceSwitcher />
      </div>
      {children}
    </Layout>
  );
}
