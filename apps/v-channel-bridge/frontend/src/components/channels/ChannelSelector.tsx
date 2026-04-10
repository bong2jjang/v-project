/**
 * ChannelSelector - 채널 선택 드롭다운
 *
 * Provider의 채널 목록을 불러와서 선택할 수 있는 컴포넌트
 */

import { useEffect, useMemo, useState } from "react";
import { useRoutesStore } from "@/store/routes";
import type { ChannelInfo } from "@/lib/api/routes";

interface ChannelSelectorProps {
  platform: string;
  value: string; // channel_id
  onChange: (channelId: string, channelName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** 타입별 표시 레이블 */
const TYPE_LABELS: Record<string, string> = {
  channel: "채널",
  dm: "다이렉트 메시지",
  group_dm: "그룹 채팅",
};

/** 타입별 정렬 순서 */
const TYPE_ORDER: Record<string, number> = {
  channel: 0,
  dm: 1,
  group_dm: 2,
};

export function ChannelSelector({
  platform,
  value,
  onChange,
  disabled = false,
  placeholder = "채널 선택",
}: ChannelSelectorProps) {
  const { fetchChannels, isLoadingChannels, error, clearError } =
    useRoutesStore();
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 플랫폼이 변경되면 채널 목록 로드
  useEffect(() => {
    if (!platform) {
      setChannels([]);
      return;
    }

    const loadChannels = async () => {
      try {
        setLoadError(null);
        const result = await fetchChannels(platform);
        setChannels(result);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "채널 목록을 불러올 수 없습니다",
        );
        setChannels([]);
      }
    };

    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  // 에러가 있을 때 표시
  useEffect(() => {
    if (error) {
      setLoadError(error);
      const timer = setTimeout(() => {
        clearError();
        setLoadError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // 타입별로 그룹화 (channel → dm → group_dm 순)
  const groupedChannels = useMemo(() => {
    const groups: Record<string, ChannelInfo[]> = {};
    for (const ch of channels) {
      const type = ch.type || "channel";
      if (!groups[type]) groups[type] = [];
      groups[type].push(ch);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99),
    );
  }, [channels]);

  return (
    <div className="w-full">
      <select
        value={value}
        onChange={(e) => {
          const selectedId = e.target.value;
          const selectedChannel = channels.find((ch) => ch.id === selectedId);
          onChange(selectedId, selectedChannel?.name || selectedId);
        }}
        disabled={disabled || isLoadingChannels || !platform}
        className="w-full px-3 py-2 border border-border-subtle rounded-button bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">
          {isLoadingChannels
            ? "로딩 중..."
            : loadError
              ? "에러 발생"
              : placeholder}
        </option>
        {groupedChannels.map(([type, items]) => (
          <optgroup key={type} label={TYPE_LABELS[type] ?? type}>
            {items.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {type === "dm"
                  ? `💬 ${channel.name}`
                  : type === "group_dm"
                    ? `👥 ${channel.name}`
                    : `# ${channel.name}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {loadError && platform && (
        <div className="mt-2 text-sm text-status-danger">{loadError}</div>
      )}

      {!loadError &&
        platform &&
        channels.length === 0 &&
        !isLoadingChannels && (
          <div className="mt-2 text-sm text-content-tertiary">
            사용 가능한 채널이 없습니다. Provider가 연결되어 있는지 확인하세요.
          </div>
        )}
    </div>
  );
}
