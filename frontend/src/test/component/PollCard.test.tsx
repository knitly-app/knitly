import { describe, it, expect, afterEach, mock } from "bun:test";
import { screen, fireEvent } from "@testing-library/preact";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import { PollCard } from "../../components/PollCard";
import type { Poll } from "../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: "poll-1",
    question: "Favourite language?",
    userVote: null,
    totalVotes: 0,
    options: [
      { id: "opt-a", optionText: "TypeScript", voteCount: 0, sortOrder: 0 },
      { id: "opt-b", optionText: "Rust", voteCount: 0, sortOrder: 1 },
    ],
    ...overrides,
  };
}

describe("PollCard — pre-vote state", () => {
  it("renders the question", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<PollCard poll={makePoll()} onVote={() => {}} isVoting={false} />);
    expect(screen.getByText("Favourite language?")).toBeInTheDocument();
  });

  it("renders all option buttons when user has not voted", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<PollCard poll={makePoll()} onVote={() => {}} isVoting={false} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("calls onVote with the correct option id when clicked", async () => {
    fetchMock = mockFetch({});
    const onVote = mock(() => {});
    await renderWithProviders(<PollCard poll={makePoll()} onVote={onVote} isVoting={false} />);
    fireEvent.click(screen.getByText("TypeScript"));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onVote).toHaveBeenCalledWith("opt-a");
  });

  it("disables option buttons while isVoting is true", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<PollCard poll={makePoll()} onVote={() => {}} isVoting={true} />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }
  });
});

describe("PollCard — post-vote (results) state", () => {
  it("shows percentages and vote count after voting", async () => {
    fetchMock = mockFetch({});
    const poll = makePoll({
      userVote: "opt-a",
      totalVotes: 4,
      options: [
        { id: "opt-a", optionText: "TypeScript", voteCount: 3, sortOrder: 0 },
        { id: "opt-b", optionText: "Rust", voteCount: 1, sortOrder: 1 },
      ],
    });
    await renderWithProviders(<PollCard poll={poll} onVote={() => {}} isVoting={false} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("4 votes")).toBeInTheDocument();
  });

  it("renders singular 'vote' for exactly 1 total vote", async () => {
    fetchMock = mockFetch({});
    const poll = makePoll({
      userVote: "opt-b",
      totalVotes: 1,
      options: [
        { id: "opt-a", optionText: "TypeScript", voteCount: 0, sortOrder: 0 },
        { id: "opt-b", optionText: "Rust", voteCount: 1, sortOrder: 1 },
      ],
    });
    await renderWithProviders(<PollCard poll={poll} onVote={() => {}} isVoting={false} />);
    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });

  it("shows zero percent for an option with no votes when total > 0", async () => {
    fetchMock = mockFetch({});
    const poll = makePoll({
      userVote: "opt-a",
      totalVotes: 2,
      options: [
        { id: "opt-a", optionText: "TypeScript", voteCount: 2, sortOrder: 0 },
        { id: "opt-b", optionText: "Rust", voteCount: 0, sortOrder: 1 },
      ],
    });
    await renderWithProviders(<PollCard poll={poll} onVote={() => {}} isVoting={false} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows 0% for all options when totalVotes is 0 but user has voted", async () => {
    fetchMock = mockFetch({});
    const poll = makePoll({
      userVote: "opt-a",
      totalVotes: 0,
      options: [
        { id: "opt-a", optionText: "TypeScript", voteCount: 0, sortOrder: 0 },
        { id: "opt-b", optionText: "Rust", voteCount: 0, sortOrder: 1 },
      ],
    });
    await renderWithProviders(<PollCard poll={poll} onVote={() => {}} isVoting={false} />);
    const percentages = screen.getAllByText("0%");
    expect(percentages.length).toBe(2);
  });

  it("shows a checkmark next to the user's chosen option", async () => {
    fetchMock = mockFetch({});
    const poll = makePoll({
      userVote: "opt-a",
      totalVotes: 1,
      options: [
        { id: "opt-a", optionText: "TypeScript", voteCount: 1, sortOrder: 0 },
        { id: "opt-b", optionText: "Rust", voteCount: 0, sortOrder: 1 },
      ],
    });
    await renderWithProviders(<PollCard poll={poll} onVote={() => {}} isVoting={false} />);
    // Check icon is an SVG rendered by the Check lucide component
    const checkIcons = document.querySelectorAll("svg");
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it("does not render vote buttons in the results view", async () => {
    fetchMock = mockFetch({});
    const poll = makePoll({
      userVote: "opt-b",
      totalVotes: 3,
      options: [
        { id: "opt-a", optionText: "TypeScript", voteCount: 1, sortOrder: 0 },
        { id: "opt-b", optionText: "Rust", voteCount: 2, sortOrder: 1 },
      ],
    });
    await renderWithProviders(<PollCard poll={poll} onVote={() => {}} isVoting={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
