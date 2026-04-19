/**
 * TitleBlock — title_block ui tool 의 component 렌더러.
 * 섹션 제목을 h1~h4 수준으로 표시. 대시보드 상단 헤드라인 용도.
 */

export interface TitleBlockProps {
  text: string;
  level: "h1" | "h2" | "h3" | "h4";
  align: "left" | "center";
}

const LEVEL_CLASS: Record<TitleBlockProps["level"], string> = {
  h1: "text-[22px] font-bold",
  h2: "text-[18px] font-semibold",
  h3: "text-[15px] font-semibold",
  h4: "text-[13px] font-semibold",
};

const ALIGN_CLASS: Record<TitleBlockProps["align"], string> = {
  left: "text-left",
  center: "text-center",
};

export function TitleBlock({ text, level, align }: TitleBlockProps) {
  const Tag = level;
  return (
    <div className={`px-1 py-0.5 ${ALIGN_CLASS[align]}`}>
      <Tag className={`${LEVEL_CLASS[level]} text-content-primary leading-tight break-words`}>
        {text}
      </Tag>
    </div>
  );
}
