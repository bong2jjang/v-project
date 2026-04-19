/**
 * channel-bridge Help 페이지
 *
 * 사용자 가이드, 기능 안내, 프로덕트 투어, FAQ
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ContentHeader } from "../components/layout/ContentHeader";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useTour } from "../hooks/useTour";
import { useAuthStore } from "../store/auth";
import { useSystemSettingsStore } from "../store/systemSettings";
import {
  LayoutDashboard,
  Route,
  MessageSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  Activity,
  FileText,
  Rocket,
  BookOpen,
  HelpCircle,
  Keyboard,
  RotateCcw,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

const Help = () => {
  const { startMainTour, startPageTour, resetAllTours } = useTour();
  const navigate = useNavigate();
  const isAdmin = useAuthStore().isAdmin();
  const { settings } = useSystemSettingsStore();

  const handleDocsClick = () => {
    if (settings?.manual_url) {
      try {
        const url = new URL(settings.manual_url);
        if (url.protocol === "http:" || url.protocol === "https:") {
          window.open(settings.manual_url, "_blank", "noopener,noreferrer");
        }
      } catch {
        // invalid URL
      }
    }
  };

  // Help 페이지에서 투어 시작 시 해당 페이지로 먼저 이동 후 투어 시작
  const navigateAndTour = useCallback(
    (
      page: "dashboard" | "channels" | "messages" | "statistics" | "settings",
    ) => {
      const pathMap: Record<string, string> = {
        dashboard: "/",
        channels: "/channels",
        messages: "/messages",
        statistics: "/statistics",
        settings: "/settings",
      };
      navigate(pathMap[page]);
      setTimeout(() => startPageTour(page), 500);
    },
    [navigate, startPageTour],
  );

  const navigateAndMainTour = useCallback(() => {
    navigate("/");
    setTimeout(() => startMainTour(), 500);
  }, [navigate, startMainTour]);

  return (
    <>
      <ContentHeader title="도움말" description="channel-bridge 사용 가이드" />

      <div className="page-container space-y-section-gap">
        {/* 제품 소개 */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-heading-md text-content-primary mb-2">
                  channel-bridge란?
                </h3>
                <p className="text-body-base text-content-secondary leading-relaxed">
                  channel-bridge는{" "}
                  <strong>
                    Slack과 Microsoft Teams 간 메시지를 실시간으로 연동
                  </strong>
                  하는 브리지 시스템입니다. 한쪽 플랫폼에서 보낸 메시지가
                  자동으로 다른 쪽 플랫폼의 지정된 채널로 전달됩니다. 팀 간 소통
                  단절 없이 각자 선호하는 메신저를 사용할 수 있습니다.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 시작하기 */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                시작하기
              </div>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <p className="text-body-base text-content-secondary">
                메시지 연동을 시작하려면 아래 3단계를 따르세요.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StepCard
                  step={1}
                  title="플랫폼 연동"
                  description="연동 관리 > 플랫폼 연동 탭에서 Slack과 Teams 계정의 봇 토큰을 등록하고 연결 테스트를 합니다."
                  action={
                    isAdmin
                      ? () => navigate("/integrations#providers")
                      : undefined
                  }
                  actionLabel="설정으로 이동"
                  adminOnly
                />
                <StepCard
                  step={2}
                  title="Route 추가"
                  description="채널 관리에서 Slack 채널과 Teams 채널을 연결하는 Route를 만듭니다. 양방향 설정도 가능합니다."
                  action={() => navigate("/channels")}
                  actionLabel="채널 관리로 이동"
                />
                <StepCard
                  step={3}
                  title="메시지 확인"
                  description="Route가 활성화되면 메시지가 자동으로 전달됩니다. 메시지 페이지에서 전송 이력을 확인하세요."
                  action={() => navigate("/messages")}
                  actionLabel="메시지로 이동"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 페이지별 기능 안내 */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                페이지별 기능 안내
              </div>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-1">
              <FeatureRow
                icon={<LayoutDashboard className="w-5 h-5" />}
                title="대시보드"
                description="Provider 연결 상태, 실시간 메시지 처리량 차트, 메시지 흐름 시각화, 시스템 로그를 한 화면에서 모니터링합니다."
                tourAction={() => navigateAndTour("dashboard")}
              />
              <FeatureRow
                icon={<Route className="w-5 h-5" />}
                title="채널 관리"
                description="Slack ↔ Teams 채널 간 메시지 전달 경로(Route)를 추가, 수정, 삭제합니다. 양방향 Route를 설정하면 양쪽 모두에서 메시지가 전달됩니다."
                tourAction={() => navigateAndTour("channels")}
              />
              <FeatureRow
                icon={<MessageSquare className="w-5 h-5" />}
                title="메시지"
                description="브리지를 통해 전달된 모든 메시지의 이력을 검색, 필터링, 내보내기(CSV/JSON)할 수 있습니다. 전송 상태별 분류와 실시간 업데이트를 지원합니다."
                tourAction={() => navigateAndTour("messages")}
              />
              <FeatureRow
                icon={<BarChart3 className="w-5 h-5" />}
                title="통계"
                description="기간별 메시지 전송량, 성공률, 채널별 분포, 시간대별 패턴 등을 차트로 분석합니다. 실시간 업데이트와 날짜 프리셋을 지원합니다."
                tourAction={() => navigateAndTour("statistics")}
              />
              <FeatureRow
                icon={<Settings className="w-5 h-5" />}
                title="설정"
                description="테마(라이트/다크), 세션 관리, 시스템 정보를 확인합니다. 관리자는 보안 정책, 시스템 설정을 추가로 관리할 수 있습니다."
                tourAction={() => navigateAndTour("settings")}
              />
              {isAdmin && (
                <>
                  <FeatureRow
                    icon={<ShieldCheck className="w-5 h-5" />}
                    title="감사 로그"
                    badge="관리자"
                    description="계정 생성, Route 변경, 설정 수정 등 모든 관리 작업의 이력을 기록합니다. 날짜, 사용자, 액션 타입별로 필터링하고 CSV로 내보낼 수 있습니다."
                  />
                  <FeatureRow
                    icon={<Activity className="w-5 h-5" />}
                    title="모니터링"
                    badge="관리자"
                    description="Backend, PostgreSQL, Redis, Prometheus, Grafana 등 모든 인프라 서비스의 상태를 실시간으로 확인합니다."
                  />
                </>
              )}
            </div>
          </CardBody>
        </Card>

        {/* 프로덕트 투어 & 단축키 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-section-gap">
          {/* 프로덕트 투어 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  프로덕트 투어
                </div>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-body-base text-content-secondary mb-4">
                화면을 따라가며 각 기능의 위치와 사용법을 안내받을 수 있습니다.
              </p>

              <Button
                onClick={navigateAndMainTour}
                variant="primary"
                className="w-full mb-3"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                전체 투어 시작
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => navigateAndTour("dashboard")}
                  variant="secondary"
                  size="sm"
                >
                  대시보드
                </Button>
                <Button
                  onClick={() => navigateAndTour("channels")}
                  variant="secondary"
                  size="sm"
                >
                  채널 관리
                </Button>
                <Button
                  onClick={() => navigateAndTour("messages")}
                  variant="secondary"
                  size="sm"
                >
                  메시지
                </Button>
                <Button
                  onClick={() => navigateAndTour("statistics")}
                  variant="secondary"
                  size="sm"
                >
                  통계
                </Button>
              </div>

              <button
                type="button"
                onClick={resetAllTours}
                className="flex items-center gap-1.5 text-body-sm text-content-tertiary hover:text-content-secondary mt-4 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                투어 진행 상태 초기화
              </button>
            </CardBody>
          </Card>

          {/* 키보드 단축키 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5" />
                  키보드 단축키
                </div>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                <ShortcutRow label="도움말 메뉴 열기" shortcut="Shift + ?" />
                <ShortcutRow
                  label="프로덕트 투어 시작"
                  shortcut="Ctrl + Shift + T"
                />
                <ShortcutRow label="투어 진행 중 종료" shortcut="ESC" />
                <ShortcutRow label="투어 다음 단계" shortcut="→ 또는 Enter" />
                <ShortcutRow
                  label="투어 이전 단계"
                  shortcut="← 또는 Backspace"
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                자주 묻는 질문
              </div>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <FaqItem
                question="메시지가 상대 플랫폼으로 전달되지 않아요"
                answer="대시보드에서 Provider 연결 상태가 '연결됨'인지 확인하세요. 연결이 끊겼다면 연동 관리 > 플랫폼 연동에서 봇 토큰을 확인하고, 채널 관리에서 해당 Route가 올바르게 설정되어 있는지 점검하세요."
              />
              <FaqItem
                question="Route를 만들었는데 채널 목록이 안 보여요"
                answer="Provider가 먼저 연결되어 있어야 채널 목록을 불러올 수 있습니다. 연동 관리 > 플랫폼 연동에서 해당 플랫폼의 연결 상태를 확인하세요."
              />
              <FaqItem
                question="양방향 Route와 단방향 Route의 차이가 뭔가요?"
                answer="양방향 Route는 A→B, B→A 양쪽 모두 메시지가 전달됩니다. 단방향은 설정한 한 방향으로만 전달됩니다. 양방향 Route는 목록에서 ↔ 배지로 구분됩니다."
              />
              <FaqItem
                question="메시지 전송에 실패하면 어떻게 되나요?"
                answer="시스템이 자동으로 재시도합니다. 메시지 페이지에서 '재시도중' 또는 '실패' 상태의 메시지를 확인할 수 있습니다. 반복 실패 시 시스템 로그에서 원인(봇 권한 부족, 채널 없음 등)을 확인하세요."
              />
              <FaqItem
                question="다크 모드는 어떻게 변경하나요?"
                answer="상단 바 오른쪽의 테마 전환 아이콘을 클릭하면 라이트/다크/시스템 테마를 순환합니다. 설정 > 테마 탭에서 브랜드 색상도 변경할 수 있습니다."
              />
              {isAdmin && (
                <FaqItem
                  question="새 사용자를 추가하려면 어떻게 하나요?"
                  answer="사이드바 > 사용자 관리에서 새 사용자를 생성할 수 있습니다. 관리자(admin) 또는 일반 사용자(user) 역할을 부여할 수 있으며, 관리자만 연동 관리, 보안, 시스템 설정에 접근할 수 있습니다."
                />
              )}
            </div>
          </CardBody>
        </Card>

        {/* 문서 링크 */}
        {settings?.manual_enabled && settings?.manual_url && (
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-heading-sm text-content-primary mb-1">
                    상세 문서
                  </h3>
                  <p className="text-body-sm text-content-secondary">
                    관리자 가이드, API 문서, 아키텍처 등 자세한 기술 문서를 확인할
                    수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDocsClick}
                  className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-body-sm font-medium transition-colors"
                >
                  문서 사이트 열기
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
};

/* -- 서브 컴포넌트 ---------------------------------------------------------- */

interface StepCardProps {
  step: number;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
  adminOnly?: boolean;
}

function StepCard({
  step,
  title,
  description,
  action,
  actionLabel,
  adminOnly,
}: StepCardProps) {
  return (
    <div className="border border-line rounded-lg p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <span className="text-heading-sm text-content-primary">{title}</span>
        {adminOnly && (
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            관리자
          </Badge>
        )}
      </div>
      <p className="text-body-sm text-content-secondary flex-1">
        {description}
      </p>
      {action && actionLabel && (
        <button
          type="button"
          onClick={action}
          className="mt-3 text-body-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium flex items-center gap-1 transition-colors"
        >
          {actionLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  tourAction?: () => void;
}

function FeatureRow({
  icon,
  title,
  description,
  badge,
  tourAction,
}: FeatureRowProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-raised transition-colors">
      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-heading-sm text-content-primary">{title}</span>
          {badge && (
            <Badge variant="info" className="text-[10px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-body-sm text-content-secondary">{description}</p>
      </div>
      {tourAction && (
        <button
          type="button"
          onClick={tourAction}
          className="text-body-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium flex-shrink-0 mt-1 transition-colors"
        >
          투어
        </button>
      )}
    </div>
  );
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between bg-surface-raised rounded-lg p-3">
      <span className="text-body-base text-content-primary">{label}</span>
      <kbd className="px-2 py-1 bg-surface-card border border-line rounded text-xs font-mono text-content-secondary">
        {shortcut}
      </kbd>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-line pb-4 last:border-0 last:pb-0">
      <h4 className="text-heading-sm text-content-primary mb-1.5">
        Q. {question}
      </h4>
      <p className="text-body-sm text-content-secondary leading-relaxed">
        {answer}
      </p>
    </div>
  );
}

export default Help;
