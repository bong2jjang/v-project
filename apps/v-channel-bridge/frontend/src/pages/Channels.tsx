/**
 * Channels 페이지
 *
 * 양방향 메시지 라우팅 관리
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RouteList } from "../components/channels/RouteList";
import { RouteModal } from "../components/channels/RouteModal";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Alert } from "../components/ui/Alert";
import { ContentHeader } from "../components/Layout";
import { useAuthStore } from "@/store/auth";
import { usePermissionStore } from "@/store/permission";
import type { RouteResponse } from "@/lib/api/routes";

const Channels = () => {
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteResponse | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const isAdmin = useAuthStore().isAdmin();
  const canEdit = usePermissionStore().canWrite("channels");

  return (
    <>
      <ContentHeader
        title="채널 관리"
        description="Slack ↔ Teams 양방향 메시지 라우팅 설정"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate("/integrations#providers")}
                className="flex items-center gap-2 px-4 py-2 border border-white/30 text-white rounded-button hover:bg-white/10 transition-colors duration-normal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Provider 설정</span>
              </button>
            )}
            <button
              type="button"
              data-tour="add-route-btn"
              onClick={() => setIsRouteModalOpen(true)}
              disabled={!canEdit}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-button hover:bg-white/90 dark:bg-brand-600 dark:text-content-inverse dark:hover:bg-brand-700 transition-colors duration-normal disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span className="hidden sm:inline">Route 추가</span>
            </button>
          </div>
        }
      />

      <div
        className="page-container space-y-section-gap"
        data-tour="routes-page"
      >
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6">
            <Alert variant="success" onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          </div>
        )}

        {/* Routes Card */}
        <Card data-tour="route-list">
          <CardHeader>
            <CardTitle>메시지 Routes</CardTitle>
          </CardHeader>
          <CardBody>
            <RouteList
              onRefresh={() => {}}
              onEdit={(route) => {
                setEditingRoute(route);
                setIsRouteModalOpen(true);
              }}
              readOnly={!canEdit}
            />
          </CardBody>
        </Card>

        {/* Info Section */}
        <div className="bg-status-info-light border border-status-info-border rounded-lg p-4">
          <div className="flex gap-3">
            <svg
              className="w-6 h-6 text-status-info flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-content-primary mb-2">
                Route 안내
              </h3>
              <div className="text-sm text-content-primary space-y-1">
                <p>
                  <strong>Route</strong>는 서로 다른 플랫폼(Slack, Teams 등) 간
                  양방향 메시지 동기화를 설정합니다.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                  <li>각 Route는 자동으로 양방향으로 동작합니다</li>
                  <li>무한 루프는 시스템에서 자동으로 방지됩니다</li>
                  <li>실시간으로 메시지가 동기화됩니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Route Modal */}
      <RouteModal
        isOpen={isRouteModalOpen}
        onClose={() => {
          setIsRouteModalOpen(false);
          setEditingRoute(null);
        }}
        onSuccess={() => {
          setSuccessMessage(
            editingRoute
              ? "Route가 수정되었습니다."
              : "Route가 추가되었습니다.",
          );
          setTimeout(() => setSuccessMessage(null), 3000);
          setEditingRoute(null);
        }}
        editRoute={editingRoute}
        readOnly={!canEdit}
      />
    </>
  );
};

export default Channels;
