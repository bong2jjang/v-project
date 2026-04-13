/**
 * ChannelInputField - 채널 ID 입력/선택 하이브리드 컴포넌트
 *
 * 1. 드롭다운으로 채널 선택
 * 2. 직접 입력으로 채널 ID 입력 + 유효성 검증
 */

import { useEffect, useState } from "react";
import { Search, Check, AlertCircle } from "lucide-react";
import { useRoutesStore } from "@/store/routes";
import { bridgeApi } from "@/lib/api/bridge";
import type { ChannelInfo } from "@/lib/api/routes";

interface ChannelInputFieldProps {
  platform: string;
  value: string; // channel_id
  channelName?: string; // 검증된 채널 이름
  onChange: (channelId: string, channelName?: string) => void;
  disabled?: boolean;
  label?: string;
}

export function ChannelInputField({
  platform,
  value,
  channelName: externalChannelName,
  onChange,
  disabled = false,
  label = "채널",
}: ChannelInputFieldProps) {
  const { fetchChannels } = useRoutesStore();

  // 입력 모드: 'select' (드롭다운) 또는 'manual' (직접 입력)
  const [inputMode, setInputMode] = useState<"select" | "manual">("select");

  // 채널 목록
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // 검색 및 정렬
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "id">("name");

  // 수동 입력 상태
  const [manualInput, setManualInput] = useState(value);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    name?: string;
    error?: string;
  } | null>(null);

  // 플랫폼 변경 시 채널 목록 로드
  useEffect(() => {
    if (!platform) {
      setChannels([]);
      return;
    }

    const loadChannels = async () => {
      try {
        setLoadingChannels(true);
        const result = await fetchChannels(platform);
        setChannels(result);
      } catch (err) {
        console.error("Failed to fetch channels:", err);
        setChannels([]);
      } finally {
        setLoadingChannels(false);
      }
    };

    loadChannels();
  }, [platform, fetchChannels]);

  // value가 외부에서 변경되면 manualInput 동기화
  useEffect(() => {
    setManualInput(value);
  }, [value]);

  // 채널 목록 필터링 및 정렬
  const filteredAndSortedChannels = channels
    .filter((channel) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        channel.name.toLowerCase().includes(query) ||
        channel.id.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return a.id.localeCompare(b.id);
      }
    });

  // 타입별 그룹핑
  const channelGroups = {
    channel: filteredAndSortedChannels.filter((ch) => ch.type === "channel"),
    dm: filteredAndSortedChannels.filter((ch) => ch.type === "dm"),
    group_dm: filteredAndSortedChannels.filter((ch) => ch.type === "group_dm"),
  };

  const groupLabels: Record<string, string> = {
    channel: "채널",
    dm: "다이렉트 메시지",
    group_dm: "그룹 채팅",
  };

  // 채널 ID 유효성 검증
  const validateChannelId = async () => {
    if (!manualInput || !platform) return;

    try {
      setValidating(true);
      setValidationResult(null);

      const result = await bridgeApi.validateChannel(platform, manualInput);

      if (result.valid && result.channel) {
        setValidationResult({
          valid: true,
          name: result.channel.name,
        });
        onChange(manualInput, result.channel.name);
      } else {
        setValidationResult({
          valid: false,
          error: result.error || "채널을 찾을 수 없습니다",
        });
        // 유효하지 않아도 입력값은 전달 (경고만 표시)
        onChange(manualInput, undefined);
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        error: "유효성 검사 실패",
      });
      // 오류 발생해도 입력값은 전달
      onChange(manualInput, undefined);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* 라벨 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="block text-sm font-medium text-content-secondary">
          {label}
        </label>
        {/* 모드 전환 토글 */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setInputMode("select")}
            className={`px-3 py-1.5 rounded-button transition-colors font-medium ${
              inputMode === "select"
                ? "bg-brand-600 text-white"
                : "bg-surface-hover text-content-primary hover:bg-surface-elevated border border-border-subtle"
            }`}
            disabled={disabled}
          >
            목록 선택
          </button>
          <button
            type="button"
            onClick={() => setInputMode("manual")}
            className={`px-3 py-1.5 rounded-button transition-colors font-medium ${
              inputMode === "manual"
                ? "bg-brand-600 text-white"
                : "bg-surface-hover text-content-primary hover:bg-surface-elevated border border-border-subtle"
            }`}
            disabled={disabled}
          >
            직접 입력
          </button>
        </div>
      </div>

      {/* 드롭다운 모드 */}
      {inputMode === "select" && (
        <div className="space-y-2">
          {/* 검색 및 정렬 컨트롤 */}
          {!loadingChannels && platform && channels.length > 0 && (
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="채널 검색..."
                className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-border-subtle rounded-button bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "id")}
                className="flex-shrink-0 px-3 py-1.5 text-sm border border-border-subtle rounded-button bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="name">이름순</option>
                <option value="id">ID순</option>
              </select>
            </div>
          )}

          {/* 채널 선택 드롭다운 */}
          <select
            value={value}
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedChannel = channels.find(
                (ch) => ch.id === selectedId,
              );
              onChange(selectedId, selectedChannel?.name || selectedId);
              setValidationResult(null);
            }}
            disabled={disabled || loadingChannels || !platform}
            className="w-full px-3 py-2 border border-border-subtle rounded-button bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {loadingChannels
                ? "로딩 중..."
                : !platform
                  ? "플랫폼을 먼저 선택하세요"
                  : channels.length === 0
                    ? "채널 없음"
                    : searchQuery && filteredAndSortedChannels.length === 0
                      ? "검색 결과 없음"
                      : `채널/채팅 선택 (${filteredAndSortedChannels.length}개)`}
            </option>
            {(
              Object.keys(channelGroups) as Array<keyof typeof channelGroups>
            ).map((groupKey) => {
              const items = channelGroups[groupKey];
              if (items.length === 0) return null;
              return (
                <optgroup key={groupKey} label={groupLabels[groupKey]}>
                  {items.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.id})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      )}

      {/* 직접 입력 모드 */}
      {inputMode === "manual" && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value);
                setValidationResult(null);
              }}
              onBlur={() => {
                // 입력 완료 시 값 전달 (검증 없이)
                if (manualInput !== value) {
                  onChange(manualInput, undefined);
                }
              }}
              placeholder="채널 ID 입력 (예: C01234567)"
              disabled={disabled || !platform}
              className="flex-1 min-w-0 px-3 py-2 border border-border-subtle rounded-button bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={validateChannelId}
              disabled={disabled || !platform || !manualInput || validating}
              className="flex-shrink-0 px-3 py-2 bg-brand-600 text-white rounded-button hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              title="채널 유효성 검사"
            >
              {validating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  검증 중
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  검증
                </>
              )}
            </button>
          </div>

          {/* 유효성 검사 결과 */}
          {validationResult && (
            <div
              className={`flex items-start gap-2 p-2 rounded text-xs ${
                validationResult.valid
                  ? "bg-status-success/10 border border-status-success/20 text-status-success"
                  : "bg-status-warning/10 border border-status-warning/20 text-status-warning"
              }`}
            >
              {validationResult.valid ? (
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div>
                {validationResult.valid ? (
                  <div>
                    <strong>유효한 채널:</strong> {validationResult.name}
                  </div>
                ) : (
                  <div>
                    <strong>경고:</strong> {validationResult.error}
                    <div className="mt-1 text-content-tertiary">
                      유효하지 않아도 Route 추가는 가능합니다.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 검증된 채널 이름 표시 (외부에서 제공된 경우) */}
          {!validationResult && externalChannelName && (
            <div className="flex items-center gap-2 text-xs text-content-tertiary">
              <Check className="w-3 h-3" />
              {externalChannelName}
            </div>
          )}
        </div>
      )}

      {/* 채널 목록이 비어있을 때 안내 */}
      {inputMode === "select" &&
        !loadingChannels &&
        platform &&
        channels.length === 0 && (
          <div className="text-sm text-content-tertiary">
            사용 가능한 채널이 없습니다. "직접 입력" 모드를 사용하거나 Provider
            연결 상태를 확인하세요.
          </div>
        )}
    </div>
  );
}
