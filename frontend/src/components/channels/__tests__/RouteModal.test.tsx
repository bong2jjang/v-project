/**
 * RouteModal 컴포넌트 테스트
 *
 * 작성일: 2026-04-02
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RouteModal } from "../RouteModal";
import { useRoutesStore } from "@/store/routes";

// Zustand store mock
vi.mock("@/store/routes", () => ({
  useRoutesStore: vi.fn(),
}));

// ChannelSelector mock
vi.mock("../ChannelSelector", () => ({
  ChannelSelector: ({ value, onChange }: any) => (
    <select
      data-testid="channel-selector"
      value={value}
      onChange={(e) => onChange(e.target.value, e.target.value)}
    >
      <option value="">Select channel</option>
      <option value="C123">general</option>
      <option value="C456">random</option>
    </select>
  ),
}));

describe("RouteModal", () => {
  const mockAddRoute = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useRoutesStore as any).mockReturnValue({
      addRoute: mockAddRoute,
    });
  });

  it("renders when isOpen is true", () => {
    render(
      <RouteModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(screen.getByText(/Route 추가/)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <RouteModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(screen.queryByText(/Route 추가/)).not.toBeInTheDocument();
  });

  it("shows platform selection dropdowns", () => {
    render(
      <RouteModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("calls onClose when cancel button is clicked", () => {
    render(
      <RouteModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const cancelButton = screen.getByText(/취소/);
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows error when source and target are the same", async () => {
    render(
      <RouteModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    // Select same platform and channel for source and target
    const platformSelects = screen.getAllByRole("combobox");

    // Set source platform to slack
    fireEvent.change(platformSelects[0], { target: { value: "slack" } });

    // Set target platform to slack
    fireEvent.change(platformSelects[1], { target: { value: "slack" } });

    // Set same channel
    const channelSelectors = screen.getAllByTestId("channel-selector");
    fireEvent.change(channelSelectors[0], { target: { value: "C123" } });
    fireEvent.change(channelSelectors[1], { target: { value: "C123" } });

    // Try to add
    const addButton = screen.getByRole("button", { name: /^추가$/ });
    fireEvent.click(addButton);

    expect(mockAddRoute).not.toHaveBeenCalled();
  });
});
