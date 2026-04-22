/**
 * v-itsm ITSM-specific API types — 백엔드 스키마(§4.1.8~§4.1.14) 대응.
 */

export type RequestServiceType = "on_premise" | "saas" | "internal" | "partner";
export type CustomerStatus = "active" | "inactive";
export type ContractStatus = "active" | "expired" | "terminated";
export type ScopeLevel = "read" | "write";

export const SERVICE_TYPE_LABELS: Record<RequestServiceType, string> = {
  on_premise: "온프레미스",
  saas: "SaaS",
  internal: "내부",
  partner: "협력사",
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "활성",
  inactive: "비활성",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "활성",
  expired: "만료",
  terminated: "해지",
};

export const SCOPE_LEVEL_LABELS: Record<ScopeLevel, string> = {
  read: "조회",
  write: "변경",
};

// ── Customer ──────────────────────────────────────────────
export interface Customer {
  id: string;
  code: string;
  name: string;
  service_type: RequestServiceType;
  industry: string | null;
  status: CustomerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreateInput {
  code: string;
  name: string;
  service_type: RequestServiceType;
  industry?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

export interface CustomerUpdateInput {
  code?: string;
  name?: string;
  service_type?: RequestServiceType;
  industry?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
}

// ── CustomerContact ───────────────────────────────────────
export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerContactCreateInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  role_title?: string | null;
  is_primary?: boolean;
  notes?: string | null;
}

export interface CustomerContactUpdateInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  role_title?: string | null;
  is_primary?: boolean;
  notes?: string | null;
}

// ── Product ───────────────────────────────────────────────
export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreateInput {
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface ProductUpdateInput {
  code?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}

// ── Contract ──────────────────────────────────────────────
export interface Contract {
  id: string;
  contract_no: string;
  customer_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  sla_tier_id: string | null;
  status: ContractStatus;
  notes: string | null;
  product_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ContractCreateInput {
  contract_no: string;
  customer_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  sla_tier_id?: string | null;
  status?: ContractStatus;
  notes?: string | null;
  product_ids?: string[];
}

export interface ContractUpdateInput {
  contract_no?: string;
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  sla_tier_id?: string | null;
  status?: ContractStatus;
  notes?: string | null;
  product_ids?: string[];
}

export interface ContractListResponse {
  items: Contract[];
  total: number;
  page: number;
  page_size: number;
}

// ── SLA Tier ──────────────────────────────────────────────
export type SlaPriority = "critical" | "high" | "normal" | "low";

export interface SlaPriorityMinutes {
  response: number;
  resolution: number;
}

export type SlaPriorityMatrix = Record<string, SlaPriorityMinutes>;

export interface SlaTier {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priority_matrix: SlaPriorityMatrix;
  business_hours: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaTierCreateInput {
  code: string;
  name: string;
  description?: string | null;
  priority_matrix: SlaPriorityMatrix;
  business_hours?: Record<string, unknown> | null;
  active?: boolean;
}

export interface SlaTierUpdateInput {
  code?: string;
  name?: string;
  description?: string | null;
  priority_matrix?: SlaPriorityMatrix;
  business_hours?: Record<string, unknown> | null;
  active?: boolean;
}

export interface SlaTierListResponse {
  items: SlaTier[];
  total: number;
}

// ── Scope Grant ───────────────────────────────────────────
export interface ScopeGrant {
  id: string;
  permission_group_id: number;
  service_type: RequestServiceType | null;
  customer_id: string | null;
  product_id: string | null;
  scope_level: ScopeLevel;
  granted_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScopeGrantCreateInput {
  permission_group_id: number;
  service_type?: RequestServiceType | null;
  customer_id?: string | null;
  product_id?: string | null;
  scope_level?: ScopeLevel;
}

export interface ScopeGrantUpdateInput {
  service_type?: RequestServiceType | null;
  customer_id?: string | null;
  product_id?: string | null;
  scope_level?: ScopeLevel;
}

export interface ScopeGrantListResponse {
  items: ScopeGrant[];
  total: number;
}

export interface UserScopeGrantItem {
  service_type: RequestServiceType | null;
  customer_id: string | null;
  product_id: string | null;
  scope_level: ScopeLevel;
}

export interface UserScopeSummary {
  is_admin: boolean;
  grants: UserScopeGrantItem[];
}

// ── Ticket (v0.2) ─────────────────────────────────────────
export type LoopStage =
  | "intake"
  | "analyze"
  | "execute"
  | "verify"
  | "answer"
  | "closed";

export type LoopAction =
  | "advance"
  | "reject"
  | "on_hold"
  | "resume"
  | "rollback"
  | "reopen"
  | "note";

export type Priority = "critical" | "high" | "normal" | "low";

export type ChannelSource = "slack" | "teams" | "email" | "web" | "phone";

export const LOOP_STAGE_LABELS: Record<LoopStage, string> = {
  intake: "접수",
  analyze: "분석",
  execute: "실행",
  verify: "검증",
  answer: "답변",
  closed: "종료",
};

export const LOOP_ACTION_LABELS: Record<LoopAction, string> = {
  advance: "다음 단계",
  reject: "반려",
  on_hold: "보류",
  resume: "재개",
  rollback: "롤백",
  reopen: "재오픈",
  note: "처리 내용",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const CHANNEL_SOURCE_LABELS: Record<ChannelSource, string> = {
  slack: "Slack",
  teams: "Teams",
  email: "이메일",
  web: "웹",
  phone: "전화",
};

export interface Ticket {
  id: string;
  ticket_no: string;
  title: string;
  description: string | null;
  source_channel: ChannelSource;
  source_ref: string | null;
  priority: Priority;
  category_l1: string | null;
  category_l2: string | null;
  current_stage: LoopStage;
  service_type: RequestServiceType;
  customer_id: string | null;
  product_id: string | null;
  contract_id: string | null;
  requester_id: number | null;
  current_owner_id: number | null;
  sla_policy_id: string | null;
  opened_at: string;
  closed_at: string | null;
  reopened_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketIntakeInput {
  title: string;
  description?: string | null;
  source_channel: ChannelSource;
  source_ref?: string | null;
  priority?: Priority;
  category_l1?: string | null;
  category_l2?: string | null;
  requester_id?: number | null;
  service_type?: RequestServiceType;
  customer_id?: string | null;
  product_id?: string | null;
  contract_id?: string | null;
}

export interface TicketUpdateInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  category_l1?: string | null;
  category_l2?: string | null;
  current_owner_id?: number | null;
  sla_policy_id?: string | null;
  service_type?: RequestServiceType;
  customer_id?: string | null;
  product_id?: string | null;
  contract_id?: string | null;
}

export interface TicketTransitionInput {
  action: LoopAction;
  note?: string | null;
  artifacts?: Record<string, unknown> | null;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
}

export interface LoopTransition {
  id: string;
  ticket_id: string;
  from_stage: LoopStage | null;
  to_stage: LoopStage;
  action: LoopAction;
  actor_id: number | null;
  note: string | null;
  artifacts: Record<string, unknown> | null;
  transitioned_at: string;
}

export type LoopTransitionRevisionOperation =
  | "create"
  | "edit"
  | "delete"
  | "restore"
  | "revert";

export const LOOP_TRANSITION_REVISION_OPERATION_LABELS: Record<
  LoopTransitionRevisionOperation,
  string
> = {
  create: "생성",
  edit: "편집",
  delete: "삭제",
  restore: "복원",
  revert: "되돌리기",
};

export interface LoopTransitionRevision {
  id: string;
  transition_id: string;
  revision_no: number;
  operation: LoopTransitionRevisionOperation | string;
  actor_id: number | null;
  reason: string | null;
  snapshot_note: string | null;
  snapshot_artifacts: Record<string, unknown> | null;
  snapshot_from_stage: string | null;
  snapshot_to_stage: string | null;
  snapshot_action: string | null;
  created_at: string;
}

export interface LoopTransitionDetail extends LoopTransition {
  deleted_at: string | null;
  deleted_by: number | null;
  last_edited_at: string | null;
  last_edited_by: number | null;
  edit_count: number;
  head_revision_id: string | null;
  can_edit: boolean;
  can_delete: boolean;
  can_restore: boolean;
  latest_revision: LoopTransitionRevision | null;
}

export interface TransitionEditInput {
  note?: string | null;
  artifacts?: Record<string, unknown> | null;
  reason?: string | null;
}

export interface TransitionDeleteInput {
  reason?: string | null;
}

export interface TransitionRestoreInput {
  reason?: string | null;
}

export interface TransitionRevertInput {
  reason?: string | null;
}

export interface ListTransitionsOptions {
  include_deleted?: boolean;
  with_latest_revision?: boolean;
}

export interface AllowedActions {
  current_stage: LoopStage;
  allowed: LoopAction[];
}

// ── SLA Timer (Monitor) ───────────────────────────────────
export type SlaTimerStatus = "active" | "warning" | "breached" | "satisfied";
export type SlaTimerKind = "response" | "resolution";

export const SLA_TIMER_STATUS_LABELS: Record<SlaTimerStatus, string> = {
  active: "진행중",
  warning: "경고(80%)",
  breached: "위반",
  satisfied: "충족",
};

export const SLA_TIMER_KIND_LABELS: Record<SlaTimerKind, string> = {
  response: "응답",
  resolution: "해결",
};

export interface SlaTimer {
  id: string;
  ticket_id: string;
  kind: SlaTimerKind;
  due_at: string;
  warning_sent_at: string | null;
  breached_at: string | null;
  satisfied_at: string | null;
  created_at: string;

  ticket_no: string;
  ticket_title: string;
  ticket_priority: Priority;
  ticket_stage: LoopStage;
  ticket_service_type: RequestServiceType;
  customer_id: string | null;
  product_id: string | null;

  status: SlaTimerStatus;
  remaining_seconds: number;
}

export interface SlaTimerListResponse {
  items: SlaTimer[];
  total: number;
  page: number;
  page_size: number;
}

export interface SlaSummary {
  active: number;
  warning: number;
  breached: number;
  satisfied: number;
  total: number;
}

// ── KPI Dashboard ─────────────────────────────────────────
export interface StageCount {
  stage: LoopStage;
  count: number;
}

export interface PriorityCount {
  priority: Priority;
  count: number;
}

export interface ServiceTypeCount {
  service_type: RequestServiceType;
  count: number;
}

export interface KpiSummary {
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
  opened_last_30d: number;
  closed_last_30d: number;

  sla_total: number;
  sla_active: number;
  sla_warning: number;
  sla_breached: number;
  sla_satisfied: number;
  sla_met_ratio: number;

  mttr_minutes: number | null;
  reopen_ratio: number;

  by_stage: StageCount[];
  by_priority: PriorityCount[];
  by_service_type: ServiceTypeCount[];
}

// ── SLA Policy ────────────────────────────────────────────
export interface SlaPolicy {
  id: string;
  name: string;
  priority: Priority;
  category: string | null;
  response_minutes: number;
  resolution_minutes: number;
  business_hours: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaPolicyCreateInput {
  name: string;
  priority: Priority;
  category?: string | null;
  response_minutes: number;
  resolution_minutes: number;
  business_hours?: Record<string, unknown> | null;
  active?: boolean;
}

export interface SlaPolicyUpdateInput {
  name?: string;
  priority?: Priority;
  category?: string | null;
  response_minutes?: number;
  resolution_minutes?: number;
  business_hours?: Record<string, unknown> | null;
  active?: boolean;
}

export interface SlaPolicyListResponse {
  items: SlaPolicy[];
  total: number;
  page: number;
  page_size: number;
}

export interface SlaRecalcResult {
  tickets_scanned: number;
  timers_updated: number;
  skipped_breached: number;
  skipped_satisfied: number;
}

// ── SLA Notification Policy ───────────────────────────────
export type TriggerEvent = "warning" | "breach";

export const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  warning: "경고(80%)",
  breach: "위반(100%)",
};

export interface SlaNotificationPolicy {
  id: string;
  name: string;
  trigger_event: TriggerEvent;
  applies_priority: Priority | null;
  applies_service_type: RequestServiceType | null;
  notify_channels: string[];
  notify_assignee: boolean;
  notify_assignee_manager: boolean;
  notify_custom_user_ids: number[] | null;
  notify_custom_addresses: string[] | null;
  template_key: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaNotificationPolicyCreateInput {
  name: string;
  trigger_event: TriggerEvent;
  applies_priority?: Priority | null;
  applies_service_type?: RequestServiceType | null;
  notify_channels: string[];
  notify_assignee?: boolean;
  notify_assignee_manager?: boolean;
  notify_custom_user_ids?: number[] | null;
  notify_custom_addresses?: string[] | null;
  template_key?: string | null;
  active?: boolean;
}

export interface SlaNotificationPolicyUpdateInput {
  name?: string;
  trigger_event?: TriggerEvent;
  applies_priority?: Priority | null;
  applies_service_type?: RequestServiceType | null;
  notify_channels?: string[];
  notify_assignee?: boolean;
  notify_assignee_manager?: boolean;
  notify_custom_user_ids?: number[] | null;
  notify_custom_addresses?: string[] | null;
  template_key?: string | null;
  active?: boolean;
}

export interface SlaNotificationPolicyListResponse {
  items: SlaNotificationPolicy[];
  total: number;
  page: number;
  page_size: number;
}

// ── Scheduler ─────────────────────────────────────────────
export interface SchedulerJob {
  job_id: string;
  description: string;
  interval_seconds: number;
  default_interval_seconds: number;
  min_interval_seconds: number;
  max_interval_seconds: number;
  paused: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  override_updated_at: string | null;
  override_updated_by: number | null;
}

export interface SchedulerJobListResponse {
  items: SchedulerJob[];
}

export interface SchedulerRescheduleInput {
  interval_seconds?: number;
  paused?: boolean;
}

// ── Integration Settings ──────────────────────────────────
export interface IntegrationTestResult {
  ok: boolean;
  message: string;
  tested_at: string;
}

export interface IntegrationSettings {
  slack_bot_token_set: boolean;
  slack_app_token_set: boolean;
  slack_signing_secret_set: boolean;
  slack_default_channel: string | null;
  slack_last_test: IntegrationTestResult | null;

  teams_tenant_id: string | null;
  teams_app_id: string | null;
  teams_app_password_set: boolean;
  teams_team_id: string | null;
  teams_webhook_url_set: boolean;
  teams_default_channel_id: string | null;
  teams_last_test: IntegrationTestResult | null;

  email_smtp_host: string | null;
  email_smtp_port: number | null;
  email_from: string | null;
  email_smtp_user: string | null;
  email_smtp_password_set: boolean;
  email_last_test: IntegrationTestResult | null;

  updated_at: string | null;
  updated_by: number | null;
}

export interface IntegrationSettingsUpdateInput {
  slack_bot_token?: string | null;
  slack_app_token?: string | null;
  slack_signing_secret?: string | null;
  slack_default_channel?: string | null;

  teams_tenant_id?: string | null;
  teams_app_id?: string | null;
  teams_app_password?: string | null;
  teams_team_id?: string | null;
  teams_webhook_url?: string | null;
  teams_default_channel_id?: string | null;

  email_smtp_host?: string | null;
  email_smtp_port?: number | null;
  email_from?: string | null;
  email_smtp_user?: string | null;
  email_smtp_password?: string | null;
}

export type IntegrationChannel = "slack" | "teams" | "email";

// ── Notification Log ──────────────────────────────────────
export type NotificationLogStatus = "pending" | "success" | "failure";

export const NOTIFICATION_LOG_STATUS_LABELS: Record<NotificationLogStatus, string> = {
  pending: "대기",
  success: "성공",
  failure: "실패",
};

export interface NotificationLog {
  id: string;
  ticket_id: string | null;
  event_type: string;
  channel: string;
  target_user_id: number | null;
  target_address: string | null;
  status: NotificationLogStatus;
  error: string | null;
  is_retry: boolean;
  retry_of_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
}

export interface NotificationLogFilter {
  status?: NotificationLogStatus;
  channel?: string;
  event_type?: string;
  ticket_id?: string;
  target_user_id?: number;
  since?: string;
  until?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface NotificationLogListResponse {
  items: NotificationLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface NotificationLogRetryResult {
  ok: boolean;
  message: string;
  log: NotificationLog;
}

// ── User Notification Preference (self) ───────────────────
export interface UserNotificationPref {
  user_id: number;
  slack_user_id: string | null;
  teams_user_id: string | null;
  teams_channel_override: string | null;
  email_override: string | null;
  channels: string[] | null;
  event_overrides: Record<string, unknown> | null;
  enabled: boolean;
  quiet_hours: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UserNotificationPrefUpdateInput {
  slack_user_id?: string | null;
  teams_user_id?: string | null;
  teams_channel_override?: string | null;
  email_override?: string | null;
  channels?: string[] | null;
  event_overrides?: Record<string, unknown> | null;
  enabled?: boolean;
  quiet_hours?: Record<string, unknown> | null;
}
