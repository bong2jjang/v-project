/**
 * Authentication Debugging Logger
 *
 * 인증 관련 모든 이벤트를 추적하고 로깅하는 유틸리티
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class AuthLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // 최대 로그 개수

  private log(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    // 최대 로그 개수 초과 시 오래된 로그 제거
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 콘솔에 출력
    const prefix = `[Auth ${category}]`;
    const logMessage = `${prefix} ${message}`;

    switch (level) {
      case "error":
        console.error(logMessage, data || "");
        break;
      case "warn":
        console.warn(logMessage, data || "");
        break;
      case "debug":
        if (import.meta.env.DEV) {
          console.debug(logMessage, data || "");
        }
        break;
      default:
        console.log(logMessage, data || "");
    }
  }

  // API 요청 로깅
  logRequest(method: string, url: string, hasToken: boolean, hasCsrf: boolean) {
    this.log("debug", "Request", `${method} ${url}`, {
      hasAuthToken: hasToken,
      hasCsrfToken: hasCsrf,
    });
  }

  // API 응답 로깅
  logResponse(method: string, url: string, status: number, data?: unknown) {
    const level = status >= 400 ? "error" : "debug";
    this.log(level, "Response", `${method} ${url} - ${status}`, data);
  }

  // 토큰 관련 이벤트
  logTokenEvent(event: string, details?: unknown) {
    this.log("info", "Token", event, details);
  }

  // 인증 상태 변경
  logAuthState(state: string, user?: unknown) {
    this.log("info", "State", state, user);
  }

  // 에러 로깅
  logError(context: string, error: unknown) {
    this.log("error", "Error", context, error);
  }

  // 경고 로깅
  logWarning(message: string, details?: unknown) {
    this.log("warn", "Warning", message, details);
  }

  // 로그 조회
  getLogs() {
    return [...this.logs];
  }

  // 로그 초기화
  clearLogs() {
    this.logs = [];
    console.clear();
  }

  // 로그 내보내기 (디버깅용)
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  // 특정 카테고리 로그만 조회
  getLogsByCategory(category: string) {
    return this.logs.filter((log) => log.category === category);
  }

  // 특정 레벨 로그만 조회
  getLogsByLevel(level: LogLevel) {
    return this.logs.filter((log) => log.level === level);
  }
}

// 싱글톤 인스턴스
export const authLogger = new AuthLogger();

// 개발 환경에서 window 객체에 노출 (디버깅용)
if (import.meta.env.DEV) {
  (window as any).authLogger = authLogger;
  console.log(
    "[AuthLogger] Initialized. Use window.authLogger to access logs.",
  );
}
