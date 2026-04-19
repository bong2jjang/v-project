/**
 * v-ui-builder Help 페이지
 *
 * AI UI Builder 전용 사용자 가이드, 기능 안내, FAQ
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
  Code2,
  Sparkles,
  Settings,
  Users,
  Shield,
  ShieldCheck,
  Building2,
  Menu,
  KeyRound,
} from "lucide-react";

const Help = () => {
  const { startMainTour, resetAllTours } = useTour();
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
        description="AI UI Builder 사용 가이드"
      />

      <div className="page-container space-y-section-gap">
        {/* 제품 소개 */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-heading-md text-content-primary mb-2">
                  AI UI Builder란?
                </h3>
                <p className="text-body-base text-content-secondary leading-relaxed">
                  AI UI Builder는{" "}
                  <strong>
                    대화로 UI를 만들고 브라우저에서 즉시 미리보는 AI 기반 IDE
                  </strong>
                  입니다. Sandpack(@codesandbox/sandpack-react) 기반 3-pane IDE로
                  React/TypeScript 앱을 즉시 번들링하고, Generative UI 모드로는
                  대시보드 위젯 보드를 조립할 수 있습니다. OpenAI / Gemini /
                  Claude Provider를 환경변수로 전환할 수 있습니다.
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
                처음 UI Builder를 사용한다면 아래 3단계를 따르세요.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StepCard
                  step={1}
                  title="프로젝트 생성"
                  description="Sandpack 프로젝트 목록에서 새 프로젝트를 만듭니다. React + TypeScript 템플릿이 기본 적용됩니다."
                  action={() => navigate("/")}
                  actionLabel="프로젝트 목록으로"
                />
                <StepCard
                  step={2}
                  title="대화로 UI 생성"
                  description="Builder 화면의 좌측 Chat 창에서 원하는 UI를 자연어로 설명하세요. AI가 코드를 스트리밍으로 작성합니다."
                />
                <StepCard
                  step={3}
                  title="코드·미리보기 확인"
                  description="가운데 Code 패널에서 생성된 소스를, 우측 Preview 패널에서 실시간 번들링 결과를 즉시 확인할 수 있습니다."
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
                icon={<Code2 className="w-5 h-5" />}
                title="Sandpack 프로젝트"
                description="AI로 생성한 Sandpack 프로젝트 목록을 확인하고 새 프로젝트를 만듭니다. 각 프로젝트는 고유 대화 이력과 코드 스냅샷을 가집니다."
              />
              <FeatureRow
                icon={<Code2 className="w-5 h-5" />}
                title="Sandpack Builder (3-pane IDE)"
                description="Chat / Code / Preview 3개 영역으로 구성된 IDE. 대화로 지시하면 AI가 파일을 작성·수정하고 Sandpack이 브라우저에서 즉시 번들링해 결과를 보여줍니다."
              />
              <FeatureRow
                icon={<Sparkles className="w-5 h-5" />}
                title="Generative UI 프로젝트"
                description="대시보드형 위젯 보드 프로젝트 목록입니다. Sandpack과 달리 react-grid-layout 위에 독립 위젯을 배치하는 워크플로우에 최적화되어 있습니다."
              />
              <FeatureRow
                icon={<Sparkles className="w-5 h-5" />}
                title="Generative UI Builder"
                description="우측 Chat 창으로 대화하면서 DashboardCanvas 위에 위젯을 추가·조정합니다. 위젯 크기와 위치는 드래그로 편집할 수 있습니다."
              />
              <FeatureRow
                icon={<Settings className="w-5 h-5" />}
                title="설정"
                description="테마(라이트/다크/시스템), 세션 관리, 시스템 정보를 확인합니다. LLM Provider는 서버 환경변수로 관리됩니다."
              />
              {isAdmin && (
                <>
                  <FeatureRow
                    icon={<Users className="w-5 h-5" />}
                    title="사용자 관리"
                    badge="관리자"
                    description="사용자 계정을 생성·수정하고 권한 그룹을 할당합니다. UI Builder 메뉴는 ui_builder_sandpack / ui_builder_genui 권한 키로 개별 제어됩니다."
                  />
                  <FeatureRow
                    icon={<Shield className="w-5 h-5" />}
                    title="권한 그룹"
                    badge="관리자"
                    description="권한 그룹별로 Sandpack / Generative UI 메뉴 접근 권한을 부여합니다. 읽기·쓰기 권한을 분리해 관리할 수 있습니다."
                  />
                  <FeatureRow
                    icon={<KeyRound className="w-5 h-5" />}
                    title="권한 매트릭스"
                    badge="관리자"
                    description="모든 권한 그룹과 메뉴의 접근 권한을 매트릭스 형태로 한눈에 확인하고 편집합니다."
                  />
                  <FeatureRow
                    icon={<Menu className="w-5 h-5" />}
                    title="메뉴 관리"
                    badge="관리자"
                    description="사이드바 메뉴 항목을 추가·수정하고 정렬합니다. UI Builder 기본 메뉴(Sandpack / Generative UI)와 커스텀 iframe 메뉴를 함께 관리할 수 있습니다."
                  />
                  <FeatureRow
                    icon={<Building2 className="w-5 h-5" />}
                    title="조직도"
                    badge="관리자"
                    description="부서 계층 구조를 생성하고 사용자를 부서에 배정합니다."
                  />
                  <FeatureRow
                    icon={<ShieldCheck className="w-5 h-5" />}
                    title="감사 로그"
                    badge="관리자"
                    description="로그인, 사용자 생성, 프로젝트 변경 등 관리 작업 이력을 기록합니다. 날짜·사용자·액션 타입별 필터링과 CSV 내보내기가 가능합니다."
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
                onClick={() => navigate("/")}
                variant="secondary"
                className="w-full mb-3"
                icon={<Code2 className="w-4 h-4" />}
              >
                Sandpack 프로젝트로 이동
              </Button>

              <Button
                onClick={() => navigate("/genui")}
                variant="secondary"
                className="w-full mb-3"
                icon={<Sparkles className="w-4 h-4" />}
              >
                Generative UI 프로젝트로 이동
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
                question="Sandpack 프로젝트와 Generative UI 프로젝트는 무엇이 다른가요?"
                answer="Sandpack 프로젝트는 완전한 React 앱 한 개를 Chat으로 만들고 브라우저에서 번들링하는 방식입니다. 반대로 Generative UI는 대시보드 캔버스(react-grid-layout) 위에 독립 위젯을 여러 개 올려 조합하는 방식입니다. 앱 수준 프로토타이핑은 Sandpack, 위젯·데이터 패널은 Generative UI를 선택하세요."
              />
              <FaqItem
                question="대화에 AI가 응답하지 않거나 오류가 납니다"
                answer="대부분 LLM Provider 설정 문제입니다. .env 파일의 LLM_PROVIDER 값(openai | gemini | claude)과 해당 API 키(OPENAI_API_KEY 등)가 올바른지 확인하세요. docker logs v-ui-builder-backend --tail=50 으로 스트림 오류를 함께 점검할 수 있습니다."
              />
              <FaqItem
                question="LLM Provider를 어떻게 바꾸나요?"
                answer=".env 파일에서 LLM_PROVIDER와 해당 Provider의 API 키·모델명을 설정한 뒤 docker compose up -d --build v-ui-builder-backend 로 백엔드 컨테이너를 재기동하면 됩니다. 코드 변경은 필요 없습니다."
              />
              <FaqItem
                question="생성된 프로젝트와 대화 이력은 저장되나요?"
                answer="예, 모든 프로젝트·메시지·아티팩트는 PostgreSQL의 ui_builder_* 테이블에 저장됩니다. 브라우저를 닫아도 다음 접속 시 목록과 이력이 그대로 유지됩니다."
              />
              <FaqItem
                question="Preview 패널이 비어 있거나 에러가 보여요"
                answer="Sandpack은 브라우저에서 번들링하기 때문에 생성된 코드에 문법 오류가 있으면 Preview가 실패합니다. Code 패널에서 오류 표시를 확인한 뒤 Chat으로 'X를 수정해 줘' 처럼 수정 지시를 내리세요."
              />
              <FaqItem
                question="다크 모드는 어떻게 변경하나요?"
                answer="상단 바 오른쪽의 테마 전환 아이콘을 클릭하면 라이트/다크/시스템 테마를 순환합니다. 설정 > 테마 탭에서 브랜드 색상도 변경할 수 있습니다."
              />
              {isAdmin && (
                <>
                  <FaqItem
                    question="특정 사용자만 Sandpack 또는 Generative UI에 접근하게 하려면?"
                    answer="권한 그룹에 ui_builder_sandpack 또는 ui_builder_genui 권한을 개별 부여하고, 사용자를 해당 그룹에 배정하세요. 두 메뉴는 서로 독립된 permission_key를 가지므로 세밀하게 제어할 수 있습니다."
                  />
                  <FaqItem
                    question="새 사용자를 추가하려면 어떻게 하나요?"
                    answer="사이드바 > 사용자 관리에서 새 사용자를 생성할 수 있습니다. 권한 그룹을 할당하면 Sandpack / Generative UI / 관리 페이지 접근 권한이 메뉴별로 적용됩니다."
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
