/**
 * Portal Help 페이지
 *
 * v-platform Portal 전용 사용자 가이드, 기능 안내, FAQ
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ContentHeader } from "../components/layout/ContentHeader";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useTour } from "../hooks/useTour";
import { useAuthStore } from "../store/auth";
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
  Box,
  Users,
  Shield,
  ShieldCheck,
  Building2,
  Settings,
  Menu,
  Globe,
  KeyRound,
} from "lucide-react";

const Help = () => {
  const { startMainTour, startPageTour, resetAllTours } = useTour();
  const navigate = useNavigate();
  const isAdmin = useAuthStore().isAdmin();

  const navigateAndMainTour = useCallback(() => {
    navigate("/");
    setTimeout(() => startMainTour(), 500);
  }, [navigate, startMainTour]);

  return (
    <>
      <ContentHeader title="도움말" description="v-platform Portal 사용 가이드" />

      <div className="page-container space-y-section-gap">
        {/* 제품 소개 */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                <Globe className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-heading-md text-content-primary mb-2">
                  v-platform Portal이란?
                </h3>
                <p className="text-body-base text-content-secondary leading-relaxed">
                  v-platform Portal은{" "}
                  <strong>
                    여러 앱을 통합 관리하고 SSO(Single Sign-On)로 원클릭
                    접속
                  </strong>
                  할 수 있는 통합 포탈입니다. 포탈에 한 번 로그인하면 등록된 모든
                  앱에 별도 로그인 없이 바로 접근할 수 있습니다. 앱 상태 모니터링,
                  사이트맵, 앱 관리(CRUD) 기능을 제공합니다.
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
                포탈을 처음 사용한다면 아래 3단계를 따르세요.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StepCard
                  step={1}
                  title="포탈 로그인"
                  description="관리자가 발급한 계정 또는 SSO를 통해 포탈에 로그인합니다. 한 번의 로그인으로 모든 앱에 접근할 수 있습니다."
                />
                <StepCard
                  step={2}
                  title="앱 둘러보기"
                  description="메인 화면에서 등록된 앱 목록과 상태를 확인합니다. 각 앱의 온라인/오프라인 상태와 응답 시간을 한눈에 볼 수 있습니다."
                  action={() => navigate("/")}
                  actionLabel="포탈 메인으로"
                />
                <StepCard
                  step={3}
                  title="앱 실행하기"
                  description="원하는 앱 카드를 클릭하면 SSO 토큰이 자동 전달되어 별도 로그인 없이 앱이 열립니다."
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
                title="앱 포탈"
                description="등록된 앱 목록, 시스템 상태(온라인/오프라인/응답시간), 사이트맵을 한 화면에서 확인합니다. 앱 카드를 클릭하면 SSO로 자동 로그인됩니다."
              />
              <FeatureRow
                icon={<Settings className="w-5 h-5" />}
                title="설정"
                description="테마(라이트/다크), 세션 관리, 시스템 정보를 확인합니다. 관리자는 보안 정책, 브랜딩, 시스템 설정을 추가로 관리할 수 있습니다."
              />
              {isAdmin && (
                <>
                  <FeatureRow
                    icon={<Box className="w-5 h-5" />}
                    title="앱 관리"
                    badge="관리자"
                    description="포탈에 등록된 앱을 추가, 수정, 삭제합니다. 앱 ID, 이름, URL, 아이콘, 정렬 순서 등을 관리하고 활성/비활성 상태를 전환할 수 있습니다."
                  />
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
                    description="사이드바 메뉴 항목을 추가, 수정, 삭제하고 정렬 순서를 조정합니다. 커스텀 iframe 메뉴로 외부 페이지를 포탈 안에 내장할 수 있습니다."
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
                화면을 따라가며 포탈의 주요 기능 위치와 사용법을 안내받을 수
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
                question="앱을 클릭했는데 로그인 화면이 나와요"
                answer="SSO 토큰이 만료되었을 수 있습니다. 포탈에서 로그아웃 후 다시 로그인하면 새 토큰이 발급되어 앱에 자동 로그인됩니다. 문제가 지속되면 관리자에게 문의하세요."
              />
              <FaqItem
                question="앱 상태가 Offline으로 표시돼요"
                answer="해당 앱의 백엔드 서비스가 중지되었거나 네트워크 연결에 문제가 있을 수 있습니다. 새로고침 버튼으로 상태를 다시 확인하고, 지속될 경우 관리자에게 문의하세요."
              />
              <FaqItem
                question="사이트맵에 메뉴가 표시되지 않아요"
                answer="사이트맵은 각 앱에 등록된 활성 메뉴를 표시합니다. 메뉴가 없거나 비활성 상태이면 표시되지 않습니다. 관리자에게 메뉴 활성화를 요청하세요."
              />
              {isAdmin && (
                <>
                  <FaqItem
                    question="새 앱을 포탈에 추가하려면 어떻게 하나요?"
                    answer="관리 > 앱 관리 페이지에서 '새 앱 등록' 버튼을 클릭합니다. 앱 ID, 표시 이름, Backend/Frontend URL을 입력하고 저장하면 포탈 메인에 앱 카드가 나타납니다."
                  />
                  <FaqItem
                    question="특정 사용자에게만 특정 메뉴를 보여주려면?"
                    answer="권한 그룹을 생성한 뒤 해당 메뉴에 대한 접근 권한을 부여하고, 사용자를 그 권한 그룹에 배정하세요. 권한 매트릭스 페이지에서 전체 권한 설정을 한눈에 확인할 수 있습니다."
                  />
                  <FaqItem
                    question="커스텀 iframe 메뉴는 어떻게 만드나요?"
                    answer="메뉴 관리에서 '커스텀' 타입의 메뉴를 추가하고 외부 URL을 입력하면, 해당 메뉴 클릭 시 포탈 내부에 iframe으로 외부 페이지가 표시됩니다."
                  />
                </>
              )}
              <FaqItem
                question="다크 모드는 어떻게 변경하나요?"
                answer="상단 바 오른쪽의 테마 전환 아이콘을 클릭하면 라이트/다크/시스템 테마를 순환합니다. 설정 > 테마 탭에서 브랜드 색상도 변경할 수 있습니다."
              />
            </div>
          </CardBody>
        </Card>

        {/* 문서 링크 */}
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
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-body-sm font-medium transition-colors"
              >
                문서 사이트 열기
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
};

/* ── 서브 컴포넌트 ─────────────────────────────────────────────────────────── */

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
