import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../lib/api/auth";
import { ApiClientError } from "../lib/api/client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // 유효성 검사
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
      setEmail(""); // 성공 후 입력 필드 초기화
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.getUserMessage());
      } else {
        setError("비밀번호 재설정 요청 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* 헤더 */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            비밀번호 재설정
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            가입하신 이메일 주소를 입력하시면
            <br />
            비밀번호 재설정 링크를 보내드립니다
          </p>
        </div>

        {/* 성공 메시지 */}
        {success && (
          <Alert variant="success" className="mt-4">
            <div className="flex items-start">
              <Mail className="h-5 w-5 mr-2 flex-shrink-0" />
              <div>
                <p className="font-medium">이메일을 확인하세요</p>
                <p className="text-sm mt-1">
                  입력하신 이메일 주소로 비밀번호 재설정 링크를 발송했습니다.
                  이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.
                </p>
              </div>
            </div>
          </Alert>
        )}

        {/* 재설정 폼 */}
        {!success && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="sr-only">
                이메일
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <Alert variant="error" className="mt-4">
                {error}
              </Alert>
            )}

            {/* 재설정 링크 발송 버튼 */}
            <div>
              <Button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "발송 중..." : "재설정 링크 발송"}
              </Button>
            </div>
          </form>
        )}

        {/* 로그인으로 돌아가기 링크 */}
        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            로그인으로 돌아가기
          </Link>
        </div>

        {/* 보안 안내 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            보안을 위해 재설정 링크는 30분 동안만 유효하며,
            <br />
            1회만 사용 가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
