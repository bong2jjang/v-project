/**
 * useBrowserNotification Hook
 *
 * 브라우저 알림 (Desktop Notification) 관리
 */

import { useEffect, useState } from "react";

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      console.warn("Browser notifications are not supported");
      return "denied";
    }

    if (permission === "granted") {
      return "granted";
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return "denied";
    }
  };

  const showNotification = (
    options: BrowserNotificationOptions,
  ): Notification | null => {
    if (!isSupported || permission !== "granted") {
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/vite.svg",
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
      });

      return notification;
    } catch (error) {
      console.error("Failed to show browser notification:", error);
      return null;
    }
  };

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    isEnabled: permission === "granted",
  };
}
