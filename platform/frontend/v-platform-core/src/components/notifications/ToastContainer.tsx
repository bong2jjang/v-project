/**
 * ToastContainer Component
 *
 * 토스트 메시지 컨테이너 (화면 우측 하단)
 */

import { useNotificationStore } from "../../stores/notification";
import { Toast } from "./Toast";

export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-3 pointer-events-none max-h-[calc(100dvh-2rem)] overflow-y-auto"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast notification={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
}
