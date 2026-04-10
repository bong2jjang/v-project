/**
 * API Client 테스트
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient, ApiClientError } from "../client";
import type { AxiosError } from "axios";

describe("ApiClientError", () => {
  it("should create error from axios error", () => {
    const axiosError = {
      response: {
        status: 400,
        data: {
          detail: {
            error: "validation_failed",
            message: "Validation failed",
            errors: ["Route required"],
          },
        },
        statusText: "Bad Request",
        headers: {},
        config: {},
      },
      config: {},
      isAxiosError: true,
    } as AxiosError;

    const error = new ApiClientError(axiosError);

    expect(error.status).toBe(400);
    expect(error.detail).toEqual({
      error: "validation_failed",
      message: "Validation failed",
      errors: ["Gateway required"],
    });
  });

  it("should handle string detail", () => {
    const axiosError = {
      response: {
        status: 500,
        data: {
          detail: "Internal server error",
        },
        statusText: "Internal Server Error",
        headers: {},
        config: {},
      },
      config: {},
      isAxiosError: true,
    } as AxiosError;

    const error = new ApiClientError(axiosError);

    expect(error.status).toBe(500);
    expect(error.detail).toBe("Internal server error");
  });

  describe("getUserMessage", () => {
    it("should return user-friendly message for already_running", () => {
      const axiosError = {
        response: {
          status: 409,
          data: {
            detail: {
              error: "already_running",
              message: "Already running with PID 123",
            },
          },
          statusText: "Conflict",
          headers: {},
          config: {},
        },
        config: {},
        isAxiosError: true,
      } as AxiosError;

      const error = new ApiClientError(axiosError);
      expect(error.getUserMessage()).toBe("v-channel-bridge가 이미 실행 중입니다.");
    });

    it("should return user-friendly message for not_running", () => {
      const axiosError = {
        response: {
          status: 404,
          data: {
            detail: {
              error: "not_running",
              message: "Not running",
            },
          },
          statusText: "Not Found",
          headers: {},
          config: {},
        },
        config: {},
        isAxiosError: true,
      } as AxiosError;

      const error = new ApiClientError(axiosError);
      expect(error.getUserMessage()).toBe("v-channel-bridge가 실행 중이 아닙니다.");
    });

    it("should return validation error message", () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            detail: {
              error: "validation_failed",
              message: "Validation failed",
              errors: ["Route must have at least 2 channels"],
            },
          },
          statusText: "Bad Request",
          headers: {},
          config: {},
        },
        config: {},
        isAxiosError: true,
      } as AxiosError;

      const error = new ApiClientError(axiosError);
      expect(error.getUserMessage()).toBe(
        "설정 검증 실패: Route must have at least 2 channels",
      );
    });

    it("should return string detail as-is", () => {
      const axiosError = {
        response: {
          status: 500,
          data: {
            detail: "Custom error message",
          },
          statusText: "Internal Server Error",
          headers: {},
          config: {},
        },
        config: {},
        isAxiosError: true,
      } as AxiosError;

      const error = new ApiClientError(axiosError);
      expect(error.getUserMessage()).toBe("Custom error message");
    });
  });
});

describe("apiClient", () => {
  it("should have correct base URL", () => {
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it("should have timeout configured", () => {
    expect(apiClient.defaults.timeout).toBe(30000);
  });

  it("should have JSON content type", () => {
    expect(apiClient.defaults.headers["Content-Type"]).toBe("application/json");
  });
});
