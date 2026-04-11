/**
 * CustomIframe 페이지
 *
 * 커스텀 iframe 메뉴를 렌더링하는 동적 페이지
 * 라우트: /custom/:menuId
 */

import { useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import { usePermissionStore } from "../stores/permission";
import { ContentHeader } from "../components/Layout";
import { Spinner } from "../components/ui/Spinner";

export default function CustomIframe() {
  const { menuId } = useParams<{ menuId: string }>();
  const { menus, isLoaded } = usePermissionStore();

  const menu = useMemo(() => {
    if (!menuId) return null;
    // menuId를 숫자 또는 path segment로 매칭
    return menus.find(
      (m) => m.id === Number(menuId) || m.path === `/custom/${menuId}`,
    );
  }, [menuId, menus]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!menu || menu.menu_type !== "custom_iframe" || !menu.iframe_url) {
    return <Navigate to="/" replace />;
  }

  if (menu.iframe_fullscreen) {
    return (
      <iframe
        src={menu.iframe_url}
        className="w-full border-0"
        style={{ height: "calc(100vh - 64px)" }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        title={menu.label}
        loading="lazy"
      />
    );
  }

  return (
    <>
      <ContentHeader title={menu.label} description="커스텀 외부 시스템" />

      <div className="page-container">
        <iframe
          src={menu.iframe_url}
          className="w-full border-0 rounded-lg bg-surface-card"
          style={{ height: "calc(100vh - 180px)" }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          title={menu.label}
          loading="lazy"
        />
      </div>
    </>
  );
}
