/**
 * Profile 페이지
 *
 * 사용자 프로필 정보 조회 및 수정
 * - 기본 정보 (username)
 * - 비밀번호 변경
 * - 세션 관리
 */

import { useState, useEffect, useMemo } from "react";
import { ContentHeader } from "../components/Layout";
import { useAuthStore } from "../stores/auth";
import { usePermissionStore } from "../stores/permission";
import { useSystemSettingsStore } from "../stores/systemSettings";
import { resolveStartPage } from "../lib/resolveStartPage";
import { getMe, updateMe } from "../api/users";
import { useNotificationStore } from "../stores/notification";
import { SessionDeviceList } from "../components/profile/SessionDeviceList";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/Tabs";
import { Card, CardBody } from "../components/ui/Card";
import type { User } from "../api/types";
import { getRoleDisplayName } from "../api/types";

export default function Profile() {
  const { setUser } = useAuthStore();
  const { menus, isLoaded: permissionsLoaded } = usePermissionStore();
  const { settings: systemSettings } = useSystemSettingsStore();
  const { addNotification } = useNotificationStore();

  const [profile, setProfile] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [startPage, setStartPage] = useState("/");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  // 시스템 기본 시작 페이지 라벨 계산
  const systemDefaultLabel = useMemo(() => {
    const sysPage = systemSettings?.default_start_page || "/";
    if (sysPage === "/") return "대시보드";
    const found = menus.find(
      (m) => m.path === sysPage && m.menu_type !== "menu_group",
    );
    return found?.label || sysPage;
  }, [systemSettings, menus]);

  // 사용자 접근 가능한 페이지 옵션 (menu_group 제외, 실제 페이지만)
  const pageOptions = useMemo(() => {
    const options: { path: string; label: string }[] = [
      { path: "/", label: "대시보드" },
    ];
    if (!permissionsLoaded) return options;

    for (const menu of menus) {
      if (menu.menu_type === "menu_group") continue;
      if (menu.path && menu.path !== "/" && !menu.path.startsWith("http")) {
        options.push({ path: menu.path, label: menu.label });
      }
    }
    return options;
  }, [menus, permissionsLoaded]);

  // 프로필 정보 로드
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await getMe();
      setProfile(data);
      setUsername(data.username);
      setStartPage(data.start_page ?? "");
    } catch (error) {
      console.error("Failed to load profile:", error);
      addNotification({
        id: `profile-load-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "프로필 로드 실패",
        message: "프로필 정보를 불러오는데 실패했습니다.",
        source: "profile_page",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // 변경사항이 없으면 저장하지 않음
    const hasChanges = username !== profile.username;
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      const payload: { username?: string } = {};
      if (username !== profile.username) payload.username = username;
      const updatedUser = await updateMe(payload);
      setProfile(updatedUser);
      setUser(updatedUser); // Zustand 스토어 업데이트
      setIsEditing(false);

      addNotification({
        id: `profile-update-success-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "프로필 업데이트 성공",
        message: "프로필 정보가 성공적으로 업데이트되었습니다.",
        source: "profile_page",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
      addNotification({
        id: `profile-update-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "프로필 업데이트 실패",
        message: "프로필 정보 업데이트에 실패했습니다.",
        source: "profile_page",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setUsername(profile.username);
    }
    setIsEditing(false);
  };

  // 시작 페이지 저장 (별도 탭)
  const handleStartPageSave = async () => {
    if (!profile) return;

    // 변경사항 확인
    if (startPage === (profile.start_page ?? "")) return;

    try {
      setIsSaving(true);
      const updatedUser = await updateMe({ start_page: startPage });
      setProfile(updatedUser);
      setUser(updatedUser);

      addNotification({
        id: `startpage-update-success-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "시작 페이지 변경 완료",
        message: "시작 페이지가 성공적으로 변경되었습니다.",
        source: "profile_page",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } catch (error) {
      console.error("Failed to update start page:", error);
      addNotification({
        id: `startpage-update-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "시작 페이지 변경 실패",
        message: "시작 페이지 변경에 실패했습니다.",
        source: "profile_page",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 시작 페이지 변경 여부
  const isStartPageDirty = profile
    ? startPage !== (profile.start_page ?? "")
    : false;

  if (isLoading) {
    return (
      <>
        <ContentHeader
          title="프로필"
          description="내 프로필 정보를 확인하고 수정합니다"
        />
        <div className="page-container space-y-section-gap">
          <div className="bg-surface-card border border-line rounded-lg p-6 animate-pulse space-y-6">
            {/* 탭 스켈레톤 */}
            <div className="flex gap-4 border-b border-line pb-3">
              <div className="h-4 w-16 bg-surface-raised rounded" />
              <div className="h-4 w-20 bg-surface-raised rounded" />
            </div>
            {/* 아바타 + 이름 */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface-raised" />
              <div className="space-y-2">
                <div className="h-4 w-28 bg-surface-raised rounded" />
                <div className="h-3 w-40 bg-surface-raised rounded" />
              </div>
            </div>
            {/* 폼 필드 스켈레톤 */}
            <div className="border-t border-line pt-4 space-y-4">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-surface-raised rounded" />
                <div className="h-9 w-full bg-surface-raised rounded" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-12 bg-surface-raised rounded" />
                <div className="h-9 w-full bg-surface-raised rounded" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-10 bg-surface-raised rounded" />
                <div className="h-9 w-full bg-surface-raised rounded" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <ContentHeader
          title="프로필"
          description="내 프로필 정보를 확인하고 수정합니다"
        />
        <div className="page-container">
          <div className="flex items-center justify-center py-12">
            <div className="text-content-secondary">
              프로필 정보를 불러올 수 없습니다.
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHeader
        title="프로필"
        description="내 프로필 정보를 확인하고 수정합니다"
      />

      <div className="page-container space-y-section-gap">
        <Card>
          <CardBody>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="startpage">시작 페이지</TabsTrigger>
                <TabsTrigger value="sessions">로그인 세션</TabsTrigger>
              </TabsList>

              {/* 기본 정보 탭 */}
              <TabsContent value="info">
                <div className="space-y-4">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-content-primary">
                      기본 정보
                    </h3>
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="btn btn-primary"
                      >
                        수정
                      </button>
                    )}
                  </div>

                  {/* 아바타 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-brand-600 text-content-inverse font-medium text-xl">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-body-base font-medium text-content-primary">
                        {profile.username}
                      </p>
                      <p className="text-caption text-content-tertiary">
                        {getRoleDisplayName(profile.role)} · 가입일:{" "}
                        {new Date(profile.created_at).toLocaleDateString(
                          "ko-KR",
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-line pt-4 space-y-4">
                    {/* 사용자명 */}
                    <div>
                      <label
                        htmlFor="username"
                        className="block text-body-sm font-medium text-content-primary mb-1.5"
                      >
                        사용자명
                      </label>
                      {isEditing ? (
                        <input
                          id="username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="input"
                          placeholder="사용자명을 입력하세요"
                        />
                      ) : (
                        <div className="text-body-base text-content-secondary">
                          {profile.username}
                        </div>
                      )}
                    </div>

                    {/* 이메일 (읽기 전용) */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-body-sm font-medium text-content-primary mb-1.5"
                      >
                        이메일
                      </label>
                      <div className="text-body-base text-content-secondary">
                        {profile.email}
                      </div>
                      <p className="text-caption text-content-tertiary mt-1">
                        이메일은 변경할 수 없습니다
                      </p>
                    </div>

                    {/* 역할 (읽기 전용) */}
                    <div>
                      <label className="block text-body-sm font-medium text-content-primary mb-1.5">
                        역할
                      </label>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium bg-brand-100 text-brand-700">
                        {getRoleDisplayName(profile.role)}
                      </div>
                    </div>
                  </div>

                  {/* 수정 모드 액션 버튼 */}
                  {isEditing && (
                    <div className="flex gap-3 pt-4 border-t border-line">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn btn-primary btn-lg"
                      >
                        {isSaving ? "저장 중..." : "저장"}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="btn btn-secondary btn-lg"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 시작 페이지 탭 */}
              <TabsContent value="startpage">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-content-primary">
                      시작 페이지 설정
                    </h3>
                    <p className="text-body-sm text-content-secondary mt-1">
                      로그인 후 처음 표시될 페이지를 선택할 수 있습니다.
                      설정하지 않으면 시스템 관리자가 지정한 기본 페이지로
                      이동합니다.
                    </p>
                  </div>

                  {/* 현재 적용 중인 시작 페이지 표시 */}
                  <div className="p-4 bg-surface-raised rounded-lg border border-line">
                    <p className="text-body-sm font-medium text-content-secondary mb-1">
                      현재 적용 중인 시작 페이지
                    </p>
                    <p className="text-body-base font-semibold text-content-primary">
                      {(() => {
                        const resolved = resolveStartPage(
                          profile.start_page || "",
                          systemSettings?.default_start_page || "/",
                          menus,
                        );
                        const label =
                          pageOptions.find((o) => o.path === resolved)?.label ||
                          (resolved === "/" ? "대시보드" : resolved);
                        const source = profile.start_page
                          ? "개인 설정"
                          : "시스템 기본값";
                        return `${label} (${source})`;
                      })()}
                    </p>
                    {/* 저장된 시작 페이지에 권한이 없는 경우 경고 */}
                    {profile.start_page &&
                      !pageOptions.some(
                        (o) => o.path === profile.start_page,
                      ) && (
                        <p className="text-caption text-status-error mt-2">
                          현재 저장된 시작 페이지({profile.start_page})에 대한
                          접근 권한이 없습니다. 로그인 시 시스템 기본값으로
                          이동합니다.
                        </p>
                      )}
                  </div>

                  {/* 시작 페이지 선택 */}
                  <div>
                    <label
                      htmlFor="start-page"
                      className="block text-body-sm font-medium text-content-primary mb-2"
                    >
                      시작 페이지 선택
                    </label>
                    <select
                      id="start-page"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">
                        시스템 기본값 사용 (현재: {systemDefaultLabel})
                      </option>
                      {pageOptions.map((opt) => (
                        <option key={opt.path} value={opt.path}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-caption text-content-tertiary mt-2">
                      &quot;시스템 기본값 사용&quot;을 선택하면 관리자가 설정한
                      기본 시작 페이지로 이동합니다. 특정 페이지를 직접 선택하면
                      시스템 설정과 관계없이 항상 해당 페이지로 이동합니다.
                    </p>
                  </div>

                  {/* 우선순위 안내 */}
                  <div className="p-4 bg-surface-raised rounded-lg">
                    <p className="text-body-sm font-medium text-content-secondary mb-2">
                      시작 페이지 적용 우선순위
                    </p>
                    <ol className="text-body-sm text-content-tertiary space-y-1.5 list-decimal list-inside">
                      <li>
                        <span className="font-medium text-content-secondary">
                          개인 설정
                        </span>{" "}
                        — 이 페이지에서 직접 선택한 페이지
                      </li>
                      <li>
                        <span className="font-medium text-content-secondary">
                          시스템 기본값
                        </span>{" "}
                        — 관리자가 설정 &gt; 시스템 설정에서 지정한 페이지
                        (현재: {systemDefaultLabel})
                      </li>
                      <li>
                        <span className="font-medium text-content-secondary">
                          대시보드
                        </span>{" "}
                        — 위 설정이 없을 경우 기본 대시보드로 이동
                      </li>
                    </ol>
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex gap-3 pt-2 border-t border-line">
                    <button
                      onClick={handleStartPageSave}
                      disabled={isSaving || !isStartPageDirty}
                      className="btn btn-primary btn-lg"
                    >
                      {isSaving ? "저장 중..." : "저장"}
                    </button>
                    {isStartPageDirty && (
                      <button
                        onClick={() => setStartPage(profile.start_page ?? "")}
                        disabled={isSaving}
                        className="btn btn-secondary btn-lg"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* 로그인 세션 탭 */}
              <TabsContent value="sessions">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-content-primary">
                    로그인 세션
                  </h3>
                  <p className="text-body-sm text-content-secondary">
                    현재 로그인된 디바이스 목록입니다
                  </p>
                  <SessionDeviceList />
                </div>
              </TabsContent>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
