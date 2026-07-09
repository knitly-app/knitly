import { describe, it, expect } from "bun:test";
import { screen } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { ChatSystemMessage } from "../../../components/Chat/ChatSystemMessage";

describe("ChatSystemMessage", () => {
  it("renders 'entered' text for a join event", async () => {
    await renderWithProviders(<ChatSystemMessage type="join" username="ada" />);
    expect(screen.getByText("ada entered")).toBeInTheDocument();
  });

  it("renders 'left' text for a leave event", async () => {
    await renderWithProviders(<ChatSystemMessage type="leave" username="bob" />);
    expect(screen.getByText("bob left")).toBeInTheDocument();
  });
});
