/**
 * IconPicker 컴포넌트
 *
 * Lucide 아이콘을 카테고리별로 분류하여 시각적으로 선택하거나 이름을 직접 입력
 * - 카테고리 탭: 회사/조직, 업무/문서, 시스템/인프라, 자동화, 데이터/분석, 알림, UI, 미디어
 * - 검색 + 카테고리 필터 병행
 * - 선택된 아이콘 미리보기 + 초기화
 */

import { useState, useMemo } from "react";
import { icons } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** PascalCase → kebab-case (저장 형식) */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/** kebab-case → PascalCase (lucide-react 조회용) */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

// ── 카테고리 정의 ────────────────────────────────────────────────────

interface IconCategory {
  key: string;
  label: string;
  iconNames: string[];
}

const ICON_CATEGORIES: IconCategory[] = [
  {
    key: "company",
    label: "회사/조직",
    iconNames: [
      "Building",
      "Building2",
      "Landmark",
      "Briefcase",
      "Users",
      "UserPlus",
      "UserCog",
      "UserCheck",
      "Contact",
      "BadgeCheck",
      "Network",
      "Handshake",
      "Crown",
      "GraduationCap",
      "Award",
      "Trophy",
      "IdCard",
      "CircleUser",
      "UserRound",
      "UsersRound",
      "Factory",
      "Store",
      "Warehouse",
      "Hotel",
    ],
  },
  {
    key: "work",
    label: "업무/문서",
    iconNames: [
      "FileText",
      "FolderOpen",
      "Folder",
      "FolderTree",
      "ClipboardList",
      "ClipboardCheck",
      "Calendar",
      "CalendarDays",
      "CalendarClock",
      "Mail",
      "MailOpen",
      "MessageSquare",
      "MessageCircle",
      "Phone",
      "PhoneCall",
      "Video",
      "Headphones",
      "Pen",
      "PenLine",
      "Edit",
      "Bookmark",
      "BookmarkCheck",
      "Inbox",
      "Send",
      "Reply",
      "Paperclip",
      "Archive",
      "File",
      "FileCheck",
      "FilePlus",
      "FileSearch",
      "NotebookPen",
      "BookOpen",
      "ListTodo",
      "ListChecks",
      "CircleCheck",
      "SquareCheck",
    ],
  },
  {
    key: "system",
    label: "시스템/인프라",
    iconNames: [
      "Server",
      "Database",
      "Cpu",
      "HardDrive",
      "Monitor",
      "Laptop",
      "Smartphone",
      "Tablet",
      "Cloud",
      "CloudCog",
      "Wifi",
      "Globe",
      "Lock",
      "Unlock",
      "Key",
      "KeyRound",
      "Shield",
      "ShieldCheck",
      "ShieldAlert",
      "Settings",
      "Settings2",
      "Wrench",
      "Terminal",
      "Code",
      "Code2",
      "Bug",
      "Container",
      "Cable",
      "Router",
      "Plug",
      "Power",
      "Binary",
      "Fingerprint",
      "ScanFace",
    ],
  },
  {
    key: "automation",
    label: "자동화/워크플로우",
    iconNames: [
      "Zap",
      "Bot",
      "Workflow",
      "GitBranch",
      "GitPullRequest",
      "GitCommit",
      "GitMerge",
      "GitFork",
      "Play",
      "CirclePlay",
      "RefreshCw",
      "Timer",
      "TimerReset",
      "Repeat",
      "Repeat2",
      "Route",
      "Rocket",
      "Sparkles",
      "Wand2",
      "Cog",
      "Blocks",
      "Puzzle",
      "Unplug",
      "PlugZap",
      "Webhook",
      "ArrowRightLeft",
      "Shuffle",
      "Forward",
      "IterationCw",
      "CircleDot",
    ],
  },
  {
    key: "data",
    label: "데이터/분석",
    iconNames: [
      "BarChart3",
      "BarChart4",
      "BarChartBig",
      "ChartPie",
      "ChartLine",
      "ChartArea",
      "ChartSpline",
      "Activity",
      "TrendingUp",
      "TrendingDown",
      "Gauge",
      "Target",
      "Search",
      "Filter",
      "Eye",
      "Scan",
      "ScanLine",
      "Hash",
      "Binary",
      "FileSpreadsheet",
      "Table2",
      "PieChart",
      "Sigma",
      "Calculator",
      "Percent",
    ],
  },
  {
    key: "notification",
    label: "알림/상태",
    iconNames: [
      "Bell",
      "BellRing",
      "BellDot",
      "BellOff",
      "CircleAlert",
      "AlertTriangle",
      "AlertOctagon",
      "CheckCircle",
      "CheckCircle2",
      "XCircle",
      "Info",
      "HelpCircle",
      "Flag",
      "FlagTriangleRight",
      "Star",
      "Heart",
      "ThumbsUp",
      "ThumbsDown",
      "Siren",
      "Megaphone",
      "Volume2",
      "VolumeX",
      "Radio",
      "Rss",
    ],
  },
  {
    key: "layout",
    label: "레이아웃/UI",
    iconNames: [
      "Layout",
      "LayoutDashboard",
      "LayoutGrid",
      "LayoutList",
      "LayoutTemplate",
      "Grid3x3",
      "Layers",
      "Layers3",
      "Columns3",
      "Rows3",
      "SidebarOpen",
      "SidebarClose",
      "PanelLeft",
      "PanelRight",
      "PanelTop",
      "PanelBottom",
      "Table",
      "List",
      "Menu",
      "Maximize",
      "Minimize",
      "AppWindow",
      "Fullscreen",
      "GalleryVertical",
      "Component",
      "Blocks",
    ],
  },
  {
    key: "media",
    label: "미디어/콘텐츠",
    iconNames: [
      "Image",
      "Camera",
      "Film",
      "Music",
      "Palette",
      "Brush",
      "Paintbrush",
      "Type",
      "Link",
      "Link2",
      "ExternalLink",
      "QrCode",
      "Map",
      "MapPin",
      "Navigation",
      "Compass",
      "Download",
      "Upload",
      "Share2",
      "Copy",
      "Scissors",
      "Crop",
      "Printer",
      "ScanBarcode",
      "Tv",
    ],
  },
];

// 카테고리에 속한 아이콘을 빠르게 찾기 위한 맵
const iconToCategoryMap = new Map<string, string>();
for (const cat of ICON_CATEGORIES) {
  for (const name of cat.iconNames) {
    iconToCategoryMap.set(name, cat.key);
  }
}

const MAX_DISPLAY = 200;

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // 카테고리별 아이콘 목록 (실제 존재하는 아이콘만)
  const categoryIcons = useMemo(() => {
    const allEntries = Object.entries(icons) as [string, LucideIcon][];
    const allMap = new Map(allEntries);

    const result: Record<string, [string, LucideIcon][]> = { all: [] };

    for (const cat of ICON_CATEGORIES) {
      result[cat.key] = cat.iconNames
        .filter((n) => allMap.has(n))
        .map((n) => [n, allMap.get(n)!] as [string, LucideIcon]);
    }

    // "전체"는 카테고리 아이콘 우선 → 나머지 알파벳 순
    const categorized = new Set(
      ICON_CATEGORIES.flatMap((c) => c.iconNames).filter((n) => allMap.has(n)),
    );
    const categorizedEntries = [...categorized].map(
      (n) => [n, allMap.get(n)!] as [string, LucideIcon],
    );
    const uncategorized = allEntries
      .filter(([n]) => !categorized.has(n))
      .sort((a, b) => a[0].localeCompare(b[0]));
    result.all = [...categorizedEntries, ...uncategorized];

    return result;
  }, []);

  // 검색 + 카테고리 필터
  const filteredIcons = useMemo(() => {
    const base = categoryIcons[activeCategory] || categoryIcons.all;
    if (!search.trim()) return base.slice(0, MAX_DISPLAY);
    const q = search.toLowerCase();
    return base
      .filter(
        ([name]) =>
          name.toLowerCase().includes(q) || toKebabCase(name).includes(q),
      )
      .slice(0, MAX_DISPLAY);
  }, [categoryIcons, activeCategory, search]);

  // 현재 선택된 아이콘 미리보기
  const selectedPascal = value ? toPascalCase(value) : "";
  const SelectedIcon = selectedPascal
    ? (icons as Record<string, LucideIcon>)[selectedPascal]
    : null;

  return (
    <div>
      {/* 모드 토글 */}
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => setMode("visual")}
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            mode === "visual"
              ? "bg-brand-600 text-white"
              : "bg-surface-raised text-content-secondary hover:text-content-primary"
          }`}
        >
          아이콘 선택
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            mode === "text"
              ? "bg-brand-600 text-white"
              : "bg-surface-raised text-content-secondary hover:text-content-primary"
          }`}
        >
          이름 입력
        </button>
      </div>

      {/* 선택된 아이콘 미리보기 */}
      {value && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-surface-raised rounded-lg border border-line">
          {SelectedIcon ? (
            <SelectedIcon size={18} className="text-brand-600 flex-shrink-0" />
          ) : (
            <span className="w-[18px] h-[18px] flex-shrink-0 rounded bg-line" />
          )}
          <span className="text-sm text-content-primary font-mono">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto text-xs text-content-tertiary hover:text-status-danger transition-colors"
          >
            초기화
          </button>
        </div>
      )}

      {mode === "visual" ? (
        <>
          {/* 검색 */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="아이콘 검색..."
            className="w-full px-3 py-1.5 mb-2 bg-surface-card border border-line rounded-lg text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />

          {/* 카테고리 탭 */}
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                activeCategory === "all"
                  ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium"
                  : "bg-surface-raised text-content-tertiary hover:text-content-secondary"
              }`}
            >
              전체
            </button>
            {ICON_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  activeCategory === cat.key
                    ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium"
                    : "bg-surface-raised text-content-tertiary hover:text-content-secondary"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 아이콘 그리드 */}
          <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1 border border-line rounded-lg bg-surface-card">
            {filteredIcons.map(([name, Icon]) => {
              const kebab = toKebabCase(name);
              const isSelected = value === kebab;
              return (
                <button
                  key={name}
                  type="button"
                  title={kebab}
                  onClick={() => onChange(kebab)}
                  className={`p-2 rounded-md flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-brand-600/10 text-brand-600 ring-1 ring-brand-500"
                      : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
                  }`}
                >
                  <Icon size={18} />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className="col-span-8 py-4 text-center text-xs text-content-tertiary">
                일치하는 아이콘이 없습니다
              </div>
            )}
          </div>

          {!search && filteredIcons.length >= MAX_DISPLAY && (
            <p className="mt-1 text-xs text-content-tertiary">
              상위 {MAX_DISPLAY}개 표시 중 — 검색하여 더 많은 아이콘을 찾으세요
            </p>
          )}
        </>
      ) : (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="예: globe, monitor, link"
            className="w-full px-3 py-2 bg-surface-card border border-line rounded-lg text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <p className="mt-1 text-xs text-content-tertiary">
            Lucide 아이콘 이름 (비워두면 기본 아이콘 사용)
          </p>
        </>
      )}
    </div>
  );
}

/** IconPicker가 저장하는 kebab-case 이름을 PascalCase로 변환 (외부 유틸) */
export { toPascalCase, toKebabCase };
