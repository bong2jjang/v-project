/**
 * DeleteMessagesModal Component
 *
 * 메시지 삭제 모달 (전체 삭제 또는 조건부 삭제)
 */

import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import {
  deleteAllMessages,
  deleteMessagesByFilters,
  countMessagesByFilters,
  getFilterOptions,
  type FilterOptions,
} from "../../lib/api/messages";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedCount: number) => void;
  currentFilters?: {
    gateway?: string;
    channel?: string;
    user?: string;
    from_date?: string;
    to_date?: string;
  };
}

type DeleteMode = "all" | "filters" | "current_filters";

export const DeleteMessagesModal = ({
  isOpen,
  onClose,
  onSuccess,
  currentFilters,
}: DeleteMessagesModalProps) => {
  const [mode, setMode] = useState<DeleteMode>("filters");
  const [isLoading, setIsLoading] = useState(false);
  const [isCountingLoading, setIsCountingLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 필터 옵션
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(
    null,
  );

  // 사용자 선택 필터
  const [selectedGateways, setSelectedGateways] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // 필터 옵션 로드
  useEffect(() => {
    if (isOpen) {
      loadFilterOptions();
    }
  }, [isOpen]);

  // 현재 필터 모드일 때 미리보기 자동 로드
  useEffect(() => {
    if (isOpen && mode === "current_filters" && currentFilters) {
      loadPreviewCount();
    }
  }, [isOpen, mode, currentFilters]);

  // 조건 변경 시 미리보기 초기화
  useEffect(() => {
    setPreviewCount(null);
  }, [
    mode,
    selectedGateways,
    selectedChannels,
    selectedUser,
    fromDate,
    toDate,
  ]);

  const loadFilterOptions = async () => {
    try {
      const options = await getFilterOptions();
      setFilterOptions(options);
    } catch (err) {
      console.error("Failed to load filter options:", err);
    }
  };

  const loadPreviewCount = async () => {
    setIsCountingLoading(true);
    setError(null);

    try {
      const params: any = {};

      if (mode === "current_filters" && currentFilters) {
        // 현재 필터 사용
        if (currentFilters.gateway) {
          params.gateway = [currentFilters.gateway];
        }
        if (currentFilters.channel) {
          params.channel = [currentFilters.channel];
        }
        if (currentFilters.user) {
          params.user = currentFilters.user;
        }
        if (currentFilters.from_date) {
          params.from_date = currentFilters.from_date;
        }
        if (currentFilters.to_date) {
          params.to_date = currentFilters.to_date;
        }
      } else if (mode === "filters") {
        // 사용자 선택 필터
        if (selectedGateways.length > 0) {
          params.gateway = selectedGateways;
        }
        if (selectedChannels.length > 0) {
          params.channel = selectedChannels;
        }
        if (selectedUser) {
          params.user = selectedUser;
        }
        if (fromDate) {
          params.from_date = fromDate;
        }
        if (toDate) {
          params.to_date = toDate;
        }
      }

      const result = await countMessagesByFilters(params);
      setPreviewCount(result.count);
    } catch (err: any) {
      setError(err.message || "미리보기 로드 실패");
    } finally {
      setIsCountingLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      mode === "all" &&
      !window.confirm(
        "정말로 모든 메시지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!",
      )
    ) {
      return;
    }

    if (
      (mode === "filters" || mode === "current_filters") &&
      previewCount !== null &&
      !window.confirm(
        `${previewCount}개의 메시지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result;

      if (mode === "all") {
        result = await deleteAllMessages();
      } else {
        const params: any = {};

        if (mode === "current_filters" && currentFilters) {
          if (currentFilters.gateway) params.gateway = [currentFilters.gateway];
          if (currentFilters.channel) params.channel = [currentFilters.channel];
          if (currentFilters.user) params.user = currentFilters.user;
          if (currentFilters.from_date)
            params.from_date = currentFilters.from_date;
          if (currentFilters.to_date) params.to_date = currentFilters.to_date;
        } else {
          if (selectedGateways.length > 0) params.gateway = selectedGateways;
          if (selectedChannels.length > 0) params.channel = selectedChannels;
          if (selectedUser) params.user = selectedUser;
          if (fromDate) params.from_date = fromDate;
          if (toDate) params.to_date = toDate;
        }

        result = await deleteMessagesByFilters(params);
      }

      onSuccess(result.deleted_count);
      onClose();
    } catch (err: any) {
      setError(err.message || "삭제 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const hasCurrentFilters =
    currentFilters &&
    (currentFilters.gateway ||
      currentFilters.channel ||
      currentFilters.user ||
      currentFilters.from_date ||
      currentFilters.to_date);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="메시지 삭제" size="lg">
      <div className="space-y-6">
        {/* 삭제 모드 선택 */}
        <div>
          <label className="block text-body-sm font-semibold text-content-primary mb-3">
            삭제 방법 선택
          </label>
          <div className="space-y-2">
            {hasCurrentFilters && (
              <button
                type="button"
                onClick={() => setMode("current_filters")}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  mode === "current_filters"
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-border bg-surface-card hover:border-brand-primary/30"
                }`}
              >
                <div className="font-medium text-content-primary">
                  현재 필터 조건으로 삭제
                </div>
                <div className="text-body-sm text-content-secondary mt-1">
                  현재 페이지에서 적용 중인 필터로 삭제합니다
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode("filters")}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                mode === "filters"
                  ? "border-brand-primary bg-brand-primary/5"
                  : "border-border bg-surface-card hover:border-brand-primary/30"
              }`}
            >
              <div className="font-medium text-content-primary">
                조건 선택하여 삭제
              </div>
              <div className="text-body-sm text-content-secondary mt-1">
                Gateway, 채널, 날짜 등을 선택하여 삭제합니다
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("all")}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                mode === "all"
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                  : "border-border bg-surface-card hover:border-red-500/30"
              }`}
            >
              <div className="font-medium text-red-600 dark:text-red-400">
                전체 삭제
              </div>
              <div className="text-body-sm text-content-secondary mt-1">
                모든 메시지를 삭제합니다 (되돌릴 수 없음)
              </div>
            </button>
          </div>
        </div>

        {/* 조건 선택 (filters 모드) */}
        {mode === "filters" && (
          <div className="space-y-4 p-4 bg-surface-secondary rounded-lg">
            <h4 className="text-body font-semibold text-content-primary">
              삭제 조건 선택
            </h4>

            {/* Gateway 선택 */}
            <div>
              <label className="block text-body-sm font-medium text-content-primary mb-2">
                Gateway
              </label>
              <select
                multiple
                value={selectedGateways}
                onChange={(e) =>
                  setSelectedGateways(
                    Array.from(e.target.selectedOptions, (opt) => opt.value),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                size={3}
              >
                {filterOptions?.gateways.map((gw) => (
                  <option key={gw} value={gw}>
                    {gw}
                  </option>
                ))}
              </select>
              <p className="text-caption text-content-tertiary mt-1">
                Ctrl/Cmd 클릭으로 여러 개 선택 가능
              </p>
            </div>

            {/* 채널 선택 */}
            <div>
              <label className="block text-body-sm font-medium text-content-primary mb-2">
                채널
              </label>
              <select
                multiple
                value={selectedChannels}
                onChange={(e) =>
                  setSelectedChannels(
                    Array.from(e.target.selectedOptions, (opt) => opt.value),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                size={3}
              >
                {filterOptions?.channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
              <p className="text-caption text-content-tertiary mt-1">
                Ctrl/Cmd 클릭으로 여러 개 선택 가능
              </p>
            </div>

            {/* 사용자 선택 */}
            <div>
              <label className="block text-body-sm font-medium text-content-primary mb-2">
                사용자
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">전체</option>
                {filterOptions?.users.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </div>

            {/* 날짜 범위 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-content-primary mb-2">
                  시작 날짜
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-content-primary mb-2">
                  종료 날짜
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>

            {/* 미리보기 버튼 */}
            <Button
              onClick={loadPreviewCount}
              disabled={isCountingLoading}
              variant="secondary"
              className="w-full"
            >
              {isCountingLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  확인 중...
                </>
              ) : (
                "삭제될 메시지 수 확인"
              )}
            </Button>
          </div>
        )}

        {/* 현재 필터 표시 (current_filters 모드) */}
        {mode === "current_filters" && currentFilters && (
          <div className="p-4 bg-surface-secondary rounded-lg">
            <h4 className="text-body font-semibold text-content-primary mb-3">
              적용 중인 필터
            </h4>
            <div className="space-y-2 text-body-sm">
              {currentFilters.gateway && (
                <div>
                  <span className="text-content-secondary">Gateway:</span>{" "}
                  <span className="text-content-primary font-medium">
                    {currentFilters.gateway}
                  </span>
                </div>
              )}
              {currentFilters.channel && (
                <div>
                  <span className="text-content-secondary">채널:</span>{" "}
                  <span className="text-content-primary font-medium">
                    {currentFilters.channel}
                  </span>
                </div>
              )}
              {currentFilters.user && (
                <div>
                  <span className="text-content-secondary">사용자:</span>{" "}
                  <span className="text-content-primary font-medium">
                    {currentFilters.user}
                  </span>
                </div>
              )}
              {currentFilters.from_date && (
                <div>
                  <span className="text-content-secondary">시작 날짜:</span>{" "}
                  <span className="text-content-primary font-medium">
                    {currentFilters.from_date}
                  </span>
                </div>
              )}
              {currentFilters.to_date && (
                <div>
                  <span className="text-content-secondary">종료 날짜:</span>{" "}
                  <span className="text-content-primary font-medium">
                    {currentFilters.to_date}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 미리보기 결과 */}
        {previewCount !== null && mode !== "all" && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-body font-semibold text-yellow-800 dark:text-yellow-300">
                  {previewCount}개의 메시지가 삭제됩니다
                </p>
                <p className="text-body-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  이 작업은 되돌릴 수 없습니다. 신중하게 확인해주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-body-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={
              isLoading ||
              (mode !== "all" && previewCount === null) ||
              (mode !== "all" && previewCount === 0)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                삭제 중...
              </>
            ) : (
              "삭제"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
