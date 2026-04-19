/**
 * iconMap — 백엔드 ui tool 의 `icon` 문자열을 lucide-react 컴포넌트로 해석.
 *
 * 백엔드 BaseUiTool.icon 에 지정된 이름만 추가하면 된다. 지정되지 않은 이름은
 * 기본 `Blocks` 아이콘으로 대체되므로 카탈로그 UI 가 비어 보이지 않는다.
 */

import {
  Activity,
  BarChart3,
  Bell,
  Blocks,
  Bookmark,
  CircleDotDashed,
  FileText,
  Heading,
  LayoutGrid,
  LineChart,
  MessageSquare,
  Minus,
  PieChart,
  Table,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

const BarChartHorizontal: LucideIcon = BarChart3;

const ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  BarChartHorizontal,
  Bell,
  Blocks,
  Bookmark,
  CircleDotDashed,
  FileText,
  Heading,
  LayoutGrid,
  LineChart,
  MessageSquare,
  Minus,
  PieChart,
  Table,
  TrendingUp,
};

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Blocks;
  return ICONS[name] ?? Blocks;
}
