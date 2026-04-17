/**
 * Template Help 페이지
 *
 * v-platform-template 전용 사용자 가이드, 기능 안내, FAQ
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
  Rocket,
  BookOpen,
  HelpCircle,
  Keyboard,
  FileText,
  ExternalLink,
  ArrowRight,
  RotateCcw,
  LayoutDashboard,
  Settings,
  Users,
  Shield,
  ShieldCheck,
  Building2,
  Menu,
  KeyRound,
  Blocks,
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

  const navigateAndMainTour = useCallback(() => {
    navigate("/");
    setTimeout(() => startMainTour(), 500);
  }, [navigate, startMainTour]);

  return (
    <>
      <ContentHeader
        title="도움말"
        description="v-platform Template 사용 가이드"
      />

      <div className="page-container space-y-section-gap">
        {/* 제품 소개 */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                <Blocks className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-heading-md text-content-primary mb-2">
                  v-platform Template이란?
                </h3>
                <p className="text-body-base text-content-secondary leading-relaxed">
                  v-platform Template은{" "}
                  <strong>
                    v-platform 기반 새 앱을 빠르게 시작할 수 있는 스캐폴딩
                    템플릿
                  </strong>
                  입니다. 인증, RBAC(역할 기반 접근 제어), 감사 로그, 조직도,
                  알림 등 플랫폼 공통 기능이 모두 내장되어 있어, 앱 고유 비즈니스
                  로직 개발에만 집중할 수 있습니다.
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
                템플릿 앱을 처음 사용한다면 아래 3단계를 따르세요.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StepCard
                  step={1}
                  title="로그인"
                  description="관리자가 발급한 계정 또는 SSO를 통해 로그인합니다. JWT 기반 인증으로 안전하게 세션이 관리됩니다."
                />
                <StepCard
                  step={2}
                  title="대시보드 확인"
                  description="대시보드에서 플랫폼, 데이터베이스, Redis 등 시스템 상태를 한눈에 확인합니다."
                  action={() => navigate("/")}
                  actionLabel="대시보드로 이동"
                />
                <StepCard
                  step={3}
                  title="설정 둘러보기"
                  description="설정 페이지에서 테마, 세션 관리, 시스템 정보를 확인합니다. 관리자는 보안/시스템 설정을 추가로 관리할 수 있습니다."
                  action={() => navigate("/settings")}
                  actionLabel="설정으로 이동"
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
                description="시스템 상태(플랫폼, 데이터베이스, Redis)를 실시간으로 모니터링합니다. 앱 개발 시 이 영역에 비즈니스 위젯을 추가할 수 있습니다."
              />
              <FeatureRow
                icon={<Settings className="w-5 h-5" />}
                title="설정"
                description="테마(라이트/다크/시스템), 세션 관리, 시스템 정보를 확인합니다. 관리자는 보안 정책, 브랜딩, 시스템 설정을 추가로 관리할 수 있습니다."
              />
              {isAdmin && (
                <>
                  <FeatureRow
                    icon={<Users className="w-5 h-5" />}
                    title="사용자 관리"
                    badge="관리자"
                    description="사용자 계정을 생성, 수정, 비활성화합니다. 권한 그룹을 할당하여 접근 가능한 메뉴와 기능을 제어할 수 있습니다."
                  />
                  <FeatureRow
                    icon={<Shield className="w-5 h-5" />}
                    title="권한 그룹"
                    badge="관리자"
                    description="역할별 권한 그룹을 생성하고 각 그룹에 메뉴 접근 권한(읽기/쓰기)을 부여합니다. 사용자를 그룹에 배정하여 체계적으로 접근 권한을 관리합니다."
                  />
                  <FeatureRow
                    icon={<KeyRound className="w-5 h-5" />}
                    title="권한 매트릭스"
                    badge="관리자"
                    description="모든 권한 그룹과 메뉴 항목의 접근 권한을 매트릭스 형태로 한눈에 확인하고 편집할 수 있습니다."
                  />
                  <FeatureRow
                    icon={<Menu className="w-5 h-5" />}
                    title="메뉴 관리"
                    badge="관리자"
                    description="사이드바 메뉴 항목을 추가, 수정, 삭제하고 정렬 순서를 조정합니다. 커스텀 iframe 메뉴로 외부 페이지를 앱 안에 내장할 수 있습니다."
                  />
                  <FeatureRow
                    icon={<Building2 className="w-5 h-5" />}
                    title="조직도"
                    badge="관리자"
                    description="부서 계층 구조를 생성하고 사용자를 부서에 배정합니다. 트리 형태로 전체 조직 구조를 시각화합니다."
                  />
                  <FeatureRow
                    icon={<ShieldCheck className="w-5 h-5" />}
                    title="감사 로그"
                    badge="관리자"
                    description="로그인, 사용자 생성, 설정 변경 등 모든 관리 작업의 이력을 기록합니다. 날짜, 사용자, 액션 타입별로 필터링하고 CSV로 내보낼 수 있습니다."
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
                화면을 따라가며 주요 기능의 위치와 사용법을 안내받을 수
                있습니다.
              </p>

              <Button
                onClick={navigateAndMainTour}
                variant="primary"
                className="w-full mb-3"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                전체 투어 시작
              </Button>

              <Button
                onClick={() => {
                  navigate("/settings");
                  setTimeout(() => startPageTour("settings"), 500);
                }}
                variant="secondary"
                className="w-full mb-3"
                icon={<Settings className="w-4 h-4" />}
              >
                설정 페이지 가이드
              </Button>

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
                question="이 앱은 무엇을 위한 템플릿인가요?"
                answer="v-platform 기반으로 새 앱을 만들 때 사용하는 스타터 프로젝트입니다. 인증, 사용자 관리, 권한 제어, 감사 로그 등 공통 기능이 사전 구성되어 있으므로, 대시보드와 앱 전용 페이지만 추가하면 됩니다."
              />
              <FaqItem
                question="대시보드에 시스템 상태가 빨간색으로 표시돼요"
                answer="해당 서비스(데이터베이스 또는 Redis)에 연결할 수 없는 상태입니다. Docker 컨테이너가 정상 실행 중인지 확인하고, docker compose logs로 오류를 점검하세요."
              />
              <FaqItem
                question="새 페이지를 추가하려면 어떻게 하나요?"
                answer="src/pages/ 디렉터리에 새 컴포넌트를 만들고, App.tsx에 Route를 추가하세요. ProtectedRoute로 감싸면 권한 검사가 자동 적용됩니다. 메뉴 관리에서 해당 경로의 메뉴를 등록하면 사이드바에 표시됩니다."
              />
              <FaqItem
                question="다크 모드는 어떻게 변경하나요?"
                answer="상단 바 오른쪽의 테마 전환 아이콘을 클릭하면 라이트/다크/시스템 테마를 순환합니다. 설정 > 테마 탭에서 브랜드 색상도 변경할 수 있습니다."
              />
              {isAdmin && (
                <>
                  <FaqItem
                    question="특정 사용자에게만 특정 메뉴를 보여주려면?"
                    answer="권한 그룹을 생성한 뒤 해당 메뉴에 대한 접근 권한을 부여하고, 사용자를 그 권한 그룹에 배정하세요. 권한 매트릭스 페이지에서 전체 권한 설정을 한눈에 확인할 수 있습니다."
                  />
                  <FaqItem
                    question="커스텀 iframe 메뉴는 어떻게 만드나요?"
                    answer="메뉴 관리에서 '커스텀' 타입의 메뉴를 추가하고 외부 URL을 입력하면, 해당 메뉴 클릭 시 앱 내부에 iframe으로 외부 페이지가 표시됩니다."
                  />
                  <FaqItem
                    question="새 사용자를 추가하려면 어떻게 하나요?"
                    answer="사이드바 > 사용자 관리에서 새 사용자를 생성할 수 있습니다. 권한 그룹을 할당하여 메뉴별 접근 권한(읽기/쓰기)을 세밀하게 제어할 수 있습니다."
                  />
                </>
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
}

function FeatureRow({ icon, title, description, badge }: FeatureRowProps) {
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
