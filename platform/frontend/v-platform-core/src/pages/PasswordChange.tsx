/**
 * PasswordChange 페이지
 *
 * 비밀번호 변경 전용 페이지
 * - 현재 비밀번호 확인
 * - 새 비밀번호 입력 및 검증
 * - 비밀번호 변경 처리
 */

import { ContentHeader } from "../components/Layout";
import { PasswordChangeForm } from "../components/profile/PasswordChangeForm";
import { Card, CardBody } from "../components/ui/Card";

export default function PasswordChange() {
  return (
    <>
      <ContentHeader
        title="비밀번호 변경"
        description="보안을 위해 정기적으로 비밀번호를 변경하세요"
      />

      <div className="page-container space-y-section-gap">
        <Card>
          <CardBody>
            <div className="space-y-8">
              {/* 비밀번호 변경 폼 */}
              <div>
                <h3 className="text-lg font-semibold text-content-primary mb-2">
                  새 비밀번호 설정
                </h3>
                <p className="text-body-sm text-content-secondary mb-6">
                  현재 비밀번호를 입력한 후 새 비밀번호를 설정할 수 있습니다
                </p>
                <PasswordChangeForm />
              </div>

              {/* 비밀번호 보안 가이드 */}
              <div className="border-t border-line pt-8">
                <h3 className="text-lg font-semibold text-content-primary mb-4">
                  비밀번호 보안 가이드
                </h3>
                <ul className="space-y-3 text-body-sm text-content-secondary">
                  <li className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>최소 8자 이상의 비밀번호를 사용하세요</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      영문 대소문자, 숫자, 특수문자를 조합하면 더욱 안전합니다
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      다른 사이트에서 사용하는 비밀번호와 다르게 설정하세요
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      정기적으로 비밀번호를 변경하여 계정을 보호하세요
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
