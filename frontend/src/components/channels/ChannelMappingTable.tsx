/**
 * ChannelMappingTable 컴포넌트 (최종 버전 - 모바일 반응형)
 *
 * Gateway와 Channel Mapping을 표시
 * - 플랫폼 아이콘 추가
 * - 확장/축소 기능
 * - 모바일: 카드 형태, 데스크톱: 테이블 형태
 */

import { useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PlatformIcon } from "../ui/PlatformIcon";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/Table";
import type { GatewayConfig } from "../../lib/api/types";
import { useTour } from "../../hooks/useTour";
import { getPlatform } from "../../lib/utils/platform";

interface ChannelMappingTableProps {
  gateways: GatewayConfig[];
  onEdit: (gateway: GatewayConfig, index: number) => void;
  onDelete: (index: number) => void;
  onTest?: (gateway: GatewayConfig) => void;
}

export function ChannelMappingTable({
  gateways,
  onEdit,
  onDelete,
  onTest,
}: ChannelMappingTableProps) {
  const { startPageTour } = useTour();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    new Set(gateways.map((_, index) => index)), // 기본적으로 모두 확장
  );

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (gateways.length === 0) {
    return (
      <div className="py-4 px-card-x">
        <EmptyState
          icon={
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          }
          title="Gateway가 없습니다"
          description="새 Gateway를 추가하여 채널 간 메시지 동기화를 시작하세요."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startPageTour("channels")}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              }
            >
              사용 방법 보기
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="block lg:hidden">
        <div className="space-y-4 p-4">
          {gateways.map((gateway, index) => (
            <div
              key={index}
              className="bg-surface-card rounded-card p-4 border border-line shadow-card"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-brand-600/10 rounded-card">
                    <svg
                      className="h-5 w-5 text-brand-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-heading-md font-semibold text-content-primary">
                      {gateway.name}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {gateway.is_valid === false && (
                    <Badge
                      variant="warning"
                      title={
                        gateway.validation_errors
                          ? `유효하지 않은 Gateway (Matterbridge 설정에 미포함)\n\n유효성 검증 오류:\n${JSON.parse(
                              gateway.validation_errors,
                            )
                              .map(
                                (e: { field: string; message: string }) =>
                                  `• ${e.field}: ${e.message}`,
                              )
                              .join("\n")}`
                          : "유효하지 않은 Gateway는 Matterbridge 설정에 포함되지 않습니다"
                      }
                    >
                      Invalid
                    </Badge>
                  )}
                  <Badge
                    variant={gateway.enable !== false ? "success" : "default"}
                    dot
                  >
                    {gateway.enable !== false ? "활성" : "비활성"}
                  </Badge>
                </div>
              </div>

              {/* Channels */}
              <div className="space-y-2 mb-4">
                <div className="text-body-sm text-content-secondary mb-1">
                  연결된 채널 ({gateway.inout.length}개)
                </div>
                {gateway.inout.map((channel, idx) => {
                  const platform = getPlatform(channel.account);
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-surface-raised rounded-card"
                    >
                      <PlatformIcon platform={platform} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-body-sm text-content-secondary truncate">
                          {channel.account}
                        </div>
                        <div className="text-body-sm text-content-primary truncate">
                          {channel.channel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {onTest && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onTest(gateway)}
                    disabled={!gateway.enable}
                    title={
                      !gateway.enable
                        ? "Gateway가 비활성 상태입니다. 활성화 후 테스트하세요."
                        : "테스트 메시지 전송"
                    }
                    className="flex-1 touch-target"
                    icon={
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    }
                  >
                    Test
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit(gateway, index)}
                  className="flex-1 touch-target"
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(index)}
                  className="flex-1 touch-target"
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop View - Table */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gateway</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>매핑</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gateways.map((gateway, index) => {
              const isExpanded = expandedRows.has(index);

              return (
                <TableRow key={index}>
                  {/* Gateway Name with Expand/Collapse */}
                  <TableCell>
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleRow(index)}
                        className="flex-shrink-0 p-1 hover:bg-surface-raised rounded transition-colors mr-2 focus-visible"
                        aria-label={isExpanded ? "접기" : "펼치기"}
                        aria-expanded={isExpanded}
                      >
                        <svg
                          className={`w-4 h-4 text-content-tertiary transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>

                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-brand-600/10 rounded-card">
                        <svg
                          className="h-6 w-6 text-brand-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </div>

                      <div className="ml-4 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-body-base font-medium text-content-primary">
                            {gateway.name}
                          </div>
                          {gateway.is_valid === false && (
                            <Badge
                              variant="warning"
                              title={
                                gateway.validation_errors
                                  ? `유효하지 않은 Gateway (Matterbridge 설정에 미포함)\n\n유효성 검증 오류:\n${JSON.parse(
                                      gateway.validation_errors,
                                    )
                                      .map(
                                        (e: {
                                          field: string;
                                          message: string;
                                        }) => `• ${e.field}: ${e.message}`,
                                      )
                                      .join("\n")}`
                                  : "유효하지 않은 Gateway는 Matterbridge 설정에 포함되지 않습니다"
                              }
                            >
                              Invalid
                            </Badge>
                          )}
                        </div>
                        {!isExpanded && (
                          <div className="text-body-sm text-content-secondary mt-0.5">
                            {gateway.inout.length}개 채널
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Channel Details */}
                    {isExpanded && (
                      <div
                        className="ml-16 mt-3 space-y-2"
                        role="region"
                        aria-label="채널 목록"
                      >
                        {gateway.inout.map((channel, idx) => {
                          const platform = getPlatform(channel.account);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-body-sm py-1.5 px-3 bg-surface-raised rounded-card"
                            >
                              <PlatformIcon platform={platform} size="sm" />
                              <span className="font-mono text-content-secondary">
                                {channel.account}
                              </span>
                              <svg
                                className="w-3 h-3 text-content-tertiary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              <span className="text-content-primary">
                                {channel.channel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={gateway.enable !== false ? "success" : "default"}
                      dot
                    >
                      {gateway.enable !== false ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>

                  {/* Mappings Count */}
                  <TableCell>
                    <Badge variant="info">{gateway.inout.length}개 채널</Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onTest && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onTest(gateway)}
                          className="focus-visible"
                          icon={
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                          }
                          aria-label={`${gateway.name} 테스트`}
                        >
                          Test
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onEdit(gateway, index)}
                        className="focus-visible"
                        icon={
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        }
                        aria-label={`${gateway.name} 편집`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDelete(index)}
                        className="focus-visible"
                        icon={
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        }
                        aria-label={`${gateway.name} 삭제`}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
