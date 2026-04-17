/**
 * Dashboard 페이지 — v-ui-builder
 *
 * AI UI Builder 메인 진입점. 최근 프로젝트 목록과 새 프로젝트 시작 버튼.
 * 프로젝트 목록 API는 P1.1 에서 연동됩니다.
 */

import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/auth";

export default function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="page-container">
      <div className="space-y-section-gap">
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-content-primary">
                  {user?.username || "사용자"}님, 무엇을 만들어 볼까요?
                </h2>
                <p className="mt-1 text-content-secondary">
                  대화로 UI를 만들고 Sandpack 으로 즉시 미리봅니다.
                </p>
              </div>
              <Link to="/builder/new">
                <Button variant="primary">새 프로젝트</Button>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 프로젝트</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-content-secondary">
              프로젝트 목록은 P1.1 에서 백엔드 API 연동과 함께 표시됩니다.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
