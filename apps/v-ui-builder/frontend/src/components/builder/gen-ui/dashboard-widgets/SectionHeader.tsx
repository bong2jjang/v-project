/**
 * SectionHeader — section_header ui tool 의 component 렌더러.
 * 좌측 아이콘 + 텍스트, 우측 선택적 액션 링크. 하단 얇은 구분선.
 */

import { ExternalLink } from "lucide-react";

import { resolveIcon } from "../../dashboard/iconMap";

export interface SectionHeaderProps {
  text: string;
  icon: string | null;
  action_label: string | null;
  action_href: string | null;
}

export function SectionHeader({
  text,
  icon,
  action_label,
  action_href,
}: SectionHeaderProps) {
  const Icon = resolveIcon(icon);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5 mb-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && (
          <Icon size={14} className="text-content-secondary shrink-0" />
        )}
        <span className="text-[14px] font-semibold text-content-primary truncate">
          {text}
        </span>
      </div>
      {action_label && action_href && (
        <a
          href={action_href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-brand-500 hover:underline shrink-0"
        >
          {action_label}
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}
