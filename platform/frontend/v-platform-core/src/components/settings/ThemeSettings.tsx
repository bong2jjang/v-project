/**
 * ThemeSettings 컴포넌트
 *
 * 화면 모드(라이트/다크/시스템) + 브랜드 색상 프리셋 선택
 * - 다크모드에서는 ContentHeader에 브랜드 색상이 반영되지 않음을 프리뷰에 반영
 */

import { useTheme, COLOR_PRESETS } from "../../hooks/useTheme";
import { InfoBox } from "../ui/InfoBox";

export function ThemeSettings() {
  const {
    theme,
    isDark,
    setTheme,
    colorPreset,
    setColorPreset,
    contentWidth,
    setContentWidth,
    fontSize,
    setFontSize,
    pullToRefresh,
    setPullToRefresh,
    showWideViewToggle,
    setShowWideViewToggle,
  } = useTheme();

  return (
    <div className="space-y-8">
      {/* 브랜드 색상 */}
      <section>
        <h3 className="text-heading-md text-content-primary mb-1">
          브랜드 색상
        </h3>
        <p className="text-body-base text-content-secondary mb-4">
          앱 전체의 액센트 색상을 선택합니다
          {isDark && (
            <span className="text-content-tertiary">
              {" "}
              — 다크 모드의 페이지 헤더에는 적용되지 않습니다
            </span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {COLOR_PRESETS.map((preset) => (
            <ColorPresetCard
              key={preset.id}
              active={colorPreset === preset.id}
              onClick={() => setColorPreset(preset.id)}
              label={preset.label}
              color={preset.color}
              isDark={isDark}
            />
          ))}
        </div>
      </section>

      {/* 화면 모드 */}
      <section>
        <h3 className="text-heading-md text-content-primary mb-1">화면 모드</h3>
        <p className="text-body-base text-content-secondary mb-4">
          라이트, 다크, 또는 시스템 설정에 맞춰 자동 전환
        </p>
        <div className="grid grid-cols-3 gap-3">
          <ThemeModeCard
            active={theme === "light"}
            onClick={() => setTheme("light")}
            label="라이트"
            sublabel="밝은 배경"
            icon={<SunIcon />}
            preview={<LightPreview accent="#0078d4" />}
          />
          <ThemeModeCard
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            label="다크"
            sublabel="어두운 배경"
            icon={<MoonIcon />}
            preview={<DarkPreview />}
          />
          <ThemeModeCard
            active={theme === "system"}
            onClick={() => setTheme("system")}
            label="시스템"
            sublabel="OS 설정에 맞춤"
            icon={<MonitorIcon />}
            preview={<SystemPreview accent="#0078d4" />}
          />
        </div>
      </section>

      {/* 콘텐츠 너비 */}
      <section>
        <h3 className="text-heading-md text-content-primary mb-1">
          콘텐츠 너비
        </h3>
        <p className="text-body-base text-content-secondary mb-4">
          페이지 콘텐츠의 최대 너비를 설정합니다
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ContentWidthCard
            active={contentWidth === "default"}
            onClick={() => setContentWidth("default")}
            label="기본 너비"
            sublabel="읽기 편한 기본 폭"
            preview={<DefaultWidthPreview />}
          />
          <ContentWidthCard
            active={contentWidth === "wide"}
            onClick={() => setContentWidth("wide")}
            label="넓게보기"
            sublabel="화면 전체 활용"
            preview={<WideWidthPreview />}
          />
        </div>
      </section>

      {/* 글자 크기 */}
      <section>
        <h3 className="text-heading-md text-content-primary mb-1">글자 크기</h3>
        <p className="text-body-base text-content-secondary mb-4">
          인터페이스 전체의 기본 글자 크기를 조절합니다
          <span className="text-content-tertiary">
            {" "}
            — 코드 에디터와 미리보기 영역은 가독성을 위해 고정됩니다
          </span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <FontSizeCard
            active={fontSize === "small"}
            onClick={() => setFontSize("small")}
            label="작게"
            sublabel="15px"
            sampleScale="0.9375"
          />
          <FontSizeCard
            active={fontSize === "medium"}
            onClick={() => setFontSize("medium")}
            label="보통"
            sublabel="16px (기본)"
            sampleScale="1"
          />
          <FontSizeCard
            active={fontSize === "large"}
            onClick={() => setFontSize("large")}
            label="크게"
            sublabel="17.5px"
            sampleScale="1.09375"
          />
        </div>
      </section>

      {/* 인터랙션 옵션 */}
      <section>
        <h3 className="text-heading-md text-content-primary mb-1">
          인터랙션 옵션
        </h3>
        <p className="text-body-base text-content-secondary mb-4">
          스크롤 및 레이아웃 전환 버튼의 동작을 설정합니다
        </p>
        <div className="space-y-2">
          <ToggleRow
            checked={pullToRefresh}
            onChange={setPullToRefresh}
            label="당겨서 새로고침"
            sublabel="모바일에서 상단을 아래로 당기면 페이지를 새로고침합니다. 끄면 스크롤 사용성이 개선됩니다."
          />
          <ToggleRow
            checked={showWideViewToggle}
            onChange={setShowWideViewToggle}
            label="넓게보기 버튼 표시"
            sublabel="메인 콘텐츠 우측 상단의 넓게보기/기본보기 전환 버튼 노출 여부"
          />
        </div>
      </section>

      {/* 안내 */}
      <InfoBox variant="info" title="테마 안내">
        <ul className="list-disc list-inside space-y-1 text-body-sm">
          <li>
            테마와 색상 설정은 계정에 저장되어 어떤 기기에서든 동일하게
            적용됩니다
          </li>
          <li>시스템 모드는 OS의 다크모드 설정을 자동으로 감지합니다</li>
          <li>
            Nav 바의 테마 아이콘을 클릭하면 라이트 → 다크 → 시스템 순으로
            전환됩니다
          </li>
        </ul>
      </InfoBox>
    </div>
  );
}

/* ── 서브 컴포넌트 ── */

function ThemeModeCard({
  active,
  onClick,
  label,
  sublabel,
  icon,
  preview,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-4 rounded-card border-2 transition-all duration-normal ${
        active
          ? "border-brand-600 bg-brand-600/5 shadow-card-hover"
          : "border-line hover:border-line-heavy bg-surface-card hover:bg-surface-raised"
      }`}
    >
      {preview}
      <div className="flex items-center gap-2">
        <span className={active ? "text-brand-600" : "text-content-tertiary"}>
          {icon}
        </span>
        <div className="text-left">
          <span
            className={`text-heading-sm block ${active ? "text-brand-600" : "text-content-primary"}`}
          >
            {label}
          </span>
          <span className="text-caption text-content-tertiary">{sublabel}</span>
        </div>
      </div>
    </button>
  );
}

function ColorPresetCard({
  active,
  onClick,
  label,
  color,
  isDark,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-4 rounded-card border-2 transition-all duration-normal ${
        active
          ? "border-brand-600 bg-brand-600/5 shadow-card-hover"
          : "border-line hover:border-line-heavy bg-surface-card hover:bg-surface-raised"
      }`}
    >
      {/* 프리뷰 — 라이트에서만 브랜드 헤더 표시 */}
      {isDark ? (
        <DarkPreviewWithAccent accent={color} />
      ) : (
        <LightPreview accent={color} />
      )}

      <div className="flex items-center gap-2">
        <span
          className={`w-5 h-5 rounded-full ring-2 ${active ? "ring-brand-600 ring-offset-2 ring-offset-surface-card" : "ring-transparent"}`}
          style={{ background: color }}
        />
        <span
          className={`text-heading-sm ${active ? "text-content-primary" : "text-content-secondary"}`}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  sublabel: string;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-card border border-line bg-surface-card hover:bg-surface-raised cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-brand-600 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="text-heading-sm text-content-primary">{label}</div>
        <div className="text-caption text-content-tertiary mt-0.5">
          {sublabel}
        </div>
      </div>
    </label>
  );
}

function ContentWidthCard({
  active,
  onClick,
  label,
  sublabel,
  preview,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-4 rounded-card border-2 transition-all duration-normal ${
        active
          ? "border-brand-600 bg-brand-600/5 shadow-card-hover"
          : "border-line hover:border-line-heavy bg-surface-card hover:bg-surface-raised"
      }`}
    >
      {preview}
      <div className="text-center">
        <span
          className={`text-heading-sm block ${active ? "text-brand-600" : "text-content-primary"}`}
        >
          {label}
        </span>
        <span className="text-caption text-content-tertiary">{sublabel}</span>
      </div>
    </button>
  );
}

function FontSizeCard({
  active,
  onClick,
  label,
  sublabel,
  sampleScale,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  sampleScale: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-4 rounded-card border-2 transition-all duration-normal ${
        active
          ? "border-brand-600 bg-brand-600/5 shadow-card-hover"
          : "border-line hover:border-line-heavy bg-surface-card hover:bg-surface-raised"
      }`}
    >
      <div
        className="w-full h-16 rounded bg-surface-page border border-line flex items-center justify-center"
        style={{ fontSize: `${Number(sampleScale) * 16}px` }}
      >
        <span className="text-content-primary font-medium">Aa</span>
      </div>
      <div className="text-center">
        <span
          className={`text-heading-sm block ${active ? "text-brand-600" : "text-content-primary"}`}
        >
          {label}
        </span>
        <span className="text-caption text-content-tertiary">{sublabel}</span>
      </div>
    </button>
  );
}

function DefaultWidthPreview() {
  return (
    <div className="w-full h-16 rounded bg-surface-page border border-line p-1.5 flex flex-col gap-1">
      <div className="h-2 rounded-sm bg-brand-600 dark:bg-surface-raised mx-4 sm:mx-8 md:mx-12" />
      <div className="flex-1 rounded-sm bg-surface-card border border-line mx-4 sm:mx-8 md:mx-12" />
    </div>
  );
}

function WideWidthPreview() {
  return (
    <div className="w-full h-16 rounded bg-surface-page border border-line p-1.5 flex flex-col gap-1">
      <div className="h-2 rounded-sm bg-brand-600 dark:bg-surface-raised mx-1" />
      <div className="flex-1 rounded-sm bg-surface-card border border-line mx-1" />
    </div>
  );
}

/* ── 프리뷰 미니어처 ── */

function LightPreview({ accent }: { accent: string }) {
  return (
    <div className="w-full h-20 rounded bg-[#f3f3f3] border border-[#e5e5e5] p-1.5 flex flex-col gap-1">
      <div className="h-3 rounded-sm" style={{ background: accent }} />
      <div className="flex gap-1 flex-1">
        <div className="flex-1 rounded-sm bg-white border border-[#e5e5e5]" />
        <div className="flex-1 rounded-sm bg-white border border-[#e5e5e5]" />
      </div>
      <div className="h-2 rounded-sm bg-white border border-[#e5e5e5]" />
    </div>
  );
}

function DarkPreview() {
  return (
    <div className="w-full h-20 rounded bg-[#181818] border border-[#2b2b2b] p-1.5 flex flex-col gap-1">
      <div className="h-3 rounded-sm bg-[#2a2d2e]" />
      <div className="flex gap-1 flex-1">
        <div className="flex-1 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
        <div className="flex-1 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
      </div>
      <div className="h-2 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
    </div>
  );
}

function DarkPreviewWithAccent({ accent }: { accent: string }) {
  return (
    <div className="w-full h-20 rounded bg-[#181818] border border-[#2b2b2b] p-1.5 flex flex-col gap-1">
      <div className="h-3 rounded-sm bg-[#2a2d2e] flex items-center px-1">
        <div
          className="w-1/3 h-1 rounded-full"
          style={{ background: accent, opacity: 0.6 }}
        />
      </div>
      <div className="flex gap-1 flex-1">
        <div className="flex-1 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
        <div className="flex-1 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
      </div>
      <div className="h-2 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
    </div>
  );
}

function SystemPreview({ accent }: { accent: string }) {
  return (
    <div className="w-full h-20 rounded overflow-hidden flex border border-[#e5e5e5]">
      <div className="flex-1 bg-[#f3f3f3] p-1 flex flex-col gap-0.5">
        <div className="h-2 rounded-sm" style={{ background: accent }} />
        <div className="flex-1 rounded-sm bg-white border border-[#e5e5e5]" />
      </div>
      <div className="flex-1 bg-[#181818] p-1 flex flex-col gap-0.5">
        <div className="h-2 rounded-sm bg-[#2a2d2e]" />
        <div className="flex-1 rounded-sm bg-[#1e1e1e] border border-[#2b2b2b]" />
      </div>
    </div>
  );
}

/* ── 아이콘 ── */

function SunIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}
