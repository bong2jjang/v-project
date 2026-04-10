/**
 * PasswordChangeForm 컴포넌트
 *
 * 비밀번호 변경 폼
 * - 현재 비밀번호 확인
 * - 새 비밀번호 입력
 * - 비밀번호 확인
 */

import { useState } from "react";
import { changePassword } from "../../lib/api/users";
import { useNotificationStore } from "../../store/notification";

export function PasswordChangeForm() {
  const { addNotification } = useNotificationStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // 폼 검증
  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.currentPassword = "현재 비밀번호를 입력하세요";
    }

    if (!newPassword) {
      newErrors.newPassword = "새 비밀번호를 입력하세요";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "비밀번호는 최소 8자 이상이어야 합니다";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "비밀번호 확인을 입력하세요";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다";
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword = "새 비밀번호는 현재 비밀번호와 달라야 합니다";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      // 성공
      addNotification({
        id: `password-change-success-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "비밀번호 변경 성공",
        message: "비밀번호가 성공적으로 변경되었습니다.",
        source: "password_change_form",
        dismissible: true,
        persistent: false,
        read: false,
      });

      // 폼 초기화
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (error: any) {
      console.error("Failed to change password:", error);

      // 에러 메시지 처리
      let errorMessage = "비밀번호 변경에 실패했습니다.";
      if (error.message?.includes("Current password is incorrect")) {
        errorMessage = "현재 비밀번호가 올바르지 않습니다.";
        setErrors({ currentPassword: "현재 비밀번호가 올바르지 않습니다" });
      } else if (error.message?.includes("New password must be different")) {
        errorMessage = "새 비밀번호는 현재 비밀번호와 달라야 합니다.";
        setErrors({
          newPassword: "새 비밀번호는 현재 비밀번호와 달라야 합니다",
        });
      }

      addNotification({
        id: `password-change-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "비밀번호 변경 실패",
        message: errorMessage,
        source: "password_change_form",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 현재 비밀번호 */}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-body-sm font-medium text-content-primary mb-1.5"
        >
          현재 비밀번호
        </label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            if (errors.currentPassword) {
              setErrors({ ...errors, currentPassword: undefined });
            }
          }}
          className={`input ${errors.currentPassword ? "border-status-danger" : ""}`}
          placeholder="현재 비밀번호를 입력하세요"
        />
        {errors.currentPassword && (
          <p className="text-body-sm text-status-danger mt-1.5">
            {errors.currentPassword}
          </p>
        )}
      </div>

      {/* 새 비밀번호 */}
      <div>
        <label
          htmlFor="newPassword"
          className="block text-body-sm font-medium text-content-primary mb-1.5"
        >
          새 비밀번호
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (errors.newPassword) {
              setErrors({ ...errors, newPassword: undefined });
            }
          }}
          className={`input ${errors.newPassword ? "border-status-danger" : ""}`}
          placeholder="새 비밀번호를 입력하세요 (최소 8자)"
        />
        {errors.newPassword && (
          <p className="text-body-sm text-status-danger mt-1.5">
            {errors.newPassword}
          </p>
        )}
        {!errors.newPassword && (
          <p className="text-body-sm text-content-tertiary mt-1.5">
            최소 8자 이상 입력하세요
          </p>
        )}
      </div>

      {/* 비밀번호 확인 */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-body-sm font-medium text-content-primary mb-1.5"
        >
          비밀번호 확인
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) {
              setErrors({ ...errors, confirmPassword: undefined });
            }
          }}
          className={`input ${errors.confirmPassword ? "border-status-danger" : ""}`}
          placeholder="새 비밀번호를 다시 입력하세요"
        />
        {errors.confirmPassword && (
          <p className="text-body-sm text-status-danger mt-1.5">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* 제출 버튼 */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary btn-lg"
        >
          {isSubmitting ? "변경 중..." : "비밀번호 변경"}
        </button>
      </div>
    </form>
  );
}
