import { describe, it, expect } from "bun:test";
import { screen } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { ChatPresenceBadge } from "../../../components/Chat/ChatPresenceBadge";

describe("ChatPresenceBadge", () => {
  it("renders nothing when count is 0", async () => {
    await renderWithProviders(<ChatPresenceBadge count={0} />);
    expect(screen.queryByText(/online/)).toBeNull();
  });

  it("renders the count for a single online user", async () => {
    await renderWithProviders(<ChatPresenceBadge count={1} />);
    expect(screen.getByText("1 online")).toBeInTheDocument();
  });

  it("renders the count for multiple online users", async () => {
    await renderWithProviders(<ChatPresenceBadge count={42} />);
    expect(screen.getByText("42 online")).toBeInTheDocument();
  });

  it("uses md size classes by default", async () => {
    await renderWithProviders(<ChatPresenceBadge count={3} />);
    const badge = screen.getByText("3 online").parentElement;
    expect(badge?.className).toContain("text-sm");
  });

  it("uses sm size classes when size='sm'", async () => {
    await renderWithProviders(<ChatPresenceBadge count={3} size="sm" />);
    const badge = screen.getByText("3 online").parentElement;
    expect(badge?.className).toContain("text-xs");
  });

  it("uses md size classes when size='md' is explicit", async () => {
    await renderWithProviders(<ChatPresenceBadge count={5} size="md" />);
    const badge = screen.getByText("5 online").parentElement;
    expect(badge?.className).toContain("text-sm");
  });
});
