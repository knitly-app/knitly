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
});
