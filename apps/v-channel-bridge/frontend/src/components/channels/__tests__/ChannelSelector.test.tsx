/**
 * ChannelSelector 컴포넌트 테스트
 *
 * 작성일: 2026-04-02
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChannelSelector } from "../ChannelSelector";
import { useRoutesStore } from "@/store/routes";

// Zustand store mock
vi.mock("@/store/routes", () => ({
  useRoutesStore: vi.fn(),
}));

describe("ChannelSelector", () => {
  const mockFetchChannels = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store
    (useRoutesStore as any).mockReturnValue({
      fetchChannels: mockFetchChannels,
      isLoadingChannels: false,
    });
  });

  it("renders without crashing", () => {
    mockFetchChannels.mockResolvedValue([]);

    render(
      <ChannelSelector platform="slack" value="" onChange={mockOnChange} />,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows loading state when isLoadingChannels is true", () => {
    (useRoutesStore as any).mockReturnValue({
      fetchChannels: mockFetchChannels,
      isLoadingChannels: true,
    });

    render(
      <ChannelSelector platform="slack" value="" onChange={mockOnChange} />,
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeDisabled();
  });

  it("loads channels on mount when platform is provided", async () => {
    const mockChannels = [
      { id: "C123", name: "general", type: "public" },
      { id: "C456", name: "random", type: "public" },
    ];

    mockFetchChannels.mockResolvedValue(mockChannels);

    render(
      <ChannelSelector platform="slack" value="" onChange={mockOnChange} />,
    );

    await waitFor(() => {
      expect(mockFetchChannels).toHaveBeenCalledWith("slack");
    });
  });

  it("does not load channels when platform is empty", () => {
    mockFetchChannels.mockResolvedValue([]);

    render(<ChannelSelector platform="" value="" onChange={mockOnChange} />);

    expect(mockFetchChannels).not.toHaveBeenCalled();
  });

  it("is disabled when disabled prop is true", () => {
    mockFetchChannels.mockResolvedValue([]);

    render(
      <ChannelSelector
        platform="slack"
        value=""
        onChange={mockOnChange}
        disabled={true}
      />,
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeDisabled();
  });
});
