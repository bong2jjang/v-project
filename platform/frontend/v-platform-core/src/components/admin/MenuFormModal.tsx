/**
 * MenuFormModal
 *
 * 커스텀 메뉴 등록/수정 모달
 * - custom_iframe: iframe URL 입력
 * - custom_link: 외부 링크 URL 입력
 * - menu_group: 메뉴 그룹 (컨테이너)
 * - built_in: label, sort_order, is_active만 수정 가능
 */

import { useState, useEffect } from "react";
import { Modal, ModalFooter } from "../ui/Modal";
import { IconPicker } from "./IconPicker";
import type { MenuItemResponse } from "../../api/types";

export interface MenuFormData {
  permission_key: string;
  label: string;
  icon: string;
  path: string;
  menu_type: "custom_iframe" | "custom_link" | "menu_group";
  iframe_url: string;
  iframe_fullscreen: boolean;
  open_in_new_tab: boolean;
  parent_key: string;
  sort_order: number;
  is_active: boolean;
}

interface MenuFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MenuFormData) => Promise<void>;
  /** null이면 생성 모드, 값이 있으면 수정 모드 */
  editMenu: MenuItemResponse | null;
  /** 그룹 선택용: 현재 섹션의 menu_group 목록 */
  availableGroups?: MenuItemResponse[];
  loading?: boolean;
  /** 생성 모드: "menu" = iframe/링크만, "group" = 메뉴 그룹 전용 */
  createMode?: "menu" | "group";
}

const INITIAL_FORM: MenuFormData = {
  permission_key: "",
  label: "",
  icon: "",
  path: "",
  menu_type: "custom_iframe",
  iframe_url: "",
  iframe_fullscreen: false,
  open_in_new_tab: false,
  parent_key: "",
  sort_order: 100,
  is_active: true,
};

export function MenuFormModal({
  isOpen,
  onClose,
  onSubmit,
  editMenu,
  availableGroups = [],
  loading = false,
  createMode = "menu",
}: MenuFormModalProps) {
  const [form, setForm] = useState<MenuFormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editMenu;
  const isBuiltIn = editMenu?.menu_type === "built_in";

  useEffect(() => {
    if (isOpen) {
      if (editMenu) {
        setForm({
          permission_key: editMenu.permission_key,
          label: editMenu.label,
          icon: editMenu.icon || "",
          path: editMenu.path,
          menu_type:
            editMenu.menu_type === "built_in"
              ? "custom_iframe"
              : (editMenu.menu_type as
                  | "custom_iframe"
                  | "custom_link"
                  | "menu_group"),
          iframe_url: editMenu.iframe_url || "",
          iframe_fullscreen: editMenu.iframe_fullscreen ?? false,
          open_in_new_tab: editMenu.open_in_new_tab,
          parent_key: editMenu.parent_key || "",
          sort_order: editMenu.sort_order,
          is_active: editMenu.is_active,
        });
      } else {
        setForm({
          ...INITIAL_FORM,
          menu_type: createMode === "group" ? "menu_group" : "custom_iframe",
        });
      }
      setError(null);
    }
  }, [isOpen, editMenu, createMode]);

  const handleSubmit = async () => {
    setError(null);

    if (!isBuiltIn) {
      if (!form.label.trim()) {
        setError("메뉴 이름을 입력하세요");
        return;
      }
      if (!form.permission_key.trim()) {
        setError("권한 키를 입력하세요");
        return;
      }
      if (form.menu_type !== "menu_group" && !form.path.trim()) {
        setError("경로를 입력하세요");
        return;
      }
      if (form.menu_type === "custom_iframe" && !form.iframe_url.trim()) {
        setError("iframe URL을 입력하세요");
        return;
      }
      if (form.iframe_url && form.iframe_url.startsWith("javascript:")) {
        setError("javascript: URL은 허용되지 않습니다");
        return;
      }
    }

    try {
      await onSubmit(form);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다";
      setError(msg);
    }
  };

  const updateField = <K extends keyof MenuFormData>(
    key: K,
    value: MenuFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // menu_type 변경 시 자동 path 생성 (menu_group)
  const handleMenuTypeChange = (
    type: "custom_iframe" | "custom_link" | "menu_group",
  ) => {
    updateField("menu_type", type);
    if (type === "menu_group") {
      updateField("iframe_url", "");
      updateField("open_in_new_tab", false);
      updateField("iframe_fullscreen", false);
      updateField("parent_key", "");
    }
  };

  const labelClass = "block text-sm font-medium text-content-primary mb-1";
  const inputClass =
    "w-full px-3 py-2 bg-surface-card border border-line rounded-lg text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const selectClass =
    "w-full px-3 py-2 bg-surface-card border border-line rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? isBuiltIn
            ? "메뉴 설정 수정"
            : editMenu?.menu_type === "menu_group"
              ? "메뉴 그룹 수정"
              : "커스텀 메뉴 수정"
          : createMode === "group"
            ? "메뉴 그룹 추가"
            : "커스텀 메뉴 추가"
      }
      size="md"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          confirmText={isEdit ? "수정" : "추가"}
          loading={loading}
        />
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-status-danger-light border border-status-danger-border rounded-lg text-sm text-status-danger">
            {error}
          </div>
        )}

        {/* 메뉴 이름 */}
        <div>
          <label className={labelClass}>메뉴 이름</label>
          <input
            type="text"
            className={inputClass}
            value={form.label}
            onChange={(e) => updateField("label", e.target.value)}
            placeholder="예: Grafana 대시보드"
          />
        </div>

        {/* built_in이 아닌 경우에만 표시 */}
        {!isBuiltIn && (
          <>
            {/* 메뉴 타입 — menu 모드에서만 표시 (group 모드는 menu_group 고정) */}
            {!isEdit && createMode === "menu" && (
              <div>
                <label className={labelClass}>메뉴 타입</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-content-primary cursor-pointer">
                    <input
                      type="radio"
                      name="menu_type"
                      checked={form.menu_type === "custom_iframe"}
                      onChange={() => handleMenuTypeChange("custom_iframe")}
                      className="accent-brand-600"
                    />
                    iframe (내장)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-content-primary cursor-pointer">
                    <input
                      type="radio"
                      name="menu_type"
                      checked={form.menu_type === "custom_link"}
                      onChange={() => handleMenuTypeChange("custom_link")}
                      className="accent-brand-600"
                    />
                    외부 링크
                  </label>
                </div>
              </div>
            )}

            {/* 권한 키 (생성 시에만) */}
            {!isEdit && (
              <div>
                <label className={labelClass}>권한 키</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.permission_key}
                  onChange={(e) =>
                    updateField(
                      "permission_key",
                      e.target.value.toLowerCase().replace(/[^a-z0-9_:]/g, "_"),
                    )
                  }
                  placeholder="예: custom_grafana"
                />
                <p className="mt-1 text-xs text-content-tertiary">
                  영문 소문자, 숫자, 밑줄만 사용 가능
                </p>
              </div>
            )}

            {/* 경로 (menu_group이 아닌 경우) */}
            {form.menu_type !== "menu_group" && (
              <div>
                <label className={labelClass}>경로</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.path}
                  onChange={(e) => updateField("path", e.target.value)}
                  placeholder={
                    form.menu_type === "custom_iframe"
                      ? "/custom/grafana"
                      : "https://external.example.com"
                  }
                />
              </div>
            )}

            {/* iframe URL (iframe 타입) */}
            {form.menu_type === "custom_iframe" && (
              <>
                <div>
                  <label className={labelClass}>iframe URL</label>
                  <input
                    type="url"
                    className={inputClass}
                    value={form.iframe_url}
                    onChange={(e) => updateField("iframe_url", e.target.value)}
                    placeholder="https://grafana.company.com/d/abc"
                  />
                  <p className="mt-1 text-xs text-content-tertiary">
                    iframe으로 표시할 외부 URL (https:// 권장)
                  </p>
                </div>

                {/* iframe 전체 화면 옵션 */}
                <div>
                  <label className={labelClass}>표시 방식</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-content-primary cursor-pointer">
                      <input
                        type="radio"
                        name="iframe_fullscreen"
                        checked={!form.iframe_fullscreen}
                        onChange={() => updateField("iframe_fullscreen", false)}
                        className="accent-brand-600"
                      />
                      기본 (헤더 + 여백)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-content-primary cursor-pointer">
                      <input
                        type="radio"
                        name="iframe_fullscreen"
                        checked={form.iframe_fullscreen}
                        onChange={() => updateField("iframe_fullscreen", true)}
                        className="accent-brand-600"
                      />
                      전체 화면
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-content-tertiary">
                    전체 화면: 헤더/여백 없이 iframe이 콘텐츠 영역을 꽉 채웁니다
                  </p>
                </div>
              </>
            )}

            {/* 외부 링크: 새 탭 열기 */}
            {form.menu_type === "custom_link" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="open_in_new_tab"
                  checked={form.open_in_new_tab}
                  onChange={(e) =>
                    updateField("open_in_new_tab", e.target.checked)
                  }
                  className="accent-brand-600"
                />
                <label
                  htmlFor="open_in_new_tab"
                  className="text-sm text-content-primary cursor-pointer"
                >
                  새 탭에서 열기
                </label>
              </div>
            )}

            {/* 소속 그룹 (menu_group 자체가 아닌 경우에만) */}
            {form.menu_type !== "menu_group" && availableGroups.length > 0 && (
              <div>
                <label className={labelClass}>소속 그룹</label>
                <select
                  className={selectClass}
                  value={form.parent_key}
                  onChange={(e) => updateField("parent_key", e.target.value)}
                >
                  <option value="">없음 (최상위)</option>
                  {availableGroups.map((g) => (
                    <option key={g.permission_key} value={g.permission_key}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-content-tertiary">
                  그룹에 포함하면 사이드바에서 그룹 하위로 표시됩니다
                </p>
              </div>
            )}

            {/* 아이콘 */}
            <div>
              <label className={labelClass}>아이콘 (선택)</label>
              <IconPicker
                value={form.icon}
                onChange={(v) => updateField("icon", v)}
              />
            </div>
          </>
        )}

        {/* 정렬 순서 */}
        <div>
          <label className={labelClass}>정렬 순서</label>
          <input
            type="number"
            className={inputClass}
            value={form.sort_order}
            onChange={(e) =>
              updateField("sort_order", parseInt(e.target.value) || 0)
            }
            min={0}
          />
          <p className="mt-1 text-xs text-content-tertiary">
            숫자가 작을수록 먼저 표시됩니다
          </p>
        </div>
      </div>
    </Modal>
  );
}
