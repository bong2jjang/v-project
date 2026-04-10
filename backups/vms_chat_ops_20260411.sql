--
-- PostgreSQL database dump
--

\restrict TRQ2Ry84zhbsynbKhhuyngW9MLB4Xua43Kfuctkj7X3LNSiQWKWkEMdK0oCFKPi

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
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.accounts (id, platform, name, token, app_token, tenant_id, app_id, app_password, prefix_messages_with_nick, edit_suffix, edit_disable, use_username, no_send_join_part, use_api, debug, is_valid, validation_errors, enabled, created_at, updated_at, created_by, updated_by, enabled_features, team_id, ms_refresh_token, ms_token_expires_at, ms_user_id, webhook_url) FROM stdin;
15	slack	viktor-bot	gAAAAABpzwml3ZodTDq0Pz0jSy3G19iplYZxghfUhcwzLZhc9i-6rP0M04S2szQusA3aVsB4Gm1InSrOGqyz-eYn_s339EGs_jKhpHhEeZe_fzU-WV5wolHUKxzZDXouGNCVVvQIRGvE11Zaw_8-KAr5XY-biD4zNw==	gAAAAABpzwmmoltNSllMMVkqmuYFVc5xqak1vwNhVVSsci-BWNvSWIkgfxPnenJqK8YcRbXpeZuDerrPHqz4-ldatLyTtvDjNTv0D5gf1xBbinaOQE0yYaeWHAMLK3VYjFbNBqG9P6TqUhXEC8AD-Q8ltG3CixydZcNCCUh7csYSNUE3u4ba5MXFLR-32wT0YaTppeM3yx751LE4eppZQdoNIhtoGqTOAA==	\N	\N	\N	t	 (edited)	f	t	t	t	f	t	\N	t	2026-04-03 00:28:22.307495+00	2026-04-06 15:22:35.076147+00	\N	5	\N	\N	\N	\N	\N	\N
20	teams	vms-channel-bot	\N	\N	gAAAAABp08z8h1lLTg7e5SC13n6uxN2lW4Em7LMQHTUANvyIgevYv-tebzIvpjMU48jmSoS87jP_dsJi9YbuYzmEwFZMso0sMokybBIF5PI8a8zI_6_2S9vcM_H4n7d_fpPep7x3vpVn	gAAAAABp088ZwDb8wcsqizQEorCg48iQndVRbFdqOh7BsJgd8E2b4yg0NHngru8BbM5ARXTJiQwin-_yerEYo66qop2G1OAx8Zt5o3XMP_Op6YHE6-fKmuZCFFbIFCsKUBltJO4NNouA	gAAAAABp08z8Z_GWUlW2Z7KJ1gGTDmUwoMaRMrbvV3zVEFp8YIH65uHSRKc3MV3Rf3s0iFG7XZv-6o0LRSpPJAsGMxj5RxF0Z4_lf9YslCQWxQvgSXE6_O7Cy9rgszr3QbFzP5qTs8M-	t	 (edited)	f	t	t	t	f	t	\N	t	2026-04-06 15:10:52.603772+00	2026-04-10 07:45:44.144944+00	5	5	\N	gAAAAABp08z8MpTUDgMeXmuenM5jpCjK5FRZ9F6Y08RxTIsLiDHB2MB0FSpjCW8tKEoXgz5fPa_HlWt01rodOioFI1Awp0-iX15EyQfXYb7O7rp8CfmwfjMFAGjqxw-ZjR7t7MnsD5Kv	gAAAAABp2Kqo3i9L1WK9dVHoePev9C3o1DK_gaxktdxJkDYKW0QjMwalIWKXIqK5vOVZITA33COlk-FCAXYllGgr_lOtNofuqIKgH4c7nJp9nhmOGobjc3eZeQNx6nsH1tHKrLF6hg5euZ6etLQK-HzORiS09JfkbSBg5edILWdk1NUIw5KXLDrwQQQXxtRcztzUUJYnO8uwUAisgDakAExXqZK3icjTsJabn46FDeBqRKpsPNr-Mk8_btnx3fpJd6_vJhRD4RUQ-gf4zHHF2N8nc9CXyG-6Hb5FZUQUSYCErk3QlBgNk8MoS3gyncmAI5JVdk_1N9pMzfV_MT0dmycdBUWeFTkPhtr4bajuKrK8r6iViSmi3DXQthS7_UHU99bYNjVO1NbzjTd8_R2P_64WXFYPWGqI2WTdzNqDR_hTG9DuAhPkNrdlh8sw4zOu9QtfPLyaLP88Tj_0b8WULnFA2h1vEGsB0DgLo0vTt6a9eQor-G1r189uqX3wbQizwFUESdz5Bj9jdK1z6f7vpe8Tx-Ya8fXcP-ykPEwm9tYL4zsLfkOwdHZr86tjESSWWsfvo2u7Gcyx7bhmXXgJKp6F9lkP68EwadKU0--lkGn10jMtZH5z3qIxHB7PRBPeWiHlJFEKF1O-NOWzGIEHVE_01P2CRB4jZkRayBaatDZ95neIZhxakLIXN2btfRj2A7IXEqu7yg9l8WVc-ME_KOk44NJ-ngP3AMksO8ldjRduw_PQeTeBKPn5OrV9JgbOCOMdUIYhHHERwNU1hVi1C2ftYzGQKL8QVHZ90nvtuHu1ynhC71sEX2APpoNC5oxSU8NFnxoFqn1wWTaXBXyZj28fmWABGnIiSLwjzttshkVzZCk7ogu5BA6hZH1TJ_uh8P0uyR_Wl2qRmxQs6sPMYJOfyZl1DtTtAlTBcMeZ3lb-B2iDFDEhl0jchIiky7PkRCn3LTb7i4Cc67ZhFnvNCFvU8dUOlDhMCHVfTVXb-NCMywkJRyGqc9oax3teY1dP6-DE59WoAZEloZ-K5n6eem9KGfwqcxX8-plmMbmn654puoXMEyb_EmWSlTUUw91woOrmPA-gK_4nHql1xb-JA5vJGZuq837o_wYo_byEOT9uPvb9_LHAgcTd4j88J3VO7SQXYcrdpqraiFqj9d6t08ehES3vUwGWtvq0Cyd1F5L-c3YYmhiGJSXEZaUHR0U_dhm_hnFpio80BinlUCw65iNu4miKQYtNKGuXabkMCNR0_onsRXG-eE9lbPfoNU76IurAzg1txndN4uZODdWAiSfDblvD4oToF0jwxMJZzWKGPFGY-K42iX1a-ALOX2GZ1EB-z9cHQodHrWTE23kwqJq0M_B7mirhZw56_fG8AjkFMKZ-QYddEOruEzTzvWVE5MeooIK_WUpniMR2BfQl1gsP7wRF7hqhsExtdfAO11BAaGmBOPar-jeXlhJVcHgmz9tWo4ZbOrzcdPmMLO-4xNENj-4arvZdoWU6Vz7ZZ4j8Kf9qSTjpK-j1ruG3JXuk0lxcGzCMGIfiYou0OJFqC3STPLeIIjcW7fYs3x9PGziaqUqpMC1gO8MgA9NAb6qHFUaHi94Hz5d8tnkfCG4-4pUTR28rPM34xDN4bZ6msOFzBi-BYTfZk6aKwyULvlHsOT6s65ut4KbfpoulEYCmzp-sX9uFPHk3RFi-AmMVJjaKRIq86xFDiO7tCY_S6d1B1vbwf_AAx-2cQ31JbGV7LepHEqHYTSkxZ2BGWp1kprnNygOHPU-J-Ur4I6RsT-8BK3AFJCDzonJDSI38AhvbQWiQwfNqJi3oCIH2t7qedjb8qwb194mwwYd5bUlA7MYklQZBJnRXb6Qw4j0jTm4L_KWCFvWqifPr-XAoTWRd9vqHl3vaYSmdh_XSH2itBMH7IBmBhijZ1rYC19tk1VGnuwMy6OiZjVCmiqBlrqDGqMLYlRuIkukdrQEJ4ziAyFfVz-tTU-Lq8VmPa-1G3kHsjiXC-zVPEjx9J0scrTkBhL7V7NOEFiB8mCK-aYHVpNuyEjJJxF44TRQo0qJY7QFDSClOEnauIqPA385rg-5CWDg5BjUZCEla__LpDvROFx4Rp0Eb2bsb007B	2026-04-10 08:47:48.138245+00	bong78@vms-solutions.com	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.audit_logs (id, "timestamp", user_id, user_email, action, resource_type, resource_id, description, details, status, error_message, ip_address, user_agent) FROM stdin;
3	2026-03-30 04:49:25.942011+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
4	2026-03-30 05:00:40.869714+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
5	2026-04-02 07:49:50.747184+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
6	2026-04-02 08:47:22.675548+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
7	2026-04-02 10:10:01.395564+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
8	2026-04-02 16:06:11.87607+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
9	2026-04-02 22:27:28.441233+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
10	2026-04-03 00:38:56.146972+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
11	2026-04-03 02:02:14.605905+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
12	2026-04-03 04:32:43.759697+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
13	2026-04-03 05:16:48.930304+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
14	2026-04-03 05:53:10.451564+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
15	2026-04-03 08:11:32.155024+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
16	2026-04-03 09:56:10.518342+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
17	2026-04-03 10:25:04.028366+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
18	2026-04-03 10:25:34.152384+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
19	2026-04-03 14:57:34.220111+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
20	2026-04-03 23:43:55.198329+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
21	2026-04-03 23:49:28.827949+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
22	2026-04-04 01:02:34.64333+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
23	2026-04-04 13:11:39.315796+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
24	2026-04-04 16:21:51.407794+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	curl/8.10.1
25	2026-04-04 16:22:00.234369+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	curl/8.10.1
26	2026-04-04 16:22:06.451994+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	curl/8.10.1
27	2026-04-04 16:34:53.033652+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	curl/8.10.1
28	2026-04-04 16:38:59.193062+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
29	2026-04-04 16:44:34.135025+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
30	2026-04-04 17:46:57.275163+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
31	2026-04-04 19:42:58.777381+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
32	2026-04-06 00:35:47.713926+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
33	2026-04-06 09:11:27.152363+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
34	2026-04-06 09:12:25.710927+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
35	2026-04-06 11:35:44.951498+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
36	2026-04-06 13:12:08.163749+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
37	2026-04-06 15:05:05.573262+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
38	2026-04-06 17:18:00.880968+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
39	2026-04-06 23:55:35.762232+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
40	2026-04-06 23:55:42.186288+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
41	2026-04-07 01:30:04.199961+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
42	2026-04-07 05:23:52.967453+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
43	2026-04-07 09:25:32.392887+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
44	2026-04-07 09:25:51.437495+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
45	2026-04-07 09:57:37.739772+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
46	2026-04-07 12:12:42.104103+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
47	2026-04-08 02:50:32.645352+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
48	2026-04-08 06:08:49.745899+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
49	2026-04-08 06:08:53.783096+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
50	2026-04-08 08:12:14.393332+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.1	curl/8.10.1
51	2026-04-08 09:01:17.145826+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
52	2026-04-08 09:02:23.651508+00	6	bong78@vms-solutions.com	user.register	user	6	User bong78@vms-solutions.com registered	{"role": "user"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
53	2026-04-08 09:02:24.943511+00	6	bong78@vms-solutions.com	user.login	user	6	User bong78@vms-solutions.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
54	2026-04-08 09:05:08.455608+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
55	2026-04-08 09:05:35.378954+00	6	bong78@vms-solutions.com	user.login	user	6	User bong78@vms-solutions.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
56	2026-04-08 09:09:53.297233+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
57	2026-04-08 09:37:59.053876+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
58	2026-04-08 09:51:56.406194+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
59	2026-04-09 02:21:07.117889+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
60	2026-04-09 03:01:23.404002+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
61	2026-04-09 04:17:57.518174+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
62	2026-04-09 04:18:19.805925+00	5	admin@example.com	user.role_change	user	6	User bong78@vms-solutions.com role changed from user to org_admin by admin@example.com	{"old_role": "user", "new_role": "org_admin"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
63	2026-04-09 04:18:30.200933+00	5	admin@example.com	user.role_change	user	6	User bong78@vms-solutions.com role changed from org_admin to user by admin@example.com	{"old_role": "org_admin", "new_role": "user"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
64	2026-04-09 04:19:04.564137+00	6	bong78@vms-solutions.com	user.login	user	6	User bong78@vms-solutions.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
71	2026-04-09 04:38:24.418765+00	5	admin@example.com	menu.update	menu	2	Menu '대시보드' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
73	2026-04-09 04:38:26.39067+00	5	admin@example.com	menu.update	menu	2	Menu '대시보드' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
65	2026-04-09 04:22:46.412254+00	6	bong78@vms-solutions.com	user.login	user	6	User bong78@vms-solutions.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
66	2026-04-09 04:25:44.840209+00	6	bong78@vms-solutions.com	user.login	user	6	User bong78@vms-solutions.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
67	2026-04-09 04:27:42.904141+00	6	bong78@vms-solutions.com	user.login	user	6	User bong78@vms-solutions.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
68	2026-04-09 04:29:05.648955+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
69	2026-04-09 04:38:18.426791+00	5	admin@example.com	menu.update	menu	2	Menu '대시보드' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
70	2026-04-09 04:38:21.018376+00	5	admin@example.com	menu.update	menu	2	Menu '대시보드' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
72	2026-04-09 04:38:25.076688+00	5	admin@example.com	menu.update	menu	2	Menu '대시보드' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
74	2026-04-09 04:38:27.190289+00	5	admin@example.com	menu.update	menu	2	Menu '대시보드' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
75	2026-04-09 04:42:09.209404+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 3, "sort_order": 100}, {"id": 2, "sort_order": 200}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
76	2026-04-09 04:42:13.651465+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 3, "sort_order": 200}, {"id": 2, "sort_order": 100}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
77	2026-04-09 04:42:17.162837+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 3, "sort_order": 100}, {"id": 2, "sort_order": 200}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
78	2026-04-09 04:42:25.198447+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 4, "sort_order": 200}, {"id": 2, "sort_order": 300}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
79	2026-04-09 04:42:30.499514+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 6, "sort_order": 400}, {"id": 5, "sort_order": 500}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
80	2026-04-09 04:42:31.854867+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 5, "sort_order": 400}, {"id": 6, "sort_order": 500}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
81	2026-04-09 04:43:21.57178+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	127.0.0.1	python-requests/2.33.1
82	2026-04-09 04:44:47.110365+00	5	admin@example.com	user.role_change	user	6	User bong78@vms-solutions.com role changed from user to org_admin by admin@example.com	{"old_role": "user", "new_role": "org_admin"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
83	2026-04-09 04:48:34.684155+00	5	admin@example.com	permission.update	permission	6	Permissions for user bong78@vms-solutions.com updated by admin@example.com	{"target_user_id": 6, "grants": [{"menu_item_id": 2, "access_level": "write"}, {"menu_item_id": 3, "access_level": "write"}, {"menu_item_id": 4, "access_level": "write"}, {"menu_item_id": 5, "access_level": "write"}, {"menu_item_id": 6, "access_level": "write"}, {"menu_item_id": 7, "access_level": "write"}, {"menu_item_id": 8, "access_level": "write"}, {"menu_item_id": 9, "access_level": "write"}, {"menu_item_id": 10, "access_level": "write"}, {"menu_item_id": 11, "access_level": "write"}, {"menu_item_id": 12, "access_level": "write"}, {"menu_item_id": 13, "access_level": "write"}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
84	2026-04-09 05:57:20.408454+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 10, "sort_order": 800}, {"id": 9, "sort_order": 900}, {"id": 12, "sort_order": 1000}, {"id": 13, "sort_order": 1100}, {"id": 11, "sort_order": 1200}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
85	2026-04-09 06:59:30.317664+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 13, "sort_order": 800}, {"id": 12, "sort_order": 900}, {"id": 9, "sort_order": 1000}, {"id": 10, "sort_order": 1100}, {"id": 11, "sort_order": 1200}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
86	2026-04-09 06:59:45.058259+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 12, "sort_order": 800}, {"id": 13, "sort_order": 900}, {"id": 9, "sort_order": 1000}, {"id": 10, "sort_order": 1100}, {"id": 11, "sort_order": 1200}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
87	2026-04-09 06:59:50.28524+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 13, "sort_order": 800}, {"id": 12, "sort_order": 900}, {"id": 9, "sort_order": 1000}, {"id": 10, "sort_order": 1100}, {"id": 11, "sort_order": 1200}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
88	2026-04-09 06:59:54.556225+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
89	2026-04-09 06:59:58.437186+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
90	2026-04-09 07:00:00.137219+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
91	2026-04-09 07:00:10.208344+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
92	2026-04-09 07:00:11.356537+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
93	2026-04-09 07:00:13.80786+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
94	2026-04-09 07:03:47.127321+00	5	admin@example.com	menu.create	menu	15	Menu '메뉴얼 링크' create by admin@example.com	{"menu_type": "custom_iframe", "permission_key": "custom_manual", "path": "/custom/manual"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
95	2026-04-09 07:08:30.632067+00	5	admin@example.com	menu.update	menu	15	Menu '메뉴얼 링크' update by admin@example.com	{"changes": {"is_active": false}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
96	2026-04-09 07:08:55.91655+00	5	admin@example.com	menu.update	menu	15	Menu '메뉴얼 링크' update by admin@example.com	{"changes": {"sort_order": 2100}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
97	2026-04-09 07:09:02.046091+00	5	admin@example.com	menu.update	menu	15	Menu '메뉴얼 링크' update by admin@example.com	{"changes": {"is_active": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
98	2026-04-09 07:21:32.71015+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 2, "sort_order": 100}, {"id": 3, "sort_order": 200}, {"id": 6, "sort_order": 300}, {"id": 4, "sort_order": 400}, {"id": 5, "sort_order": 500}, {"id": 8, "sort_order": 600}, {"id": 7, "sort_order": 700}]}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
99	2026-04-09 07:55:37.678125+00	5	admin@example.com	menu.update	menu	15	Menu '메뉴얼 링크' update by admin@example.com	{"changes": {"iframe_fullscreen": true}}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
100	2026-04-09 08:01:36.00732+00	5	admin@example.com	menu.create	menu	16	Menu '메뉴그룹1' create by admin@example.com	{"menu_type": "menu_group", "permission_key": "group_1", "path": "/group/group_1"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
101	2026-04-09 08:06:39.699577+00	5	admin@example.com	menu.delete	menu	16	Menu '메뉴그룹1' delete by admin@example.com	{"permission_key": "group_1"}	success	\N	172.20.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
102	2026-04-09 08:51:47.288428+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
103	2026-04-09 08:52:51.21816+00	5	admin@example.com	menu.create	menu	42	Menu '메뉴 그룹 1' create by admin@example.com	{"menu_type": "menu_group", "permission_key": "group_1", "path": "/group/group_1"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
104	2026-04-09 08:53:14.416822+00	5	admin@example.com	menu.update	menu	4	Menu '메시지 히스토리' update by admin@example.com	{"changes": {"parent_key": "group_1"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
105	2026-04-09 08:53:21.002615+00	5	admin@example.com	menu.update	menu	6	Menu '연동 관리' update by admin@example.com	{"changes": {"parent_key": "group_1"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
106	2026-04-09 08:54:24.893429+00	5	admin@example.com	menu.update	menu	5	Menu '통계' update by admin@example.com	{"changes": {"parent_key": "group_1"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
107	2026-04-09 08:54:36.349719+00	5	admin@example.com	menu.update	menu	8	Menu '도움말' update by admin@example.com	{"changes": {"parent_key": "group_1"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
108	2026-04-09 08:54:46.416602+00	5	admin@example.com	menu.update	menu	8	Menu '도움말' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
109	2026-04-09 08:54:47.996043+00	5	admin@example.com	menu.update	menu	5	Menu '통계' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
110	2026-04-09 08:54:49.184804+00	5	admin@example.com	menu.update	menu	6	Menu '연동 관리' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
111	2026-04-09 08:54:50.84333+00	5	admin@example.com	menu.update	menu	4	Menu '메시지 히스토리' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
112	2026-04-09 08:55:15.972125+00	5	admin@example.com	menu.update	menu	7	Menu '설정' update by admin@example.com	{"changes": {"parent_key": "group_1"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
113	2026-04-09 08:59:12.263663+00	5	admin@example.com	menu.create	menu	43	Menu '메뉴그룹2' create by admin@example.com	{"menu_type": "menu_group", "permission_key": "group_2", "path": "/group/group_2"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
114	2026-04-09 08:59:16.22426+00	5	admin@example.com	menu.update	menu	11	Menu '모니터링' update by admin@example.com	{"changes": {"parent_key": "group_2"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
115	2026-04-09 09:07:37.992248+00	5	admin@example.com	menu.update	menu	7	Menu '설정' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
116	2026-04-09 09:07:48.615692+00	5	admin@example.com	menu.delete	menu	42	Menu '메뉴 그룹 1' delete by admin@example.com	{"permission_key": "group_1"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
117	2026-04-09 09:11:35.923456+00	5	admin@example.com	menu.update	menu	11	Menu '모니터링' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
118	2026-04-09 10:06:06.348658+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
119	2026-04-09 10:06:31.685341+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
120	2026-04-09 10:07:25.91797+00	5	admin@example.com	menu.update	menu	11	Menu '모니터링' update by admin@example.com	{"changes": {"parent_key": "group_2"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
121	2026-04-09 10:11:46.591715+00	5	admin@example.com	menu.update	menu	11	Menu '모니터링' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
122	2026-04-09 10:11:54.715663+00	5	admin@example.com	menu.delete	menu	43	Menu '메뉴그룹2' delete by admin@example.com	{"permission_key": "group_2"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
123	2026-04-09 10:13:07.926781+00	5	admin@example.com	menu.create	menu	44	Menu '히스토리/통계' create by admin@example.com	{"menu_type": "menu_group", "permission_key": "menu_group01", "path": "/group/menu_group01"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
124	2026-04-09 10:13:26.631614+00	5	admin@example.com	menu.update	menu	6	Menu '연동 관리' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
125	2026-04-09 10:13:32.877047+00	5	admin@example.com	menu.update	menu	6	Menu '연동 관리' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
126	2026-04-09 10:13:40.096035+00	5	admin@example.com	menu.update	menu	4	Menu '메시지 히스토리' update by admin@example.com	{"changes": {"parent_key": null}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
127	2026-04-09 10:14:27.569136+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 2, "sort_order": 100}, {"id": 3, "sort_order": 200}, {"id": 6, "sort_order": 300}, {"id": 4, "sort_order": 300}, {"id": 44, "sort_order": 400}, {"id": 5, "sort_order": 500}, {"id": 8, "sort_order": 600}, {"id": 7, "sort_order": 700}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
128	2026-04-09 10:14:27.682579+00	5	admin@example.com	menu.update	menu	4	Menu '메시지 히스토리' update by admin@example.com	{"changes": {"parent_key": "menu_group01"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
129	2026-04-09 10:14:27.750631+00	5	admin@example.com	menu.update	menu	5	Menu '통계' update by admin@example.com	{"changes": {"parent_key": "menu_group01"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
130	2026-04-09 10:20:58.453335+00	5	admin@example.com	menu.create	menu	45	Menu '메뉴얼 링크 2' create by admin@example.com	{"menu_type": "custom_iframe", "permission_key": "custom_menu2", "path": "/custom/menu2"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
131	2026-04-09 10:21:21.454648+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 2, "sort_order": 100}, {"id": 3, "sort_order": 100}, {"id": 6, "sort_order": 200}, {"id": 4, "sort_order": 300}, {"id": 44, "sort_order": 300}, {"id": 8, "sort_order": 400}, {"id": 5, "sort_order": 500}, {"id": 7, "sort_order": 600}, {"id": 45, "sort_order": 700}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
132	2026-04-09 10:36:04.401117+00	5	admin@example.com	menu.update	menu	44	Menu '히스토리/통계' update by admin@example.com	{"changes": {"icon": "ungroup"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
133	2026-04-09 10:36:26.862731+00	5	admin@example.com	menu.update	menu	44	Menu '히스토리/통계' update by admin@example.com	{"changes": {"icon": "group"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
134	2026-04-09 10:58:11.00131+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
135	2026-04-09 12:22:46.429512+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
136	2026-04-09 12:38:28.237109+00	5	admin@example.com	menu.create	menu	102	Menu '사용자 관리' create by admin@example.com	{"menu_type": "menu_group", "permission_key": "menu_group_mgt_user", "path": "/group/menu_group_mgt_user"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
159	2026-04-09 16:30:28.308983+00	5	admin@example.com	permission.update	permission	8	Permissions for user kbhee@vms-solutions.com updated by admin@example.com	{"target_user_id": 8, "grants": [{"menu_item_id": 7, "access_level": "write"}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
137	2026-04-09 12:39:25.384274+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 58, "sort_order": 800}, {"id": 12, "sort_order": 900}, {"id": 9, "sort_order": 1000}, {"id": 13, "sort_order": 1100}, {"id": 10, "sort_order": 1200}, {"id": 11, "sort_order": 1300}, {"id": 59, "sort_order": 1400}, {"id": 102, "sort_order": 9000}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
138	2026-04-09 12:39:25.495426+00	5	admin@example.com	menu.update	menu	9	Menu '사용자 관리' update by admin@example.com	{"changes": {"parent_key": "menu_group_mgt_user"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
139	2026-04-09 12:39:25.592283+00	5	admin@example.com	menu.update	menu	59	Menu '조직 관리' update by admin@example.com	{"changes": {"parent_key": "menu_group_mgt_user"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
140	2026-04-09 12:45:35.532323+00	5	admin@example.com	menu.create	menu	131	Menu '모니터링' create by admin@example.com	{"menu_type": "menu_group", "permission_key": "menu_group_mgtmonitor", "path": "/group/menu_group_mgtmonitor"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
141	2026-04-09 12:45:56.326118+00	5	admin@example.com	menu.update	menu	10	Menu '감사 로그' update by admin@example.com	{"changes": {"parent_key": "menu_group_mgtmonitor"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
142	2026-04-09 12:45:56.414828+00	5	admin@example.com	menu.update	menu	11	Menu '모니터링' update by admin@example.com	{"changes": {"parent_key": "menu_group_mgtmonitor"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
143	2026-04-09 12:51:36.09855+00	5	admin@example.com	user.update	user	5	User admin@example.com updated by admin@example.com	{"changes": {"company_id": {"old": null, "new": 1}}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
144	2026-04-09 12:53:25.789519+00	5	admin@example.com	user.update	user	6	User bong78@vms-solutions.com updated by admin@example.com	{"changes": {"company_id": {"old": null, "new": 1}, "department_id": {"old": null, "new": 1}}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
145	2026-04-09 13:03:42.51958+00	5	admin@example.com	menu.update	menu	3	Menu '채널 관리' update by admin@example.com	{"changes": {"sort_order": 200}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
146	2026-04-09 13:20:27.943055+00	5	admin@example.com	user.update	user	6	User bong78@vms-solutions.com updated by admin@example.com	{"changes": {"department_id": {"old": 1, "new": 3}}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
147	2026-04-09 13:36:17.456215+00	5	admin@example.com	menu.delete	menu	102	Menu '사용자 관리' delete by admin@example.com	{"permission_key": "menu_group_mgt_user"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
148	2026-04-09 13:37:07.399957+00	5	admin@example.com	menu.reorder	menu	\N	Menu '(bulk reorder)' reorder by admin@example.com	{"orders": [{"id": 59, "sort_order": 800}, {"id": 9, "sort_order": 900}, {"id": 58, "sort_order": 1000}, {"id": 13, "sort_order": 1100}, {"id": 10, "sort_order": 1200}, {"id": 11, "sort_order": 1300}, {"id": 12, "sort_order": 1400}, {"id": 131, "sort_order": 8000}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
149	2026-04-09 14:07:41.285645+00	7	yichunbong@hotmail.com	user.register	user	7	User yichunbong@hotmail.com registered	{"role": "user"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
150	2026-04-09 14:08:03.00233+00	5	admin@example.com	user.update	user	6	User bong78@vms-solutions.com updated by admin@example.com	{"changes": {"department_id": {"old": 3, "new": 2}}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
151	2026-04-09 14:33:54.560899+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
152	2026-04-09 15:40:02.871974+00	5	admin@example.com	menu.delete	menu	45	Menu '메뉴얼 링크 2' delete by admin@example.com	{"permission_key": "custom_menu2"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
153	2026-04-09 15:43:33.739278+00	8	kbhee@vms-solutions.com	user.register	user	8	User kbhee@vms-solutions.com registered	{"role": "user"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
154	2026-04-09 15:44:47.073765+00	9	chunggh@vms-solutions.com	user.register	user	9	User chunggh@vms-solutions.com registered	{"role": "org_admin"}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
155	2026-04-09 16:03:28.941966+00	5	admin@example.com	menu.update	menu	44	Menu '히스토리/통계' update by admin@example.com	{"changes": {"icon": "history"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
156	2026-04-09 16:04:44.699889+00	5	admin@example.com	menu.update	menu	44	Menu '히스토리/통계' update by admin@example.com	{"changes": {"icon": "area-chart"}}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
157	2026-04-09 16:28:22.452651+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
158	2026-04-09 16:29:03.749003+00	5	admin@example.com	permission.update	permission	9	Permissions for user chunggh@vms-solutions.com updated by admin@example.com	{"target_user_id": 9, "grants": [{"menu_item_id": 59, "access_level": "write"}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
160	2026-04-09 16:30:28.335933+00	5	admin@example.com	permission.update	permission	7	Permissions for user yichunbong@hotmail.com updated by admin@example.com	{"target_user_id": 7, "grants": [{"menu_item_id": 7, "access_level": "write"}]}	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
161	2026-04-09 16:42:44.706354+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
162	2026-04-09 16:43:04.091914+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
163	2026-04-09 23:54:52.189767+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.20.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
164	2026-04-10 01:59:55.083836+00	10	first@test.com	user.register	user	10	User first@test.com registered	{"role": "user"}	success	\N	\N	testclient
165	2026-04-10 06:27:25.46266+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
166	2026-04-10 06:47:41.599447+00	11	second@test.com	user.register	user	11	User second@test.com registered	{"role": "user"}	success	\N	\N	testclient
167	2026-04-10 06:47:42.395382+00	12	admin@test.com	user.register	user	12	User admin@test.com registered	{"role": "user"}	success	\N	\N	testclient
168	2026-04-10 07:43:07.676434+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
169	2026-04-10 07:45:23.244196+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
170	2026-04-10 07:45:29.102847+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
171	2026-04-10 08:03:49.610681+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
172	2026-04-10 08:03:59.493141+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
173	2026-04-10 12:22:25.180218+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
174	2026-04-10 12:25:37.067204+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
175	2026-04-10 12:48:18.900193+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
176	2026-04-10 13:00:39.658423+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
177	2026-04-10 13:03:42.037781+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
178	2026-04-10 13:26:12.792624+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
179	2026-04-10 13:31:39.634164+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
180	2026-04-10 13:34:09.94455+00	5	admin@example.com	permission.update	permission	6	Permissions for user bong78@vms-solutions.com updated by admin@example.com	{"target_user_id": 6, "grants": [{"menu_item_id": 59, "access_level": "write"}, {"menu_item_id": 58, "access_level": "write"}, {"menu_item_id": 15, "access_level": "write"}]}	success	\N	172.18.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
181	2026-04-10 13:37:17.496304+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
182	2026-04-10 13:50:22.225242+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
183	2026-04-10 15:02:50.063113+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
184	2026-04-10 15:03:34.574794+00	7	yichunbong@hotmail.com	user.login	user	7	User yichunbong@hotmail.com logged in	\N	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
185	2026-04-10 15:04:33.614877+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
186	2026-04-10 15:22:46.622454+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
187	2026-04-10 15:23:14.327615+00	5	admin@example.com	user.update	user	5	User admin@example.com updated by admin@example.com	{"changes": {"color_preset": {"old": "blue", "new": "indigo"}}}	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
188	2026-04-10 15:23:24.743122+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
189	2026-04-10 15:23:32.498329+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
190	2026-04-10 15:23:45.581794+00	6	bong78@vms-solutions.com	user.update	user	6	User bong78@vms-solutions.com updated by bong78@vms-solutions.com	{"changes": {"color_preset": {"old": "blue", "new": "rose"}}}	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
191	2026-04-10 15:23:59.243361+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
192	2026-04-10 15:24:05.912042+00	6	bong78@vms-solutions.com	user.login	user	6	SSO login via microsoft (Microsoft 365)	\N	success	\N	172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
193	2026-04-10 15:29:59.058381+00	5	admin@example.com	user.login	user	5	User admin@example.com logged in	\N	success	\N	172.18.0.7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.companies (id, name, code, is_active, created_at, updated_at) FROM stdin;
1	VMS	VMS-KR	t	2026-04-09 12:46:54.163949+00	2026-04-09 12:46:54.163955+00
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.departments (id, company_id, name, code, parent_id, sort_order, is_active, created_at, updated_at) FROM stdin;
2	1	제품사업그룹	\N	1	0	t	2026-04-09 12:47:47.310547+00	2026-04-09 12:47:47.310556+00
3	1	제품팀	\N	2	0	t	2026-04-09 12:48:12.94347+00	2026-04-09 13:13:12.915066+00
4	1	대표이사	\N	\N	0	t	2026-04-09 15:35:15.412753+00	2026-04-10 07:59:27.397539+00
7	1	경영지원실	\N	\N	20	t	2026-04-10 07:58:49.865689+00	2026-04-10 08:00:43.856238+00
9	1	외부조직	\N	\N	60	t	2026-04-10 08:00:11.742619+00	2026-04-10 08:00:43.872128+00
6	1	전략사업부	\N	\N	10	t	2026-04-10 07:57:34.996974+00	2026-04-10 08:00:43.881898+00
8	1	기획영업본부	\N	\N	50	t	2026-04-10 07:59:02.993224+00	2026-04-10 08:00:43.895643+00
1	1	솔루션사업본부	\N	\N	40	t	2026-04-09 12:47:30.389505+00	2026-04-10 08:00:43.907304+00
5	1	글로벌사업부	\N	\N	30	t	2026-04-10 07:57:16.334504+00	2026-04-10 08:00:43.920822+00
10	1	운영1그룹	\N	1	0	t	2026-04-10 08:01:05.281288+00	2026-04-10 08:01:05.281294+00
11	1	운영2그룹	\N	1	0	t	2026-04-10 08:01:20.053684+00	2026-04-10 08:01:20.053689+00
12	1	사업팀	\N	2	0	t	2026-04-10 13:33:15.811335+00	2026-04-10 13:33:15.811341+00
\.


--
-- Data for Name: gateway_channels; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.gateway_channels (id, gateway_id, account, channel, created_at) FROM stdin;
\.


--
-- Data for Name: gateways; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.gateways (id, name, enabled, is_valid, validation_errors, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.menu_items (id, permission_key, label, icon, path, menu_type, iframe_url, open_in_new_tab, parent_key, sort_order, is_active, created_by, updated_by, created_at, updated_at, iframe_fullscreen, section) FROM stdin;
6	integrations	연동 관리	Link	/integrations	built_in	\N	f	\N	200	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 10:21:21.424992+00	f	basic
7	settings	설정	Settings	/settings	built_in	\N	f	\N	600	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 10:21:21.424994+00	f	basic
15	custom_manual	메뉴얼 링크	\N	/custom/manual	custom_iframe	http://127.0.0.1:3000/docs	f	\N	2100	t	5	5	2026-04-09 07:03:47.071009+00	2026-04-09 07:55:37.575832+00	t	custom
8	help	도움말	HelpCircle	/help	built_in	\N	f	\N	400	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 10:21:21.424995+00	f	basic
13	permission_management	권한 관리	Shield	/admin/permissions	built_in	\N	f	admin	1100	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 12:39:25.331842+00	f	admin
2	dashboard	대시보드	LayoutDashboard	/	built_in	\N	f	\N	100	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 07:21:32.653926+00	f	basic
10	audit_logs	감사 로그	FileText	/audit-logs	built_in	\N	f	menu_group_mgtmonitor	1200	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 12:45:56.309461+00	f	admin
11	monitoring	모니터링	Activity	/monitoring	built_in	\N	f	menu_group_mgtmonitor	1300	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 12:45:56.407157+00	f	admin
3	channels	채널 관리	Radio	/channels	built_in	\N	f	\N	200	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 13:03:42.466392+00	f	basic
9	users	사용자 관리	Users	/users	built_in	\N	f	\N	900	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 13:37:07.362092+00	f	admin
59	organizations	조직 관리	Building2	/admin/organizations	built_in	\N	f	\N	800	t	\N	5	2026-04-09 11:38:47.736878+00	2026-04-09 13:37:07.362095+00	f	admin
4	messages	메시지 히스토리	MessageSquare	/messages	built_in	\N	f	menu_group01	300	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 10:14:27.663822+00	f	basic
5	statistics	통계	BarChart3	/statistics	built_in	\N	f	menu_group01	500	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-09 10:14:27.743257+00	f	basic
131	menu_group_mgtmonitor	모니터링	monitor	/group/menu_group_mgtmonitor	menu_group	\N	f	\N	8000	t	5	5	2026-04-09 12:45:35.451658+00	2026-04-09 13:37:07.383507+00	f	admin
44	menu_group01	히스토리/통계	area-chart	/group/menu_group01	menu_group	\N	f	\N	300	t	5	5	2026-04-09 10:13:07.891711+00	2026-04-09 16:04:44.679303+00	f	basic
58	permission_groups	권한 그룹	UserCog	/admin/permission-groups	built_in	\N	f	\N	1000	t	\N	5	2026-04-09 11:38:47.736878+00	2026-04-10 15:18:08.815154+00	f	admin
12	menu_management	메뉴 관리	ListTree	/admin/menus	built_in	\N	f	admin	1400	t	\N	5	2026-04-09 04:34:33.576658+00	2026-04-10 15:18:08.815154+00	f	admin
\.


--
-- Data for Name: message_stats; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.message_stats (id, date, total_messages, gateway_stats, channel_stats, hourly_stats, updated_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.messages (id, message_id, text, gateway, source_account, source_channel, source_user, destination_account, destination_channel, protocol, "timestamp", created_at, has_attachment, attachment_count, message_type, status, error_message, retry_count, delivered_at, source_user_name, source_user_display_name, attachment_details, message_format, source_channel_name, destination_channel_name) FROM stdin;
190	1775500226288	메시지 테스트 12	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:30:26.288+00	2026-04-06 18:30:34.067826+00	f	0	text	sent	\N	0	2026-04-06 18:31:06.649477+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
194	1775500568.840179_reaction_white_check_mark	:white_check_mark: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:36:08.840179+00	2026-04-06 18:36:22.955604+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
195	1775500561054_reaction_👍	:+1: by @fb9620e2-4a03-49f0-983a-8448780f8ebb	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:36:38.099237+00	2026-04-06 18:36:39.771864+00	f	0	text	sent	\N	0	2026-04-06 18:36:38.750329+00	fb9620e2-4a03-49f0-983a-8448780f8ebb	fb9620e2-4a03-49f0-983a-8448780f8ebb	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
199	1775500568.840179_reaction_+1	:+1: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:36:08.840179+00	2026-04-06 18:38:30.48634+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
201	1775539374754	슬랙에 보내기 테스트 2	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:22:54.754+00	2026-04-07 05:22:58.348907+00	f	0	text	sent	\N	0	2026-04-07 05:22:57.286266+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
203	1775539668697		teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:27:48.697+00	2026-04-07 05:27:52.629891+00	f	0	text	sent	\N	0	2026-04-07 05:27:51.507132+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	슬랙-팀즈 (테스트)	viktor-테스트-01
206	1775540363650		teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:39:23.65+00	2026-04-07 05:39:31.965138+00	f	0	text	failed	Send failed	0	\N	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	슬랙-팀즈 (테스트)	viktor-테스트-01
208	1775540509.682769		slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-07 05:41:49.682769+00	2026-04-07 05:41:55.496822+00	f	0	text	sent	\N	0	2026-04-07 05:41:54.466883+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
210	1775540750541		teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:45:50.541+00	2026-04-07 05:45:58.462308+00	f	0	text	sent	\N	0	2026-04-07 05:45:57.197569+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	슬랙-팀즈 (테스트)	viktor-테스트-01
212	1775541327169	ㅎㅎ	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:55:27.169+00	2026-04-07 05:55:31.824375+00	t	1	file	sent	\N	0	2026-04-07 05:55:30.796753+00	이춘봉(Viktor)	이춘봉(Viktor)	[{"name": "Image (1).jfif", "type": "reference", "size": 0, "url": "https://vmsvms.sharepoint.com/sites/solution-c/Shared Documents/\\uc2ac\\ub799-\\ud300\\uc988 (\\ud14c\\uc2a4\\ud2b8)/Image (1).jfif"}]	text	슬랙-팀즈 (테스트)	viktor-테스트-01
215	1775640730156	메시지 전송 테스트 4	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-08 09:32:10.156+00	2026-04-08 09:32:13.06967+00	f	0	text	sent	\N	0	2026-04-08 09:32:12.045219+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	슬랙-팀즈 (테스트)	viktor-테스트-01
217	1775641506349	메시지 전송 테스트 6	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-08 09:45:06.349+00	2026-04-08 09:45:12.4275+00	f	0	text	sent	\N	0	2026-04-08 09:45:08.405715+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	슬랙-팀즈 (테스트)	viktor-테스트-01
219	1775702712.915369	실례합니다. 테스트 전송 메시지 입니다. 무시해 주세요. - 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-09 02:45:12.915369+00	2026-04-09 02:45:19.148713+00	f	0	text	failed	Send failed	0	\N	bong78	Viktor	null	text	viktor-테스트-01	점심친구
221	1775719795.412739	이미지 전송 테스트 - 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-09 07:29:55.412739+00	2026-04-09 07:30:01.331281+00	t	1	image	sent	\N	0	2026-04-09 07:30:00.147919+00	bong78	Viktor	[{"name": "image.png", "type": "image/png", "size": 4637, "url": "https://files.slack.com/files-pri/T056MP5374J-F0ARP8JV9E1/image.png"}]	text	viktor-테스트-01	점심친구
223	1775779644.150909	이미지 전송 테스트 1 (인라인)	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 00:07:24.150909+00	2026-04-10 00:07:28.809297+00	t	1	image	sent	\N	0	2026-04-10 00:07:27.795422+00	bong78	Viktor	[{"name": "image.png", "type": "image/png", "size": 5096, "url": "https://files.slack.com/files-pri/T056MP5374J-F0ARXFL3MFG/image.png"}]	text	viktor-테스트-01	점심친구
191	1775500231.967939_reaction_white_check_mark	:white_check_mark: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:30:31.967939+00	2026-04-06 18:30:44.917946+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
146	1775269974.993859	메시지 테스트 002	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 02:32:54.993859+00	2026-04-04 02:32:58.708078+00	f	0	text	sent	\N	0	2026-04-04 02:32:57.634988+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
147	1775270027.619879	이미지 전송 테스트	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 02:33:47.619879+00	2026-04-04 02:33:52.915283+00	f	0	text	sent	\N	0	2026-04-04 02:33:51.879043+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
148	1775270155.810519	이미지 파일 전송 테스트 2	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 02:35:55.810519+00	2026-04-04 02:36:01.94253+00	f	0	text	sent	\N	0	2026-04-04 02:36:00.915245+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
149	1775270290.296029	이미지 파일 전송 테스트 3	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 02:38:10.296029+00	2026-04-04 02:38:17.181868+00	f	0	text	sent	\N	0	2026-04-04 02:38:16.039976+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
150	1775271154.660169	이미지 파일 전송 005	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 02:52:34.660169+00	2026-04-04 02:52:42.123799+00	f	0	text	sent	\N	0	2026-04-04 02:52:40.87643+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
151	1775272210.258039	이미지 전송 005	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 03:10:10.258039+00	2026-04-04 03:10:18.041949+00	f	0	text	sent	\N	0	2026-04-04 03:10:16.575571+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
152	1775309577.169689	양방향 테스트 1	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 13:32:57.169689+00	2026-04-04 13:33:00.672969+00	f	0	text	sent	\N	0	2026-04-04 13:32:59.634331+00	bong78	이춘봉	\N	text	viktor-테스트-01	viktor-테스트-02
153	1775310536.492479	양방향 테스트 3	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 13:48:56.492479+00	2026-04-04 13:48:59.726623+00	f	0	text	sent	\N	0	2026-04-04 13:48:58.69625+00	bong78	Viktor	\N	text	viktor-테스트-01	viktor-테스트-02
154	1775310545.070689	양방향 테스트 4	slack→slack	slack	C0AP4T21G3X	U05JT4UHFAB	slack	C0APBT4G4UC	slack	2026-04-04 13:49:05.070689+00	2026-04-04 13:49:09.061055+00	f	0	text	sent	\N	0	2026-04-04 13:49:08.059949+00	bong78	Viktor	\N	text	viktor-테스트-02	viktor-테스트-01
155	1775312353.227039	양방향 테스트 5	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 14:19:13.227039+00	2026-04-04 14:19:17.970982+00	f	0	text	sent	\N	0	2026-04-04 14:19:16.924707+00	bong78	Viktor	\N	text	viktor-테스트-01	viktor-테스트-02
156	1775312364.347639	양방향 테스트 6	slack→slack	slack	C0AP4T21G3X	U05JT4UHFAB	slack	C0APBT4G4UC	slack	2026-04-04 14:19:24.347639+00	2026-04-04 14:19:27.8723+00	f	0	text	sent	\N	0	2026-04-04 14:19:26.850527+00	bong78	Viktor	\N	text	viktor-테스트-02	viktor-테스트-01
157	1775312391.077239	양방향 테스트 7	slack→slack	slack	C0APBT4G4UC	U05JT4UHFAB	slack	C0AP4T21G3X	slack	2026-04-04 14:19:51.077239+00	2026-04-04 14:19:54.83085+00	f	0	text	sent	\N	0	2026-04-04 14:19:53.824006+00	bong78	Viktor	\N	text	viktor-테스트-01	viktor-테스트-02
158	1775489555.529819	팀즈랑 테스트 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 15:32:35.529819+00	2026-04-06 15:32:39.187891+00	f	0	text	failed	Send failed	0	\N	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
159	1775489971.467409	팀즈랑 테스트 2	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 15:39:31.467409+00	2026-04-06 15:39:38.346913+00	f	0	text	failed	Send failed	0	\N	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
160	1775312366.598139_reaction_white_check_mark	:white_check_mark: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-04 14:19:26.598139+00	2026-04-06 16:12:23.313667+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
161	1775493785.648779	팀즈랑 테스트 3	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 16:43:05.648779+00	2026-04-06 16:43:12.486551+00	f	0	text	sent	\N	0	2026-04-06 16:43:11.424941+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
162	1775495895271	슬랙과 테스트 3	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 17:18:15.271+00	2026-04-06 17:18:22.564263+00	f	0	text	sent	\N	0	2026-04-06 17:55:03.339202+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
163	1775498155.987979	팀즈로 보내기 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 17:55:55.987979+00	2026-04-06 17:56:02.093092+00	f	0	text	sent	\N	0	2026-04-06 17:56:00.484752+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
166	1775498155.987979_deleted	~메시지가 삭제되었습니다~ _(deleted)_	slack→teams	slack	C0APBT4G4UC	system	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 17:55:55.987979+00	2026-04-06 17:58:17.480462+00	f	0	text	sent	\N	0	2026-04-06 17:58:16.200277+00	System	System	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
167	1775498295271	[SLACK] System\n\n~~메시지가 삭제되었습니다~~ (deleted)	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 17:58:15.271+00	2026-04-06 17:58:22.26438+00	f	0	text	sent	\N	0	2026-04-06 17:58:19.246679+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
169	1775498840999_deleted	~슬랙으로 보내기 1~ _(deleted)_	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	system	slack	C0APBT4G4UC	teams	2026-04-06 18:09:00.395809+00	2026-04-06 18:09:02.095021+00	f	0	text	sent	\N	0	2026-04-06 18:09:01.043754+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
170	1775499051274	슬랙으로 보내기 4	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:10:51.274+00	2026-04-06 18:10:55.061827+00	f	0	text	sent	\N	0	2026-04-06 18:20:31.70034+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
171	1775499065.898529_reaction_white_check_mark	:white_check_mark: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:11:05.898529+00	2026-04-06 18:11:22.618046+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
172	1775499065.898529_reaction_ok_hand	:ok_hand: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:11:05.898529+00	2026-04-06 18:11:36.55013+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
192	1775500226288_reaction_👍	:👍: by @unknown	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	unknown	slack	C0APBT4G4UC	teams	2026-04-06 18:30:51.809648+00	2026-04-06 18:30:53.965833+00	f	0	text	sent	\N	0	2026-04-06 18:30:52.951467+00	unknown	unknown	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
200	1775538941493	슬랙에 보내기 테스트 1	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:15:41.493+00	2026-04-07 05:15:44.441457+00	f	0	text	sent	\N	0	2026-04-07 05:15:43.377672+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
202	1775539567747	슬랙에 보내기 테스트 3	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:26:07.747+00	2026-04-07 05:26:11.198401+00	f	0	text	sent	\N	0	2026-04-07 05:26:10.075979+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	슬랙-팀즈 (테스트)	viktor-테스트-01
204	1775539700.873299		slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-07 05:28:20.873299+00	2026-04-07 05:28:26.805928+00	f	0	text	sent	\N	0	2026-04-07 05:28:25.789894+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
205	1775539881998		teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:31:21.998+00	2026-04-07 05:31:30.920832+00	f	0	text	sent	\N	0	2026-04-07 05:31:28.572363+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	슬랙-팀즈 (테스트)	viktor-테스트-01
207	1775540473753		teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-07 05:41:13.753+00	2026-04-07 05:41:22.766392+00	f	0	text	failed	Send failed	0	\N	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	슬랙-팀즈 (테스트)	viktor-테스트-01
209	1775540670.858479	ㅇㅇ	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-07 05:44:30.858479+00	2026-04-07 05:44:35.982411+00	f	0	text	sent	\N	0	2026-04-07 05:44:34.949587+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
211	1775540799.547189		slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-07 05:46:39.547189+00	2026-04-07 05:46:50.61051+00	f	0	text	sent	\N	0	2026-04-07 05:46:47.845842+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
213	1775541513.401329	ㅂㅂ	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-07 05:58:33.401329+00	2026-04-07 05:58:40.325477+00	t	1	image	sent	\N	0	2026-04-07 05:58:39.282197+00	bong78	Viktor	[{"name": "image.png", "type": "image/png", "size": 5505, "url": "https://files.slack.com/files-pri/T056MP5374J-F0AR54DSRUM/image.png"}]	text	viktor-테스트-01	슬랙-팀즈 (테스트)
214	1775640629595	메시지 전송 테스트 3	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-08 09:30:29.595+00	2026-04-08 09:30:32.910286+00	f	0	text	sent	\N	0	2026-04-08 09:30:31.778405+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	슬랙-팀즈 (테스트)	viktor-테스트-01
216	1775641503009	메시지 전송 테스트 5	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-08 09:45:03.009+00	2026-04-08 09:45:06.849218+00	f	0	text	sent	\N	0	2026-04-08 09:45:05.72436+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	슬랙-팀즈 (테스트)	viktor-테스트-01
218	1775702251.941549	실례합니다. 테스트 전송 메시지 입니다. 무시해 주세요. - 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-09 02:37:31.941549+00	2026-04-09 02:37:38.759901+00	f	0	text	failed	Send failed	0	\N	bong78	Viktor	null	text	viktor-테스트-01	점심친구
220	1775719485.009729	실례합니다. 테스트 전송 메시지 입니다. 무시해 주세요. - 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-09 07:24:45.009729+00	2026-04-09 07:24:51.074795+00	f	0	text	sent	\N	0	2026-04-09 07:24:50.03211+00	bong78	Viktor	null	text	viktor-테스트-01	점심친구
222	1775779564.800009	실례합니다. 테스트 좀 하겠습니다. - 1	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 00:06:04.800009+00	2026-04-10 00:06:09.127288+00	f	0	text	sent	\N	0	2026-04-10 00:06:08.10499+00	bong78	Viktor	null	text	viktor-테스트-01	점심친구
224	1775779752.134539	파일 첨부 테스트 1 (텍스트 파일)	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 00:09:12.134539+00	2026-04-10 00:09:17.217723+00	t	1	file	sent	\N	0	2026-04-10 00:09:16.186839+00	bong78	Viktor	[{"name": "\\uc0c8 \\ud14d\\uc2a4\\ud2b8 \\ubb38\\uc11c.txt", "type": "text/plain", "size": 16, "url": "https://files.slack.com/files-pri/T056MP5374J-F0ASCENHHNV/____________________.txt"}]	text	viktor-테스트-01	점심친구
168	1775498840999	슬랙으로 보내기 1	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:07:20.999+00	2026-04-06 18:07:25.777565+00	f	0	text	sent	\N	0	2026-04-06 18:12:01.765524+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
173	1775499192198	볼드	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:13:12.198+00	2026-04-06 18:13:15.972269+00	f	0	text	sent	\N	0	2026-04-06 18:13:14.957442+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
174	1775499247.631079_deleted	~메시지가 삭제되었습니다~ _(deleted)_	slack→teams	slack	C0APBT4G4UC	system	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:14:07.631079+00	2026-04-06 18:15:05.318354+00	f	0	text	sent	\N	0	2026-04-06 18:15:04.176593+00	System	System	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
175	1775499247.631079	*볼드*	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:14:07.631079+00	2026-04-06 18:15:15.227393+00	f	0	text	sent	\N	0	2026-04-06 18:15:14.144273+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
176	1775499279.180499_deleted	~메시지가 삭제되었습니다~ _(deleted)_	slack→teams	slack	C0APBT4G4UC	system	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:14:39.180499+00	2026-04-06 18:15:21.07568+00	f	0	text	sent	\N	0	2026-04-06 18:15:16.064218+00	System	System	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
177	1775499194.122939_deleted	~메시지가 삭제되었습니다~ _(deleted)_	slack→teams	slack	C0APBT4G4UC	system	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:13:14.122939+00	2026-04-06 18:15:30.140936+00	f	0	text	sent	\N	0	2026-04-06 18:15:29.13133+00	System	System	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
178	1775499279.180499	적달 테스트	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:14:39.180499+00	2026-04-06 18:15:46.317779+00	f	0	text	sent	\N	0	2026-04-06 18:15:45.234636+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
179	1775499403.868679	메시지 테스트 10	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:16:43.868679+00	2026-04-06 18:16:48.671669+00	f	0	text	sent	\N	0	2026-04-06 18:16:47.593759+00	bong78	Viktor	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
180	1775499406700_reaction_👍	:👍: by @unknown	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	unknown	slack	C0APBT4G4UC	teams	2026-04-06 18:18:31.819491+00	2026-04-06 18:18:36.39642+00	f	0	text	sent	\N	0	2026-04-06 18:18:33.14693+00	unknown	unknown	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
193	1775500561054	메시지 테스트 13	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:36:01.054+00	2026-04-06 18:36:11.356379+00	f	0	text	sent	\N	0	2026-04-06 18:36:09.527894+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
196	1775500561054_reaction_😒	:😒: by @fb9620e2-4a03-49f0-983a-8448780f8ebb	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:36:47.288557+00	2026-04-06 18:36:49.188132+00	f	0	text	sent	\N	0	2026-04-06 18:36:48.180989+00	fb9620e2-4a03-49f0-983a-8448780f8ebb	fb9620e2-4a03-49f0-983a-8448780f8ebb	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
183	1775499344350_deleted	~메시지가 삭제되었습니다~ _(deleted)_	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	system	slack	C0APBT4G4UC	teams	2026-04-06 18:20:55.986978+00	2026-04-06 18:20:57.58206+00	f	0	text	sent	\N	0	2026-04-06 18:20:56.566001+00	System	System	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
184	1775499403.868679_reaction_x	:x: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:16:43.868679+00	2026-04-06 18:21:02.625955+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
185	1775499403.868679_reaction_microsoftteams-image__2_-removebg-preview	:microsoftteams-image__2_-removebg-preview: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:16:43.868679+00	2026-04-06 18:21:11.73889+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
186	1775499403.868679_reaction_ok_hand	:ok_hand: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:16:43.868679+00	2026-04-06 18:21:27.318134+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
187	1775500033348	메시지 테스트 11	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-06 18:27:13.348+00	2026-04-06 18:27:17.635608+00	f	0	text	sent	\N	0	2026-04-06 18:27:16.536377+00	이춘봉(Viktor)	이춘봉(Viktor)	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
188	1775500035.743869_reaction_white_check_mark	:white_check_mark: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:27:15.743869+00	2026-04-06 18:27:28.894545+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
189	1775500033348_reaction_👍	:👍: by @unknown	teams→slack	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	unknown	slack	C0APBT4G4UC	teams	2026-04-06 18:27:41.977516+00	2026-04-06 18:27:44.08746+00	f	0	text	sent	\N	0	2026-04-06 18:27:43.06966+00	unknown	unknown	\N	text	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	viktor-테스트-01
197	1775500568.840179_reaction_감사합니다	:감사합니다: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:36:08.840179+00	2026-04-06 18:38:02.223893+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
198	1775500568.840179_reaction_ok_hand	:ok_hand: by @이춘봉	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	c070ebee-0361-4dd1-8709-41cc20221ece:19:c3010ea831af4f8e97bbacd9c166bf81@thread.tacv2	slack	2026-04-06 18:36:08.840179+00	2026-04-06 18:38:19.526083+00	f	0	text	failed	Send failed	0	\N	bong78	이춘봉	\N	text	viktor-테스트-01	슬랙-팀즈 (테스트)
225	1775789406830	회의 잘 마무리 하고, 지하 2층으로 오세요~~\n\n전 먼저 내려가 있을께요.	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	34d12620-b878-4cb2-9eb7-d7ca8baa162b	slack	C0APBT4G4UC	teams	2026-04-10 02:50:06.83+00	2026-04-10 02:50:11.385378+00	f	0	text	sent	\N	0	2026-04-10 02:50:09.766193+00	백재용	백재용	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
226	1775789656529	전 안갈래요^^	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	377207b3-ebe8-4f5c-a6c4-32330258dbf5	slack	C0APBT4G4UC	teams	2026-04-10 02:54:16.529+00	2026-04-10 02:54:20.18105+00	f	0	text	sent	\N	0	2026-04-10 02:54:19.063666+00	정구환(Eric)	정구환(Eric)	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
227	1775789701815	같이 가는 인원이 있나요?  ㅎㅎ	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	33e5bba9-df58-45c7-9fc6-1b8fd99c37e3	slack	C0APBT4G4UC	teams	2026-04-10 02:55:01.815+00	2026-04-10 02:55:04.957713+00	f	0	text	sent	\N	0	2026-04-10 02:55:03.886754+00	추헌성	추헌성	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
228	1775789769222	엥 오세요	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	34d12620-b878-4cb2-9eb7-d7ca8baa162b	slack	C0APBT4G4UC	teams	2026-04-10 02:56:09.222+00	2026-04-10 02:56:12.759394+00	f	0	text	sent	\N	0	2026-04-10 02:56:11.753761+00	백재용	백재용	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
229	1775789832391	ㅜ.ㅜ 알았어요	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	377207b3-ebe8-4f5c-a6c4-32330258dbf5	slack	C0APBT4G4UC	teams	2026-04-10 02:57:12.391+00	2026-04-10 02:57:15.3929+00	f	0	text	sent	\N	0	2026-04-10 02:57:14.387418+00	정구환(Eric)	정구환(Eric)	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
230	1775789835397	헌성 ~\n\n구환이형 잡아서 내려 와	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	34d12620-b878-4cb2-9eb7-d7ca8baa162b	slack	C0APBT4G4UC	teams	2026-04-10 02:57:15.397+00	2026-04-10 02:57:21.334384+00	f	0	text	sent	\N	0	2026-04-10 02:57:17.328194+00	백재용	백재용	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
231	1775789835397_reaction_👍	:+1: by @33e5bba9-df58-45c7-9fc6-1b8fd99c37e3	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	33e5bba9-df58-45c7-9fc6-1b8fd99c37e3	slack	C0APBT4G4UC	teams	2026-04-10 02:57:26.578773+00	2026-04-10 02:57:27.988289+00	f	0	reaction	sent	\N	0	2026-04-10 02:57:26.978217+00	33e5bba9-df58-45c7-9fc6-1b8fd99c37e3	33e5bba9-df58-45c7-9fc6-1b8fd99c37e3	null	text	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
232	1775789910494	회의 이제 마침.	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-10 02:58:30.494+00	2026-04-10 02:58:33.963657+00	f	0	text	sent	\N	0	2026-04-10 02:58:32.947557+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
233	1775789918307	몇층?	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-10 02:58:38.307+00	2026-04-10 02:58:44.374108+00	f	0	text	sent	\N	0	2026-04-10 02:58:43.349235+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
234	1775790108356	지하 2층	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	34d12620-b878-4cb2-9eb7-d7ca8baa162b	slack	C0APBT4G4UC	teams	2026-04-10 03:01:48.356+00	2026-04-10 03:01:52.141812+00	f	0	text	sent	\N	0	2026-04-10 03:01:51.13568+00	백재용	백재용	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
235	1775805630620	(역방향) 실례합니다. 테스트 좀 하겠습니다. - 3	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-10 07:20:30.62+00	2026-04-10 07:20:33.404318+00	f	0	text	sent	\N	0	2026-04-10 07:20:32.351323+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
236	1775805651.514129	파일 전송 테스트	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 07:20:51.514129+00	2026-04-10 07:20:56.15024+00	t	1	file	sent	\N	0	2026-04-10 07:20:55.141466+00	bong78	Viktor	[{"name": "\\uc0c8 \\ud14d\\uc2a4\\ud2b8 \\ubb38\\uc11c.txt", "type": "text/plain", "size": 16, "url": "https://files.slack.com/files-pri/T056MP5374J-F0AS53BU77W/____________________.txt", "download_status": "pending"}]	text	viktor-테스트-01	점심친구
237	1775805673.470829	이미지 전송 테스트 (인라인)	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 07:21:13.470829+00	2026-04-10 07:21:17.777603+00	t	1	image	sent	\N	0	2026-04-10 07:21:16.742376+00	bong78	Viktor	[{"name": "image.png", "type": "image/png", "size": 5096, "url": "https://files.slack.com/files-pri/T056MP5374J-F0ARXFL3MFG/image.png", "download_status": "pending"}]	text	viktor-테스트-01	점심친구
238	1775805673.470829_deleted	~메시지가 삭제되었습니다~ _(deleted)_	slack→teams	slack	C0APBT4G4UC	system	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 07:21:13.470829+00	2026-04-10 07:22:26.610693+00	f	0	system	sent	\N	0	2026-04-10 07:22:25.589142+00	System	System	null	text	viktor-테스트-01	점심친구
239	1775805630620_deleted	~(역방향) 실례합니다. 테스트 좀 하겠습니다. - 3~ _(deleted)_	teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	system	slack	C0APBT4G4UC	teams	2026-04-10 07:24:40.728931+00	2026-04-10 07:24:42.176346+00	f	0	system	sent	\N	0	2026-04-10 07:24:41.17152+00	이춘봉(Viktor)	이춘봉(Viktor)	null	text	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
240	1775806040491		teams→slack	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	fb9620e2-4a03-49f0-983a-8448780f8ebb	slack	C0APBT4G4UC	teams	2026-04-10 07:27:20.491+00	2026-04-10 07:27:25.943664+00	t	1	file	partial_success	Attachment download failed: 새 텍스트 문서.txt	0	2026-04-10 07:27:24.915886+00	이춘봉(Viktor)	이춘봉(Viktor)	[{"name": "\\uc0c8 \\ud14d\\uc2a4\\ud2b8 \\ubb38\\uc11c.txt", "type": "reference", "size": 0, "url": "https://vmsvms-my.sharepoint.com/personal/bong78_vms-solutions_com/Documents/Microsoft%20Teams%20%EC%B1%84%ED%8C%85%20%ED%8C%8C%EC%9D%BC/%EC%83%88%20%ED%85%8D%EC%8A%A4%ED%8A%B8%20%EB%AC%B8%EC%84%9C.txt", "download_status": "pending"}]	text	19:edbd8b394f274e0883bb905078d91230@thread.v2	viktor-테스트-01
241	1775806044.943549_deleted	~:paperclip: *새 텍스트 문서.txt*\n<https://vmsvms-my.sharepoint.com/personal/bong78_vms-solutions_com/Documents/Microsoft%20Teams%20%EC%B1%84%ED%8C%85%20%ED%8C%8C%EC%9D%BC/%EC%83%88%20%ED%85%8D%EC%8A%A4%ED%8A%B8%20%EB%AC%B8%EC%84%9C.txt|다운로드>~ _(deleted)_	slack→teams	slack	C0APBT4G4UC	system	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 07:27:24.943549+00	2026-04-10 07:45:45.686691+00	f	0	system	sent	\N	0	2026-04-10 07:45:44.670916+00		system	null	text	viktor-테스트-01	점심친구
242	1775807160.812149	파일 전송 테스트	slack→teams	slack	C0APBT4G4UC	U05JT4UHFAB	teams	chat:19:edbd8b394f274e0883bb905078d91230@thread.v2	slack	2026-04-10 07:46:00.812149+00	2026-04-10 07:46:04.466055+00	t	1	file	partial_success	Attachment download failed: 새 텍스트 문서.txt	0	2026-04-10 07:46:03.453279+00	bong78	Viktor	[{"name": "\\uc0c8 \\ud14d\\uc2a4\\ud2b8 \\ubb38\\uc11c.txt", "type": "text/plain", "size": 16, "url": "https://files.slack.com/files-pri/T056MP5374J-F0AS57S0928/____________________.txt", "download_status": "pending"}]	text	viktor-테스트-01	점심친구
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.password_reset_tokens (id, token, user_id, is_used, expires_at, created_at, used_at) FROM stdin;
\.


--
-- Data for Name: permission_group_grants; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.permission_group_grants (id, permission_group_id, menu_item_id, access_level) FROM stdin;
1	2	3	write
2	2	6	write
3	2	7	write
4	2	15	write
5	2	8	write
6	2	9	write
7	2	12	write
8	2	13	write
9	2	10	write
672	14	2	read
11	2	58	write
12	2	59	write
13	2	2	write
14	2	11	write
15	2	4	write
16	2	5	write
17	3	3	write
18	3	6	write
19	3	7	write
20	3	15	none
21	3	8	write
22	3	9	read
23	3	12	read
24	3	13	read
25	3	10	read
673	14	6	read
27	3	58	read
28	3	59	read
29	3	2	write
30	3	11	read
31	3	4	write
32	3	5	write
674	14	3	read
675	14	4	read
676	14	8	read
677	14	5	read
678	14	7	read
547	4	2	read
548	4	6	read
549	4	3	read
550	4	4	read
551	4	8	read
552	4	5	read
553	4	7	read
\.


--
-- Data for Name: permission_groups; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.permission_groups (id, name, description, is_default, is_active, created_by, created_at, updated_at) FROM stdin;
14	사용자정의그룹-1	테스트 그룹 1	f	t	5	2026-04-09 13:34:45.213807+00	2026-04-09 16:29:27.679438+00
39	사용자정의그룹-2	테스트 그룹 2	f	t	5	2026-04-09 15:12:55.630528+00	2026-04-09 15:12:55.630535+00
2	시스템 관리자	모든 메뉴에 대한 write 권한 (system_admin)	t	t	\N	2026-04-09 11:42:40.893052+00	2026-04-10 15:18:08.838445+00
3	조직 관리자	기본 메뉴 write + 관리 메뉴 read 권한 (org_admin)	t	t	\N	2026-04-09 11:42:40.893052+00	2026-04-10 15:18:08.838445+00
4	일반 사용자	기본 메뉴 read 전용 권한 (user)	t	t	\N	2026-04-09 11:42:40.893052+00	2026-04-10 15:18:08.838445+00
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.refresh_tokens (id, user_id, token_hash, device_fingerprint, device_name, ip_address, expires_at, is_revoked, created_at, last_used_at) FROM stdin;
3	5	358d92eaa3b2a711e03e7ef05b4a10acae5eea6c68dc40f3984b83deb45e22cf	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-06 04:49:26.074346+00	t	2026-03-30 04:49:26.079375+00	2026-03-30 04:49:26.079381+00
79	5	587aa9d0e90474aa049df0e19009a3d9ab57ec5da557119887b5c7c3f3efa73a	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 11:17:35.514483+00	t	2026-04-03 11:17:35.524182+00	2026-04-03 11:30:35.21038+00
4	5	e99927fe467c6329af36076d97f8274aee1c3ce49fd84a50395a513b77f79526	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-06 05:00:41.022527+00	t	2026-03-30 05:00:41.024235+00	2026-03-31 08:31:52.803035+00
139	5	548c1048074464f938312a659fef333db9901bcb1791f2f6dcf548ef18667e82	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 18:38:57.136098+00	t	2026-04-04 18:38:57.143983+00	2026-04-04 18:51:57.127619+00
7	5	475f50991ee72fd6d72dcffe938dba935626b9d9c856485c574da99720064823	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-07 08:57:56.358286+00	t	2026-03-31 08:57:56.36195+00	2026-03-31 08:57:56.361955+00
5	5	28bfbc6f35104a500933f6174ae513aa601a9feb19a9fc81695706b1059c1c68	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-07 08:31:54.303173+00	t	2026-03-31 08:31:54.369451+00	2026-03-31 08:44:55.417225+00
18	5	9299dc0ed458de92d5a0648061eb76a84e7776f99d7b12ea2ac8fba3718e4777	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 10:36:02.949292+00	t	2026-04-02 10:36:02.974816+00	2026-04-02 10:49:02.147624+00
6	5	1c113a1ae8affcf2afd33977aedeab850103babed7840e2872f3f724a9573005	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-07 08:44:56.008166+00	t	2026-03-31 08:44:56.03044+00	2026-03-31 08:57:56.1446+00
141	5	4a268f80d03aa8c1a8fe9ab0cd3b2a880956caae203a29284f2d190f89685c27	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-11 19:42:59.006031+00	t	2026-04-04 19:42:59.016943+00	2026-04-04 19:55:58.98737+00
144	5	c8d08329eae9984b2b419cefe2af88bac7e759f8173544128c6a6ab6217356a7	b16653268523570bb6825820afb70672	Windows - Chrome	172.20.0.6	2026-04-13 00:35:47.827002+00	t	2026-04-06 00:35:47.827696+00	2026-04-06 01:01:04.480131+00
8	5	8350cf792427e15c950690d7f425b349e96508bd7a3783c1401b20ebadf3b85b	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 07:49:50.962952+00	t	2026-04-02 07:49:50.968107+00	2026-04-02 08:02:51.147138+00
148	5	d01b7e016fcaa015dcf48430928b7dc7ed415889b87d2d718dcc369d0933a2e2	b16653268523570bb6825820afb70672	Windows - Chrome	172.20.0.6	2026-04-13 07:15:31.384925+00	t	2026-04-06 07:15:31.400122+00	2026-04-06 07:15:31.400135+00
26	5	ffb63fef5b78f05cc4a34267d9c83d578f9db7fcab5dbbaffc6c4a465fdac710	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 16:58:12.228936+00	t	2026-04-02 16:58:12.235146+00	2026-04-02 17:11:12.076824+00
9	5	b153d7a63fd5aaac2240b5340a489f29bd1bc0ae6ad8b62b31be039f00a7bc8d	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 08:02:51.437912+00	t	2026-04-02 08:02:51.457719+00	2026-04-02 08:15:51.134762+00
19	5	c3b906bf7c62ae2ecd958cb239d2bb0bb1555c1ecc58906f3fccfe217d3cdeeb	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 10:49:02.314562+00	t	2026-04-02 10:49:02.333325+00	2026-04-02 11:02:02.451014+00
10	5	9fff8ef79b6fec68011e538d4be5cca9c54426571c0aa0aadeedc52ecd119041	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 08:15:51.231489+00	t	2026-04-02 08:15:51.237961+00	2026-04-02 08:28:51.14875+00
149	5	66ec4bca04e8205f6dc049fc585f2329c0e5085be252e39c95295f14238324ec	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 09:11:27.427877+00	t	2026-04-06 09:11:27.44273+00	2026-04-06 09:24:27.874956+00
11	5	b5080a0e5b610ed252369beb453ea6b4876537c3235f50415f956da236d9cbdb	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 08:28:51.282544+00	t	2026-04-02 08:28:51.289895+00	2026-04-02 08:47:14.994026+00
13	5	fd425583eae0074c27f1fb0f60d9d090bf9265427eb9796502a83ef5c68fea66	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 08:47:22.735092+00	t	2026-04-02 08:47:22.736041+00	2026-04-02 09:00:22.912165+00
20	5	56d46c153c81fe54d4f383fc8c1776babe1c05df05002ee1ff0d87eea96a8073	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 11:02:02.646921+00	t	2026-04-02 11:02:02.658982+00	2026-04-02 11:15:03.010989+00
14	5	4e43bda78bb8bf3e9db80116e6548961506ea7f8b7894179bef2c5b12838d82b	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 09:00:23.171651+00	t	2026-04-02 09:00:23.193818+00	2026-04-02 09:13:23.77275+00
16	5	8477fa119b7e0028a334717d0fb3df2015236ae5366344362d332796fa9f62da	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 10:10:01.841875+00	t	2026-04-02 10:10:01.846954+00	2026-04-02 10:23:01.781889+00
17	5	823429fd6571273d743ecdbaee3cba0f829086f1a9bc8471ebf1f8a38954b10a	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 10:23:02.086677+00	t	2026-04-02 10:23:02.103291+00	2026-04-02 10:36:02.494149+00
22	5	c6fa435c2323e4be3caa03b839e21500cb1b597963e978a27046810811ae92bd	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 16:06:12.271251+00	t	2026-04-02 16:06:12.287134+00	2026-04-02 16:19:12.222805+00
27	5	f3671406c393b9f4b7e7f66be13b2845b1837ce0ebe3f07a2eb0917aea1218fb	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 17:11:12.216975+00	t	2026-04-02 17:11:12.223869+00	2026-04-02 17:24:12.112164+00
23	5	2958e0796d1a4833a29e2cb2ac704c01769903766ab617ced07b24a622ef3c98	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 16:19:12.468285+00	t	2026-04-02 16:19:12.496861+00	2026-04-02 16:32:12.247114+00
24	5	8b6facf3f3932c019bb14b1426d488e0f98f729cef6e2745e84dd4f7b2b9c3ce	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 16:32:12.344674+00	t	2026-04-02 16:32:12.35291+00	2026-04-02 16:45:12.100708+00
31	5	eeba0644a73cd5878ea1e3e528ddc8fe40ed2f802ff421ac22eb4abefc724a5e	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 18:03:12.224274+00	t	2026-04-02 18:03:12.228311+00	2026-04-02 18:16:12.097532+00
25	5	6de5126540df9a2c2f73cdd53ef5d8a5ed226908957022703f9f90756d199842	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 16:45:12.217343+00	t	2026-04-02 16:45:12.229239+00	2026-04-02 16:58:12.129389+00
28	5	58c6fe15e592a232bb502b9d5eb46966be36611cb27203ea8cdda6cdb469d483	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 17:24:12.159389+00	t	2026-04-02 17:24:12.163033+00	2026-04-02 17:37:12.109234+00
29	5	d8cb0c4e24032e56f478a64efe7f0933de0d8031d72358084ada8e0bc83c6e76	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 17:37:12.193512+00	t	2026-04-02 17:37:12.198947+00	2026-04-02 17:50:12.10115+00
36	5	143de5eb69376d9f681fe910185cd91ec75050c373f568f84fe484504df0b8d6	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 22:27:28.813665+00	t	2026-04-02 22:27:28.830684+00	2026-04-02 22:40:28.902145+00
30	5	eeee6446f6cd25e4e519cc7753231f12839a2777e1335830d77dc47ee08dfd4d	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 17:50:12.142409+00	t	2026-04-02 17:50:12.144488+00	2026-04-02 18:03:12.13605+00
32	5	d0d641e7a8986562980d92b12da3bab0fbdb98b3bbb991767ca751806e987a12	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 18:16:12.146341+00	t	2026-04-02 18:16:12.148682+00	2026-04-02 18:29:12.133772+00
34	5	36de2464ef87d6cf0e00bdfecd99e82d212f665423fc07f2c2142d0a2d64d75d	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 18:42:12.449538+00	t	2026-04-02 18:42:12.461811+00	2026-04-02 18:55:12.217985+00
33	5	b14ef2fcf05a5cb8a8a49648ea4443cbcf782db58ae4a08d0839367f18950223	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 18:29:12.227552+00	t	2026-04-02 18:29:12.232394+00	2026-04-02 18:42:12.242266+00
37	5	8075c2fba165a93b7749a80bbd2ca986e937592a523447cb532029c5f5555287	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 22:40:29.115576+00	t	2026-04-02 22:40:29.130148+00	2026-04-02 22:53:29.120518+00
38	5	bffe9e6261a35864491a18aa919c26e1a32e559b988f566a367d2e4984305a98	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 22:53:29.217179+00	t	2026-04-02 22:53:29.223442+00	2026-04-02 23:06:29.127789+00
39	5	b02353d237dd9dfe08aed93cd1b9979f29df5fd8a4a781a1d4e0926cf93033d2	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 23:06:29.186818+00	t	2026-04-02 23:06:29.191439+00	2026-04-02 23:19:29.11071+00
41	5	dbdd5e5965eb956e82ccc3b795fbe8a67408ff66562aa99a3c55a2dfc6478b4b	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 00:38:56.230535+00	t	2026-04-03 00:38:56.235957+00	2026-04-03 00:52:09.724221+00
42	5	82836913dd1b5d63b65a51a1dd963fc6dea0f36417ae2b9211ef1fbdd4b71aac	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 00:52:11.93869+00	t	2026-04-03 00:52:12.049026+00	2026-04-03 01:09:54.750412+00
78	5	00df21536d984664cd8b1537249a83ab7fe85b489ceae85b8cb603598ac3b819	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 11:04:35.602143+00	t	2026-04-03 11:04:35.63252+00	2026-04-03 11:17:35.357786+00
43	5	a36776b64fd013766634f5451954950c950899b8c01231753200fde6cedb91d6	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 01:09:55.166552+00	t	2026-04-03 01:09:55.177618+00	2026-04-03 01:22:57.747384+00
80	5	7524bdb062af68c1cd1ad788925fc5da9e7d7080325b1770a3df74f6b5680750	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 11:30:35.320499+00	t	2026-04-03 11:30:35.325463+00	2026-04-03 11:43:35.385295+00
74	5	97e0802387fec91ca1c0c08638c1338b1c5ffbb4eb402a1598911e3f84a79b22	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 10:25:04.187508+00	t	2026-04-03 10:25:04.195574+00	2026-04-03 10:25:04.196084+00
44	5	4d49babfeef9016d3e12a691ad72f8a16411ff6d2b9e6172e1f62314cb3906df	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 01:22:57.911992+00	t	2026-04-03 01:22:57.925992+00	2026-04-03 01:35:57.212867+00
140	5	2bf1cc9ee10964c14b798c143bd0f1c39cb05319d1fb8f45cefe93ff1a63516b	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 18:51:57.161985+00	t	2026-04-04 18:51:57.162804+00	2026-04-04 18:51:57.16281+00
57	5	717fd3708cea6a78e4e7f8123abcccb22bcc89cd4cad988e45d851ec5d2ac10e	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 05:16:49.215535+00	t	2026-04-03 05:16:49.226933+00	2026-04-03 05:29:49.382238+00
45	5	44f4574b8ddafaa79224958c8fc5ff4090ef674c7b79d1bfe204de853a7d0dea	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 01:35:57.415587+00	t	2026-04-03 01:35:57.428629+00	2026-04-03 01:48:57.176877+00
81	5	9a6f100bb8d77fd0d2dba106147c1b68aa08137e7dfe5bb87bd438ba5f4627c9	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 11:43:35.528702+00	t	2026-04-03 11:43:35.538787+00	2026-04-03 11:56:35.357936+00
47	5	bd2675d9aed08757052321ee6d2b8e841876344293ff88ad0b6ed3157bde5bab	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 02:02:14.683842+00	t	2026-04-03 02:02:14.689472+00	2026-04-03 02:24:17.625172+00
145	5	bae558404deab8ad9b9433ee042b3824834cc9811895cc35560c849c2c9c4d13	b16653268523570bb6825820afb70672	Windows - Chrome	172.20.0.6	2026-04-13 01:01:04.920656+00	t	2026-04-06 01:01:04.947153+00	2026-04-06 01:14:04.679075+00
65	5	814c51d9671e4ac875a4ec0b78c4b1b577be116ce6da9111d9c354c34d458a28	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 06:58:19.059152+00	t	2026-04-03 06:58:19.082648+00	2026-04-03 07:11:18.321045+00
48	5	a90b4d924c656c797f728d19f6f0ca229169ea9c79bd767ad57815409e6857c2	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 02:24:18.63974+00	t	2026-04-03 02:24:18.678934+00	2026-04-03 02:37:18.676012+00
82	5	576e4d62678eeca630b5832e290f455f0e2c552849186aeeb021bb3ebcd94085	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 11:56:35.584037+00	t	2026-04-03 11:56:35.587422+00	2026-04-03 12:09:35.363867+00
58	5	83ee4c97b81bebf284a681ae98201e967f4f63fbf9335c4f92e167f7cf98fc7b	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 05:29:49.731369+00	t	2026-04-03 05:29:49.756857+00	2026-04-03 05:42:49.225218+00
49	5	641d03bb8ead0f7aa4883f4e3bbbe80d92f508d254236f9706406b93394dfde0	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 02:37:18.977509+00	t	2026-04-03 02:37:18.998629+00	2026-04-03 02:50:18.484589+00
46	5	0323d6b92ae6937d64dd3d9ff28cbf9b0fce96c6bdf259156ab69e48972c6897	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 01:48:57.471256+00	t	2026-04-03 01:48:57.506053+00	2026-04-03 01:48:57.506066+00
50	5	63a976c004c225e5f82c0ae669ec9cd7b215058aff843d2221ebc43ab2e70897	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 02:50:18.854666+00	t	2026-04-03 02:50:18.884864+00	2026-04-03 03:03:18.610813+00
153	5	b3e8251030f649170c9aed6ff79960a948f9cc543a5cedd8fca31cf3ca0b519c	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 09:50:31.980647+00	t	2026-04-06 09:50:32.276258+00	2026-04-06 10:03:31.435367+00
221	5	2d7c64fc8e3ae95e2dd6833892a3fbd5fab307ae2905de9391f015736a8eab2a	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 06:08:48.800762+00	t	2026-04-08 06:08:48.808114+00	2026-04-08 06:08:48.808117+00
51	5	a54882880ff3514e47175678a0f6acbe2c39f974b495620c622b381965f082ce	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 03:03:19.144012+00	t	2026-04-03 03:03:19.163816+00	2026-04-03 04:31:51.558454+00
156	5	1d96e8e4213642abe86405da029b7a3ab85e1472aae3b8f8a42ef1b8abae2f82	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 10:44:56.99505+00	t	2026-04-06 10:44:57.029913+00	2026-04-06 10:57:56.979921+00
52	5	d789b5aefeb00fe29fde9cca03ac1ef10e9c6cc618e6ef993552b2a9207dfa76	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 04:31:52.330289+00	t	2026-04-03 04:31:52.350472+00	2026-04-03 04:31:52.350495+00
53	5	46386168aec7a4d0ce7cd626260c768ca1c6c2648aa2d67e4cb46046535ada38	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 04:32:43.92615+00	t	2026-04-03 04:32:43.928214+00	2026-04-03 04:45:44.392664+00
160	5	f24a63d69ab2a6d811669c2367f331ad69b92faa60bbdc12e30ef81028f6375a	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 11:35:45.281789+00	t	2026-04-06 11:35:45.297086+00	2026-04-06 11:48:45.735199+00
60	5	93480a21e63edb8d491a2df4ba5aecb490611be0d387ca2531980e79666df590	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 05:53:10.573221+00	t	2026-04-03 05:53:10.578595+00	2026-04-03 06:06:10.717983+00
54	5	365b65d8ba1f94e51e8490bcdd735ccb8deaa7638753fdff284f1e9e21edd499	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 04:45:44.809887+00	t	2026-04-03 04:45:44.839791+00	2026-04-03 04:58:45.59691+00
55	5	7fcf4d43510d46f7d0eef999a62b80a0a64dfbe2a6ed2f05252642d16b8435a9	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 04:58:46.206687+00	t	2026-04-03 04:58:46.277446+00	2026-04-03 05:11:49.468772+00
70	5	2a6a73a89205133df75fac58a27d6851a83b0f2fa94327b963aeff9ffdec7176	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 08:11:32.392498+00	t	2026-04-03 08:11:32.407719+00	2026-04-03 08:24:35.405883+00
61	5	35a27bc4e4e44a53ab7a15a672f92b523097d0a79302848344ac01238d6c2896	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 06:06:10.781314+00	t	2026-04-03 06:06:10.785924+00	2026-04-03 06:19:10.416891+00
66	5	2e832377f2a2ef24f3612201f73413745fc2ec135c46b159456d27b08dc84019	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 07:11:18.532286+00	t	2026-04-03 07:11:18.54858+00	2026-04-03 07:24:19.209477+00
62	5	3e437700639245168be522644b13635ba75d8d2dedeb9d07adb524660b179a60	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 06:19:10.598322+00	t	2026-04-03 06:19:10.625992+00	2026-04-03 06:32:10.924371+00
63	5	27fead1a5786de510c77988387602244c920667648ef4be70b5abf9314d1d8fd	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 06:32:11.139903+00	t	2026-04-03 06:32:11.155085+00	2026-04-03 06:45:17.468399+00
64	5	14e9ccc046823a1800670e7893f1409605042c4277a35147ea4f7bc27d5e3f53	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 06:45:18.298433+00	t	2026-04-03 06:45:18.374424+00	2026-04-03 06:58:18.737349+00
67	5	bf9754afdb6554de6254fd47c27908f8f52c9de62f4dcd8a1158eec0e8270618	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 07:24:19.570543+00	t	2026-04-03 07:24:19.589949+00	2026-04-03 07:37:19.215378+00
68	5	d3f6ef2fc927fbe1d910b8dccc0183fce95c4e5195f7df8b63129365fe721e07	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 07:37:19.581329+00	t	2026-04-03 07:37:19.606595+00	2026-04-03 07:50:19.692511+00
72	5	8782b83d8292d0e2244240a598db120917aae416d6a85e06d75586c3f0225de3	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 09:56:10.945319+00	t	2026-04-03 09:56:10.973171+00	2026-04-03 10:09:11.040534+00
75	5	fad6f6e8edb87914486ecef58296c3c0e837fceeadbf5f3b53119094e1f53a6c	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 10:25:34.212463+00	t	2026-04-03 10:25:34.213651+00	2026-04-03 10:38:35.021378+00
76	5	30eea0363b28a5c09a47c1b7400bbda0512e9f49487523b4e2d220b4d5ad8e1b	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 10:38:35.441221+00	t	2026-04-03 10:38:35.46364+00	2026-04-03 10:51:35.301279+00
77	5	97b30eb58a88ffcce5858aee59518700b70c61e8441318df21e376be52543596	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 10:51:35.714793+00	t	2026-04-03 10:51:35.721271+00	2026-04-03 11:04:35.390682+00
83	5	bc59214cc38b8f7df5ba25de2920ccfc87f310a9a60bde4a0c091e6b5bba556c	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 12:09:35.537551+00	t	2026-04-03 12:09:35.549126+00	2026-04-03 12:22:35.082691+00
84	5	78c246f5937a2f59d7857d40c9d3ebef1f9c9540f09ab007522929e586c7bd58	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 12:22:35.119756+00	t	2026-04-03 12:22:35.121367+00	2026-04-03 12:35:35.128103+00
142	5	e9418234d070ef0db8569791d9d9741f27f439e23e571bedd86608e281803051	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-11 19:55:59.031071+00	t	2026-04-04 19:55:59.033937+00	2026-04-06 00:35:41.974067+00
111	5	d4d78202b53107f9340e45502f12ec1ab63dc69c3935c84c47474d8d0c6a557e	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 13:49:28.577313+00	t	2026-04-04 13:49:28.583626+00	2026-04-04 14:02:28.077525+00
85	5	e490238a6c75968bc68f7df7187225f975b170fd9ac8241078b8ecf9e03c1855	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 12:35:35.191959+00	t	2026-04-03 12:35:35.195046+00	2026-04-03 12:48:35.266381+00
99	5	bc1d6fec1a4239b9de131ea6e54f6feb4e7972e0f62c55c633a2cb0708b5a1fd	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 01:02:34.951757+00	t	2026-04-04 01:02:34.968334+00	2026-04-04 01:15:35.040939+00
86	5	111f52ce3157aa91e7bb1c3c6b5485a5f0308b71da2ddccd6d0b91e6a006ee40	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 12:48:35.420606+00	t	2026-04-03 12:48:35.428366+00	2026-04-03 13:01:35.221047+00
146	5	81f4f8bf769332d59e2757229ce39b616f86e819305c371dc2c74ef71cd08a37	b16653268523570bb6825820afb70672	Windows - Chrome	172.20.0.6	2026-04-13 01:14:04.883528+00	t	2026-04-06 01:14:04.891017+00	2026-04-06 06:59:11.90541+00
87	5	9ca8024669e954c55fd48f2f4c071b3ef87c7cf7f79e85118582baeee51ad5cd	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 13:01:35.325521+00	t	2026-04-03 13:01:35.33145+00	2026-04-03 13:14:35.107376+00
151	5	ae3e8e80756f9e7b956b34643a68d256db9a190d06a745c64eaf45070c5e636d	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 09:24:28.198357+00	t	2026-04-06 09:24:28.204839+00	2026-04-06 09:37:28.109745+00
106	5	fc1953f28c4d33399dddb1c25513c63468f86856bebfbdc1280e5261388c7fe4	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 02:33:35.405341+00	t	2026-04-04 02:33:35.408985+00	2026-04-04 02:46:35.385412+00
88	5	e6841fbde639e9fbfdce654e17fe24cf575178875acbc73ad3f980c5fcea4b8e	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 13:14:35.229236+00	t	2026-04-03 13:14:35.244272+00	2026-04-03 13:27:35.549519+00
100	5	f5d0da0333ee17e08c7955cd3852efc2779f4bb4d02cb8b6ddf90b6fe0b9b27a	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 01:15:35.201443+00	t	2026-04-04 01:15:35.214677+00	2026-04-04 01:28:35.071631+00
89	5	2ff75c2e06c162764d19316e70573ba0e7092820a8629b87fd4f700f42bedd4d	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 13:27:35.842807+00	t	2026-04-03 13:27:35.860494+00	2026-04-03 13:40:35.229679+00
154	5	e3a9c297622d3935c7e1149ca277ca13b08cec3d61a98158ae45642ade1370e6	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 10:03:31.540297+00	t	2026-04-06 10:03:31.544752+00	2026-04-06 10:31:56.905641+00
90	5	3114c250d40d10db77a457bce864d5e39613ed5ed53f0f444e6395d79e972187	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 13:40:35.371913+00	t	2026-04-03 13:40:35.380651+00	2026-04-03 13:53:35.397025+00
91	5	f249bd9243558282e5f480d9fb2506a5b38fae0968a304b66aa32d6cb2b2bd0f	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 13:53:35.643802+00	t	2026-04-03 13:53:35.655122+00	2026-04-03 14:06:35.964187+00
101	5	4b8bae896f5843323ade2232fefc41bb7117bbc5e85b662488c61d7c1e0eda44	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 01:28:35.102514+00	t	2026-04-04 01:28:35.103954+00	2026-04-04 01:41:35.060529+00
92	5	eebbef9fa7c6495ea4809c5c883fc60ccc2bf23e2055038312a002760f78303c	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 14:06:37.279227+00	t	2026-04-03 14:06:37.309809+00	2026-04-03 14:19:37.171622+00
163	5	f4ab3558d774982718622a138c299ce3e8817f922ed99ee8c588bd58dab88eaa	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 13:12:08.376743+00	t	2026-04-06 13:12:08.377821+00	2026-04-06 13:25:08.438875+00
93	5	d3b86a0f5e93d3caf269eeacb93150761cea490c4c2e8348ce3419779cfc4bee	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 14:19:37.387089+00	t	2026-04-03 14:19:37.395294+00	2026-04-03 14:32:37.236503+00
97	5	75990a9724d5c0520a95367cebe4587c547d460428bf8345ac96bfe9259d9a43	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 23:49:28.861708+00	t	2026-04-03 23:49:28.862716+00	2026-04-04 00:02:29.064166+00
102	5	3b32eaeb9a9fd1d2df9fcecbf1139fd751198d604eed30e33e82bb897f5d2ae0	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 01:41:35.128236+00	t	2026-04-04 01:41:35.132496+00	2026-04-04 01:54:35.074573+00
107	5	78ed5304686a6e7a1d0d43c355d2cd2be28fdccffbfabba2165dfeb29b3117e4	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 02:46:35.605923+00	t	2026-04-04 02:46:35.622222+00	2026-04-04 03:13:26.551796+00
103	5	00b7184b0001b0aebca31eef57dd49e2d7baf4797e28d8a5ada7e5f04797427e	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 01:54:35.127101+00	t	2026-04-04 01:54:35.13195+00	2026-04-04 02:07:35.119472+00
104	5	3e56c1c830a0511b99e7210ebfceb164f3bc43aa796f726b39192a5036b659ee	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 02:07:35.172495+00	t	2026-04-04 02:07:35.174486+00	2026-04-04 02:20:35.085568+00
105	5	955987605986d4c7fad51848f956bf9605f4369111708badc043283315251c6e	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 02:20:35.151933+00	t	2026-04-04 02:20:35.155414+00	2026-04-04 02:33:35.279888+00
114	5	d96f077d7aee4d7a78fa22a9777b14814aa05ab6c3eccdb0bca932553b665efc	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 14:28:28.122099+00	t	2026-04-04 14:28:28.123358+00	2026-04-04 14:41:28.065616+00
109	5	af0715a8adc7d445daa0dec9f755ca454f115c02b6313eaeff0ce39c5ee415fa	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 13:11:39.416924+00	t	2026-04-04 13:11:39.421088+00	2026-04-04 13:24:39.471175+00
112	5	9284ea2e027d4dd29b316c28500721993ce4cabe899088b5b8170c0d15e463d2	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 14:02:28.126459+00	t	2026-04-04 14:02:28.130072+00	2026-04-04 14:15:28.219223+00
110	5	756304b69497b688aba5e9472dab9d2ddaffc03ddde01b4c216117386397dd66	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 13:24:39.506197+00	t	2026-04-04 13:24:39.50692+00	2026-04-04 13:49:28.544065+00
113	5	7eba7960f2798ff84f1f8fa596090a1627fdd55182107602db853fdd08973632	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 14:15:28.253988+00	t	2026-04-04 14:15:28.254901+00	2026-04-04 14:28:28.097746+00
116	5	3a0bc11edf12a8e6d97c8de768be38384192b31b86c6a0f8f6353431818200be	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 14:54:28.239869+00	t	2026-04-04 14:54:28.240409+00	2026-04-04 15:07:28.198137+00
115	5	a8372f7f754026ed97ce2480f13d08bfa72f67488fda4fa4faf54ef4b049da09	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 14:41:28.158378+00	t	2026-04-04 14:41:28.158786+00	2026-04-04 14:54:28.220898+00
117	5	df1c654f4fc0ad3e0fc841a6bdbc6ee0a268adb8840c1ec45fd48360bd2332ba	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 15:07:28.221455+00	t	2026-04-04 15:07:28.221836+00	2026-04-04 15:20:28.197526+00
118	5	7d623daaf5863e3b7fc766e90fb3c6449f038e605972ccd7063b20e01da1fffd	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 15:20:28.212577+00	t	2026-04-04 15:20:28.212961+00	2026-04-04 15:33:28.247037+00
119	5	c8e33a1a53e93b11b6e58e2afcabda12e7a43e39d9c6eaab18b3d56dcfee20e8	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 15:33:28.28646+00	t	2026-04-04 15:33:28.28825+00	2026-04-04 15:46:28.054853+00
120	5	888072a8898a92a83f2e869f1f5cdb7d48b49cf3949652e2ec42ed2758a855e2	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 15:46:28.102793+00	t	2026-04-04 15:46:28.104532+00	2026-04-04 15:59:28.034791+00
121	5	f9d57b7ab117c2a573565b7759c5d7ba59946915baef22d5c1bd814811697d90	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 15:59:28.059365+00	t	2026-04-04 15:59:28.059663+00	2026-04-04 16:12:28.079095+00
94	5	c3d95d69d7c8a986e8627f113786a5c6b7af52c853e280a45ae936af025b6686	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 14:32:37.433704+00	t	2026-04-03 14:32:37.444744+00	2026-04-03 14:32:37.444782+00
147	5	fc80e1ef916a39264f9bbe7cf24b75308a6e3723df522463fb62ec10949a4024	b16653268523570bb6825820afb70672	Windows - Chrome	172.20.0.6	2026-04-13 06:59:12.6205+00	t	2026-04-06 06:59:12.652614+00	2026-04-06 07:15:30.95537+00
138	5	6552294d914479cfe430585fa38b3c5c4bd89f1e0f89f6f8e779a5947539859f	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 18:25:57.281124+00	t	2026-04-04 18:25:57.284098+00	2026-04-04 18:38:57.082466+00
215	5	ea5af6befcd97e329a3401532161461f63b9d6868a757e6d895475268a609d3c	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-14 12:12:42.526305+00	t	2026-04-07 12:12:42.532169+00	2026-04-07 12:25:42.663772+00
122	5	183af9ef688fe46901d4854edd907df0fe0d7c1acb4ce6df5d47838bbab90440	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 16:12:28.110758+00	t	2026-04-04 16:12:28.112242+00	2026-04-04 16:25:28.061865+00
143	5	81c8d2c35821d6e93bb167053ac6ed2f6c39fd3fb780ccdc703a6f5431369059	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-13 00:35:42.484161+00	t	2026-04-06 00:35:42.502546+00	2026-04-06 00:35:42.502562+00
129	5	d99d5924125584e280cccf41c8f780b9d87838c1a6ed616e356cba6e8ea4685b	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 16:38:59.24634+00	t	2026-04-04 16:38:59.247234+00	2026-04-04 16:38:59.247238+00
134	5	e65eda092cf32aeb2b0f5ba5079433b8776b406e58ca49ea2df40dcef7c40505	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 17:36:34.124738+00	t	2026-04-04 17:36:34.127594+00	2026-04-04 17:36:34.127597+00
126	5	80354ab903a42829d796308eb4eed03b283623054b34cf5ad1eaf11f87b5c031	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 16:25:28.091586+00	t	2026-04-04 16:25:28.092124+00	2026-04-04 16:38:52.077077+00
12	5	bef140642589ee4c5541688062ea0c99cd4c8a7ce87b8fe5fe2ea62f62dab5cd	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 08:47:15.305228+00	t	2026-04-02 08:47:15.323659+00	2026-04-02 08:47:15.323669+00
15	5	391a0d5cb41c8b247f1915da2d26f45dbbf6e69dafc2539316ca87957ae4952a	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 09:13:23.918215+00	t	2026-04-02 09:13:23.925073+00	2026-04-02 09:13:23.925085+00
21	5	7405f4009426ea1e3dd0b0997bae4379eee7ae8904b981c8059af2a435819e66	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.1	2026-04-09 11:15:03.252101+00	t	2026-04-02 11:15:03.26804+00	2026-04-02 11:15:03.268048+00
35	5	2d748be8d64e544b54704b6a97957a8bfbe9458cb5b7d3ac3716ff1fa51ed06c	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 18:55:12.371223+00	t	2026-04-02 18:55:12.381811+00	2026-04-02 18:55:12.381821+00
40	5	7335ce881514a37942f4056e5b5d9823f8c2494b41668d79758e60f2f1c32c28	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-09 23:19:29.161943+00	t	2026-04-02 23:19:29.163484+00	2026-04-02 23:19:29.163491+00
59	5	4ee34322279cb11832eb69878ade5abc928e9c9976cc03ac262cfb2ace8569b0	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 05:42:49.42913+00	t	2026-04-03 05:42:49.441232+00	2026-04-03 05:42:49.441255+00
56	5	dab7b11963b6a7e0a08d922b8db9a671967dcedc7d3c5592442edb0d6c8ee788	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 05:11:51.570251+00	t	2026-04-03 05:11:51.671204+00	2026-04-03 05:11:51.671229+00
71	5	a131ad63123f6a8560db6252aedf027ec8b4e4fd2b62bff4403f0053ad09116b	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 08:24:35.927497+00	t	2026-04-03 08:24:35.942286+00	2026-04-03 08:24:35.9423+00
69	5	88ae34fdce6218fa8579707c6e18baaf02b3af82563bc918ea20782b055d37ce	0713e7cb67cb74e4f773de15d0564644	Windows - Chrome	172.20.0.1	2026-04-10 07:50:19.918009+00	t	2026-04-03 07:50:19.93247+00	2026-04-03 08:03:20.149612+00
73	5	9e048fa0df106d1c86dc1ee2997d81bb460f516a44aaf2a19665ce37144225a4	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 10:09:11.270745+00	t	2026-04-03 10:09:11.289119+00	2026-04-03 10:09:11.289137+00
95	5	0a90da39d1ac8bd04668d65ebe2ff07d8714de698308bd30fab4c29555769633	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 14:57:34.376083+00	t	2026-04-03 14:57:34.385931+00	2026-04-03 14:57:34.385943+00
96	5	53fc26c9d7b505b042d1a7cbbe37e49dd8fd14f9eaeca607c2600d730378b4b5	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-10 23:43:55.354799+00	t	2026-04-03 23:43:55.363619+00	2026-04-03 23:43:55.363635+00
98	5	24d948b5fb385c2e914d426d874777e797106264b58705b31c46f2cec9ead826	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 00:02:29.135595+00	t	2026-04-04 00:02:29.138365+00	2026-04-04 00:02:29.138368+00
108	5	a42a9e497a9ffd78cdefd3d0fb163d8655d71c886192d73117c890781b92b700	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 03:13:28.462484+00	t	2026-04-04 03:13:28.528682+00	2026-04-04 03:13:28.528705+00
123	5	79b54e780f9607ae2284bdbc1f024d9cda20502ad84af5f72da4b26c05d12987	\N	\N	172.20.0.1	2026-04-11 16:21:51.42697+00	t	2026-04-04 16:21:51.429976+00	2026-04-04 16:21:51.42998+00
124	5	3c5b71b0ccad45e00a5cee2c34729ffec2874c589f8379edd1fcb4397134d746	\N	\N	172.20.0.1	2026-04-11 16:22:00.245766+00	t	2026-04-04 16:22:00.246919+00	2026-04-04 16:22:00.246923+00
125	5	da0dd2e2f2f52f396d70a3d1d9e620e13ac3e19a22617cf5e0715697be2ad8d7	\N	\N	172.20.0.1	2026-04-11 16:22:06.463146+00	t	2026-04-04 16:22:06.464167+00	2026-04-04 16:22:06.464172+00
127	5	193fc0c784e658c51cc95046c023bde16509b6a90b24988d47219fa96deab79c	\N	\N	172.20.0.1	2026-04-11 16:34:53.056342+00	t	2026-04-04 16:34:53.057695+00	2026-04-04 16:34:53.057696+00
128	5	0b97c7680d3902164abc6764a8014f6cfcf393c45ca7fd8baac150cfbd9062c2	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 16:38:52.232037+00	t	2026-04-04 16:38:52.282758+00	2026-04-04 16:38:52.282764+00
155	5	24bc9e2b2832335f7c279ea07dfed5d5eb73247672c64b559f0508c039a75bce	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 10:31:57.045239+00	t	2026-04-06 10:31:57.047929+00	2026-04-06 10:44:56.649266+00
133	5	83639d8e4e0ac794866cdcff20201bf0d6b152fec26845e211edd5021099235a	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 17:23:34.161086+00	t	2026-04-04 17:23:34.165612+00	2026-04-04 17:36:34.072243+00
130	5	e27f33c7e853c007832048b33b2e0841b09dc9a2b2840d1dfa6e79083e01d8cb	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 16:44:34.189958+00	t	2026-04-04 16:44:34.192235+00	2026-04-04 16:57:34.319758+00
131	5	36dfd889d16b0be1f474af0d8caf0b20bad5d0dfc1d4c774852c6dadc1d01d75	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 16:57:34.477382+00	t	2026-04-04 16:57:34.496874+00	2026-04-04 17:10:34.065635+00
152	5	cd18added98931407d374c09eb3bcc3f66b150c79555ddb93860bc1b28c46fbb	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 09:37:28.211462+00	t	2026-04-06 09:37:28.223531+00	2026-04-06 09:50:30.532092+00
132	5	bd6d7e4268ae9d7d6640eb3878d8c4f5178695e1f3fb989a14bc56ab594f55ad	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 17:10:34.13188+00	t	2026-04-04 17:10:34.135107+00	2026-04-04 17:23:34.078644+00
135	5	f9bc4491300d5af5dfc5eb1bd2c07e61a6c1a69e71dd4f205c61e0028dd6cc4f	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 17:46:57.345909+00	t	2026-04-04 17:46:57.350586+00	2026-04-04 17:59:57.436122+00
157	5	ec20a84cfc2fa264b033da6114668f7623965d710c4d34c0c06e2870e2b59f2a	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 10:57:57.924308+00	t	2026-04-06 10:57:57.960799+00	2026-04-06 11:10:57.10545+00
158	5	16ee8eefad2760c364fa82871ad701145751e3af663e296aaa81a54f336ad1cf	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 11:10:57.206498+00	t	2026-04-06 11:10:57.214604+00	2026-04-06 11:23:57.123581+00
136	5	179f56c2704b456c01351097265aa3880ad1ef1dd0293a2cd759857f3da070dc	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 17:59:57.48069+00	t	2026-04-04 17:59:57.482452+00	2026-04-04 18:12:57.091063+00
150	5	5a8a25ab15ecd1fc147cfaef4c7d50a9922429e85d4cc44d8574c11225db6a22	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 09:12:25.761629+00	t	2026-04-06 09:12:25.764249+00	2026-04-06 09:12:25.764568+00
137	5	57f09ffe4224ac887deb6bfd1b641f1c66174bea4a63b96413fed1d5e1d39589	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.1	2026-04-11 18:12:57.151137+00	t	2026-04-04 18:12:57.158522+00	2026-04-04 18:25:57.221518+00
161	5	581baacdd3a900c05b51fb58d31c3d28f148d33a88ac6de09f09b4306623511f	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 11:48:46.126533+00	t	2026-04-06 11:48:46.142447+00	2026-04-06 13:10:10.736999+00
162	5	7dc5d7da73af6be39939bc935311ee4466005c568bffa991c9fa5bbf8cf999b2	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 13:10:11.832552+00	t	2026-04-06 13:10:11.897376+00	2026-04-06 13:10:11.897394+00
159	5	ff187ac061561a0f507b798c346e4b57641df77d28cc78960786d58345bdd9fd	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-13 11:23:57.256924+00	t	2026-04-06 11:23:57.264098+00	2026-04-06 11:23:57.264123+00
164	5	e1f2cff18b0871e28fd5b59a14f24685a36cea07109495ab673d90f5f5464cf8	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 13:25:08.644493+00	t	2026-04-06 13:25:08.659474+00	2026-04-06 13:38:08.508629+00
217	5	703524c957618b241c1df5663a2b2619c4d0c6aeda9ef9667f22aa29b8887770	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.5	2026-04-15 02:50:32.700475+00	t	2026-04-08 02:50:32.704395+00	2026-04-08 03:03:33.319904+00
177	5	3db2bd6d330e11d4d9005efda59aa08bb591a69cd1b8afd97514d6720c11e4e5	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 16:10:07.511282+00	t	2026-04-06 16:10:07.541118+00	2026-04-06 16:23:07.550568+00
165	5	378552c322742e0d3a67d2277f397a4a1be9375dd4d1605c42224a1cf3bb554c	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 13:38:08.890283+00	t	2026-04-06 13:38:08.926489+00	2026-04-06 13:51:08.917319+00
227	5	6f9f784eb2b2870b75b19d848bef2c66bfa1a4028e0387d8db2c5706a1ed50b3	\N	\N	172.20.0.1	2026-04-15 08:12:14.526705+00	t	2026-04-08 08:12:14.536405+00	2026-04-08 08:12:14.536412+00
166	5	d51d82721b2941d14f34d3d117b441ac0c6a09d26dd14b4f917894b101a783a7	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 13:51:09.58648+00	t	2026-04-06 13:51:10.039461+00	2026-04-06 14:04:09.099633+00
191	5	f7b9ec64e06ffe05ad94797e8aed56a1b43cc6585bd01a619dd11c895893f553	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-13 23:55:42.233803+00	t	2026-04-06 23:55:42.234282+00	2026-04-07 00:18:18.646285+00
167	5	87e6441c91dc8c307f3a7e07a4c058e269f02a54ef325baf56d8a150e77eb6fe	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 14:04:09.195907+00	t	2026-04-06 14:04:09.198938+00	2026-04-06 14:17:09.310915+00
178	5	f0dfbe46e8522d04ba7bd0d36d5da86ba3db4d9f3ed46202bcd1f490ba07cdca	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 16:23:07.986771+00	t	2026-04-06 16:23:08.01125+00	2026-04-06 16:36:07.623313+00
168	5	b9111b48d428d3e6add95c1d3aa175f5ff148f1c715f964c3d7df1ed34e2c574	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 14:17:09.70367+00	t	2026-04-06 14:17:09.750395+00	2026-04-06 14:30:09.133566+00
169	5	81368572437b0f7213bdb1df277ee1b4ef73907bcd7235063e7e800c9df8182b	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 14:30:09.335394+00	t	2026-04-06 14:30:09.361713+00	2026-04-06 14:43:09.629194+00
186	5	0bab3ed1bd8183baa3ee30677aea20f483e801863f0613a5de0eccaa2c46f34a	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 18:10:01.700799+00	t	2026-04-06 18:10:01.718583+00	2026-04-06 18:26:21.633506+00
170	5	e7afaf7eee65389979e415bb9ef9132c7a9129249d4cf9dbc8fa53bd2caab84f	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 14:43:09.868055+00	t	2026-04-06 14:43:09.885007+00	2026-04-06 14:56:09.107335+00
179	5	6a82ece01d0d60e0d45f1e0ad1c0442e74e5caddbda46b80e0b77e686eac1751	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 16:36:08.218808+00	t	2026-04-06 16:36:08.284204+00	2026-04-06 16:49:08.089953+00
172	5	240f6da196040c97c09442ff63fdfd9ea6929b532aecb8a7e5140520803e1c21	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 15:05:05.808353+00	t	2026-04-06 15:05:05.810218+00	2026-04-06 15:18:06.569243+00
173	5	60bc785b0ec66cd92485b1b0ec1ff3df4f19495f5634bde82d15940a7a4cccee	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 15:18:07.097429+00	t	2026-04-06 15:18:07.124926+00	2026-04-06 15:31:06.088067+00
174	5	0e58f656c9e53010cf5db7a6f35b355d78f0dfdcbd54600c50ae5495ac0c818a	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 15:31:06.169339+00	t	2026-04-06 15:31:06.176005+00	2026-04-06 15:44:06.580209+00
180	5	3ada1b8fb211842370140a6464452ed3f9c12a19be5a3d14d9546fde0ad4e73f	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 16:49:08.122944+00	t	2026-04-06 16:49:08.124015+00	2026-04-06 17:02:08.097062+00
175	5	1589a1df49f5035bdc0a6cf7133d1dba838a4958d4403382cc4e22e96e2327f2	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 15:44:06.88499+00	t	2026-04-06 15:44:06.900126+00	2026-04-06 15:57:06.081573+00
176	5	57b27532367e1fd9d8a110c28613c9e2c81982904d1bb92a40ae9aed63ec4e82	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 15:57:06.203062+00	t	2026-04-06 15:57:06.212046+00	2026-04-06 16:10:07.00148+00
187	5	3a420ed4cd1b1e88afd87ac9813de1e86381961a959b6eaf53bda7ef3f112d48	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 18:26:21.892321+00	t	2026-04-06 18:26:21.903019+00	2026-04-06 23:37:49.874849+00
182	5	97a2dd4b8ce8fdc09fb144c627b6ca6dfce530263e30ed77537be8c06e0db12b	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 17:18:00.934854+00	t	2026-04-06 17:18:00.937722+00	2026-04-06 17:31:01.296598+00
183	5	58aff0c7b6b2a759967aa200c551b016d79f2e0b537717681ea36c1e69b7601b	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 17:31:01.784099+00	t	2026-04-06 17:31:01.804859+00	2026-04-06 17:44:01.367252+00
184	5	6078480dbb4683d4a4f21029b843e2927daf9b5661a3c754d6a2bd64a18e5111	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 17:44:01.659865+00	t	2026-04-06 17:44:01.68324+00	2026-04-06 17:57:01.516726+00
188	5	c7851004ff01b02036e35a953cf587d87c0eb385b1a67afcce2f1b1fb95bf44b	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 23:37:50.793718+00	t	2026-04-06 23:37:50.845062+00	2026-04-06 23:55:33.387844+00
185	5	cf2392d11be1143e07fed14040abf92c25cbc8d066dd7c6430343a6ab6d2aec3	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 17:57:01.780594+00	t	2026-04-06 17:57:01.804791+00	2026-04-06 18:10:01.395192+00
171	5	f0d9cc90f676de46ed4e066aaa40ff5e8cd25635ab0f103be2fd2559efb339d8	58fd16bd3df02306c22cb472ebfc587e	Windows - Chrome	172.20.0.6	2026-04-13 14:56:09.246862+00	t	2026-04-06 14:56:09.253612+00	2026-04-06 14:56:09.253619+00
181	5	97c9a990744e66a0017f5c0c78e60c73f8652c55a7171c2e1f65937dc129f730	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 17:02:08.197967+00	t	2026-04-06 17:02:08.202318+00	2026-04-06 17:02:08.202323+00
189	5	33f5e5db3556d1a14c028924e003a00cc85393c9a5b0d14f18f6aacf1fca2fb0	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-13 23:55:34.077181+00	t	2026-04-06 23:55:34.093581+00	2026-04-06 23:55:34.093619+00
195	5	d4938ce0de688c5cdd45148677467191c4feb07f14ea7beb35ca8ef941ed5198	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 01:30:04.384815+00	t	2026-04-07 01:30:04.38797+00	2026-04-07 01:47:10.610086+00
192	5	55c368badfeb2a62593beaff4a4818de5d916a3397550a932a0a5310aefb64a5	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 00:18:19.163301+00	t	2026-04-07 00:18:19.194217+00	2026-04-07 00:31:19.790883+00
193	5	6c61b4ad6df9d3163b96544436f078a477b5522ee04e71e7a98f2705c5aaaf2c	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 00:31:19.957114+00	t	2026-04-07 00:31:19.969848+00	2026-04-07 01:26:59.211324+00
196	5	1cdbc45740992059dd6dbfac12c67d9b15b7a7aca1a59d49687e204a8275ab55	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 01:47:11.115751+00	t	2026-04-07 01:47:11.165009+00	2026-04-07 02:00:11.690047+00
197	5	25dabbc86351215f43aed85df37a69a4a9ba54db7b6f2b8d342652d24793ac32	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 02:00:11.928764+00	t	2026-04-07 02:00:11.953059+00	2026-04-07 02:43:38.141234+00
198	5	28b5f9a0f2166fcc3ccb5f973ba00b596774b44ec3ef6f6a635339e189075d3e	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 02:43:38.520284+00	t	2026-04-07 02:43:38.526147+00	2026-04-07 02:56:38.248433+00
199	5	ffb76058eefc80c64f4ad79eb3ac391f802532bbf58df5ef21f671077cb4b26c	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 02:56:38.407067+00	t	2026-04-07 02:56:38.415477+00	2026-04-07 03:09:38.502691+00
200	5	7c5735a5047dacb368000bcfb8a29bd046e4ebc88c1564628e97b5ccf335a72b	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 03:09:38.700546+00	t	2026-04-07 03:09:38.713875+00	2026-04-07 03:22:38.788393+00
201	5	5071c8252bad1e38f6de9aeea1dcb67639f7a4fba5f5cceb7930c9acb6fb060e	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 03:22:38.988765+00	t	2026-04-07 03:22:38.996799+00	2026-04-07 04:39:03.934745+00
202	5	f1bbd051d3e9111436498c37d9b97ff63f2364d74d825554cbb26721cbe57bba	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 04:39:04.47981+00	t	2026-04-07 04:39:04.501144+00	2026-04-07 04:52:04.152152+00
190	5	50b894325f414b13f6eb058db7b3059e2f84ab5cffe08853784ce9cb7b281666	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-13 23:55:35.931937+00	t	2026-04-06 23:55:35.932643+00	2026-04-06 23:55:35.932645+00
203	5	987edba9f9c27baaf45514917ecdbba555b7171649690ddf2c5912db8f956ad8	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 04:52:04.33571+00	t	2026-04-07 04:52:04.349111+00	2026-04-07 05:05:04.838914+00
231	5	91539fe174a52434183a2abc9883d0330245f819288c2929e3459a17fe9302a1	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 08:57:55.214884+00	t	2026-04-08 08:57:55.222317+00	2026-04-08 08:57:55.222323+00
218	5	35653af375e453e16a3bae3668c8533a3828aa5ea6f769a125999e6dfa9ee714	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.5	2026-04-15 03:03:33.529252+00	t	2026-04-08 03:03:33.53752+00	2026-04-08 04:41:15.071885+00
219	5	42ee0c1780a6461fc8f837602e1a491db701ac13ec1590d6eb04c40b5351bcf0	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.5	2026-04-15 04:41:16.57981+00	t	2026-04-08 04:41:16.587413+00	2026-04-08 04:54:16.060248+00
205	5	07af33fd4c29bbe0ea349f68b952b50eabc00dcabfafe07b86f79106ed510dbc	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 05:23:53.274026+00	t	2026-04-07 05:23:53.292149+00	2026-04-07 05:44:39.654596+00
220	5	19abfca361e4abc158c09a1fe20b5408eba710efae2005f40aedf5e5b5009c96	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.5	2026-04-15 04:54:16.230987+00	t	2026-04-08 04:54:16.233187+00	2026-04-08 06:08:40.619252+00
216	5	78137fe7247ae5d422813ca0e894b2a2159a7704fb8257ff88c8878e0b783fe2	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-14 12:25:43.105261+00	t	2026-04-07 12:25:43.121791+00	2026-04-07 12:25:43.121797+00
206	5	08a33d0875671ad8be44c84326e58e236530748d25dfd0286f970607d832c8e7	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 05:44:39.727543+00	t	2026-04-07 05:44:39.728797+00	2026-04-07 05:57:39.271277+00
214	5	67e687126faf784cb8195e83a8eb728e6914eadf355f34002bf0a799ce1ee245	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 09:57:37.833067+00	t	2026-04-07 09:57:37.833924+00	2026-04-07 09:57:37.833928+00
207	5	51c5cd7f12a9e25f9429d7d2d7c7c6d9ecae52775ae38369baed86534ab5c935	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 05:57:39.597267+00	t	2026-04-07 05:57:39.632785+00	2026-04-07 07:40:09.88169+00
208	5	269eccf1acfeba1e5c96745c913ec02447f7bf6cccb6998ae00bcee2cf403297	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 07:40:10.426667+00	t	2026-04-07 07:40:10.455195+00	2026-04-07 09:25:27.037228+00
223	5	9294b3a9ce22072cf521bf69b53bd464a084f0ac893a867c6ce90d40ed05c1ca	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 06:08:53.790234+00	t	2026-04-08 06:08:53.790626+00	2026-04-08 06:21:54.269019+00
194	5	308fe9527fc5839ae72577cd0c9780d3e30fa8d8d56f2d40d5ba8472951c2de6	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 01:26:59.931665+00	t	2026-04-07 01:26:59.968783+00	2026-04-07 01:26:59.968804+00
204	5	bd63e47ef0edf6063293b59fd29f9e5c009ce9266c255261b2ca06bf107f3db8	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 05:05:05.125254+00	t	2026-04-07 05:05:05.152266+00	2026-04-07 05:05:05.152276+00
209	5	dbba1ae1d223597d6e7136909d742ef8c3578be16beeaba9872f8e4763848b08	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-14 09:25:28.185592+00	t	2026-04-07 09:25:28.293396+00	2026-04-07 09:25:28.293568+00
210	5	66423c372e512d287ee60adfd43cb5c406fbf513a80c791e1e3c2891fa266e10	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 09:25:33.991239+00	t	2026-04-07 09:25:33.992534+00	2026-04-07 09:25:33.99254+00
224	5	5d5c76b802c11ae3665b4acc3512ed3e64aad6dd1db9dcf5a550d5fffb4c949e	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 06:21:54.342359+00	t	2026-04-08 06:21:54.345689+00	2026-04-08 06:34:54.116922+00
211	5	0090e0d1073ed45e6b4a5502c4607ab0ba10e1b895e81bc8c35add066d626d23	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 09:25:51.623353+00	t	2026-04-07 09:25:51.624527+00	2026-04-07 09:38:54.242478+00
232	5	d15c03716c842b67f7c79baca57ff2f37bd855ba9e0aaadaea7da73d332155a4	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:01:17.257345+00	t	2026-04-08 09:01:17.258987+00	2026-04-08 09:01:17.258992+00
225	5	17c51f1db412d16ec3759bc002754ddaeba0bca181da9c7acee366c42d1ff511	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 06:34:54.184634+00	t	2026-04-08 06:34:54.196547+00	2026-04-08 08:05:47.056389+00
212	5	fabce4dc33055b8cee4bcbcbd65600a21c4821cbaf6d83e2b4c41947ed64dc6b	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 09:38:55.817102+00	t	2026-04-07 09:38:55.883226+00	2026-04-07 09:57:35.828484+00
213	5	00789b85f3a9fe40ec7a58ed524c01ae3156ab844946a37c283bd019237de81d	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-14 09:57:36.257531+00	t	2026-04-07 09:57:36.271771+00	2026-04-07 09:57:36.271804+00
226	5	98db49621d72f79eba1907defe44ecb1add5340f3bfcc5320e85c36b84685918	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 08:05:55.107894+00	t	2026-04-08 08:05:55.116971+00	2026-04-08 08:18:55.208167+00
228	5	17ac3c252d0cbc84162b06c25c34eb54b78da8a9d0d6c72b9148d9eec4dab557	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 08:18:56.126809+00	t	2026-04-08 08:18:56.19426+00	2026-04-08 08:31:55.421684+00
229	5	eb447b5e4b9072e38a57997bb6f8daeeb51234e8523980f6b97683efb51182b8	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 08:31:55.572151+00	t	2026-04-08 08:31:55.578661+00	2026-04-08 08:44:55.093838+00
230	5	7976923c2f011bf1c2af1c923be7875cab7953ee0fe401385b4530a7c84a4710	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 08:44:55.336994+00	t	2026-04-08 08:44:55.349117+00	2026-04-08 08:57:55.122032+00
233	6	757c2532b3dcbe6dfdcf0c147d87884d9f7c5c105d00c89b28630dc841a07308	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:02:24.971252+00	t	2026-04-08 09:02:24.972749+00	2026-04-08 09:02:24.972756+00
234	5	131f7623e69f77bb49991e5ad76964c5b664734023847126c4c804d47f2a54b2	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:05:08.472229+00	t	2026-04-08 09:05:08.472894+00	2026-04-08 09:05:08.472896+00
235	6	20f555553075c670e3ee9390b8b413c74146b62f7e1f8819770658f9a57c5a73	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:05:35.39535+00	t	2026-04-08 09:05:35.395745+00	2026-04-08 09:05:35.395747+00
236	5	b6af6c89705b61d44bb27c89ba27595950e9ae3e612801982c554fe6f722decf	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:09:53.31273+00	t	2026-04-08 09:09:53.313165+00	2026-04-08 09:22:53.488191+00
237	5	e5f331fa76dcec1c382e22e7afc4a5912d7f5d0f8b6e0e280a5199c4b7b9899d	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:22:53.784415+00	t	2026-04-08 09:22:53.825898+00	2026-04-08 09:37:51.104741+00
222	5	7ecf55732eb41c1bdc1b86c3d05073f522fafe14ceceaa0d648cd5fa0caddf91	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 06:08:49.783445+00	t	2026-04-08 06:08:49.784501+00	2026-04-08 06:08:49.784506+00
238	5	240624bdef0faa6f0a1e191e640a17e785e8c74ce96f3ddad386d4bbd2e941ef	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-15 09:37:51.270136+00	t	2026-04-08 09:37:51.286944+00	2026-04-08 09:37:51.28696+00
239	5	6ed3d565b4f293515656689c683644e38c43e9bbca518a14db5df2acf784a1aa	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-15 09:37:59.198017+00	t	2026-04-08 09:37:59.199457+00	2026-04-08 09:51:02.492636+00
242	5	5f9a8941396fdfbbb0bceb38a577a65503c74fc13f2cd8ce540406546273325c	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 02:21:07.203493+00	t	2026-04-09 02:21:07.20636+00	2026-04-09 02:34:07.625121+00
243	5	e5a2e0859fcbd4543b33aaad85c1055d4ed254ed15da7349f75aaa75471b7b92	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 02:34:07.780896+00	t	2026-04-09 02:34:07.799608+00	2026-04-09 02:47:07.076813+00
240	5	0a9c618bfabc30219ae4a3d46b4c5a8e920e0fdb3d78c91fee977e53097f22c5	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-15 09:51:02.997529+00	t	2026-04-08 09:51:03.029624+00	2026-04-08 09:51:03.02965+00
246	5	e891f0003abebe12d69290944990a6f50d731a9a8a9d2469402ef6d18457bdd1	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:17:57.641705+00	t	2026-04-09 04:17:57.649266+00	2026-04-09 04:17:57.649273+00
247	6	b36788859563cfb372ae7b083826073c41d2d888271fdac7be0f5c9af8a55af4	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.7	2026-04-16 04:19:04.577927+00	f	2026-04-09 04:19:04.578495+00	2026-04-09 04:19:04.578497+00
248	6	5909826d388dc1ea6e34fbf69665683736f390a1c46368b94bb8921972a27980	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:22:46.431676+00	f	2026-04-09 04:22:46.433416+00	2026-04-09 04:22:46.433421+00
249	6	8ba9cedcd6e1272e556938ce5adf2b281dc2a2ac32534a81a12d470e4f5a331c	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:25:44.849571+00	t	2026-04-09 04:25:44.849946+00	2026-04-09 04:25:44.849948+00
250	6	b9cc69146ccf2c109c5beae8682a92053d51abc76ed9780c1710dde2502925b0	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:27:42.918102+00	t	2026-04-09 04:27:42.918543+00	2026-04-09 04:27:42.918545+00
251	5	79b778566235d430c8deabdc0e6015c5fe4a1d6f4bc36488ae5390d0fcc43e09	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:29:05.664788+00	t	2026-04-09 04:29:05.665311+00	2026-04-09 04:42:05.708881+00
252	5	797dd4d5f6a2a6a135fa5e57006d64d1d9b8de069249717cc4fa117ad45fa434	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:42:05.763713+00	t	2026-04-09 04:42:05.766513+00	2026-04-09 04:55:07.060623+00
262	5	19ad34a252813cdaac70b6ade6a03887da99b84798bc650717464b6a156d3423	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 08:03:40.586776+00	t	2026-04-09 08:03:40.593475+00	2026-04-09 08:16:40.283254+00
254	5	d601d3f56b8cb55341706ec5d7d6f70e4849d42f619400976c6b7f2945734fa5	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 04:55:07.414266+00	t	2026-04-09 04:55:07.435137+00	2026-04-09 05:56:02.394788+00
255	5	b63e756a6122015c3d82c637586ea8e4f1eb491f15a9b17c02795cf5683b0a69	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 05:56:02.617658+00	t	2026-04-09 05:56:02.630385+00	2026-04-09 06:09:02.142958+00
269	5	a17dde6059031fe6e3c0fa2549f4caabb3527ad77e646676ec5070e908c3a8b4	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 10:06:06.402229+00	t	2026-04-09 10:06:06.403504+00	2026-04-09 10:06:06.403528+00
256	5	1ba9a727546fd48c33cab7e03f32bd26cb5b93c88a897cb2083f2ac388666a25	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 06:09:02.30782+00	t	2026-04-09 06:09:02.319872+00	2026-04-09 06:58:34.684145+00
263	5	3bf265607204716f8fcc97cd9ffc7b56b02f3d8849192eeaae6c5d56df6c6ed3	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 08:16:40.49634+00	t	2026-04-09 08:16:40.514828+00	2026-04-09 08:29:40.77146+00
257	5	bb367618022215c8c4155d869d14642c330dbb877bdcf3f1f46c249f59c4cb59	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 06:58:34.776211+00	t	2026-04-09 06:58:34.782782+00	2026-04-09 07:11:34.900193+00
258	5	4c91d197c551113ff030da4dae4feb1c6b1bf2cb0f3b4967cda7f52b3a3e3371	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 07:11:35.059657+00	t	2026-04-09 07:11:35.065886+00	2026-04-09 07:24:35.780138+00
259	5	82272318bcf26720b2a4e7522f752a92629104f088b8d64aef761610e39d1314	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 07:24:35.92131+00	t	2026-04-09 07:24:35.928997+00	2026-04-09 07:37:40.530727+00
260	5	0c0171786f70eb3d6723e2cef5cca85f015732368b100f3d25d76d773406f81c	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 07:37:40.725835+00	t	2026-04-09 07:37:40.733989+00	2026-04-09 07:50:40.782222+00
265	5	119aed5381a076c1185adad793e547be4359108ed17e72248c21fec897165962	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 08:51:47.487841+00	t	2026-04-09 08:51:47.496066+00	2026-04-09 09:04:47.82014+00
261	5	6270290fd9136007aa052227cf9355fba4b4e9a964b6f91d3546dc206f417de9	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 07:50:40.918894+00	t	2026-04-09 07:50:40.934345+00	2026-04-09 08:03:40.431423+00
266	5	4d1c3b8bf902d1b59dc3c8bac96d39be5c8cad5c36fb188096e7a09c12355f80	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 09:04:47.991628+00	t	2026-04-09 09:04:47.995239+00	2026-04-09 09:17:47.090862+00
270	5	92e38086aafd33c93727d7ba443521bacc2d0b9f782b315d71405e4d82c9c62f	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 10:06:31.698815+00	t	2026-04-09 10:06:31.699108+00	2026-04-09 10:19:33.501598+00
267	5	99f061129fee16cf6417f0e2b1668d3102d14a940552156b3dbb42ae3fe82997	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 09:17:47.152+00	t	2026-04-09 09:17:47.157768+00	2026-04-09 09:30:47.724338+00
241	5	8851e2288900661c9181efb63188b44754bbbcadcb06405874cf6da5d8abc430	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-15 09:51:56.453483+00	t	2026-04-08 09:51:56.454426+00	2026-04-08 09:51:56.454429+00
244	5	6b5bcb440b6c68dd5515b28d8cb3cf144d2e73cdc65a77ed9196fa5cf267fd83	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 02:47:07.114662+00	t	2026-04-09 02:47:07.116322+00	2026-04-09 02:47:07.116324+00
245	5	b41c967546d229e8fd55273f7af81d24b10ab4dff4838debed42545a3287bea5	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 03:01:23.471224+00	t	2026-04-09 03:01:23.473933+00	2026-04-09 03:01:23.473937+00
253	5	f8561b03789f247c2dca71bc495d5a7f4f33439cb8cbf054425959c96d141119	\N	\N	127.0.0.1	2026-04-16 04:43:21.613058+00	t	2026-04-09 04:43:21.614222+00	2026-04-09 04:43:21.614237+00
264	5	93580f32c953e8975538862f55acf8796b1788600fffac22c2a4207f19220890	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.7	2026-04-16 08:29:41.059729+00	t	2026-04-09 08:29:41.083598+00	2026-04-09 08:29:41.083613+00
268	5	066a392a3f087f295f23921409dbf7ad897244c2c20ec4f64d668bb863abb53e	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 09:30:47.778868+00	t	2026-04-09 09:30:47.78251+00	2026-04-09 09:30:47.782547+00
275	5	6965624ef07fac488e11361ad8d7814265349c3e661c04ac355e771014e60487	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 11:11:11.476391+00	t	2026-04-09 11:11:11.48072+00	2026-04-09 12:20:53.343963+00
271	5	ce1d924fdf91a637d07f736ec3270504f28985795eeddc8ec8a3fc6958d65dfe	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 10:19:33.788427+00	t	2026-04-09 10:19:33.805586+00	2026-04-09 10:32:33.065427+00
274	5	a187a7e86c139199a6e927531e163dd5536b6ff0ef44a25d7fb7b5f4bc7b20d6	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 10:58:11.128937+00	t	2026-04-09 10:58:11.137657+00	2026-04-09 11:11:11.373385+00
272	5	b8c299c4f8199a0a7c025a7c2be2339a8bda80c8f9ffbd8e7572c73b68a42d11	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 10:32:33.2066+00	t	2026-04-09 10:32:33.237052+00	2026-04-09 10:45:33.068641+00
277	5	9e144691aa20ffe3cb672fbdf82899620971f53050c72e2c7cba6f7d88910200	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 12:35:47.087231+00	t	2026-04-09 12:35:47.129293+00	2026-04-09 12:48:47.12873+00
276	5	51b41bd814a89f198798034f91675902487e89d834d398071a87f96aa3334a97	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 12:22:46.454458+00	t	2026-04-09 12:22:46.455845+00	2026-04-09 12:35:46.63026+00
278	5	52a7eae4636e34c473144e8e0073d83d96f8e6eba31e70b21601d9c50066eec5	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 12:48:47.189847+00	t	2026-04-09 12:48:47.192949+00	2026-04-09 13:01:47.048418+00
279	5	7d964d9a3e8646be64aa615373eb51e10876bdca169245ede20f6876c7ac0738	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 13:01:47.148224+00	t	2026-04-09 13:01:47.151957+00	2026-04-09 13:14:47.041511+00
280	5	4e549175f91973a7d56fe546a25490e31586ebf63572a6575ad0a5fa2c1a1eac	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 13:14:47.093459+00	t	2026-04-09 13:14:47.095254+00	2026-04-09 13:27:47.067054+00
281	5	3b0b02658b3113e6faa8aac0d52dc1b5824e471b2b197572ed4ba7cd6bcbcdff	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 13:27:47.138573+00	t	2026-04-09 13:27:47.140743+00	2026-04-09 13:40:47.036632+00
282	5	71173953194a2c45c8f74e71f467442cd3402109372e306dfd8b6c02b5de71d8	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 13:40:47.098612+00	t	2026-04-09 13:40:47.099593+00	2026-04-09 13:53:47.15313+00
273	5	113759cb72df9be2b5da47a63892724ed4ea6f1110dab6932f9b63597031d18a	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.20.0.6	2026-04-16 10:45:33.191822+00	t	2026-04-09 10:45:33.19657+00	2026-04-09 10:45:33.196602+00
283	5	45302c14f7b35e8ca235b55dbf2f4a65163e9e723439db264f2c23b843b43dcb	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 13:53:47.277978+00	t	2026-04-09 13:53:47.282534+00	2026-04-09 14:06:47.109937+00
284	5	b5565b4d03db3d8d66347a7e7e9de3d41cc6dae3315b9ff182ce957cd165a9ca	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 14:06:47.306652+00	t	2026-04-09 14:06:47.325009+00	2026-04-09 14:19:47.119711+00
286	5	dbdab78e7a4d7d70a8078b8bde84deca81099c149b66256e9a8e1aef5ff0627a	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 14:33:54.591388+00	t	2026-04-09 14:33:54.599183+00	2026-04-09 14:46:54.831478+00
287	5	4bc51d73d7f454b0b86045d282e86f88b726b00e135abf4ff92a2220446c9617	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 14:46:55.101769+00	t	2026-04-09 14:46:55.133512+00	2026-04-09 14:59:55.067219+00
298	5	88a757bf32aa354b3908de40311cf075fcfbea096713133a31f549dfaaf9eeb1	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-16 16:43:04.103363+00	t	2026-04-09 16:43:04.104357+00	2026-04-09 17:26:50.584018+00
288	5	c1b49a73dd6443a7271ea557b04e0c97e8da4ea8b065042352ea510969857f03	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 14:59:55.168278+00	t	2026-04-09 14:59:55.176561+00	2026-04-09 15:12:55.140549+00
289	5	4b94859925e3c541188c94babc5611312a5e7929f80040c922bdb4c5aaac359e	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.4	2026-04-16 15:12:55.221356+00	t	2026-04-09 15:12:55.229196+00	2026-04-09 15:25:55.054229+00
297	5	3eef94b924407252070fa8b8d72bd2c8139000f5749cf519e424bbf7c0750210	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-16 16:42:44.858506+00	t	2026-04-09 16:42:44.862284+00	2026-04-09 16:42:44.862291+00
290	5	c426c1c708a3e29842e8924c1de4a7ca5e6618cb7c47a8a5ee97c19bc98ca8d2	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.4	2026-04-16 15:25:55.12102+00	t	2026-04-09 15:25:55.123703+00	2026-04-09 15:38:55.622801+00
299	5	436ce82215f9cf1fd0cd54d3f200ee8f7a3906617da19e1ffea6c8738e481b21	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-16 17:26:50.656091+00	t	2026-04-09 17:26:50.659105+00	2026-04-09 17:26:50.659108+00
291	5	05ab09fc0df6402cf888ea4e1bf32d2e1336c6d3daa9aa3744915107be060410	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 15:38:55.682591+00	t	2026-04-09 15:38:55.688603+00	2026-04-09 15:51:55.890366+00
292	5	4857cc5ea4c4dbe29bcd2b563ec797472a1b045a4ac4b62bfcdc99f28fab358d	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 15:51:56.040639+00	t	2026-04-09 15:51:56.045339+00	2026-04-09 16:04:56.1595+00
293	5	d09464b0205edeb151d0ebf22a55713a9f085c40454c757814141ee4f56dbd85	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 16:04:56.224303+00	t	2026-04-09 16:04:56.225724+00	2026-04-09 16:17:56.077601+00
300	5	22f2fc9cab92febac65d9fea73c195338d42c78a87cd0470aff613085cb1244b	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-16 23:54:52.471977+00	t	2026-04-09 23:54:52.481478+00	2026-04-10 00:07:52.572511+00
295	5	65b97c896827d1e002c5cb2501b8d9c1a2f0a186fc695a7e7a25c5d52288cc6c	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-16 16:28:22.730967+00	t	2026-04-09 16:28:22.736234+00	2026-04-09 16:42:33.776726+00
285	5	1acd0deac848c92c4acf6cda2930364cf0808479ef7d328a3a0ca99983e3dcfd	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 14:19:47.302752+00	t	2026-04-09 14:19:47.315916+00	2026-04-09 14:19:47.315921+00
294	5	5c3ed284090ff5b4abdc64b5c9c009a2707561e00ad2f195a99694b3c049c7a5	49f4e56b4f20475613a08ebd20be81ef	Windows - Chrome	172.20.0.6	2026-04-16 16:17:56.174451+00	t	2026-04-09 16:17:56.181507+00	2026-04-09 16:17:56.181559+00
296	5	3b242558fc8a7dadecda542194c86c35c36dedf2eb1fc39a193fd84328e2bda1	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.20.0.6	2026-04-16 16:42:34.194956+00	t	2026-04-09 16:42:34.239611+00	2026-04-09 16:42:34.239658+00
301	5	960fe88e28b7a1a31112df171dec2e86d7bba5fb7c8e38196554368a3208ea85	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-17 00:07:52.632764+00	t	2026-04-10 00:07:52.63405+00	2026-04-10 00:20:52.361945+00
302	5	663259aa0f954202433cb194f53b9a8a876c585a616cf067a3a1bf0ae66427ef	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-17 00:20:52.513125+00	t	2026-04-10 00:20:52.517047+00	2026-04-10 00:33:52.1657+00
313	5	bcc8e04e4b1136ed694e7348a4f63c958e9c30df7c8ba1f3f600da70b9925b27	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 07:58:29.217241+00	t	2026-04-10 07:58:29.218743+00	2026-04-10 07:58:29.218748+00
303	5	477eb5edefa986b9f1a88cd6a6386c49d3fb5174f20f9261a7096b0844555ae6	387296f68295e50809790dd888f555cf	Windows - Chrome	172.20.0.6	2026-04-17 00:33:52.414049+00	t	2026-04-10 00:33:52.423079+00	2026-04-10 06:27:21.598393+00
304	5	71f7391e3e3b128ee222d9c8b9e3753d343a6e0258d942010061c862f191a632	387296f68295e50809790dd888f555cf	Windows - Chrome	172.18.0.5	2026-04-17 06:27:21.734934+00	t	2026-04-10 06:27:21.745617+00	2026-04-10 06:27:21.745625+00
305	5	254511c2bca7b30dd17b30b0f2820f5d98ec5119a67076fc930485a585abc240	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 06:27:25.489559+00	t	2026-04-10 06:27:25.489976+00	2026-04-10 06:40:25.517267+00
311	5	967782bb314c15e853c4c6e12e7bc020d256f6bc185fbbceb34108ae957714cb	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 07:45:23.303674+00	t	2026-04-10 07:45:23.305018+00	2026-04-10 08:03:05.937507+00
306	5	09bd01f283e2b6799f6f51386bafb8c5800ed40ce592d98647970ad2cc6e0710	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 06:40:25.552342+00	t	2026-04-10 06:40:25.553014+00	2026-04-10 07:11:38.911043+00
307	5	8acbd0f64fcae42c81d7ffdd87bc8b4bbd33eb3befed4e017d88a167bffa23fb	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 07:11:39.432253+00	t	2026-04-10 07:11:39.442666+00	2026-04-10 07:24:39.225447+00
314	5	c267ea752efe9abd9821f457295dacb2de349baec128af5fae7b75eb322b2e9e	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 08:03:05.975095+00	t	2026-04-10 08:03:05.976254+00	2026-04-10 08:03:05.976263+00
308	5	86e44ba73db35b4c6758839d44a5a510a9684309b09c61d464c5e188fc028c08	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 07:24:39.265327+00	t	2026-04-10 07:24:39.267133+00	2026-04-10 07:37:46.309656+00
309	5	16010317232671b6525edd66db9af0cbbb14dab8700be2c0997aae88a688ebf3	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 07:37:46.459896+00	t	2026-04-10 07:37:46.467043+00	2026-04-10 07:37:46.467077+00
310	5	66df5461846909b72509e14431221004dc33f79f01d725002e7de4fe7119119d	387296f68295e50809790dd888f555cf	Windows - Chrome	172.18.0.5	2026-04-17 07:43:07.715716+00	t	2026-04-10 07:43:07.719804+00	2026-04-10 07:43:07.71981+00
312	5	c6fab903685263164a80d14ab7be67058962f0ab903a49d4c1b00f3424072f16	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 07:45:29.124657+00	t	2026-04-10 07:45:29.125514+00	2026-04-10 07:58:29.188258+00
316	5	af5678554316aec8a46b6361247849f550702dfd81632e36acabd17b071cb1d6	387296f68295e50809790dd888f555cf	Windows - Chrome	172.18.0.5	2026-04-17 08:03:59.514323+00	t	2026-04-10 08:03:59.516966+00	2026-04-10 08:03:59.516985+00
315	5	616a875fbc996941d68bf67b7bac16bb118163e7be0f2bf40dc2f765e7b5a9a8	6a01fc7b019126d8b0631a418cac53db	Windows - Chrome	172.18.0.5	2026-04-17 08:03:49.637652+00	t	2026-04-10 08:03:49.638154+00	2026-04-10 08:03:49.638156+00
317	6	5dfdc60d922ebe3615673413a4bb7b1e19c1c935b015192ca9f256b65a76cbae	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 12:22:25.089822+00	f	2026-04-10 12:22:25.107252+00	2026-04-10 12:22:25.107259+00
318	6	81f6fd23706c10ea0a0858b6c9414a913cd059fa1e1b10379619a68b8bcd42dc	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 12:25:37.043578+00	f	2026-04-10 12:25:37.048259+00	2026-04-10 12:25:37.048265+00
319	6	0e931671885bb83f95ee085f87a0950864ae72463ec3abb26c0aac2f7e398cde	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 12:48:18.87111+00	f	2026-04-10 12:48:18.874499+00	2026-04-10 12:48:18.874504+00
320	6	df614f53a12e4122ab103073616535cdb20537937f2b381593e9657eddc9b281	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 13:00:39.617395+00	f	2026-04-10 13:00:39.621191+00	2026-04-10 13:00:39.621215+00
321	6	4fa91fd330f621a98546e0e979a0077cd70f77a737c5af482ff25a2767c8f942	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 13:03:42.006917+00	f	2026-04-10 13:03:42.00865+00	2026-04-10 13:03:42.00866+00
322	6	0dc4d40312fefeba638947bc52595994a87963c8bbdddf945464f3c1ecac8815	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 13:26:12.739805+00	f	2026-04-10 13:26:12.75038+00	2026-04-10 13:26:12.750424+00
323	5	f449994e4fcdfa04a8931766d544538d9efc791edee1fc049bd1fe9875bbb580	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.6	2026-04-17 13:31:39.720616+00	t	2026-04-10 13:31:39.721709+00	2026-04-10 13:31:39.721717+00
324	6	eba9e242712fae5e929e0d92cdab60146707e18788e1831dde674639a9c27c4a	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 13:37:17.474992+00	f	2026-04-10 13:37:17.477203+00	2026-04-10 13:37:17.47721+00
325	5	3aa6cfa318fb33778d554d937fc407c43418d45532c78f4e24347e6b8bf1eae5	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.6	2026-04-17 13:50:22.245935+00	t	2026-04-10 13:50:22.24674+00	2026-04-10 14:03:22.36236+00
326	5	769c31a455e824098237e77e01f52ee456ef36214d2b7f04914fe7e8a4e6f96d	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.7	2026-04-17 14:03:32.330046+00	t	2026-04-10 14:03:32.341575+00	2026-04-10 14:16:32.061872+00
327	5	42f7d9c45f323e78fedec7352d7246184f09bf52213aa8dbc432c9817b0fa89e	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.7	2026-04-17 14:16:32.100595+00	t	2026-04-10 14:16:32.102295+00	2026-04-10 14:29:32.095978+00
328	5	f4cae6c4078b095d9920d97377ead5e874aa380161416fdf53b686388c2ec4ea	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.7	2026-04-17 14:29:32.158224+00	t	2026-04-10 14:29:32.161245+00	2026-04-10 14:42:32.998196+00
329	5	67a8e1fd27f2e266f26072a1ca95ca7a1e945a09f272d4d3acdf40d1d3219773	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.7	2026-04-17 14:42:33.028088+00	t	2026-04-10 14:42:33.029098+00	2026-04-10 14:55:34.269396+00
330	5	ab5fd137b7729260e18880a451e7dbc5bfdce6bb4e9e0db8f92cdd9f6d33fa05	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.7	2026-04-17 14:55:34.31659+00	t	2026-04-10 14:55:34.317657+00	2026-04-10 14:55:34.317669+00
331	6	d1c989d100f1d3a028a7c310d5b9e071c2deca30b4c48dbf660aabaf8402f988	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 15:02:50.034482+00	f	2026-04-10 15:02:50.037189+00	2026-04-10 15:02:50.037198+00
332	7	ebc21493364cdc0e060a95f4f67e04a0ca596346c5a721458753b4fad7dfee45	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 15:03:34.583055+00	t	2026-04-10 15:03:34.583368+00	2026-04-10 15:03:34.583369+00
333	6	d6707d9028599e9a5d0e3226dc0368c33b7d85ad2b7da1d7ae146ecabae1064e	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 15:04:33.602308+00	f	2026-04-10 15:04:33.602774+00	2026-04-10 15:04:33.602777+00
334	5	4014b06aed33bae69f83f92c9e7a2e730a3a346ace9295c458a3c2b782254fa3	0115b6fc73cc1f25e2d23a1d75d41d17	Windows - Chrome	172.18.0.7	2026-04-17 15:22:46.659944+00	t	2026-04-10 15:22:46.662306+00	2026-04-10 15:22:46.66231+00
336	6	3f742dd37bb5766c757cde276c8ff729f47c7b3b4af9f5bde56ac8779b755fc0	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 15:23:32.475712+00	f	2026-04-10 15:23:32.476695+00	2026-04-10 15:23:32.476706+00
335	5	fe7ce05b17e5055f6485cedb747cb33278407830ec959f54c1273dc10f3bca81	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 15:23:24.752468+00	t	2026-04-10 15:23:24.752842+00	2026-04-10 15:23:24.752845+00
337	5	4204c6454dd201073e43548d8a0793250b06342a4efe6aa7853da5edeba577eb	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 15:23:59.252438+00	t	2026-04-10 15:23:59.252999+00	2026-04-10 15:23:59.253003+00
338	6	f2c9008bf3179f5e1917bedfb0040db86ee3f001dca7a7e33c79eb844ab25aae	sso_microsoft	SSO (Microsoft 365)	172.18.0.1	2026-04-17 15:24:05.889946+00	f	2026-04-10 15:24:05.890733+00	2026-04-10 15:24:05.89074+00
339	5	07e07e848d7bb26146175d38cd0f926e0f21e042d7a797791e5db826736eda0e	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 15:29:59.068216+00	t	2026-04-10 15:29:59.068665+00	2026-04-10 15:42:59.130521+00
340	5	013cfabc1b709bf59073dd184ab717f4bc892b2e58d5511058e8457ec56f97a7	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 15:42:59.197096+00	t	2026-04-10 15:42:59.199687+00	2026-04-10 17:13:25.645442+00
341	5	26cb73fda4f460b825b498e750195d2408514a6139dc7fe913e579d7dd16abeb	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 17:13:25.991089+00	t	2026-04-10 17:13:26.002684+00	2026-04-10 17:26:25.164578+00
342	5	425002d3f5db17821f51f62a6a5fe4813ed83630b07391df4eb8cfc439fa45ee	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 17:26:25.287367+00	t	2026-04-10 17:26:25.292119+00	2026-04-10 17:39:25.144297+00
343	5	a80f609f445cd679a842f2bd68dc70d2819d0ec0b0b805ff035cb9969f80c4e0	bd3d95256a62a95dcdbabac758ed7cd9	Windows - Chrome	172.18.0.7	2026-04-17 17:39:25.260506+00	f	2026-04-10 17:39:25.264025+00	2026-04-10 17:39:25.264087+00
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.system_settings (id, manual_enabled, manual_url, support_email, support_url, default_start_page) FROM stdin;
1	t	http://127.0.0.1:3000/docs	\N	\N	/
\.


--
-- Data for Name: user_group_memberships; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.user_group_memberships (id, user_id, permission_group_id, assigned_by, created_at) FROM stdin;
1	5	2	\N	2026-04-09 14:33:39.976094+00
3	7	4	\N	2026-04-09 14:33:39.976094+00
16	6	3	5	2026-04-09 15:33:03.280934+00
17	6	14	5	2026-04-09 15:33:03.28094+00
22	8	14	5	2026-04-09 15:43:33.893391+00
23	9	3	5	2026-04-09 15:44:47.059909+00
28	8	4	\N	2026-04-09 15:53:54.583669+00
117	10	4	\N	2026-04-10 02:04:55.859778+00
136	11	4	\N	2026-04-10 07:17:14.249704+00
137	12	4	\N	2026-04-10 07:17:14.249704+00
\.


--
-- Data for Name: user_oauth_tokens; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.user_oauth_tokens (id, user_id, account_id, platform, access_token, refresh_token, token_expires_at, platform_user_id, platform_user_name, platform_email, scopes, is_active, created_at, updated_at, last_used_at) FROM stdin;
1	5	20	teams	gAAAAABp1hDhDgzPO8Pvpz0LcMN_pE4sCpnpUfCNdd_UJQtu_g05yP4iIqEyygxDGB4LgzVnFgAnyAaXq4LaXT0FTkesTYm0aO_JfJIzijRehJ5bDpbCY6es3ysiT1g88AdVW9t_hYVnndtVsIEEruwvLIbZnzEFe1VzDfPsRAy0f72Gi4OcWkJnIrnMvyvOp7Wz6vFBdCQuOAj7lvRLsr34nUz0fDhiPLBnJaZh8m1ZdH3IFOHPx9TLaSzvucIYVI5ee8_03UUlCCChcLVjBOFhpGNdSEJQ1cJctcagjLKErSkvo7Z3PnApL72EPN7AePSBXkjIiYddvQBc7qhhI6h01XcE7cE444nT5GhKkvOfSNLtzI-00WDTceGubyAbNYfvCJHIaf5r6ox3vjZ-AJVEFnev_5pzwHRR2JEvJEGUgcLczJ-6csli9bHE90kpE8NmbPcyd_c8Vyx0aHb6u8gkR_56hRS1_mMg91ciGtjT_p-wjoOmXLECYk_N-nI-Cc2aydgmaknYMn8W5i4W9iZiaFOXwBQ2ijkcQbYoUAV0poERHPbjy41ohQrDQY6bc5tLjY3BpsiFKL8F3_HTn-F8Yxd1vZsHWo4-oTHqIbpu6ndJ38LQHEzJC4uVy7SPB87KPhlMqJjYS6VZChivyJVIDhowUyz7x2dDd0ga4zZjt9-rV2YiUEaW843aURCli_VXwUhfGOMqWWTjdJH40kGd2n7Ke-YTsldW1IrjFGyO8TWWfrRgoPm6e8BK1YCGneXgkA4iviZrwiZ2V7s3zSPbFYhV3j_yccRSgXnYqxMuNRgISQkZ146iAHcAUM1AhrIVuB8tSNKPMPKknyKC14U2dU3P5Ok9gOid2-P9CoZmZYBSIW10FjU7yZ5ChySFi4MVncyl89bUgubIs97tvceHBMlC6nDqC_sc7uLZnQqUi4Ar098Zf5YXCgaXDPOfHJkJVRFbVNx3qpsHwxZwf9m5jLgIF4lebwOy3KI7OPnJfPLCFYEU9daz4Fs2yxVZJRavgSSI_Vzngi4FONrpI0Qr9P4uAEEKxD6UAZ65Ypw-j9FnjfRSD3apJA5Zpd34SZx4xp62ObZ3Hl5qgmtHW1Kqa_mI1-IWe7Qis6CPSDc0QrisDh_qhUVZdUPABZ2VL9_h9fcbov-k8TMAFo5d6D0JnvOeUzbMxqN1A7nO4E7rVH-V_5dFHZ1o1IGn95WtPaEyXuoo9umKhRsbQ_YOWkrJAwe1qxsvhoo322NA15dsWU_Rq7yBlY2ODIv5araALWTs9_yH4bBtmh3hj5Ib3ETAKlwPNJpudw8-lHKUPmJk4-775lLAKdsyCRGs0B9xvBx2p7r2FtJ7MtxHun8q8Vh9SFbAHeiYQcP9budJCdFM0xVb4DdFAzuMuQ3tJUgpUelmQflqO1x6-Y-keOR8cmyTtLrze3Bsm4sCesQL2OnUmC95WQYQrNLKe_Mjk1E0PY_iqT2UZJUBRsslIHMjPZiGoP5l6HGd2Y40E6KCPIy-STecF8qb95YdY2BOnc11maMRQog_7Wc_lbV8Al_7CkBkwF6glqkwdGnOPDN2dw3mG9NjnzGIvEscgr7RbpqtiHKw2WaAOTj9A1i5kAnXJSTNo_8a5J9WR6YOANrOOLUOIKI2YfP7dNCjTIpk5EPjgT6x0U66V5VKnEfnGYRkpLnnZFSaY8Fw6bxVhbAmu-5FL2b2QbvS8eaj00GS6BEgtfBg_Z_SXwE5VVjzJW6-jPISPQBXcfgr-LLbwveXEXnctsynl5KwKR_yw5W_qQ-NsU44t8nvDrBpR1rws0vgSRhKex9sfADcMtv_984rRHIqkCSsMKUykqJpp-CJzlod5VvTbKJz5AHrKQuOhwEhCzk5_FrIZUjqSJti4EY3ZkJ4AiWs-TgRLI0gg828HeFDL-v82cbr0TDJL_HjDqOCyU4yGfCrGmPPG09sE4ulj9P_UCyeOOpDSPQfk49sYxlKjkcfDhcsgiV0vwcKFCmzZeqlWfQu5VW1lzxa0srLC6J4tmmeSrcd__vPSmNaKrhTPg2nufypSPLDbyMMI1JbaxoowVAUmVCJaZrFZj6V7Sqh02ZUcEH_CDTiE6EGKfcJtkuQUpzn1n91kXwfWlxIzKG5tnjaX-I99cmnSmE1udCbZRZL4jcymAKLCLE6GJAtMIBz3ox2xCUbNnGqaet6R5LSOMx-0X7YZOwpgSg728O5t7HdnIX73JFl5eClkYb7GRzQr9fZ9EXYJg77Bk4YrhqlzlUJ06rGvCDpSLo2h-FEZluIFhaIOboBGa3NwOcetbIaj6xKixVv7nssy_E10Qf-v8PX5OUjg6JJsxr9DOuhgZxhWkox5Jjvla_tBa_vlQbK8WepknwHiIUsa2Q3NG-j2Y8T3jpDl6a1-2NKsZY1R1v47rDS2Gq_XGPov7fLEj6wkiXBdXCGgyb6h_KHlfWtHJdn_DFLyD9KorzH4qfQjFFtDPv66qBNVyfY_QonPJ2jp6UdrE7QI-aViWqkXUEwXdjKQR3Mt653wXtP1bYKc_2P4ublslNsSOl2wBfRozMTkpYQ2Zh5scAM5rbGHMgV9-kFL9GJ3xdmGuVXKGuU6uhy3ZoNpKKoD6K5XBr_KYtclq60Zb-J8EHvBw8l3G7HlBa-x_2FkAsis-3aAYHFN_zEpTu6dBjZoiaXG6YK3g7_yFxBPE9tlvpzfv_reJiiDOtOqD1dYHbvBWoqf0FjsGuvltg4yDsepda4uuc_lb5ljmVPrxecVzEyUWk9T1fPKZa-g0cPOT-enDNyCvKpGWUiMZPEQUnIOx-nYKjMHvR-Sju9D8r05wYl2b2fSIW---lTe_V4FBv0Non1_Nv9Nb4UdGrCZwYywTsiRj9xVFq45Z7IRcUtH8Um2Mo0p2FoaRZ7R01EO0llNsez5x-pUBPvR_QDzt54a-A81IuhB-5OiHAMDJ582-KXYooRyY5rXbR8wNPu7UFNe-wrZP2WHNkN54_HfePSxjTCwfQydyB2lpr7oj7I68IXctRthgdao9jNPVNTSvx1BpOGu0PJGEWPZhkh0kc6zb00qvqolI8Ax2bUl-g2JkJU4FLNZN1MUDVPzUcpJ-Q-2t2_p6us3hOsWhPnTbxV79dm6yi1GWXo2Gw9KtW63huJW1DjmNkNxzxCJZvmKOMJ536bgXxGLViwlU46bgaaAkmxjB-Pv2mu_3n9mF6vDO7S9CJn-QTOT2RNZBoMURcSinxKWuAMAI3V90ZBe_DbeL_EsddIP-joe1smR_BXZQydN1ZrI4RECISfxBrjh9_0GPju4IPxvvr9LMmq4Dd-GLNs5jNy1jC872Ae1IAqL9_TSMOfhKfPq1sabUfOYWjjLARQXVG_HTxBzACw3lA3wy9o1HPzcL-u8k9lAra8kCelSPV1NqWlt7muw8gnncbFD77iD_atmVBv1MFcAcX_l1RUsRjuXU7prxe2M9awo1f003te5DobxMvVT50b_Aj4q2Epd0shpg9wbNM6Yx1QFf_zR7MDqc3rauK5r4nDzb3-MB5Gg0azgrtkZHNOE3L5XDlQl-zCdImM84VO5bTiQo31zIVBAvANCSUtqurRGW2z4Cr-kJUip2Jp_uySCybvJ67kzeb7n296pP-YngjVfM3AFZmGL2CVDXfs6Rajwr13JoPnzFvoUQd479n8eQ==	gAAAAABp1hDh8GPa5-atOgVsBIfxMOhu56PmrbrIvxGmWTzaOsEqcNvPzMlQT6GedZNWbUYCRN1aoXRNkXfvLlVVr-p8JO6eAyzRQv20ZMlIiEoP2W6ihlFGlXFgF7A07PE6LdPZMI6B2PXyUFKZ1P_AHmjqHPxMQw0W5km9LMZL7WrJlK60jo9o5klGRSpoGf4NM_MI016GIUuzgL7wj7oyx9hDUV9DxHF1KGSf1f9j7pZk5hSzT4RLt5m7i5QITW3ETf9UYLO2Z1ZV7fVxz2unqCC1zjZHZEWoEBUMfENwbNwdKrS0JAgAF10XOOYm2NaOhRx9EwXOhPrDhUTTj_NadGgjewIVR5cVwZ9ZgHabD44oZQcvI5zSCYgRHUvXE6JzrBzJMpZOK1-Jq9RMWX9cStRqmLZlWHCuRZxH_DjAQsDseOchYazM-fBcNC7z1w5RgSIS2ylif2hQzjn9WVVLTxlHU0EfqUUFcpfcAEO6tXotl-Q3ul4bnupFYVXi0UngfjiX0LJRCtBJxmyTEh1VIn6uWf7VUyJZNXmdgui2wXVWZq0GdwPCWvGoDPOgHyvH4PD4Efv5nfHrJAu28nNL6DVjotp2Xw9SVcPxTsJeBmVVjcIfiTX1g-IlvPzVCCbG3XMLk5wMmTTdyvxt7eHAaK_tMngIC5EZXTVhjPo8sHXYDdYtFZweAgcRLwd0o1UsR8J5TGGUsyRJs1WhkohYVUksu2q8Kk_CFpxiDLuO2mN0_5IrLkPOPk4bHEEBlVNorh6_eds1zWZfVjGnqzJzWNkepWWQNxl9dbUzo0gN499VkCnoDc89NKLd_pQV-pkckmDDT3yQo1M6r9A0mDzbDWcc5mDVZcd8SUw1bznoB2zZpo_x3YNVGV-9KClYhLhhZ7I6DEuXREtj5e1LPNWUqhlHHWYZxNBCOYrVvPe28GyT5csmtApNz4_skcH7588WSD24Bmz09YDvtx4F9twdiWiZxbykO2JkZYw_GGGfXkFZQ5VUT7dAK5F3o3N-HBzeFM2aIw-fxVd8fZgf3EDdmA5ODQlJUJpqFbPa1XS7pWddADWA6OiN1x-SjScKgewOdcZQMILnANbzLCeXkj_UjnVNAY19QoacC9AyxpGrOo2-TAiSvxmDnsrkSINX0hT9w7-6khZIMcJ2RsDgY4-pLs7WnhZe6t8oqH4zTd9-NkGzVyrUEJkfC4LVb8HyvzN-fafp6LBO1khOvVlcCWZZjcYc-v3hjWoVXwCo2bdNhWvOotudyZM8_W3SgBm23RSzkSUfg8LddVaNoJ1dEHQ4uRoGKgZG_QbVIOCZZ2txGpjOidEYf-IYip5ARbQIBniqkR0OXGjGIrFNqcmRSdQ0vdzo9FBo4TGFAvbuPXLP6LadOPd2ablg4TQjIhL0UBHkansczYwwKXYr3xOWb2ibjux5uaoapLXV_eZuMx5c5-Ro68fHQwW3tUnlw4Ze1DeQosFoRCXwdND75sT54gPSRWamUF6HNPkQizkl_I6jbegIFw9cLTk-XYksiYJjh7wIGR-gssQrMT0she96hEaHH39OkMTStoBu11Hfx1sOVFqfr9yW-ANsouri3T5AtvCDMvmTpR5zpsftp0342MF2s-nQ0lx6M9JQkZUQRRE2mT-nf2C4EVQ5ibjsyoCwAvdoNS5fw3fyXzPQgI_Au3oLgw-IvIYXmbacKxke9Cw9Yme6fG1pJ7hY3mtFFMXS5eINoajcaHntKGc_AbYDpF4ESJja96tureRi0SPny6iyAQpFH6X29YtmyOpSP2Kx52QumW3o4jakohItazuEGb5NI_q63Jrp6alLZL963LwepLjW4lWhOlH5Hq1AshLdL9u0Z-3rnvxm4JFHnteD1YEpI3WBnfNT31QapFvPUrJ2CCFDmXHEuExmu8DmzYtRFPaJuIH23BaBnLAMPNIo-OzoRR6vhoH2KitxSUGHdWmthmhOHutU0aQmFuFPaS5V8DHlybuREwQdVza2oVc29cUR23YmD4AgymyKn9nJ71v0jOLDc-VkKp97Ua-CfR_AT74_iAvIZRPPXVDd9zLFzYOs2sN4E49_5jIAITce3gSp8jjy8f25rDgs0zmX9ILfE2ZSPu5Bk3_x	2026-04-08 09:51:23.338671+00	fb9620e2-4a03-49f0-983a-8448780f8ebb	bong78@vms-solutions.com	bong78@vms-solutions.com	Chat.Read Chat.ReadWrite User.Read offline_access	t	2026-04-08 08:25:05.925485+00	2026-04-08 08:25:05.92555+00	\N
2	6	20	teams	gAAAAABp1ho3m4_h07GcCfS01QKW0E8R0TUcpuuV34kAkI7n852SQDpLQF9ci0qOX4cB3MJc1GoS_jSZXzaNe-UoT7uRuHv60A5NitPXw8Mxo3zcX9tMtBfycA5eWS2Z05w6i8iObrWLF3uYKBQtsbkkViv6F4IPpuQsPifN4Ms5qwLQ9Dw7cpBo2UDHzw6yozq2gRrrJnpHwjaMvgJ1APxZZUbm2Xk5nwv8_QjWdZ5udJNvlLQ1DzwOtqbA_vzM14g4q6JXx3LMv8F66CRG7SYfxjL9UcO3LfMmGXb7z8Lg6WPiZKnh9FQrsPcHuRXCxHxGM-2ofMLvAYdH0lM8FmDfXErw1lj3TvP1LQvMb3LUgKKEuCVctvZoejzaKz9-O1_TTPKMFKAl0CS0khNF4oojNIc4KQegSGC6s66WyrhSKmTDa01xwfJFtpvlz4esoMFQ17--0OOt2TPJODI9JPzwfhGjRO3946WxPWcUrkVxm-hnLKRTh7hIpMnh_CfLIerjygNrxd1MLoIvG-bYGhyxRdGdhrzTWrJY_31R4YvcL5WSnp73zceuIFIG_QJStOwyz9KY2awHE8w00XjjAr_0qeQzhw7DSqjNS0slAsWqkNi4c1aLjwGlkhhsWDnS1qRJsfzrrWHl4Zl3Gqp0hlXaYT3-1qbSGZn1T0CqD3lW_lae8B6imP7FFJe_l-0I6PVA-hkCW9OYC8RWY2lhffxsylJ8djF1PLVqhdIcc9yAMwHKizhZDl0H0P6pkMM46QFQCAN6j-FFXZmh7gxCUvS88ZhqtG0f9R1KTL9EYjGV736vgCQFWzYgpJblGEEYyAitaU19hNh5eb5jjpst3HdsNx_Y2OkPuSJ0AFmw8HB8gC0Zajh9qNzoY78AkB4GjseCx6KZYwqgAWp2z1Aa5Ok8PI-LXiABTOOOGu0Rl4uDIY1m0HVYDSsfT8IaEZDQcmx8p-iUl9lXqzL4upus0iJpq-DB06eAWc5ZEb7BP9BEvLbAl6UafzhX3_fY_056VFS-4aJqT5afrcMfosI_MJ3_6JXwvugmAeI7hEy5JDs2BV_EeWQx_ODRqbPVQM_C3g0kgUw1ihPgXiYbbt6tHfTLY5n1_U0uSKxK_FZQB6iamxYcF0xDnWCJJYZxKp6FMBE8OZi_KQmj_RxmiIjUnRnbg9HATg9eDCFvYz19wBNtc0GaydgFTsoW6zhFafYkGppMHJjn05y_44hZZo4Ma-hujguffbOmj7kZWjZjDHsKVw3R2r66ldi-ms0lpNXBJC5NA74zyn4MuGgjAHkUQS8LlBUatWocO7cfi-NGSTWQL8sISyyRJRjd6IOrr17MjfevpWVPQyFaPn4madwlDCJn9MyBdxflsbnNsjAolK7jlfoB6LVQqU5JBE7uWWojrEJ7j_xJLQ67TvZ0FZjJRn2Z5iwjOk1UKqKtzLqjDprllspRfDfG4_ehesjULxf07IPymzCmMYkQCQXVkFJKxkra9sdCcUMob0vc6HrKxrJCms5e5CMuXSq_a32TW5l9Qmp0mcMn4MwFCGoe-SilZR5laz4U1OntAv7cfHxeVxo7rsK1T69weCvXOVdZkcIntyr176AQGd6a_Ftb8bHKAdZ0KtwqAMKHtm6gl6FekqI71EP3VKX-BYTwgPEHGfG3ycer5NEHoWraBCOVFH_cccczFrLKkWVJf9bTbzmLKy14Da33-0-ErC4gWYQbzreitYrMt1mf7pRq5SJXK1Ju1Y9drZRWptuR5r-pcGz_4gMABrFuB83DtMlbbpvwb5jAjUaUNYxfFbmimwRS6Z8gnBSx-uKlr23u_mF2hexlORvdi2rxhXAbwPFhhvC0H0GDgUi-f8gvcz5h_6ijeuG2kO5rSY-JE60peHa8vEGlMofNEISjD7vP8vuoehciS2HsenrpEh8-hJ8qEG22EK9NDeBh1zgJ5MYmWW9qXuGPgNb9Q48kiqW_14VuptCaIOiLy_U2XDYfSZ2C1RwvE-CekXfblCbO3lH-7z1POfO_RoVP5CC1lMm-gg_x1bwUBGrw8eMFXfEhcgZQBTt2hT3pTcN-xlNpcsKr1kShPPmf7tTp5HZyynrc43sdCkT7XHjcP8AE55C6GZGN5jVHrQj1M3xJsMYcpAZU6eU5XmrhMmc6YIOkgcHXSmE-bc_g_eido6x7Mj1B0voe3HrM9XcAQ3rCFIBzzsqa_KzB0khB94HDxEDLughDLxIWjJk5woe1MkDah0SOL0iUWlu7TttrWTfn0YwX4rdQSUecXd7wwJ2TXqcKwrbQBZ37MPOlj0OOTpb1tz-YTXcG06oucghcPHOLKqIxj2-EWyIr3Ka8qZVApAT8ierBEGza_DP6qLT5LgY5JhYP12pKNCgFoAVmo_Qblds-V7sBvDX0_C_QbEcdN0MmkMpjn77hIAOi5XXmqWCngu72r1h3gDKfy9dHjiUjeXFmqnTN9Xn3vThIiq5MMgohsCPvLY8U1Z6aAYdJtJ2vsM8Ph3N9E6fNhUG3stniXjJrzQJOqSiUh5DZ_WRsMVheAWic_OBHTlaGzDR79LOBi6CP-juwtT4N1RigEkJ-7y8of0ryNqpNYOMFI3qZVv7tpfDTOzjfFQnzTcWPiaS278YUAwF87J8ZsDqFvanzAMWM9Svws2dbZwdHPgUZnfH7GqKzTNjSOQHhXVa0VLQ3XBgsRewEJLq3FMUg3UyC-Blwt0E71FjOI1jhhFRVoL3QFHzhhz1ZId4tkG0Mjp-qyolTcvlAdC_PuOYfAgho7s7qLFfTNr3jGAGYUI6eMiHQFAnrRSvF87Iib3ft8TqTdk0vE6o-ZcXtAz0RQinF93j_GRqxYDmosnJZiYLq8nKHqDB3nyAmVLhgjQRkP48TIvvpX9BkL7NT1KzLdvlk3Ixk2TGfFTV06iBA82PyxDG1vWL4eymE-fbhYW8RZ9u7aMaHzuxdHQvBAmyE2CMQ4GBsAiRf6TvGp_IFei9c9sVuuNzmRQerF8VNsE0QRiTVmmrTf1Ydfl4aAfuNRZEgQ8u-TZa1FR-9GLyKHL6IyV_EEoE5RK-UCrekm9l2HbALA36AX4REF9KmJxN6B49sIeyX6GSWnZ3XfO6P1eL4kJWMnKtwewnWcy6FGReMjztsYIQUTwr6owemNBOFBPljWW4TnEb6UKQ8Z_FA-c5NiafFj300uU95dP132YrmmJYWDFgjji0X9eshCXJ5A-fH-y2SW4lj4hQiJropl87QSDKHRMJ8re7h-Z6A9OEpYPjgftehL83hWHkYQ8Ky6sQVysBtIJCpQJxzEtgqc6N2wlbqG8OhGu3UVEFK6fcMz7LtiG48ZvJmX6RGWeiDs8hoZR54SjIJXgoAymqNbP2dFulRgFAyp5tDuPVp0lwKl8TKVncPUxj663xQwlCJlwg-bOodovieQDvME4_3_bfWexpQ8spxM2Q1RH7ujlvXj1hGLmNc7shmM0z_XqBylnuKML9Eva4gq9WaiVhTX5jSmwgX7F29wOrQEzPm01vdK0Ja7a0KDKEWXHpF2FHMYTKjLEStO1QUZtt5qRiG-8IrPcmBwx0qKXOXqXh6-13PgYIGBjaG6YSPebOTnNmqIE3WYUGgoTHuhoXEgM526aPglwqmRy4jXDIbXkRN0hZk169cKSSUaW7mRw3r5pLPwckl-bapf6yQLA==	gAAAAABp1ho30LQS9A2sxjIDbihEuL12uigUSQuolrtdaO8cH9W4QaE06zAtkAZR2szxehS-DUlfpgwLXqDC2VkAbUKtEIdAE57zEIZSquUyilN1oHW4hD_jIo0T9e7mgYhTx6djPmO1tS1BByctIWdupKLQPZx5-bahrszUWdoBgMYwW5S89FUq8zWpDRUPSLIgEIcf_GykDW30tWEveYjr6qGi4HXnc1YRg0PMDOlCnHEPB12wiiEi_rUWTh1dyWMdnPpDaxn8Ycw32m2K-gAJyumryAQj-dTXEN-AdZhUQcjkRN9DJQbnnDH4-tBawBKG1RMhbyYJi6uYmy5khbDupustQO6sfcgXGv-rPcY9nLhYMJeNyBM4pL0TcgqioX4ne2SAFlP-_SmAkE7gCxJJBaeocRjY53TjMMcMYSC-g0tLSIUdY90qegnBjKAYf0ZVrP06CH4MbNNILdF8Rc4vpqzhl10EESGgpKqEFG84OBq2Nd0CGQCdnf6Ov1jyFx1tZtXxrLFCFVR5AQ3PC98uS8YjSJXquxQGeFZVT4WgsvR4Xm5rglbJ-jnQJJGtijJCTKojyqn7qq37PyUrK3hn-90_tlRRWYSa0rVtrWyDs-wBacAT7tlHgXo4bfhTV-Oaro1jxZzDUtYJL-H7W0X3PH6LsXwcpqbV2jpvsSmIlFPstkmSmyWiD8KBNdE0y0dhVdI0WxFPvbSGvUGc3Z67QXnSkkYiASCJsHE_SJ-xtcAxoFHXRwnocgIKrHfImXfrp5NvXWuhgvFk8-VDNCiADPuI9zt-hhbnXcSCOjxn_-RRRLOIq-7bctKX7Uf5gu2oQTtWSn8JymHxl7onbp4KUTKW4u4saOWFDROtH487crUvHUrYm5eX5N3GHBCWD1vEVs8a-Hlgct_fHJp_ytcKzUsmaWPMUkg78S-tOngR-emtPXePRA9PqgVNNff-3q5MqnV5RGlJW4oZCoQjlnQtG_bKwylToN8R8qOfPXILsYyX9wkxvqBYh5jyORi3zvaLSszY5u4HAxLod0pUfzZ75wg8W21iSov5QpPxOMFn6-gmh90v_gJhKxvby9VnDDoHk1sdp6UPDJmugvRM69DophyfBBoYfiO-Dc8VPINeOERjpVEnX8dwqMHNnAMUOnZjgghe5l2eqkUORW-opnKRNRNjLROT2GeftBPnKt64B4NJq60Gsl3GqKvG_kSa1MI5vSMotMBP-0-7_7dy77_4VRtcrqvSplTnkAwriyE7zvvfUcrCMl0xxeVrBHuH-uhzAQf4oiE4Fm2EhobQF4XZD-upBEY0x9w5XtXep8VioNxEUptCx38JV5lluNqQabUZE4_mqcYRTQcfcz0Dm1RZZTypLosizpL-Cdwv_ZFxazGqajR-dmp8Nws9EQVMoxz1dmb8BtAPgxfbVPxvXQ53MSRyUyUEQGsyCThgXs0L2LO5ETkZR6JXkeIPcIS5JqxhqwqnRQYGW7Xej3jFDIhritEgOMkb21nKgPjt4upGbCiphwjrDoBC7F9MUfbxLpTtGNIwbNDLwc08hcSniZSBJX8JxAqKFr8uQD7tP1dFzwZOi-VO1ZU3yb9WlX1FtRCiXRv-uGVqBtlEzabwg3MTGSdLaqnhIqNh0RHV46NTH841q_H-GwPZgIfMC5K-lh4kys99KypXMBFn6kWKDwqktQcsHzlinZAqVouz3q2vFqsY2FGYY4LYUJ6HHDNnYN-03XUAwnrZo0Thk_tO5g39Wp5dHUVb0I2koXGNFbPk3d1YZ44ftc9k5xOgtJymsQZ0MZhPQV8e8sjAKvztGqC1Ux3YY8iK9mvo0IUbErVeZ97w7rpQVssU1_gcnR8MgOkqwdRKsCmAor0lQ4Ezg4gjOd3XbXrFaihzCO9G2OYNz24z_5og7Xtp8sJVa4zFe2iaLkxNQrgrTk0o_c9sJVv8qpjOghPN78MwdwNmgLQUWBpTRO_YyedPEv0Wae939SLB0NEZiow4EGBKdEfrylQfNlIWs_kS3HpaQnVVJLutmZzT8zbXMdGLKrpDMPg_e_vKOTLwDRNdSBDuIgj95tplAQQ6ID5KMksHVMatn9FoictLeQ1gQqkCl4qgLuFHEuAlx7WjsbSJ	2026-04-08 10:06:59.646505+00	fb9620e2-4a03-49f0-983a-8448780f8ebb	bong78@vms-solutions.com	bong78@vms-solutions.com	Chat.Read Chat.ReadWrite User.Read offline_access	t	2026-04-08 09:04:55.657951+00	2026-04-08 09:04:55.657959+00	\N
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.user_permissions (id, user_id, menu_item_id, access_level, granted_by, created_at, updated_at) FROM stdin;
1	6	2	write	5	2026-04-09 04:48:34.541323+00	2026-04-09 04:48:34.541327+00
2	6	3	write	5	2026-04-09 04:48:34.577125+00	2026-04-09 04:48:34.577129+00
3	6	4	write	5	2026-04-09 04:48:34.58226+00	2026-04-09 04:48:34.582264+00
4	6	5	write	5	2026-04-09 04:48:34.589723+00	2026-04-09 04:48:34.589727+00
5	6	6	write	5	2026-04-09 04:48:34.594523+00	2026-04-09 04:48:34.594526+00
6	6	7	write	5	2026-04-09 04:48:34.599961+00	2026-04-09 04:48:34.599969+00
7	6	8	write	5	2026-04-09 04:48:34.611188+00	2026-04-09 04:48:34.611191+00
8	6	9	write	5	2026-04-09 04:48:34.620182+00	2026-04-09 04:48:34.620187+00
9	6	10	write	5	2026-04-09 04:48:34.630697+00	2026-04-09 04:48:34.630705+00
10	6	11	write	5	2026-04-09 04:48:34.643683+00	2026-04-09 04:48:34.643688+00
11	6	12	write	5	2026-04-09 04:48:34.649252+00	2026-04-09 04:48:34.64926+00
12	6	13	write	5	2026-04-09 04:48:34.664073+00	2026-04-09 04:48:34.664092+00
13	9	59	write	5	2026-04-09 16:29:03.627248+00	2026-04-09 16:29:03.627308+00
14	8	7	write	5	2026-04-09 16:30:28.299757+00	2026-04-09 16:30:28.299761+00
15	7	7	write	5	2026-04-09 16:30:28.32683+00	2026-04-09 16:30:28.326833+00
16	6	59	write	5	2026-04-10 13:34:09.898355+00	2026-04-10 13:34:09.898366+00
17	6	58	write	5	2026-04-10 13:34:09.927925+00	2026-04-10 13:34:09.927934+00
18	6	15	write	5	2026-04-10 13:34:09.933719+00	2026-04-10 13:34:09.933725+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: vmsuser
--

COPY public.users (id, email, username, hashed_password, role, is_active, created_at, updated_at, last_login, company_id, department_id, sso_provider, sso_provider_id, auth_method, start_page, theme, color_preset) FROM stdin;
6	bong78@vms-solutions.com	viktor	$2b$12$x7kU2bmq5UqVhG5uoFf8ZuoXAkTotM7dVISmf8Q/jdokupg336Spu	ORG_ADMIN	t	2026-04-08 09:02:23.448835+00	2026-04-10 15:24:05.880445+00	2026-04-10 15:24:05.87951+00	1	2	microsoft	fb9620e2-4a03-49f0-983a-8448780f8ebb	hybrid		system	rose
5	admin@example.com	admin	$2b$12$/RDKJPGGyow0MSdTNSRqlOxs0o502wQz8VCe.wIII88QTsWZb9xw6	SYSTEM_ADMIN	t	2026-03-30 04:44:30.60941+00	2026-04-10 15:29:59.046431+00	2026-04-10 15:29:59.044632+00	1	\N	\N	\N	local		system	indigo
8	kbhee@vms-solutions.com	김병희	$2b$12$ZsnC9RLzkblS1KPyItodNe2oA01jRUPJpmlL.wN.Wu6oxfAUDTtje	USER	t	2026-04-09 15:43:33.63936+00	2026-04-09 15:43:33.639368+00	\N	1	4	\N	\N	local		system	blue
9	chunggh@vms-solutions.com	정구환	$2b$12$g/NU4mGbvbR9E1lWVlthOednhNg/QifI6xxHkjAo/uHaaQxoiwtim	ORG_ADMIN	t	2026-04-09 15:44:47.028659+00	2026-04-09 15:44:47.028663+00	\N	1	1	\N	\N	local		system	blue
10	first@test.com	firstuser	$2b$12$ursgT2tDmjRyZTxLAw9BDuuoHRjsbgT0t1vas920288JWYQqtDKly	USER	t	2026-04-10 01:59:55.052163+00	2026-04-10 01:59:55.052169+00	\N	\N	\N	\N	\N	local		system	blue
11	second@test.com	seconduser	$2b$12$y.RuL9lSEGZKv9NBHJEQJuc/uDByREDOWWYi8o18NU4DXGWMwd0pi	USER	t	2026-04-10 06:47:41.586825+00	2026-04-10 06:47:41.58683+00	\N	\N	\N	\N	\N	local		system	blue
12	admin@test.com	newuser	$2b$12$FAbFWvO.dZuHSR3Y8808c.3k.K9uDi5GULxSx6VwUUTuE4ijpwR/a	USER	t	2026-04-10 06:47:42.387077+00	2026-04-10 06:47:42.387087+00	\N	\N	\N	\N	\N	local		system	blue
7	yichunbong@hotmail.com	이춘봉	$2b$12$1OWWCAeKCEIdTcW.udWvN.8z5EmSOwxI/tc.jMluv88inGT0w17P.	USER	t	2026-04-09 14:07:41.199295+00	2026-04-10 15:03:34.567284+00	2026-04-10 15:03:34.566088+00	1	3	\N	\N	local		system	blue
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.accounts_id_seq', 20, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 193, true);


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.companies_id_seq', 1, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.departments_id_seq', 12, true);


--
-- Name: gateway_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.gateway_channels_id_seq', 1, false);


--
-- Name: gateways_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.gateways_id_seq', 1, false);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 771, true);


--
-- Name: message_stats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.message_stats_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.messages_id_seq', 242, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: permission_group_grants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.permission_group_grants_id_seq', 1941, true);


--
-- Name: permission_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.permission_groups_id_seq', 171, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 343, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, true);


--
-- Name: user_group_memberships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.user_group_memberships_id_seq', 273, true);


--
-- Name: user_oauth_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.user_oauth_tokens_id_seq', 2, true);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.user_permissions_id_seq', 18, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: vmsuser
--

SELECT pg_catalog.setval('public.users_id_seq', 12, true);


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

\unrestrict TRQ2Ry84zhbsynbKhhuyngW9MLB4Xua43Kfuctkj7X3LNSiQWKWkEMdK0oCFKPi

