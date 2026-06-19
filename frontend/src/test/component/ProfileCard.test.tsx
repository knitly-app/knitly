import { describe, it, expect, afterEach } from "bun:test";
import { screen } from "@testing-library/preact";
import { ProfileCard } from "../../components/ProfileCard";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import type { User } from "../../api/endpoints";

const user: User = {
  id: "u1",
  username: "ada",
  displayName: "Ada Lovelace",
  createdAt: "2024-01-01",
};

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

describe("ProfileCard", () => {
  it("renders the user's name and handle", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<ProfileCard user={user} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  it("shows a dicebear avatar when the user has none", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<ProfileCard user={user} />);
    const img = screen.getByAltText("Ada Lovelace");
    expect(img.getAttribute("src")).toContain("dicebear");
  });

  it("hides the bot badge for non-bot accounts", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<ProfileCard user={user} />);
    expect(screen.queryByText("Bot")).toBeNull();
  });

  it("renders the bot badge for bot accounts", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<ProfileCard user={{ ...user, role: "bot" }} />);
    expect(screen.getByText("Bot")).toBeInTheDocument();
  });

  it("renders the bio when present", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<ProfileCard user={{ ...user, bio: "Mathematician" }} />);
    expect(screen.getByText("Mathematician")).toBeInTheDocument();
  });
});
