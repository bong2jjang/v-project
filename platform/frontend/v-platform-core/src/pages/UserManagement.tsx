import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { usePermissionStore } from "../stores/permission";
import { useNotificationStore } from "../stores/notification";
import * as usersApi from "../api/users";
import * as orgApi from "../api/organizations";
import * as groupApi from "../api/permission-groups";
import { ApiClientError } from "../api/client";
import type {
  User,
  UserRole,
  Company,
  Department,
  PermissionGroup,
  OrgTreeResponse,
  OrgCompanyNode,
  OrgDeptNode,
  OrgUserBrief,
} from "../api/types";
import {
  isAdminRole,
  isSystemAdmin,
  getRoleDisplayName,
} from "../api/types";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { DepartmentTreePicker } from "../components/ui/DepartmentTreePicker";
import { Alert } from "../components/ui/Alert";
import { Modal, ModalFooter } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { ContentHeader } from "../components/layout/ContentHeader";
import {
  UserPlus,
  Eye,
  EyeOff,
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Building2,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Network,
  UserCircle,
  Loader2,
  ChevronsDownUp,
  ChevronsUpDown,
  RefreshCw,
  Search,
} from "lucide-react";

// ── 조직도 서브 컴포넌트 ─────────────────────────────────────────

function OrgUserItem({ user }: { user: OrgUserBrief }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-raised">
      <UserCircle className="w-4 h-4 text-content-tertiary flex-shrink-0" />
      <span className="text-sm text-content-primary">{user.username}</span>
      <span className="text-xs text-content-tertiary">{user.email}</span>
      <Badge
        variant={
          user.role === "system_admin" || user.role === "org_admin"
            ? "warning"
            : "info"
        }
      >
        {user.role === "system_admin"
          ? "시스템 관리자"
          : user.role === "org_admin"
            ? "조직 관리자"
            : "사용자"}
      </Badge>
    </div>
  );
}

function OrgDeptTreeNode({
  dept,
  depth = 0,
  forceExpanded,
}: {
  dept: OrgDeptNode;
  depth?: number;
  forceExpanded?: boolean | null;
}) {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (forceExpanded !== null && forceExpanded !== undefined) {
      setExpanded(forceExpanded);
    }
  }, [forceExpanded]);
  const hasChildren = dept.children.length > 0 || dept.users.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-surface-raised w-full text-left"
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-content-tertiary flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-content-tertiary flex-shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}
        <FolderTree className="w-4 h-4 text-brand-500 flex-shrink-0" />
        <span className="text-sm font-medium text-content-primary">
          {dept.name}
        </span>
        {dept.code && (
          <span className="text-xs text-content-tertiary">({dept.code})</span>
        )}
        <span className="text-xs text-content-tertiary ml-auto">
          {countDeptUsers(dept)}명
        </span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-line pl-2">
          {dept.children.map((child) => (
            <OrgDeptTreeNode
              key={child.id}
              dept={child}
              depth={depth + 1}
              forceExpanded={forceExpanded}
            />
          ))}
          {dept.users.map((user) => (
            <OrgUserItem key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgCompanyCard({
  company,
  forceExpanded,
}: {
  company: OrgCompanyNode;
  forceExpanded?: boolean | null;
}) {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (forceExpanded !== null && forceExpanded !== undefined) {
      setExpanded(forceExpanded);
    }
  }, [forceExpanded]);
  const totalUsers =
    company.departments.reduce((sum, dept) => sum + countDeptUsers(dept), 0) +
    company.unassigned_users.length;

  return (
    <div className="bg-surface-card rounded-lg border border-line overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-3 hover:bg-surface-raised transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-content-tertiary" />
        ) : (
          <ChevronRight className="w-5 h-5 text-content-tertiary" />
        )}
        <Building2 className="w-5 h-5 text-brand-600" />
        <span className="font-semibold text-content-primary">
          {company.name}
        </span>
        <Badge variant="info">{company.code}</Badge>
        {!company.is_active && <Badge variant="danger">비활성</Badge>}
        <span className="text-sm text-content-tertiary ml-auto">
          {totalUsers}명
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {company.departments.map((dept) => (
            <OrgDeptTreeNode
              key={dept.id}
              dept={dept}
              forceExpanded={forceExpanded}
            />
          ))}
          {company.unassigned_users.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-content-tertiary px-2 py-1">
                미배정 사용자
              </p>
              {company.unassigned_users.map((user) => (
                <OrgUserItem key={user.id} user={user} />
              ))}
            </div>
          )}
          {company.departments.length === 0 &&
            company.unassigned_users.length === 0 && (
              <p className="text-sm text-content-tertiary px-2 py-2">
                소속 사용자 없음
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function countDeptUsers(dept: OrgDeptNode): number {
  return (
    dept.users.length +
    dept.children.reduce((sum, child) => sum + countDeptUsers(child), 0)
  );
}

function OrgChartView({
  orgTree,
  isLoading,
  error,
  onRefresh,
}: {
  orgTree: OrgTreeResponse | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-3" />
        <p className="text-sm text-content-secondary">
          조직도를 불러오는 중...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert variant="error">{error}</Alert>
        <Button variant="secondary" onClick={onRefresh}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (!orgTree) return null;

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="flex items-center gap-4 text-sm text-content-secondary">
        <span>
          회사{" "}
          <strong className="text-content-primary">
            {orgTree.companies.length}
          </strong>
          개
        </span>
        <span>
          전체 활성 사용자{" "}
          <strong className="text-content-primary">
            {orgTree.total_users}
          </strong>
          명
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const next = forceExpanded === false;
              setForceExpanded(next ? true : false);
            }}
            title={forceExpanded === false ? "전체 펼치기" : "전체 접기"}
          >
            {forceExpanded === false ? (
              <ChevronsUpDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronsDownUp className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setForceExpanded(null);
              onRefresh();
            }}
            title="새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 회사별 트리 */}
      <div className="space-y-3">
        {orgTree.companies.map((company) => (
          <OrgCompanyCard
            key={company.id}
            company={company}
            forceExpanded={forceExpanded}
          />
        ))}
      </div>

      {/* 미배정 사용자 */}
      {orgTree.unassigned_users.length > 0 && (
        <div className="bg-surface-card rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-content-primary mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-content-tertiary" />
            회사 미배정 사용자
            <span className="text-xs text-content-tertiary font-normal">
              ({orgTree.unassigned_users.length}명)
            </span>
          </h3>
          <div className="space-y-0.5">
            {orgTree.unassigned_users.map((user) => (
              <OrgUserItem key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}

      {orgTree.companies.length === 0 &&
        orgTree.unassigned_users.length === 0 && (
          <div className="text-center py-12">
            <Network className="w-10 h-10 mx-auto text-content-tertiary mb-2" />
            <p className="text-content-secondary">
              등록된 조직 정보가 없습니다.
            </p>
          </div>
        )}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const canEdit = usePermissionStore().canWrite("users");
  const { addNotification } = useNotificationStore();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [isActiveFilter, setIsActiveFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<"users" | "orgchart">("users");

  // 조직도 트리 데이터
  const [orgTree, setOrgTree] = useState<OrgTreeResponse | null>(null);
  const [orgTreeLoading, setOrgTreeLoading] = useState(false);
  const [orgTreeError, setOrgTreeError] = useState<string | null>(null);

  // 조직/그룹 참조 데이터
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);

  // 편집 모달
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    is_active: true,
    company_id: null as number | null,
    department_id: null as number | null,
  });
  const [initialEditForm, setInitialEditForm] = useState({
    username: "",
    email: "",
    is_active: true,
    company_id: null as number | null,
    department_id: null as number | null,
  });
  const [editDepartments, setEditDepartments] = useState<Department[]>([]);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // 역할 변경 모달
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [changingRoleUser, setChangingRoleUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [initialRole, setInitialRole] = useState<UserRole>("user");
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [roleModalGroupIds, setRoleModalGroupIds] = useState<Set<number>>(
    new Set(),
  );
  const [initialGroupIds, setInitialGroupIds] = useState<Set<number>>(
    new Set(),
  );

  // 사용자 생성 모달
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user" as UserRole,
    is_active: true,
    company_id: null as number | null,
    department_id: null as number | null,
  });
  const [createDepartments, setCreateDepartments] = useState<Department[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createGroupIds, setCreateGroupIds] = useState<Set<number>>(new Set());

  const isCreateFormValid =
    createForm.username.length >= 2 &&
    createForm.email.includes("@") &&
    createForm.password.length >= 8;

  // 참조 데이터 로드
  useEffect(() => {
    orgApi
      .getCompanies()
      .then(setCompanies)
      .catch(() => {});
    groupApi
      .getGroups()
      .then(setGroups)
      .catch(() => {});
  }, []);

  // 사용자 목록 로드
  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = { page, per_page: perPage };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (isActiveFilter !== "") params.is_active = isActiveFilter === "true";
      if (companyFilter) params.company_id = Number(companyFilter);
      if (groupFilter) params.group_id = Number(groupFilter);

      const response = await usersApi.getUsers(
        params as Parameters<typeof usersApi.getUsers>[0],
      );
      setUsers(response.users);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.getUserMessage());
      } else {
        setError("사용자 목록을 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, search, roleFilter, isActiveFilter, companyFilter, groupFilter]);

  // 조직도 탭 전환 시 데이터 로드
  const loadOrgTree = async () => {
    setOrgTreeLoading(true);
    setOrgTreeError(null);
    try {
      const tree = await orgApi.getOrgTree();
      setOrgTree(tree);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setOrgTreeError(err.getUserMessage());
      } else {
        setOrgTreeError("조직도를 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      setOrgTreeLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orgchart") {
      loadOrgTree();
    }
  }, [activeTab]);

  // 편집 모달 열기
  const openEditModal = (user: User) => {
    setEditingUser(user);
    const formData = {
      username: user.username,
      email: user.email,
      is_active: user.is_active,
      company_id: user.company_id ?? null,
      department_id: user.department_id ?? null,
    };
    setEditForm(formData);
    setInitialEditForm(formData);
    setIsEditSubmitting(false);
    setEditModalOpen(true);
    // 해당 회사의 부서 로드
    if (user.company_id) {
      orgApi
        .getDepartments(user.company_id)
        .then(setEditDepartments)
        .catch(() => setEditDepartments([]));
    } else {
      setEditDepartments([]);
    }
  };

  // 편집 폼 변경 감지
  const isEditFormChanged =
    editForm.username !== initialEditForm.username ||
    editForm.email !== initialEditForm.email ||
    editForm.is_active !== initialEditForm.is_active ||
    editForm.company_id !== initialEditForm.company_id ||
    editForm.department_id !== initialEditForm.department_id;

  // 사용자 정보 수정
  const handleUpdateUser = async () => {
    if (!editingUser || isEditSubmitting) return;

    setIsEditSubmitting(true);
    try {
      await usersApi.updateUser(editingUser.id, editForm);
      setEditModalOpen(false);
      loadUsers();

      // 성공 알림 (관리자만)
      addNotification({
        id: `user-updated-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "info",
        category: "user",
        title: "사용자 정보 수정",
        message: `${editingUser.username}의 정보가 수정되었습니다.`,
        source: "user_management",
        dismissible: true,
        persistent: false,
        read: false,
        requiredRole: "admin",
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        // 실패 알림 (관리자만)
        addNotification({
          id: `user-update-failed-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: "error",
          category: "user",
          title: "사용자 정보 수정 실패",
          message: err.getUserMessage(),
          source: "user_management",
          dismissible: true,
          persistent: false,
          read: false,
          requiredRole: "admin",
        });
      }
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // 사용자 삭제
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`정말로 ${user.email} 사용자를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await usersApi.deleteUser(user.id);
      loadUsers();

      // 성공 알림 (관리자만)
      addNotification({
        id: `user-deleted-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "warning",
        category: "user",
        title: "사용자 삭제",
        message: `${user.username} (${user.email}) 사용자가 삭제되었습니다.`,
        source: "user_management",
        dismissible: true,
        persistent: false,
        read: false,
        requiredRole: "admin",
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        // 실패 알림 (관리자만)
        addNotification({
          id: `user-delete-failed-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: "error",
          category: "user",
          title: "사용자 삭제 실패",
          message: err.getUserMessage(),
          source: "user_management",
          dismissible: true,
          persistent: false,
          read: false,
          requiredRole: "admin",
        });
      }
    }
  };

  // 역할 변경 모달 열기
  const openRoleModal = async (user: User) => {
    setChangingRoleUser(user);
    setNewRole(user.role);
    setInitialRole(user.role);
    setIsRoleSubmitting(false);
    // 사용자 현재 그룹 로드
    const currentIds = new Set((user.groups ?? []).map((g) => g.id));
    setRoleModalGroupIds(currentIds);
    setInitialGroupIds(new Set(currentIds));
    setRoleModalOpen(true);
    // 백그라운드: 정확한 그룹 목록 가져오기
    try {
      const res = await usersApi.getUserGroups(user.id);
      const ids = new Set(res.groups.map((g) => g.id));
      setRoleModalGroupIds(ids);
      setInitialGroupIds(new Set(ids));
    } catch {
      // user.groups fallback 유지
    }
  };

  // 역할 변경 감지
  const isGroupsChanged = (() => {
    if (roleModalGroupIds.size !== initialGroupIds.size) return true;
    for (const id of roleModalGroupIds) {
      if (!initialGroupIds.has(id)) return true;
    }
    return false;
  })();
  const isRoleChanged = newRole !== initialRole || isGroupsChanged;

  // 역할 변경
  const handleChangeRole = async () => {
    if (!changingRoleUser || isRoleSubmitting) return;

    setIsRoleSubmitting(true);
    try {
      if (newRole !== initialRole) {
        await usersApi.updateUserRole(changingRoleUser.id, { role: newRole });
      }
      if (isGroupsChanged) {
        await usersApi.setUserGroups(
          changingRoleUser.id,
          Array.from(roleModalGroupIds),
        );
      }
      setRoleModalOpen(false);
      loadUsers();

      // 성공 알림 (관리자만)
      addNotification({
        id: `role-changed-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "역할 그룹 변경 완료",
        message: `${changingRoleUser.username}의 역할 그룹이 ${getRoleDisplayName(newRole)}(으)로 변경되었습니다.`,
        source: "user_management",
        dismissible: true,
        persistent: false,
        read: false,
        requiredRole: "admin",
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        // 실패 알림 (관리자만)
        addNotification({
          id: `role-change-failed-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: "error",
          category: "user",
          title: "역할 그룹 변경 실패",
          message: err.getUserMessage(),
          source: "user_management",
          dismissible: true,
          persistent: false,
          read: false,
          requiredRole: "admin",
        });
      }
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  // 사용자 생성 모달 열기
  const openCreateModal = () => {
    setCreateForm({
      username: "",
      email: "",
      password: "",
      role: "user",
      is_active: true,
      company_id: null,
      department_id: null,
    });
    setCreateDepartments([]);
    setShowPassword(false);
    setCreateError(null);
    setIsCreateSubmitting(false);
    setCreateGroupIds(new Set());
    setCreateModalOpen(true);
  };

  // 사용자 생성
  const handleCreateUser = async () => {
    if (!isCreateFormValid || isCreateSubmitting) return;

    setIsCreateSubmitting(true);
    setCreateError(null);
    try {
      const newUser = await usersApi.createUser(createForm);
      // 추가 역할 그룹 할당
      if (createGroupIds.size > 0) {
        try {
          await usersApi.setUserGroups(newUser.id, Array.from(createGroupIds));
        } catch {
          // 사용자 생성은 성공, 그룹 할당만 실패 — 무시
        }
      }
      setCreateModalOpen(false);
      loadUsers();

      addNotification({
        id: `user-created-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "사용자 생성 완료",
        message: `${newUser.username} (${newUser.email}) 사용자가 생성되었습니다.`,
        source: "user_management",
        dismissible: true,
        persistent: false,
        read: false,
        requiredRole: "admin",
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setCreateError(err.getUserMessage());
      } else {
        setCreateError("사용자 생성 중 오류가 발생했습니다.");
      }
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  // 통계 계산
  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => isAdminRole(u.role)).length,
    inactive: users.filter((u) => !u.is_active).length,
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      <ContentHeader
        title="사용자 관리"
        description="사용자 계정을 관리하고 역할 그룹을 설정합니다"
        globalScope
        actions={
          <Button onClick={openCreateModal} disabled={!canEdit}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            사용자 추가
          </Button>
        }
      />

      <div className="page-container space-y-section-gap">
        {/* 탭 바 */}
        <div className="flex gap-1 border-b border-line">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "users"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-content-secondary hover:text-content-primary hover:border-line"
            }`}
          >
            <Users className="w-4 h-4" />
            사용자 목록
          </button>
          <button
            onClick={() => setActiveTab("orgchart")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "orgchart"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-content-secondary hover:text-content-primary hover:border-line"
            }`}
          >
            <Network className="w-4 h-4" />
            조직도
          </button>
        </div>

        {activeTab === "users" && (
          <>
            {/* 요약 통계 */}
            {!isLoading && users.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-surface-card rounded-lg border border-line p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950">
                    <Users className="w-4 h-4 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xs text-content-secondary">전체</p>
                    <p className="text-lg font-semibold text-content-primary">
                      {total}
                    </p>
                  </div>
                </div>
                <div className="bg-surface-card rounded-lg border border-line p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-status-success/10">
                    <ShieldCheck className="w-4 h-4 text-status-success" />
                  </div>
                  <div>
                    <p className="text-xs text-content-secondary">활성</p>
                    <p className="text-lg font-semibold text-content-primary">
                      {stats.active}
                    </p>
                  </div>
                </div>
                <div className="bg-surface-card rounded-lg border border-line p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-status-warning/10">
                    <UserCog className="w-4 h-4 text-status-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-content-secondary">관리자</p>
                    <p className="text-lg font-semibold text-content-primary">
                      {stats.admins}
                    </p>
                  </div>
                </div>
                <div className="bg-surface-card rounded-lg border border-line p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-status-error/10">
                    <ShieldAlert className="w-4 h-4 text-status-error" />
                  </div>
                  <div>
                    <p className="text-xs text-content-secondary">비활성</p>
                    <p className="text-lg font-semibold text-content-primary">
                      {stats.inactive}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 검색 및 필터 */}
            <div className="bg-surface-card rounded-lg shadow-sm border border-line p-4 space-y-3">
              {/* Row 1: 역할 탭 + 새로고침 */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-1 bg-surface-base rounded-lg p-1">
                  {[
                    { key: "", label: "전체" },
                    { key: "system_admin", label: "시스템 관리자" },
                    { key: "org_admin", label: "조직 관리자" },
                    { key: "user", label: "일반 사용자" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRoleFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        roleFilter === tab.key
                          ? "bg-surface-card shadow-sm text-content-primary border border-line"
                          : "text-content-secondary hover:text-content-primary"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadUsers}
                  disabled={isLoading}
                  icon={
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                    />
                  }
                >
                  새로고침
                </Button>
              </div>
              {/* Row 2: 검색 + 필터 */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
                  <Input
                    type="text"
                    placeholder="이메일 또는 사용자명 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={isActiveFilter}
                  onChange={(e) => setIsActiveFilter(e.target.value)}
                >
                  <option value="">모든 상태</option>
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </Select>
                <Select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                >
                  <option value="">모든 회사</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                >
                  <option value="">모든 역할 그룹</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && <Alert variant="error">{error}</Alert>}

            {/* 사용자 테이블 */}
            <div className="bg-surface-card rounded-lg shadow-sm border border-line overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-line">
                  <thead className="bg-surface-raised">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        사용자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        이메일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        소속
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        역할 그룹
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        상태
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-content-secondary uppercase tracking-wider">
                        가입일
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-content-secondary uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-card divide-y divide-line">
                    {isLoading ? (
                      <>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-surface-raised" />
                                <div className="ml-4 space-y-1.5">
                                  <div className="h-4 w-24 bg-surface-raised rounded" />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-36 bg-surface-raised rounded" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-20 bg-surface-raised rounded" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-5 w-14 bg-surface-raised rounded-full" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-5 w-14 bg-surface-raised rounded-full" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-24 bg-surface-raised rounded" />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="h-4 w-8 bg-surface-raised rounded ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <Users className="w-10 h-10 mx-auto text-content-tertiary mb-2" />
                          <p className="text-content-secondary">
                            {search || roleFilter || isActiveFilter
                              ? "검색 조건에 맞는 사용자가 없습니다."
                              : "등록된 사용자가 없습니다."}
                          </p>
                          {!search && !roleFilter && !isActiveFilter && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="mt-3"
                              onClick={openCreateModal}
                              disabled={!canEdit}
                            >
                              <UserPlus className="w-4 h-4 mr-1.5" />첫 사용자
                              추가
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-surface-raised">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-600 text-content-inverse font-medium">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-content-primary">
                                  {user.username}
                                </div>
                                {user.id === currentUser?.id && (
                                  <Badge variant="info">본인</Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-content-secondary">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-content-secondary">
                            {user.company ? (
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-content-tertiary" />
                                <span>{user.company.name}</span>
                                {user.department && (
                                  <>
                                    <span className="text-content-tertiary">
                                      /
                                    </span>
                                    <span>{user.department.name}</span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-content-tertiary">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              <Badge
                                variant={
                                  isAdminRole(user.role) ? "warning" : "success"
                                }
                              >
                                {getRoleDisplayName(user.role)}
                              </Badge>
                              {user.groups
                                ?.filter((g) => !g.is_default)
                                .map((g) => (
                                  <Badge key={g.id} variant="info">
                                    {g.name}
                                  </Badge>
                                ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={user.is_active ? "success" : "error"}
                            >
                              {user.is_active ? "활성" : "비활성"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-content-secondary">
                            {new Date(user.created_at).toLocaleDateString(
                              "ko-KR",
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEditModal(user)}
                                disabled={!canEdit}
                              >
                                수정
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openRoleModal(user)}
                                disabled={
                                  !canEdit || user.id === currentUser?.id
                                }
                              >
                                역할 그룹
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                disabled={
                                  !canEdit || user.id === currentUser?.id
                                }
                              >
                                삭제
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="bg-surface-raised px-4 py-3 flex items-center justify-between border-t border-line">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <Button
                      variant="secondary"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      이전
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      다음
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-content-secondary">
                        전체 <span className="font-medium">{total}</span>명 중{" "}
                        <span className="font-medium">
                          {(page - 1) * perPage + 1}
                        </span>
                        -{" "}
                        <span className="font-medium">
                          {Math.min(page * perPage, total)}
                        </span>
                        명 표시
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                      >
                        처음
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        이전
                      </Button>
                      <span className="px-4 py-2 text-sm text-content-primary">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                      >
                        다음
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                      >
                        마지막
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 조직도 탭 */}
        {activeTab === "orgchart" && (
          <OrgChartView
            orgTree={orgTree}
            isLoading={orgTreeLoading}
            error={orgTreeError}
            onRefresh={loadOrgTree}
          />
        )}

        {/* 편집 모달 */}
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="사용자 정보 수정"
          footer={
            <ModalFooter
              onCancel={() => setEditModalOpen(false)}
              onConfirm={handleUpdateUser}
              confirmText="저장"
              cancelText="취소"
              confirmVariant="primary"
              loading={isEditSubmitting}
              disabled={!isEditFormChanged}
            />
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                사용자명
              </label>
              <Input
                type="text"
                value={editForm.username}
                onChange={(e) =>
                  setEditForm({ ...editForm, username: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                이메일
              </label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                회사
              </label>
              <Select
                value={editForm.company_id?.toString() ?? ""}
                onChange={(e) => {
                  const companyId = e.target.value
                    ? Number(e.target.value)
                    : null;
                  setEditForm({
                    ...editForm,
                    company_id: companyId,
                    department_id: null,
                  });
                  if (companyId) {
                    orgApi
                      .getDepartments(companyId)
                      .then(setEditDepartments)
                      .catch(() => setEditDepartments([]));
                  } else {
                    setEditDepartments([]);
                  }
                }}
              >
                <option value="">선택 안 함</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {editForm.company_id && (
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1">
                  부서
                </label>
                <DepartmentTreePicker
                  departments={editDepartments}
                  value={editForm.department_id}
                  onChange={(id) =>
                    setEditForm({ ...editForm, department_id: id })
                  }
                  placeholder="선택 안 함"
                />
              </div>
            )}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_active: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm font-medium text-content-primary">
                  계정 활성화
                </span>
              </label>
            </div>
          </div>
        </Modal>

        {/* 역할 변경 모달 */}
        <Modal
          isOpen={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
          title="역할 그룹 변경"
          footer={
            <ModalFooter
              onCancel={() => setRoleModalOpen(false)}
              onConfirm={handleChangeRole}
              confirmText="변경"
              cancelText="취소"
              confirmVariant="primary"
              loading={isRoleSubmitting}
              disabled={!isRoleChanged}
            />
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              <strong>{changingRoleUser?.username}</strong>의 역할 그룹을
              변경합니다.
            </p>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                기본 역할 그룹
              </label>
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="user">일반 사용자</option>
                <option value="org_admin">조직 관리자</option>
                {isSystemAdmin(currentUser?.role) && (
                  <option value="system_admin">시스템 관리자</option>
                )}
              </Select>
              <p className="mt-1 text-xs text-content-tertiary">
                기본 역할 그룹에 따라 접근 가능한 메뉴 권한이 결정됩니다.
              </p>
            </div>
            {/* 추가 역할 그룹 */}
            {groups.filter((g) => !g.is_default).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1.5">
                  추가 역할 그룹
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-line p-2">
                  {groups
                    .filter((g) => !g.is_default)
                    .map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-raised cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={roleModalGroupIds.has(g.id)}
                          onChange={(e) => {
                            setRoleModalGroupIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(g.id);
                              else next.delete(g.id);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-content-primary">
                          {g.name}
                        </span>
                        {g.description && (
                          <span className="text-xs text-content-tertiary ml-auto truncate max-w-[180px]">
                            {g.description}
                          </span>
                        )}
                      </label>
                    ))}
                </div>
                <p className="mt-1 text-xs text-content-tertiary">
                  추가 권한이 필요한 그룹을 선택합니다.
                </p>
              </div>
            )}
            {changingRoleUser && (
              <Alert variant="info">
                역할 그룹 변경 시 해당 사용자의 접근 가능한 메뉴가 즉시
                변경됩니다.
              </Alert>
            )}
          </div>
        </Modal>

        {/* 사용자 생성 모달 */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="새 사용자 추가"
          footer={
            <ModalFooter
              onCancel={() => setCreateModalOpen(false)}
              onConfirm={handleCreateUser}
              confirmText="생성"
              cancelText="취소"
              confirmVariant="primary"
              loading={isCreateSubmitting}
              disabled={!isCreateFormValid}
            />
          }
        >
          <div className="space-y-4">
            {createError && <Alert variant="danger">{createError}</Alert>}
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                사용자명 <span className="text-status-error">*</span>
              </label>
              <Input
                type="text"
                placeholder="최소 2자"
                value={createForm.username}
                onChange={(e) =>
                  setCreateForm({ ...createForm, username: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                이메일 <span className="text-status-error">*</span>
              </label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                비밀번호 <span className="text-status-error">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="최소 8자"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {createForm.password.length > 0 &&
                createForm.password.length < 8 && (
                  <p className="mt-1 text-xs text-status-error">
                    비밀번호는 최소 8자 이상이어야 합니다.
                  </p>
                )}
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                기본 역할 그룹
              </label>
              <Select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    role: e.target.value as UserRole,
                  })
                }
              >
                <option value="user">일반 사용자</option>
                <option value="org_admin">조직 관리자</option>
                {isSystemAdmin(currentUser?.role) && (
                  <option value="system_admin">시스템 관리자</option>
                )}
              </Select>
              <p className="mt-1 text-xs text-content-tertiary">
                기본 역할 그룹에 따라 접근 가능한 메뉴 권한이 결정됩니다.
              </p>
            </div>
            {/* 추가 역할 그룹 */}
            {groups.filter((g) => !g.is_default).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1.5">
                  추가 역할 그룹
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-line p-2">
                  {groups
                    .filter((g) => !g.is_default)
                    .map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-raised cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={createGroupIds.has(g.id)}
                          onChange={(e) => {
                            setCreateGroupIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(g.id);
                              else next.delete(g.id);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-content-primary">
                          {g.name}
                        </span>
                        {g.description && (
                          <span className="text-xs text-content-tertiary ml-auto truncate max-w-[180px]">
                            {g.description}
                          </span>
                        )}
                      </label>
                    ))}
                </div>
                <p className="mt-1 text-xs text-content-tertiary">
                  추가 권한이 필요한 그룹을 선택합니다.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">
                회사
              </label>
              <Select
                value={createForm.company_id?.toString() ?? ""}
                onChange={(e) => {
                  const companyId = e.target.value
                    ? Number(e.target.value)
                    : null;
                  setCreateForm({
                    ...createForm,
                    company_id: companyId,
                    department_id: null,
                  });
                  if (companyId) {
                    orgApi
                      .getDepartments(companyId)
                      .then(setCreateDepartments)
                      .catch(() => setCreateDepartments([]));
                  } else {
                    setCreateDepartments([]);
                  }
                }}
              >
                <option value="">선택 안 함</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {createForm.company_id && (
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1">
                  부서
                </label>
                <DepartmentTreePicker
                  departments={createDepartments}
                  value={createForm.department_id}
                  onChange={(id) =>
                    setCreateForm({ ...createForm, department_id: id })
                  }
                  placeholder="선택 안 함"
                />
              </div>
            )}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      is_active: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm font-medium text-content-primary">
                  계정 활성화
                </span>
              </label>
              <p className="mt-1 text-xs text-content-tertiary">
                비활성 계정은 로그인이 불가합니다.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
