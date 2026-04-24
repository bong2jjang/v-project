--
-- PostgreSQL database dump
--

\restrict 45QIC7i0TXQnPR2wEUpsJZwJYbsMRSzbM7OJYxN6huiIjpIwLRaXhkny1BavEBm

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'SYSTEM_ADMIN',
    'ORG_ADMIN',
    'USER',
    'system_admin',
    'org_admin'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    platform character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    token character varying(500),
    app_token character varying(500),
    tenant_id character varying(255),
    app_id character varying(255),
    app_password character varying(500),
    team_id character varying(500),
    webhook_url text,
    ms_refresh_token text,
    ms_token_expires_at timestamp with time zone,
    ms_user_id character varying(255),
    prefix_messages_with_nick boolean,
    edit_suffix character varying(50),
    edit_disable boolean,
    use_username boolean,
    no_send_join_part boolean,
    use_api boolean,
    debug boolean,
    enabled_features text,
    is_valid boolean NOT NULL,
    validation_errors text,
    enabled boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    created_by integer,
    updated_by integer,
    CONSTRAINT account_platform_fields_check CHECK (((((platform)::text = 'slack'::text) AND (token IS NOT NULL)) OR (((platform)::text = 'teams'::text) AND (tenant_id IS NOT NULL) AND (app_id IS NOT NULL))))
);


--
-- Name: COLUMN accounts.enabled_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.enabled_features IS '활성화된 기능 목록 (JSON 배열). NULL이면 모든 기능 활성화';


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    user_id integer,
    user_email character varying(255),
    action character varying(100) NOT NULL,
    resource_type character varying(100),
    resource_id character varying(255),
    description text,
    details text,
    status character varying(50),
    error_message text,
    ip_address character varying(45),
    user_agent character varying(500),
    app_id character varying(50)
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50),
    parent_id integer,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: itsm_ai_suggestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_ai_suggestion (
    id character varying(26) NOT NULL,
    ticket_id character varying(26) NOT NULL,
    kind character varying(30) NOT NULL,
    prompt_ref character varying(100),
    result jsonb NOT NULL,
    accepted boolean,
    created_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_assignment (
    id character varying(26) NOT NULL,
    ticket_id character varying(26) NOT NULL,
    owner_id integer NOT NULL,
    role character varying(20) NOT NULL,
    assigned_at timestamp with time zone NOT NULL,
    released_at timestamp with time zone,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_contract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_contract (
    id character varying(26) NOT NULL,
    contract_no character varying(50) NOT NULL,
    customer_id character varying(26) NOT NULL,
    name character varying(200) NOT NULL,
    start_date date,
    end_date date,
    sla_tier_id character varying(26),
    status character varying(20) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_contract_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_contract_product (
    contract_id character varying(26) NOT NULL,
    product_id character varying(26) NOT NULL
);


--
-- Name: itsm_customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_customer (
    id character varying(26) NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    service_type character varying(20) NOT NULL,
    industry character varying(100),
    status character varying(20) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_customer_contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_customer_contact (
    id character varying(26) NOT NULL,
    customer_id character varying(26) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(200),
    phone character varying(50),
    role_title character varying(100),
    is_primary boolean NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: itsm_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_feedback (
    id character varying(26) NOT NULL,
    ticket_id character varying(26) NOT NULL,
    score integer,
    comment text,
    reopen boolean NOT NULL,
    submitted_by integer,
    submitted_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_integration_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_integration_settings (
    id integer NOT NULL,
    slack_bot_token_enc text,
    slack_app_token_enc text,
    slack_signing_secret_enc text,
    slack_default_channel character varying(200),
    teams_tenant_id character varying(100),
    teams_app_id character varying(100),
    teams_app_password_enc text,
    teams_team_id character varying(100),
    teams_webhook_url_enc text,
    teams_default_channel_id character varying(200),
    email_smtp_host character varying(200),
    email_smtp_port integer,
    email_from character varying(300),
    email_smtp_user_enc text,
    email_smtp_password_enc text,
    slack_last_test_at timestamp with time zone,
    slack_last_test_ok boolean,
    slack_last_test_message text,
    teams_last_test_at timestamp with time zone,
    teams_last_test_ok boolean,
    teams_last_test_message text,
    email_last_test_at timestamp with time zone,
    email_last_test_ok boolean,
    email_last_test_message text,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id character varying(26) NOT NULL,
    CONSTRAINT ck_integration_settings_singleton CHECK ((id = 1))
);


--
-- Name: itsm_integration_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itsm_integration_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itsm_integration_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.itsm_integration_settings_id_seq OWNED BY public.itsm_integration_settings.id;


--
-- Name: itsm_kpi_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_kpi_snapshot (
    id character varying(26) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    dept_id integer,
    sla_met_ratio numeric(5,2),
    mttr_minutes integer,
    reopen_ratio numeric(5,2),
    volume integer NOT NULL,
    ai_adoption_ratio numeric(5,2),
    created_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_loop_transition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_loop_transition (
    id character varying(26) NOT NULL,
    ticket_id character varying(26) NOT NULL,
    from_stage character varying(20),
    to_stage character varying(20) NOT NULL,
    action character varying(20) NOT NULL,
    actor_id integer,
    note text,
    artifacts jsonb,
    transitioned_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by integer,
    last_edited_at timestamp with time zone,
    last_edited_by integer,
    edit_count integer DEFAULT 0 NOT NULL,
    head_revision_id character varying(26),
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_loop_transition_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_loop_transition_revision (
    id character varying(26) NOT NULL,
    transition_id character varying(26) NOT NULL,
    revision_no integer NOT NULL,
    operation character varying(20) NOT NULL,
    actor_id integer,
    reason text,
    snapshot_note text,
    snapshot_artifacts jsonb,
    snapshot_from_stage character varying(20),
    snapshot_to_stage character varying(20),
    snapshot_action character varying(20),
    created_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_notification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_notification_log (
    id character varying(26) NOT NULL,
    ticket_id character varying(26),
    event_type character varying(40) NOT NULL,
    channel character varying(20) NOT NULL,
    target_user_id integer,
    target_address character varying(300) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) NOT NULL,
    error_message text,
    retry_count integer NOT NULL,
    last_retry_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_product (
    id character varying(26) NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_scheduler_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_scheduler_override (
    job_id character varying(50) NOT NULL,
    interval_seconds integer NOT NULL,
    paused boolean NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_scope_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_scope_grant (
    id character varying(26) NOT NULL,
    permission_group_id integer NOT NULL,
    service_type character varying(20),
    customer_id character varying(26),
    product_id character varying(26),
    scope_level character varying(10) NOT NULL,
    granted_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_sla_notification_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_sla_notification_policy (
    id character varying(26) NOT NULL,
    name character varying(100) NOT NULL,
    trigger_event character varying(20) NOT NULL,
    applies_priority character varying(20),
    applies_service_type character varying(20),
    notify_channels jsonb NOT NULL,
    notify_assignee boolean NOT NULL,
    notify_assignee_manager boolean NOT NULL,
    notify_custom_user_ids jsonb,
    notify_custom_addresses jsonb,
    template_key character varying(50),
    active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_sla_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_sla_policy (
    id character varying(26) NOT NULL,
    name character varying(100) NOT NULL,
    priority character varying(20) NOT NULL,
    category character varying(100),
    response_minutes integer NOT NULL,
    resolution_minutes integer NOT NULL,
    business_hours jsonb,
    active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_sla_tier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_sla_tier (
    id character varying(26) NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    priority_matrix jsonb NOT NULL,
    business_hours jsonb,
    active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_sla_timer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_sla_timer (
    id character varying(26) NOT NULL,
    ticket_id character varying(26) NOT NULL,
    kind character varying(20) NOT NULL,
    due_at timestamp with time zone NOT NULL,
    warning_sent_at timestamp with time zone,
    breached_at timestamp with time zone,
    satisfied_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_ticket (
    id character varying(26) NOT NULL,
    ticket_no character varying(32) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    source_channel character varying(20) NOT NULL,
    source_ref character varying(200),
    priority character varying(20) NOT NULL,
    category_l1 character varying(100),
    category_l2 character varying(100),
    current_stage character varying(20) NOT NULL,
    requester_id integer,
    current_owner_id integer,
    sla_policy_id character varying(26),
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    reopened_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    service_type character varying(20) DEFAULT 'internal'::character varying NOT NULL,
    customer_id character varying(26),
    product_id character varying(26),
    contract_id character varying(26),
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_ticket_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itsm_ticket_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itsm_user_notification_pref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_user_notification_pref (
    id character varying(26) NOT NULL,
    user_id integer NOT NULL,
    slack_user_id character varying(50),
    teams_user_id character varying(100),
    teams_channel_override character varying(200),
    email_override character varying(300),
    channels jsonb NOT NULL,
    event_overrides jsonb,
    enabled boolean NOT NULL,
    quiet_hours jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    workspace_id character varying(26) NOT NULL
);


--
-- Name: itsm_workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_workspace_members (
    id character varying(26) NOT NULL,
    workspace_id character varying(26) NOT NULL,
    user_id integer NOT NULL,
    role character varying(20) NOT NULL,
    is_default boolean NOT NULL,
    joined_at timestamp with time zone NOT NULL
);


--
-- Name: itsm_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itsm_workspaces (
    id character varying(26) NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    icon_url text,
    settings json NOT NULL,
    is_default boolean NOT NULL,
    created_by integer,
    created_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    permission_key character varying(100) NOT NULL,
    label character varying(200) NOT NULL,
    icon character varying(100),
    path character varying(500) NOT NULL,
    menu_type character varying(20) NOT NULL,
    iframe_url text,
    iframe_fullscreen boolean,
    open_in_new_tab boolean,
    parent_key character varying(100),
    sort_order integer,
    section character varying(20),
    app_id character varying(50),
    is_active boolean NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: message_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_stats (
    id integer NOT NULL,
    date timestamp with time zone NOT NULL,
    total_messages integer,
    gateway_stats json,
    channel_stats json,
    hourly_stats json,
    updated_at timestamp with time zone
);


--
-- Name: message_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.message_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.message_stats_id_seq OWNED BY public.message_stats.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    message_id character varying(255),
    text text NOT NULL,
    gateway character varying(100) NOT NULL,
    source_account character varying(100) NOT NULL,
    source_channel character varying(100) NOT NULL,
    source_user character varying(100),
    source_user_name character varying(255),
    source_user_display_name character varying(255),
    destination_account character varying(100) NOT NULL,
    destination_channel character varying(100) NOT NULL,
    source_channel_name character varying(255),
    destination_channel_name character varying(255),
    protocol character varying(50),
    "timestamp" timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    has_attachment boolean,
    attachment_count integer,
    attachment_details json,
    message_type character varying(50),
    message_format character varying(50),
    status character varying(20) NOT NULL,
    error_message text,
    retry_count integer,
    delivered_at timestamp with time zone
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notification_app_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_app_overrides (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    app_id character varying(50) NOT NULL,
    is_active boolean NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: notification_app_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_app_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_app_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_app_overrides_id_seq OWNED BY public.notification_app_overrides.id;


--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_reads (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    user_id integer NOT NULL,
    read_at timestamp with time zone NOT NULL
);


--
-- Name: notification_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_reads_id_seq OWNED BY public.notification_reads.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    severity character varying(20) NOT NULL,
    category character varying(50) NOT NULL,
    scope character varying(20) NOT NULL,
    app_id character varying(50),
    target_role character varying(50),
    target_user_id integer,
    source character varying(100),
    link character varying(500),
    metadata json,
    is_active boolean NOT NULL,
    is_system boolean NOT NULL,
    delivery_type character varying(20) NOT NULL,
    expires_at timestamp with time zone,
    created_by integer,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    token character varying(255) NOT NULL,
    user_id integer NOT NULL,
    is_used boolean NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: permission_group_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_group_grants (
    id integer NOT NULL,
    permission_group_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    access_level character varying(10) DEFAULT 'none'::character varying NOT NULL
);


--
-- Name: permission_group_grants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_group_grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_group_grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_group_grants_id_seq OWNED BY public.permission_group_grants.id;


--
-- Name: permission_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_groups (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    app_id character varying(50),
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permission_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_groups_id_seq OWNED BY public.permission_groups.id;


--
-- Name: portal_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_apps (
    id integer NOT NULL,
    app_id character varying(50) NOT NULL,
    display_name character varying(200) NOT NULL,
    description text,
    icon character varying(50),
    frontend_url character varying(500) NOT NULL,
    api_url character varying(500) NOT NULL,
    health_endpoint character varying(200),
    sort_order integer,
    is_active boolean NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: portal_apps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.portal_apps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portal_apps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portal_apps_id_seq OWNED BY public.portal_apps.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    device_fingerprint character varying(128),
    device_name character varying(256),
    ip_address character varying(45),
    expires_at timestamp with time zone NOT NULL,
    is_revoked boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone NOT NULL,
    app_id character varying(64),
    revoked_at timestamp with time zone
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    manual_enabled boolean NOT NULL,
    manual_url character varying NOT NULL,
    support_email character varying,
    support_url character varying,
    default_start_page character varying(255) DEFAULT '/'::character varying NOT NULL,
    app_title character varying(200),
    app_description character varying(500),
    app_logo_url character varying(500),
    app_id character varying(50)
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: ui_builder_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_builder_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_path character varying(500) NOT NULL,
    content text NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: ui_builder_dashboard_widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_builder_dashboard_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dashboard_id uuid NOT NULL,
    call_id character varying(64) NOT NULL,
    tool character varying(100) NOT NULL,
    component character varying(100) NOT NULL,
    props jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_message_id uuid,
    source_call_id character varying(64),
    grid_x integer DEFAULT 0 NOT NULL,
    grid_y integer DEFAULT 0 NOT NULL,
    grid_w integer DEFAULT 6 NOT NULL,
    grid_h integer DEFAULT 4 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(16) DEFAULT 'chat'::character varying NOT NULL,
    category character varying(32)
);


--
-- Name: ui_builder_dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_builder_dashboards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name character varying(200) DEFAULT 'Dashboard'::character varying NOT NULL,
    description text,
    layout_cols integer DEFAULT 12 NOT NULL,
    row_height integer DEFAULT 64 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ui_builder_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_builder_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tokens_in integer,
    tokens_out integer,
    created_at timestamp with time zone NOT NULL,
    ui_calls jsonb DEFAULT '[]'::jsonb NOT NULL,
    scope character varying(16) DEFAULT 'project'::character varying NOT NULL,
    dashboard_id uuid
);


--
-- Name: ui_builder_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_builder_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    template character varying(50) NOT NULL,
    llm_provider character varying(50) NOT NULL,
    llm_model character varying(100),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    current_snapshot_id uuid,
    project_type character varying(32) DEFAULT 'sandpack'::character varying NOT NULL
);


--
-- Name: ui_builder_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ui_builder_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    slug character varying(32) NOT NULL,
    title character varying(200) NOT NULL,
    files jsonb NOT NULL,
    message_id uuid,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: uploaded_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploaded_files (
    id character varying(36) NOT NULL,
    content bytea NOT NULL,
    mime_type character varying(100) NOT NULL,
    size integer NOT NULL,
    purpose character varying(32) NOT NULL,
    uploaded_by integer,
    uploaded_at timestamp with time zone NOT NULL
);


--
-- Name: user_group_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_group_memberships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_group_id integer NOT NULL,
    assigned_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_group_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_group_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_group_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_group_memberships_id_seq OWNED BY public.user_group_memberships.id;


--
-- Name: user_oauth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_oauth_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    account_id integer NOT NULL,
    platform character varying(50) NOT NULL,
    access_token text,
    refresh_token text NOT NULL,
    token_expires_at timestamp with time zone,
    platform_user_id character varying(255),
    platform_user_name character varying(255),
    platform_email character varying(255),
    scopes text,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: user_oauth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_oauth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_oauth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_oauth_tokens_id_seq OWNED BY public.user_oauth_tokens.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    access_level character varying(10) NOT NULL,
    granted_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    role public.userrole NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    last_login timestamp with time zone,
    sso_provider character varying(50),
    sso_provider_id character varying(255),
    auth_method character varying(20),
    start_page character varying(255) DEFAULT ''::character varying NOT NULL,
    theme character varying(20) DEFAULT 'system'::character varying NOT NULL,
    color_preset character varying(20) DEFAULT 'blue'::character varying NOT NULL,
    company_id integer,
    department_id integer,
    avatar_url character varying(500)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: itsm_integration_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_integration_settings ALTER COLUMN id SET DEFAULT nextval('public.itsm_integration_settings_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: message_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_stats ALTER COLUMN id SET DEFAULT nextval('public.message_stats_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notification_app_overrides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_app_overrides ALTER COLUMN id SET DEFAULT nextval('public.notification_app_overrides_id_seq'::regclass);


--
-- Name: notification_reads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads ALTER COLUMN id SET DEFAULT nextval('public.notification_reads_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: permission_group_grants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_group_grants ALTER COLUMN id SET DEFAULT nextval('public.permission_group_grants_id_seq'::regclass);


--
-- Name: permission_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_groups ALTER COLUMN id SET DEFAULT nextval('public.permission_groups_id_seq'::regclass);


--
-- Name: portal_apps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_apps ALTER COLUMN id SET DEFAULT nextval('public.portal_apps_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: user_group_memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships ALTER COLUMN id SET DEFAULT nextval('public.user_group_memberships_id_seq'::regclass);


--
-- Name: user_oauth_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_oauth_tokens ALTER COLUMN id SET DEFAULT nextval('public.user_oauth_tokens_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_code_key UNIQUE (code);


--
-- Name: companies companies_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_name_key UNIQUE (name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: itsm_ai_suggestion itsm_ai_suggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ai_suggestion
    ADD CONSTRAINT itsm_ai_suggestion_pkey PRIMARY KEY (id);


--
-- Name: itsm_assignment itsm_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_assignment
    ADD CONSTRAINT itsm_assignment_pkey PRIMARY KEY (id);


--
-- Name: itsm_contract itsm_contract_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract
    ADD CONSTRAINT itsm_contract_contract_no_key UNIQUE (contract_no);


--
-- Name: itsm_contract itsm_contract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract
    ADD CONSTRAINT itsm_contract_pkey PRIMARY KEY (id);


--
-- Name: itsm_contract_product itsm_contract_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract_product
    ADD CONSTRAINT itsm_contract_product_pkey PRIMARY KEY (contract_id, product_id);


--
-- Name: itsm_customer itsm_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_customer
    ADD CONSTRAINT itsm_customer_code_key UNIQUE (code);


--
-- Name: itsm_customer_contact itsm_customer_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_customer_contact
    ADD CONSTRAINT itsm_customer_contact_pkey PRIMARY KEY (id);


--
-- Name: itsm_customer itsm_customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_customer
    ADD CONSTRAINT itsm_customer_pkey PRIMARY KEY (id);


--
-- Name: itsm_feedback itsm_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_feedback
    ADD CONSTRAINT itsm_feedback_pkey PRIMARY KEY (id);


--
-- Name: itsm_integration_settings itsm_integration_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_integration_settings
    ADD CONSTRAINT itsm_integration_settings_pkey PRIMARY KEY (id);


--
-- Name: itsm_kpi_snapshot itsm_kpi_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_kpi_snapshot
    ADD CONSTRAINT itsm_kpi_snapshot_pkey PRIMARY KEY (id);


--
-- Name: itsm_loop_transition itsm_loop_transition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT itsm_loop_transition_pkey PRIMARY KEY (id);


--
-- Name: itsm_loop_transition_revision itsm_loop_transition_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition_revision
    ADD CONSTRAINT itsm_loop_transition_revision_pkey PRIMARY KEY (id);


--
-- Name: itsm_notification_log itsm_notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_notification_log
    ADD CONSTRAINT itsm_notification_log_pkey PRIMARY KEY (id);


--
-- Name: itsm_product itsm_product_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_product
    ADD CONSTRAINT itsm_product_code_key UNIQUE (code);


--
-- Name: itsm_product itsm_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_product
    ADD CONSTRAINT itsm_product_pkey PRIMARY KEY (id);


--
-- Name: itsm_scheduler_override itsm_scheduler_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scheduler_override
    ADD CONSTRAINT itsm_scheduler_override_pkey PRIMARY KEY (job_id);


--
-- Name: itsm_scope_grant itsm_scope_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT itsm_scope_grant_pkey PRIMARY KEY (id);


--
-- Name: itsm_sla_notification_policy itsm_sla_notification_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_notification_policy
    ADD CONSTRAINT itsm_sla_notification_policy_pkey PRIMARY KEY (id);


--
-- Name: itsm_sla_policy itsm_sla_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_policy
    ADD CONSTRAINT itsm_sla_policy_pkey PRIMARY KEY (id);


--
-- Name: itsm_sla_tier itsm_sla_tier_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_tier
    ADD CONSTRAINT itsm_sla_tier_code_key UNIQUE (code);


--
-- Name: itsm_sla_tier itsm_sla_tier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_tier
    ADD CONSTRAINT itsm_sla_tier_pkey PRIMARY KEY (id);


--
-- Name: itsm_sla_timer itsm_sla_timer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_timer
    ADD CONSTRAINT itsm_sla_timer_pkey PRIMARY KEY (id);


--
-- Name: itsm_ticket itsm_ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_pkey PRIMARY KEY (id);


--
-- Name: itsm_user_notification_pref itsm_user_notification_pref_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_user_notification_pref
    ADD CONSTRAINT itsm_user_notification_pref_pkey PRIMARY KEY (id);


--
-- Name: itsm_user_notification_pref itsm_user_notification_pref_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_user_notification_pref
    ADD CONSTRAINT itsm_user_notification_pref_user_id_key UNIQUE (user_id);


--
-- Name: itsm_workspace_members itsm_workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspace_members
    ADD CONSTRAINT itsm_workspace_members_pkey PRIMARY KEY (id);


--
-- Name: itsm_workspaces itsm_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspaces
    ADD CONSTRAINT itsm_workspaces_pkey PRIMARY KEY (id);


--
-- Name: itsm_workspaces itsm_workspaces_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspaces
    ADD CONSTRAINT itsm_workspaces_slug_key UNIQUE (slug);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: message_stats message_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_stats
    ADD CONSTRAINT message_stats_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notification_app_overrides notification_app_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_app_overrides
    ADD CONSTRAINT notification_app_overrides_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: permission_group_grants permission_group_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT permission_group_grants_pkey PRIMARY KEY (id);


--
-- Name: permission_groups permission_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT permission_groups_pkey PRIMARY KEY (id);


--
-- Name: portal_apps portal_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_apps
    ADD CONSTRAINT portal_apps_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: ui_builder_artifacts ui_builder_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_artifacts
    ADD CONSTRAINT ui_builder_artifacts_pkey PRIMARY KEY (id);


--
-- Name: ui_builder_artifacts ui_builder_artifacts_project_id_file_path_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_artifacts
    ADD CONSTRAINT ui_builder_artifacts_project_id_file_path_version_key UNIQUE (project_id, file_path, version);


--
-- Name: ui_builder_dashboard_widgets ui_builder_dashboard_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboard_widgets
    ADD CONSTRAINT ui_builder_dashboard_widgets_pkey PRIMARY KEY (id);


--
-- Name: ui_builder_dashboards ui_builder_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboards
    ADD CONSTRAINT ui_builder_dashboards_pkey PRIMARY KEY (id);


--
-- Name: ui_builder_messages ui_builder_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_messages
    ADD CONSTRAINT ui_builder_messages_pkey PRIMARY KEY (id);


--
-- Name: ui_builder_projects ui_builder_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_projects
    ADD CONSTRAINT ui_builder_projects_pkey PRIMARY KEY (id);


--
-- Name: ui_builder_snapshots ui_builder_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_snapshots
    ADD CONSTRAINT ui_builder_snapshots_pkey PRIMARY KEY (id);


--
-- Name: uploaded_files uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: departments uq_company_dept; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uq_company_dept UNIQUE (company_id, name);


--
-- Name: permission_group_grants uq_group_menu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT uq_group_menu UNIQUE (permission_group_id, menu_item_id);


--
-- Name: itsm_kpi_snapshot uq_itsm_kpi_period_dept; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_kpi_snapshot
    ADD CONSTRAINT uq_itsm_kpi_period_dept UNIQUE (period_start, period_end, dept_id);


--
-- Name: itsm_scope_grant uq_itsm_scope_grant_ws_tuple; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT uq_itsm_scope_grant_ws_tuple UNIQUE (workspace_id, permission_group_id, service_type, customer_id, product_id);


--
-- Name: itsm_sla_policy uq_itsm_sla_policy_priority_cat; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_policy
    ADD CONSTRAINT uq_itsm_sla_policy_priority_cat UNIQUE (priority, category);


--
-- Name: itsm_sla_timer uq_itsm_sla_timer_ticket_kind; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_timer
    ADD CONSTRAINT uq_itsm_sla_timer_ticket_kind UNIQUE (ticket_id, kind);


--
-- Name: itsm_loop_transition_revision uq_itsm_transition_revision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition_revision
    ADD CONSTRAINT uq_itsm_transition_revision UNIQUE (transition_id, revision_no);


--
-- Name: itsm_user_notification_pref uq_itsm_user_notification_pref_user_ws; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_user_notification_pref
    ADD CONSTRAINT uq_itsm_user_notification_pref_user_ws UNIQUE (user_id, workspace_id);


--
-- Name: itsm_workspace_members uq_itsm_ws_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspace_members
    ADD CONSTRAINT uq_itsm_ws_member UNIQUE (workspace_id, user_id);


--
-- Name: ui_builder_dashboards uq_ui_builder_dashboards_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboards
    ADD CONSTRAINT uq_ui_builder_dashboards_project UNIQUE (project_id);


--
-- Name: ui_builder_snapshots uq_ui_builder_snapshots_project_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_snapshots
    ADD CONSTRAINT uq_ui_builder_snapshots_project_slug UNIQUE (project_id, slug);


--
-- Name: ui_builder_dashboard_widgets uq_ui_builder_widget_call_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboard_widgets
    ADD CONSTRAINT uq_ui_builder_widget_call_id UNIQUE (dashboard_id, call_id);


--
-- Name: user_oauth_tokens uq_user_account_oauth; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT uq_user_account_oauth UNIQUE (user_id, account_id);


--
-- Name: user_group_memberships uq_user_group; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT uq_user_group UNIQUE (user_id, permission_group_id);


--
-- Name: user_permissions uq_user_menu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT uq_user_menu UNIQUE (user_id, menu_item_id);


--
-- Name: user_group_memberships user_group_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_pkey PRIMARY KEY (id);


--
-- Name: user_oauth_tokens user_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT user_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_destination_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_destination_channel ON public.messages USING btree (destination_channel);


--
-- Name: idx_gateway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gateway ON public.messages USING btree (gateway);


--
-- Name: idx_notifications_active_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_active_created ON public.notifications USING btree (is_active, created_at);


--
-- Name: idx_notifications_scope_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_scope_app ON public.notifications USING btree (scope, app_id);


--
-- Name: idx_source_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_channel ON public.messages USING btree (source_channel);


--
-- Name: idx_source_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_user ON public.messages USING btree (source_user);


--
-- Name: idx_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status ON public.messages USING btree (status);


--
-- Name: idx_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timestamp ON public.messages USING btree ("timestamp");


--
-- Name: idx_ui_builder_artifacts_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_artifacts_project ON public.ui_builder_artifacts USING btree (project_id, file_path, version);


--
-- Name: idx_ui_builder_messages_dashboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_messages_dashboard ON public.ui_builder_messages USING btree (dashboard_id, created_at) WHERE (dashboard_id IS NOT NULL);


--
-- Name: idx_ui_builder_messages_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_messages_project ON public.ui_builder_messages USING btree (project_id, created_at);


--
-- Name: idx_ui_builder_projects_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_projects_user_type ON public.ui_builder_projects USING btree (user_id, project_type, updated_at DESC);


--
-- Name: idx_ui_builder_snapshots_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_snapshots_project ON public.ui_builder_snapshots USING btree (project_id, created_at);


--
-- Name: idx_ui_builder_widgets_dashboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_widgets_dashboard ON public.ui_builder_dashboard_widgets USING btree (dashboard_id, created_at);


--
-- Name: idx_ui_builder_widgets_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ui_builder_widgets_source ON public.ui_builder_dashboard_widgets USING btree (dashboard_id, source);


--
-- Name: idx_user_oauth_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_oauth_account ON public.user_oauth_tokens USING btree (account_id);


--
-- Name: idx_user_oauth_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_oauth_active ON public.user_oauth_tokens USING btree (is_active);


--
-- Name: idx_user_oauth_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_oauth_platform ON public.user_oauth_tokens USING btree (platform);


--
-- Name: idx_user_oauth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_oauth_user ON public.user_oauth_tokens USING btree (user_id);


--
-- Name: ix_accounts_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_enabled ON public.accounts USING btree (enabled);


--
-- Name: ix_accounts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_id ON public.accounts USING btree (id);


--
-- Name: ix_accounts_is_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_is_valid ON public.accounts USING btree (is_valid);


--
-- Name: ix_accounts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_accounts_name ON public.accounts USING btree (name);


--
-- Name: ix_accounts_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_platform ON public.accounts USING btree (platform);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_action_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_action_timestamp ON public.audit_logs USING btree (action, "timestamp");


--
-- Name: ix_audit_logs_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_app_id ON public.audit_logs USING btree (app_id);


--
-- Name: ix_audit_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_id ON public.audit_logs USING btree (id);


--
-- Name: ix_audit_logs_resource_type_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_resource_type_timestamp ON public.audit_logs USING btree (resource_type, "timestamp");


--
-- Name: ix_audit_logs_status_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_status_timestamp ON public.audit_logs USING btree (status, "timestamp");


--
-- Name: ix_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: ix_audit_logs_user_email_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_user_email_timestamp ON public.audit_logs USING btree (user_email, "timestamp");


--
-- Name: ix_inlog_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inlog_created_desc ON public.itsm_notification_log USING btree (created_at);


--
-- Name: ix_inlog_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inlog_event ON public.itsm_notification_log USING btree (event_type);


--
-- Name: ix_inlog_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inlog_status_created ON public.itsm_notification_log USING btree (status, created_at);


--
-- Name: ix_inlog_target_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inlog_target_user ON public.itsm_notification_log USING btree (target_user_id);


--
-- Name: ix_inlog_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inlog_ticket ON public.itsm_notification_log USING btree (ticket_id);


--
-- Name: ix_itsm_ai_suggestion_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ai_suggestion_kind ON public.itsm_ai_suggestion USING btree (kind);


--
-- Name: ix_itsm_ai_suggestion_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ai_suggestion_ticket ON public.itsm_ai_suggestion USING btree (ticket_id, created_at);


--
-- Name: ix_itsm_assignment_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_assignment_owner ON public.itsm_assignment USING btree (owner_id);


--
-- Name: ix_itsm_assignment_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_assignment_ticket ON public.itsm_assignment USING btree (ticket_id, assigned_at);


--
-- Name: ix_itsm_assignment_ws_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_assignment_ws_assigned ON public.itsm_assignment USING btree (workspace_id, assigned_at DESC);


--
-- Name: ix_itsm_contract_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_contract_customer ON public.itsm_contract USING btree (customer_id);


--
-- Name: ix_itsm_contract_sla_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_contract_sla_tier ON public.itsm_contract USING btree (sla_tier_id);


--
-- Name: ix_itsm_contract_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_contract_status ON public.itsm_contract USING btree (status);


--
-- Name: ix_itsm_customer_contact_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_customer_contact_customer ON public.itsm_customer_contact USING btree (customer_id);


--
-- Name: ix_itsm_customer_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_customer_service_type ON public.itsm_customer USING btree (service_type);


--
-- Name: ix_itsm_customer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_customer_status ON public.itsm_customer USING btree (status);


--
-- Name: ix_itsm_customer_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_customer_ws_created ON public.itsm_customer USING btree (workspace_id, created_at DESC);


--
-- Name: ix_itsm_feedback_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_feedback_ticket ON public.itsm_feedback USING btree (ticket_id);


--
-- Name: ix_itsm_kpi_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_kpi_period ON public.itsm_kpi_snapshot USING btree (period_start, period_end);


--
-- Name: ix_itsm_kpi_snapshot_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_kpi_snapshot_ws_created ON public.itsm_kpi_snapshot USING btree (workspace_id, created_at DESC);


--
-- Name: ix_itsm_loop_transition_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_loop_transition_deleted ON public.itsm_loop_transition USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: ix_itsm_loop_transition_revision_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_loop_transition_revision_actor ON public.itsm_loop_transition_revision USING btree (actor_id, created_at);


--
-- Name: ix_itsm_loop_transition_revision_tid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_loop_transition_revision_tid ON public.itsm_loop_transition_revision USING btree (transition_id, revision_no);


--
-- Name: ix_itsm_loop_transition_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_loop_transition_ticket ON public.itsm_loop_transition USING btree (ticket_id, transitioned_at);


--
-- Name: ix_itsm_loop_transition_ws_transitioned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_loop_transition_ws_transitioned ON public.itsm_loop_transition USING btree (workspace_id, transitioned_at DESC);


--
-- Name: ix_itsm_notification_log_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_notification_log_ws_created ON public.itsm_notification_log USING btree (workspace_id, created_at DESC);


--
-- Name: ix_itsm_scope_grant_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_scope_grant_customer ON public.itsm_scope_grant USING btree (customer_id);


--
-- Name: ix_itsm_scope_grant_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_scope_grant_group ON public.itsm_scope_grant USING btree (permission_group_id);


--
-- Name: ix_itsm_scope_grant_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_scope_grant_product ON public.itsm_scope_grant USING btree (product_id);


--
-- Name: ix_itsm_scope_grant_ws_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_scope_grant_ws_group ON public.itsm_scope_grant USING btree (workspace_id, permission_group_id);


--
-- Name: ix_itsm_sla_policy_ws_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_sla_policy_ws_active ON public.itsm_sla_policy USING btree (workspace_id, active);


--
-- Name: ix_itsm_sla_timer_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_sla_timer_due ON public.itsm_sla_timer USING btree (due_at);


--
-- Name: ix_itsm_sla_timer_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_sla_timer_ws_created ON public.itsm_sla_timer USING btree (workspace_id, created_at DESC);


--
-- Name: ix_itsm_ticket_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_customer ON public.itsm_ticket USING btree (customer_id);


--
-- Name: ix_itsm_ticket_opened_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_opened_at ON public.itsm_ticket USING btree (opened_at);


--
-- Name: ix_itsm_ticket_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_owner ON public.itsm_ticket USING btree (current_owner_id);


--
-- Name: ix_itsm_ticket_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_priority ON public.itsm_ticket USING btree (priority);


--
-- Name: ix_itsm_ticket_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_product ON public.itsm_ticket USING btree (product_id);


--
-- Name: ix_itsm_ticket_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_service_type ON public.itsm_ticket USING btree (service_type);


--
-- Name: ix_itsm_ticket_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_stage ON public.itsm_ticket USING btree (current_stage);


--
-- Name: ix_itsm_ticket_ticket_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_itsm_ticket_ticket_no ON public.itsm_ticket USING btree (ticket_no);


--
-- Name: ix_itsm_ticket_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_ws_created ON public.itsm_ticket USING btree (workspace_id, created_at DESC);


--
-- Name: ix_itsm_ticket_ws_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_ws_customer ON public.itsm_ticket USING btree (workspace_id, customer_id);


--
-- Name: ix_itsm_ticket_ws_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ticket_ws_stage ON public.itsm_ticket USING btree (workspace_id, current_stage);


--
-- Name: ix_itsm_workspaces_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_workspaces_slug ON public.itsm_workspaces USING btree (slug);


--
-- Name: ix_itsm_ws_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ws_members_user ON public.itsm_workspace_members USING btree (user_id);


--
-- Name: ix_itsm_ws_members_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_itsm_ws_members_ws ON public.itsm_workspace_members USING btree (workspace_id);


--
-- Name: ix_menu_items_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_menu_items_app_id ON public.menu_items USING btree (app_id);


--
-- Name: ix_menu_items_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_menu_items_sort_order ON public.menu_items USING btree (sort_order);


--
-- Name: ix_message_stats_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_message_stats_date ON public.message_stats USING btree (date);


--
-- Name: ix_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: ix_messages_destination_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_destination_channel ON public.messages USING btree (destination_channel);


--
-- Name: ix_messages_gateway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_gateway ON public.messages USING btree (gateway);


--
-- Name: ix_messages_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_message_id ON public.messages USING btree (message_id);


--
-- Name: ix_messages_source_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_source_channel ON public.messages USING btree (source_channel);


--
-- Name: ix_messages_source_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_source_user ON public.messages USING btree (source_user);


--
-- Name: ix_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_status ON public.messages USING btree (status);


--
-- Name: ix_messages_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_timestamp ON public.messages USING btree ("timestamp");


--
-- Name: ix_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: ix_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: ix_permission_groups_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_permission_groups_app_id ON public.permission_groups USING btree (app_id);


--
-- Name: ix_portal_apps_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_portal_apps_app_id ON public.portal_apps USING btree (app_id);


--
-- Name: ix_portal_apps_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_portal_apps_is_active ON public.portal_apps USING btree (is_active);


--
-- Name: ix_refresh_tokens_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_app_id ON public.refresh_tokens USING btree (app_id);


--
-- Name: ix_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: ix_refresh_tokens_is_revoked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_is_revoked ON public.refresh_tokens USING btree (is_revoked);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_snp_trigger_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_snp_trigger_active ON public.itsm_sla_notification_policy USING btree (trigger_event, active);


--
-- Name: ix_system_settings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_system_settings_id ON public.system_settings USING btree (id);


--
-- Name: ix_ui_builder_projects_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ui_builder_projects_user_id ON public.ui_builder_projects USING btree (user_id);


--
-- Name: ix_uploaded_files_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_uploaded_files_purpose ON public.uploaded_files USING btree (purpose);


--
-- Name: ix_uploaded_files_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_uploaded_files_uploaded_by ON public.uploaded_files USING btree (uploaded_by);


--
-- Name: ix_user_oauth_tokens_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_oauth_tokens_id ON public.user_oauth_tokens USING btree (id);


--
-- Name: ix_user_oauth_tokens_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_oauth_tokens_is_active ON public.user_oauth_tokens USING btree (is_active);


--
-- Name: ix_user_oauth_tokens_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_oauth_tokens_platform ON public.user_oauth_tokens USING btree (platform);


--
-- Name: ix_user_permissions_menu_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_permissions_menu_item_id ON public.user_permissions USING btree (menu_item_id);


--
-- Name: ix_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_is_active ON public.users USING btree (is_active);


--
-- Name: ix_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_role ON public.users USING btree (role);


--
-- Name: uq_itsm_ws_member_user_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_itsm_ws_member_user_default ON public.itsm_workspace_members USING btree (user_id) WHERE (is_default = true);


--
-- Name: uq_menu_items_key_app_path; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_menu_items_key_app_path ON public.menu_items USING btree (permission_key, COALESCE(app_id, ''::character varying), path);


--
-- Name: uq_notification_app_override; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notification_app_override ON public.notification_app_overrides USING btree (notification_id, app_id);


--
-- Name: uq_notification_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notification_user_read ON public.notification_reads USING btree (notification_id, user_id);


--
-- Name: uq_permission_groups_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_permission_groups_name ON public.permission_groups USING btree (name);


--
-- Name: uq_permission_groups_name_app; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_permission_groups_name_app ON public.permission_groups USING btree (name, COALESCE(app_id, ''::character varying));


--
-- Name: uq_pgg_group_menu; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_pgg_group_menu ON public.permission_group_grants USING btree (permission_group_id, menu_item_id);


--
-- Name: accounts accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: accounts accounts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: itsm_ai_suggestion fk_itsm_ai_suggestion_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ai_suggestion
    ADD CONSTRAINT fk_itsm_ai_suggestion_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_assignment fk_itsm_assignment_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_assignment
    ADD CONSTRAINT fk_itsm_assignment_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_contract fk_itsm_contract_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract
    ADD CONSTRAINT fk_itsm_contract_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_customer fk_itsm_customer_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_customer
    ADD CONSTRAINT fk_itsm_customer_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_feedback fk_itsm_feedback_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_feedback
    ADD CONSTRAINT fk_itsm_feedback_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_integration_settings fk_itsm_integration_settings_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_integration_settings
    ADD CONSTRAINT fk_itsm_integration_settings_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_kpi_snapshot fk_itsm_kpi_snapshot_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_kpi_snapshot
    ADD CONSTRAINT fk_itsm_kpi_snapshot_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_loop_transition_revision fk_itsm_loop_transition_revision_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition_revision
    ADD CONSTRAINT fk_itsm_loop_transition_revision_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_loop_transition fk_itsm_loop_transition_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT fk_itsm_loop_transition_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_notification_log fk_itsm_notification_log_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_notification_log
    ADD CONSTRAINT fk_itsm_notification_log_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_product fk_itsm_product_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_product
    ADD CONSTRAINT fk_itsm_product_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_scheduler_override fk_itsm_scheduler_override_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scheduler_override
    ADD CONSTRAINT fk_itsm_scheduler_override_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_scope_grant fk_itsm_scope_grant_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT fk_itsm_scope_grant_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_sla_notification_policy fk_itsm_sla_notification_policy_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_notification_policy
    ADD CONSTRAINT fk_itsm_sla_notification_policy_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_sla_policy fk_itsm_sla_policy_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_policy
    ADD CONSTRAINT fk_itsm_sla_policy_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_sla_tier fk_itsm_sla_tier_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_tier
    ADD CONSTRAINT fk_itsm_sla_tier_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_sla_timer fk_itsm_sla_timer_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_timer
    ADD CONSTRAINT fk_itsm_sla_timer_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_ticket fk_itsm_ticket_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT fk_itsm_ticket_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_user_notification_pref fk_itsm_user_notification_pref_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_user_notification_pref
    ADD CONSTRAINT fk_itsm_user_notification_pref_workspace FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE RESTRICT;


--
-- Name: itsm_ai_suggestion itsm_ai_suggestion_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ai_suggestion
    ADD CONSTRAINT itsm_ai_suggestion_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.itsm_ticket(id) ON DELETE CASCADE;


--
-- Name: itsm_ai_suggestion itsm_ai_suggestion_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ai_suggestion
    ADD CONSTRAINT itsm_ai_suggestion_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_assignment itsm_assignment_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_assignment
    ADD CONSTRAINT itsm_assignment_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: itsm_assignment itsm_assignment_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_assignment
    ADD CONSTRAINT itsm_assignment_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.itsm_ticket(id) ON DELETE CASCADE;


--
-- Name: itsm_assignment itsm_assignment_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_assignment
    ADD CONSTRAINT itsm_assignment_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_contract itsm_contract_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract
    ADD CONSTRAINT itsm_contract_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.itsm_customer(id);


--
-- Name: itsm_contract_product itsm_contract_product_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract_product
    ADD CONSTRAINT itsm_contract_product_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.itsm_contract(id) ON DELETE CASCADE;


--
-- Name: itsm_contract_product itsm_contract_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract_product
    ADD CONSTRAINT itsm_contract_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.itsm_product(id);


--
-- Name: itsm_contract itsm_contract_sla_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract
    ADD CONSTRAINT itsm_contract_sla_tier_id_fkey FOREIGN KEY (sla_tier_id) REFERENCES public.itsm_sla_tier(id);


--
-- Name: itsm_contract itsm_contract_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_contract
    ADD CONSTRAINT itsm_contract_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_customer_contact itsm_customer_contact_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_customer_contact
    ADD CONSTRAINT itsm_customer_contact_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.itsm_customer(id) ON DELETE CASCADE;


--
-- Name: itsm_customer itsm_customer_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_customer
    ADD CONSTRAINT itsm_customer_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_feedback itsm_feedback_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_feedback
    ADD CONSTRAINT itsm_feedback_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: itsm_feedback itsm_feedback_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_feedback
    ADD CONSTRAINT itsm_feedback_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.itsm_ticket(id) ON DELETE CASCADE;


--
-- Name: itsm_feedback itsm_feedback_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_feedback
    ADD CONSTRAINT itsm_feedback_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_integration_settings itsm_integration_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_integration_settings
    ADD CONSTRAINT itsm_integration_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: itsm_integration_settings itsm_integration_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_integration_settings
    ADD CONSTRAINT itsm_integration_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_kpi_snapshot itsm_kpi_snapshot_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_kpi_snapshot
    ADD CONSTRAINT itsm_kpi_snapshot_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id);


--
-- Name: itsm_kpi_snapshot itsm_kpi_snapshot_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_kpi_snapshot
    ADD CONSTRAINT itsm_kpi_snapshot_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_loop_transition itsm_loop_transition_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT itsm_loop_transition_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: itsm_loop_transition itsm_loop_transition_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT itsm_loop_transition_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: itsm_loop_transition itsm_loop_transition_last_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT itsm_loop_transition_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES public.users(id);


--
-- Name: itsm_loop_transition_revision itsm_loop_transition_revision_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition_revision
    ADD CONSTRAINT itsm_loop_transition_revision_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: itsm_loop_transition_revision itsm_loop_transition_revision_transition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition_revision
    ADD CONSTRAINT itsm_loop_transition_revision_transition_id_fkey FOREIGN KEY (transition_id) REFERENCES public.itsm_loop_transition(id) ON DELETE CASCADE;


--
-- Name: itsm_loop_transition_revision itsm_loop_transition_revision_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition_revision
    ADD CONSTRAINT itsm_loop_transition_revision_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_loop_transition itsm_loop_transition_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT itsm_loop_transition_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.itsm_ticket(id) ON DELETE CASCADE;


--
-- Name: itsm_loop_transition itsm_loop_transition_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_loop_transition
    ADD CONSTRAINT itsm_loop_transition_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_notification_log itsm_notification_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_notification_log
    ADD CONSTRAINT itsm_notification_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: itsm_notification_log itsm_notification_log_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_notification_log
    ADD CONSTRAINT itsm_notification_log_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.itsm_ticket(id) ON DELETE SET NULL;


--
-- Name: itsm_notification_log itsm_notification_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_notification_log
    ADD CONSTRAINT itsm_notification_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_product itsm_product_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_product
    ADD CONSTRAINT itsm_product_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_scheduler_override itsm_scheduler_override_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scheduler_override
    ADD CONSTRAINT itsm_scheduler_override_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: itsm_scheduler_override itsm_scheduler_override_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scheduler_override
    ADD CONSTRAINT itsm_scheduler_override_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_scope_grant itsm_scope_grant_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT itsm_scope_grant_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.itsm_customer(id);


--
-- Name: itsm_scope_grant itsm_scope_grant_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT itsm_scope_grant_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: itsm_scope_grant itsm_scope_grant_permission_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT itsm_scope_grant_permission_group_id_fkey FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: itsm_scope_grant itsm_scope_grant_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT itsm_scope_grant_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.itsm_product(id);


--
-- Name: itsm_scope_grant itsm_scope_grant_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_scope_grant
    ADD CONSTRAINT itsm_scope_grant_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_sla_notification_policy itsm_sla_notification_policy_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_notification_policy
    ADD CONSTRAINT itsm_sla_notification_policy_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_sla_policy itsm_sla_policy_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_policy
    ADD CONSTRAINT itsm_sla_policy_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_sla_tier itsm_sla_tier_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_tier
    ADD CONSTRAINT itsm_sla_tier_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_sla_timer itsm_sla_timer_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_timer
    ADD CONSTRAINT itsm_sla_timer_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.itsm_ticket(id) ON DELETE CASCADE;


--
-- Name: itsm_sla_timer itsm_sla_timer_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_sla_timer
    ADD CONSTRAINT itsm_sla_timer_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_ticket itsm_ticket_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.itsm_contract(id);


--
-- Name: itsm_ticket itsm_ticket_current_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_current_owner_id_fkey FOREIGN KEY (current_owner_id) REFERENCES public.users(id);


--
-- Name: itsm_ticket itsm_ticket_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.itsm_customer(id);


--
-- Name: itsm_ticket itsm_ticket_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.itsm_product(id);


--
-- Name: itsm_ticket itsm_ticket_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- Name: itsm_ticket itsm_ticket_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.itsm_sla_policy(id);


--
-- Name: itsm_ticket itsm_ticket_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_ticket
    ADD CONSTRAINT itsm_ticket_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_user_notification_pref itsm_user_notification_pref_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_user_notification_pref
    ADD CONSTRAINT itsm_user_notification_pref_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: itsm_user_notification_pref itsm_user_notification_pref_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_user_notification_pref
    ADD CONSTRAINT itsm_user_notification_pref_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id);


--
-- Name: itsm_workspace_members itsm_workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspace_members
    ADD CONSTRAINT itsm_workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: itsm_workspace_members itsm_workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspace_members
    ADD CONSTRAINT itsm_workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.itsm_workspaces(id) ON DELETE CASCADE;


--
-- Name: itsm_workspaces itsm_workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itsm_workspaces
    ADD CONSTRAINT itsm_workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: menu_items menu_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: menu_items menu_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: notification_app_overrides notification_app_overrides_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_app_overrides
    ADD CONSTRAINT notification_app_overrides_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: permission_group_grants permission_group_grants_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT permission_group_grants_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: permission_group_grants permission_group_grants_permission_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT permission_group_grants_permission_group_id_fkey FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: permission_groups permission_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT permission_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ui_builder_artifacts ui_builder_artifacts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_artifacts
    ADD CONSTRAINT ui_builder_artifacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.ui_builder_projects(id) ON DELETE CASCADE;


--
-- Name: ui_builder_dashboard_widgets ui_builder_dashboard_widgets_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboard_widgets
    ADD CONSTRAINT ui_builder_dashboard_widgets_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.ui_builder_dashboards(id) ON DELETE CASCADE;


--
-- Name: ui_builder_dashboard_widgets ui_builder_dashboard_widgets_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboard_widgets
    ADD CONSTRAINT ui_builder_dashboard_widgets_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.ui_builder_messages(id) ON DELETE SET NULL;


--
-- Name: ui_builder_dashboards ui_builder_dashboards_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_dashboards
    ADD CONSTRAINT ui_builder_dashboards_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.ui_builder_projects(id) ON DELETE CASCADE;


--
-- Name: ui_builder_messages ui_builder_messages_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_messages
    ADD CONSTRAINT ui_builder_messages_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.ui_builder_dashboards(id) ON DELETE CASCADE;


--
-- Name: ui_builder_messages ui_builder_messages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_messages
    ADD CONSTRAINT ui_builder_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.ui_builder_projects(id) ON DELETE CASCADE;


--
-- Name: ui_builder_projects ui_builder_projects_current_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_projects
    ADD CONSTRAINT ui_builder_projects_current_snapshot_id_fkey FOREIGN KEY (current_snapshot_id) REFERENCES public.ui_builder_snapshots(id) ON DELETE SET NULL;


--
-- Name: ui_builder_projects ui_builder_projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_projects
    ADD CONSTRAINT ui_builder_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ui_builder_snapshots ui_builder_snapshots_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_snapshots
    ADD CONSTRAINT ui_builder_snapshots_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.ui_builder_messages(id) ON DELETE SET NULL;


--
-- Name: ui_builder_snapshots ui_builder_snapshots_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ui_builder_snapshots
    ADD CONSTRAINT ui_builder_snapshots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.ui_builder_projects(id) ON DELETE CASCADE;


--
-- Name: uploaded_files uploaded_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_group_memberships user_group_memberships_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_group_memberships user_group_memberships_permission_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_permission_group_id_fkey FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_oauth_tokens user_oauth_tokens_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT user_oauth_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: user_oauth_tokens user_oauth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT user_oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 45QIC7i0TXQnPR2wEUpsJZwJYbsMRSzbM7OJYxN6huiIjpIwLRaXhkny1BavEBm

