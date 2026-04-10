/**
 * RouteList 컴포넌트 테스트
 *
 * 작성일: 2026-04-02
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteList } from "../RouteList";
import { useRoutesStore } from "@/store/routes";

// Zustand store mock
vi.mock("@/store/routes", () => ({
  useRoutesStore: vi.fn(),
}));

describe("RouteList", () => {
  const mockFetchRoutes = vi.fn();
  const mockDeleteRoute = vi.fn();
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    (useRoutesStore as any).mockReturnValue({
      routes: [],
      isLoading: false,
      fetchRoutes: mockFetchRoutes,
      deleteRoute: mockDeleteRoute,
      clearError: vi.fn(),
    });

    render(<RouteList onRefresh={mockOnRefresh} />);

    // 빈 상태 메시지 확인
    expect(screen.getByText(/등록된 Route가 없습니다/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    (useRoutesStore as any).mockReturnValue({
      routes: [],
      isLoading: true,
      fetchRoutes: mockFetchRoutes,
      deleteRoute: mockDeleteRoute,
      clearError: vi.fn(),
    });

    render(<RouteList onRefresh={mockOnRefresh} />);

    // 로딩 스피너가 있는지 확인
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no routes", () => {
    (useRoutesStore as any).mockReturnValue({
      routes: [],
      isLoading: false,
      fetchRoutes: mockFetchRoutes,
      deleteRoute: mockDeleteRoute,
      clearError: vi.fn(),
    });

    render(<RouteList onRefresh={mockOnRefresh} />);

    expect(screen.getByText(/등록된 Route가 없습니다/)).toBeInTheDocument();
  });

  it("displays routes when available", () => {
    const mockRoutes = [
      {
        source: {
          platform: "slack",
          channel_id: "C123",
        },
        targets: [
          {
            platform: "teams",
            channel_id: "T456",
            channel_name: "general",
          },
        ],
      },
    ];

    (useRoutesStore as any).mockReturnValue({
      routes: mockRoutes,
      isLoading: false,
      fetchRoutes: mockFetchRoutes,
      deleteRoute: mockDeleteRoute,
      clearError: vi.fn(),
    });

    render(<RouteList onRefresh={mockOnRefresh} />);

    expect(screen.getByText("C123")).toBeInTheDocument();
    expect(screen.getByText("general")).toBeInTheDocument();
  });

  it("fetches routes on mount", () => {
    (useRoutesStore as any).mockReturnValue({
      routes: [],
      isLoading: false,
      fetchRoutes: mockFetchRoutes,
      deleteRoute: mockDeleteRoute,
      clearError: vi.fn(),
    });

    render(<RouteList onRefresh={mockOnRefresh} />);

    expect(mockFetchRoutes).toHaveBeenCalledTimes(1);
  });
});
