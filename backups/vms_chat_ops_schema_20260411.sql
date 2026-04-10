--
-- PostgreSQL database dump
--

\restrict fJu48L4FRq5q34hFd3Uw92LZhzABslAl9WWMxlB2qSZXr5uz96ssS5Hl6QyvhcQ

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
-- Name: userrole; Type: TYPE; Schema: public; Owner: vmsuser
--

CREATE TYPE public.userrole AS ENUM (
    'ADMIN',
    'USER',
    'SYSTEM_ADMIN',
    'ORG_ADMIN',
    'system_admin',
    'org_admin'
);


ALTER TYPE public.userrole OWNER TO vmsuser;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: vmsuser
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
    prefix_messages_with_nick boolean,
    edit_suffix character varying(50),
    edit_disable boolean,
    use_username boolean,
    no_send_join_part boolean,
    use_api boolean,
    debug boolean,
    is_valid boolean NOT NULL,
    validation_errors text,
    enabled boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    created_by integer,
    updated_by integer,
    enabled_features text,
    team_id character varying(500),
    ms_refresh_token text,
    ms_token_expires_at timestamp with time zone,
    ms_user_id character varying(255),
    webhook_url text,
    CONSTRAINT account_platform_fields_check CHECK (((((platform)::text = 'slack'::text) AND (token IS NOT NULL)) OR (((platform)::text = 'teams'::text) AND (tenant_id IS NOT NULL) AND (app_id IS NOT NULL))))
);


ALTER TABLE public.accounts OWNER TO vmsuser;

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_id_seq OWNER TO vmsuser;

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: vmsuser
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
    user_agent character varying(500)
);


ALTER TABLE public.audit_logs OWNER TO vmsuser;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO vmsuser;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.companies OWNER TO vmsuser;

--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.companies_id_seq OWNER TO vmsuser;

--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: vmsuser
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


ALTER TABLE public.departments OWNER TO vmsuser;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO vmsuser;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: gateway_channels; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.gateway_channels (
    id integer NOT NULL,
    gateway_id integer NOT NULL,
    account character varying(255) NOT NULL,
    channel character varying(255) NOT NULL,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.gateway_channels OWNER TO vmsuser;

--
-- Name: gateway_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.gateway_channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gateway_channels_id_seq OWNER TO vmsuser;

--
-- Name: gateway_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.gateway_channels_id_seq OWNED BY public.gateway_channels.id;


--
-- Name: gateways; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.gateways (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    enabled boolean NOT NULL,
    is_valid boolean NOT NULL,
    validation_errors text,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    created_by integer,
    updated_by integer
);


ALTER TABLE public.gateways OWNER TO vmsuser;

--
-- Name: gateways_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.gateways_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gateways_id_seq OWNER TO vmsuser;

--
-- Name: gateways_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.gateways_id_seq OWNED BY public.gateways.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    permission_key character varying(100) NOT NULL,
    label character varying(200) NOT NULL,
    icon character varying(100),
    path character varying(500) NOT NULL,
    menu_type character varying(20) NOT NULL,
    iframe_url text,
    open_in_new_tab boolean,
    parent_key character varying(100),
    sort_order integer,
    is_active boolean NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    iframe_fullscreen boolean DEFAULT false,
    section character varying(20) DEFAULT 'custom'::character varying
);


ALTER TABLE public.menu_items OWNER TO vmsuser;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO vmsuser;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: message_stats; Type: TABLE; Schema: public; Owner: vmsuser
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


ALTER TABLE public.message_stats OWNER TO vmsuser;

--
-- Name: message_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.message_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_stats_id_seq OWNER TO vmsuser;

--
-- Name: message_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.message_stats_id_seq OWNED BY public.message_stats.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    message_id character varying(255),
    text text NOT NULL,
    gateway character varying(100) NOT NULL,
    source_account character varying(100) NOT NULL,
    source_channel character varying(100) NOT NULL,
    source_user character varying(100),
    destination_account character varying(100) NOT NULL,
    destination_channel character varying(100) NOT NULL,
    protocol character varying(50),
    "timestamp" timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    has_attachment boolean,
    attachment_count integer,
    message_type character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    delivered_at timestamp with time zone,
    source_user_name character varying(255),
    source_user_display_name character varying(255),
    attachment_details json,
    message_format character varying(50) DEFAULT 'text'::character varying,
    source_channel_name character varying(255),
    destination_channel_name character varying(255)
);


ALTER TABLE public.messages OWNER TO vmsuser;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO vmsuser;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: vmsuser
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


ALTER TABLE public.password_reset_tokens OWNER TO vmsuser;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO vmsuser;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: permission_group_grants; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.permission_group_grants (
    id integer NOT NULL,
    permission_group_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    access_level character varying(10) DEFAULT 'none'::character varying NOT NULL
);


ALTER TABLE public.permission_group_grants OWNER TO vmsuser;

--
-- Name: permission_group_grants_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.permission_group_grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permission_group_grants_id_seq OWNER TO vmsuser;

--
-- Name: permission_group_grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.permission_group_grants_id_seq OWNED BY public.permission_group_grants.id;


--
-- Name: permission_groups; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.permission_groups (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permission_groups OWNER TO vmsuser;

--
-- Name: permission_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.permission_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permission_groups_id_seq OWNER TO vmsuser;

--
-- Name: permission_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.permission_groups_id_seq OWNED BY public.permission_groups.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: vmsuser
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
    last_used_at timestamp with time zone NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO vmsuser;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.refresh_tokens_id_seq OWNER TO vmsuser;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    manual_enabled boolean NOT NULL,
    manual_url character varying NOT NULL,
    support_email character varying,
    support_url character varying,
    default_start_page character varying(255) DEFAULT '/'::character varying NOT NULL
);


ALTER TABLE public.system_settings OWNER TO vmsuser;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO vmsuser;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: user_group_memberships; Type: TABLE; Schema: public; Owner: vmsuser
--

CREATE TABLE public.user_group_memberships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_group_id integer NOT NULL,
    assigned_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_group_memberships OWNER TO vmsuser;

--
-- Name: user_group_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.user_group_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_group_memberships_id_seq OWNER TO vmsuser;

--
-- Name: user_group_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.user_group_memberships_id_seq OWNED BY public.user_group_memberships.id;


--
-- Name: user_oauth_tokens; Type: TABLE; Schema: public; Owner: vmsuser
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


ALTER TABLE public.user_oauth_tokens OWNER TO vmsuser;

--
-- Name: user_oauth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.user_oauth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_oauth_tokens_id_seq OWNER TO vmsuser;

--
-- Name: user_oauth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.user_oauth_tokens_id_seq OWNED BY public.user_oauth_tokens.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: vmsuser
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


ALTER TABLE public.user_permissions OWNER TO vmsuser;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_permissions_id_seq OWNER TO vmsuser;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: vmsuser
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
    company_id integer,
    department_id integer,
    sso_provider character varying(50),
    sso_provider_id character varying(255),
    auth_method character varying(20) DEFAULT 'local'::character varying,
    start_page character varying(255) DEFAULT ''::character varying NOT NULL,
    theme character varying(20) DEFAULT 'system'::character varying NOT NULL,
    color_preset character varying(20) DEFAULT 'blue'::character varying NOT NULL
);


ALTER TABLE public.users OWNER TO vmsuser;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: vmsuser
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO vmsuser;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vmsuser
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: gateway_channels id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateway_channels ALTER COLUMN id SET DEFAULT nextval('public.gateway_channels_id_seq'::regclass);


--
-- Name: gateways id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateways ALTER COLUMN id SET DEFAULT nextval('public.gateways_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: message_stats id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.message_stats ALTER COLUMN id SET DEFAULT nextval('public.message_stats_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: permission_group_grants id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_group_grants ALTER COLUMN id SET DEFAULT nextval('public.permission_group_grants_id_seq'::regclass);


--
-- Name: permission_groups id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_groups ALTER COLUMN id SET DEFAULT nextval('public.permission_groups_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: user_group_memberships id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_group_memberships ALTER COLUMN id SET DEFAULT nextval('public.user_group_memberships_id_seq'::regclass);


--
-- Name: user_oauth_tokens id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_oauth_tokens ALTER COLUMN id SET DEFAULT nextval('public.user_oauth_tokens_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_code_key; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_code_key UNIQUE (code);


--
-- Name: companies companies_name_key; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_name_key UNIQUE (name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: gateway_channels gateway_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateway_channels
    ADD CONSTRAINT gateway_channels_pkey PRIMARY KEY (id);


--
-- Name: gateways gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateways
    ADD CONSTRAINT gateways_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: message_stats message_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.message_stats
    ADD CONSTRAINT message_stats_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: permission_group_grants permission_group_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT permission_group_grants_pkey PRIMARY KEY (id);


--
-- Name: permission_groups permission_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT permission_groups_name_key UNIQUE (name);


--
-- Name: permission_groups permission_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT permission_groups_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: departments uq_company_dept; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uq_company_dept UNIQUE (company_id, name);


--
-- Name: permission_group_grants uq_group_menu; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT uq_group_menu UNIQUE (permission_group_id, menu_item_id);


--
-- Name: user_oauth_tokens uq_user_account_oauth; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT uq_user_account_oauth UNIQUE (user_id, account_id);


--
-- Name: user_group_memberships uq_user_group; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT uq_user_group UNIQUE (user_id, permission_group_id);


--
-- Name: user_permissions uq_user_menu; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT uq_user_menu UNIQUE (user_id, menu_item_id);


--
-- Name: user_group_memberships user_group_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_pkey PRIMARY KEY (id);


--
-- Name: user_oauth_tokens user_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT user_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_created_at; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_destination_channel; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_destination_channel ON public.messages USING btree (destination_channel);


--
-- Name: idx_gateway; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_gateway ON public.messages USING btree (gateway);


--
-- Name: idx_source_channel; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_source_channel ON public.messages USING btree (source_channel);


--
-- Name: idx_source_user; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_source_user ON public.messages USING btree (source_user);


--
-- Name: idx_source_user_display_name; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_source_user_display_name ON public.messages USING btree (source_user_display_name);


--
-- Name: idx_source_user_name; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_source_user_name ON public.messages USING btree (source_user_name);


--
-- Name: idx_status; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_status ON public.messages USING btree (status);


--
-- Name: idx_timestamp; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_timestamp ON public.messages USING btree ("timestamp");


--
-- Name: idx_user_oauth_account; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_user_oauth_account ON public.user_oauth_tokens USING btree (account_id);


--
-- Name: idx_user_oauth_active; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_user_oauth_active ON public.user_oauth_tokens USING btree (is_active);


--
-- Name: idx_user_oauth_platform; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_user_oauth_platform ON public.user_oauth_tokens USING btree (platform);


--
-- Name: idx_user_oauth_user; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX idx_user_oauth_user ON public.user_oauth_tokens USING btree (user_id);


--
-- Name: ix_accounts_enabled; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_accounts_enabled ON public.accounts USING btree (enabled);


--
-- Name: ix_accounts_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_accounts_id ON public.accounts USING btree (id);


--
-- Name: ix_accounts_is_valid; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_accounts_is_valid ON public.accounts USING btree (is_valid);


--
-- Name: ix_accounts_name; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_accounts_name ON public.accounts USING btree (name);


--
-- Name: ix_accounts_platform; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_accounts_platform ON public.accounts USING btree (platform);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_audit_logs_id ON public.audit_logs USING btree (id);


--
-- Name: ix_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: ix_gateway_channels_account; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_gateway_channels_account ON public.gateway_channels USING btree (account);


--
-- Name: ix_gateway_channels_gateway_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_gateway_channels_gateway_id ON public.gateway_channels USING btree (gateway_id);


--
-- Name: ix_gateway_channels_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_gateway_channels_id ON public.gateway_channels USING btree (id);


--
-- Name: ix_gateways_enabled; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_gateways_enabled ON public.gateways USING btree (enabled);


--
-- Name: ix_gateways_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_gateways_id ON public.gateways USING btree (id);


--
-- Name: ix_gateways_is_valid; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_gateways_is_valid ON public.gateways USING btree (is_valid);


--
-- Name: ix_gateways_name; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_gateways_name ON public.gateways USING btree (name);


--
-- Name: ix_menu_items_permission_key; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_menu_items_permission_key ON public.menu_items USING btree (permission_key);


--
-- Name: ix_menu_items_sort_order; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_menu_items_sort_order ON public.menu_items USING btree (sort_order);


--
-- Name: ix_message_stats_date; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_message_stats_date ON public.message_stats USING btree (date);


--
-- Name: ix_messages_created_at; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: ix_messages_destination_channel; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_destination_channel ON public.messages USING btree (destination_channel);


--
-- Name: ix_messages_gateway; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_gateway ON public.messages USING btree (gateway);


--
-- Name: ix_messages_message_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_message_id ON public.messages USING btree (message_id);


--
-- Name: ix_messages_source_channel; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_source_channel ON public.messages USING btree (source_channel);


--
-- Name: ix_messages_source_user; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_source_user ON public.messages USING btree (source_user);


--
-- Name: ix_messages_timestamp; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_messages_timestamp ON public.messages USING btree ("timestamp");


--
-- Name: ix_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: ix_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: ix_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: ix_refresh_tokens_is_revoked; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_refresh_tokens_is_revoked ON public.refresh_tokens USING btree (is_revoked);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_system_settings_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_system_settings_id ON public.system_settings USING btree (id);


--
-- Name: ix_user_oauth_tokens_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_user_oauth_tokens_id ON public.user_oauth_tokens USING btree (id);


--
-- Name: ix_user_oauth_tokens_is_active; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_user_oauth_tokens_is_active ON public.user_oauth_tokens USING btree (is_active);


--
-- Name: ix_user_oauth_tokens_platform; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_user_oauth_tokens_platform ON public.user_oauth_tokens USING btree (platform);


--
-- Name: ix_user_permissions_menu_item_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_user_permissions_menu_item_id ON public.user_permissions USING btree (menu_item_id);


--
-- Name: ix_user_permissions_user_id; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_is_active; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_users_is_active ON public.users USING btree (is_active);


--
-- Name: ix_users_role; Type: INDEX; Schema: public; Owner: vmsuser
--

CREATE INDEX ix_users_role ON public.users USING btree (role);


--
-- Name: accounts accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: accounts accounts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: gateway_channels gateway_channels_gateway_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateway_channels
    ADD CONSTRAINT gateway_channels_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES public.gateways(id) ON DELETE CASCADE;


--
-- Name: gateways gateways_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateways
    ADD CONSTRAINT gateways_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: gateways gateways_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.gateways
    ADD CONSTRAINT gateways_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: menu_items menu_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: menu_items menu_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: permission_group_grants permission_group_grants_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT permission_group_grants_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: permission_group_grants permission_group_grants_permission_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_group_grants
    ADD CONSTRAINT permission_group_grants_permission_group_id_fkey FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: permission_groups permission_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT permission_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_group_memberships user_group_memberships_permission_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_permission_group_id_fkey FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: user_group_memberships user_group_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_group_memberships
    ADD CONSTRAINT user_group_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_oauth_tokens user_oauth_tokens_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT user_oauth_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: user_oauth_tokens user_oauth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_oauth_tokens
    ADD CONSTRAINT user_oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vmsuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict fJu48L4FRq5q34hFd3Uw92LZhzABslAl9WWMxlB2qSZXr5uz96ssS5Hl6QyvhcQ

