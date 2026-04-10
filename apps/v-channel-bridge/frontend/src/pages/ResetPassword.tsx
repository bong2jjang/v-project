import { useState, useEffect, FormEvent } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  verifyPasswordResetToken,
  confirmPasswordReset,
} from "../lib/api/auth";
import { ApiClientError } from "../lib/api/client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  // 토큰 검증 상태
  const [isVerifying, setIsVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // 비밀번호 재설정 상태
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 토큰 검증 (컴포넌트 마운트 시)
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerifyError("유효하지 않은 재설정 링크입니다.");
        setIsVerifying(false);
        return;
      }

      try {
        const result = await verifyPasswordResetToken(token);
        if (result.valid) {
          setIsTokenValid(true);
          setUserEmail(result.email);
        } else {
          setVerifyError("만료되었거나 이미 사용된 재설정 링크입니다.");
        }
      } catch (err) {
        if (err instanceof ApiClientError) {
          setVerifyError(err.getUserMessage());
        } else {
          setVerifyError("토큰 검증 중 오류가 발생했습니다.");
        }
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 유효성 검사
    if (!newPassword || !confirmPassword) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    if (newPassword.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset(token!, newPassword);
      setSuccess(true);

      // 3초 후 로그인 페이지로 리다이렉트
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.getUserMessage());
      } else {
        setError("비밀번호 재설정 중 오류가 발생했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* 헤더 */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            새 비밀번호 설정
          </h2>
          {userEmail && (
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              {userEmail}
            </p>
          )}
        </div>

        {/* 토큰 검증 중 */}
        {isVerifying && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              재설정 링크를 확인하는 중...
            </p>
          </div>
        )}

        {/* 토큰 검증 실패 */}
        {!isVerifying && !isTokenValid && (
          <>
            <Alert variant="error" className="mt-4">
              <div className="flex items-start">
                <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <div>
                  <p className="font-medium">재설정 링크가 유효하지 않습니다</p>
                  <p className="text-sm mt-1">
                    {verifyError || "링크가 만료되었거나 이미 사용되었습니다."}
                  </p>
                </div>
              </div>
            </Alert>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                새 재설정 링크 요청하기
              </Link>
            </div>
          </>
        )}

        {/* 성공 메시지 */}
        {success && (
          <Alert variant="success" className="mt-4">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  비밀번호가 성공적으로 변경되었습니다
                </p>
                <p className="text-sm mt-1">
                  잠시 후 로그인 페이지로 이동합니다...
                </p>
              </div>
            </div>
          </Alert>
        )}

        {/* 비밀번호 재설정 폼 */}
        {!isVerifying && isTokenValid && !success && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="new-password" className="sr-only">
                  새 비밀번호
                </label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="새 비밀번호 (최소 8자)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  비밀번호 확인
                </label>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* 비밀번호 요구사항 안내 */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>비밀번호 요구사항:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>최소 8자 이상</li>
                <li>영문, 숫자, 특수문자 조합 권장</li>
              </ul>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <Alert variant="error" className="mt-4">
                {error}
              </Alert>
            )}

            {/* 재설정 버튼 */}
            <div>
              <Button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "재설정 중..." : "비밀번호 재설정"}
              </Button>
            </div>
          </form>
        )}

        {/* 로그인으로 돌아가기 링크 */}
        {!success && (
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              로그인으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
