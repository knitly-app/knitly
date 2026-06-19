import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ProfileTabs } from "../../components/ProfileTabs";

describe("ProfileTabs", () => {
  it("renders post and media counts", () => {
    render(<ProfileTabs activeTab="posts" onTabChange={() => {}} postCount={42} mediaCount={7} />);
    expect(screen.getByText("42 Posts")).toBeInTheDocument();
    expect(screen.getByText("7 Media")).toBeInTheDocument();
  });

  it("highlights Posts tab when activeTab is posts", () => {
    render(<ProfileTabs activeTab="posts" onTabChange={() => {}} postCount={0} mediaCount={0} />);
    const postsBtn = screen.getByText("0 Posts").closest("button") as HTMLButtonElement;
    expect(postsBtn.className).toContain("text-accent-500");
    expect(postsBtn.className).toContain("border-accent-500");
  });

  it("does not highlight Media tab when activeTab is posts", () => {
    render(<ProfileTabs activeTab="posts" onTabChange={() => {}} postCount={0} mediaCount={0} />);
    const mediaBtn = screen.getByText("0 Media").closest("button") as HTMLButtonElement;
    expect(mediaBtn.className).toContain("text-gray-400");
    expect(mediaBtn.className).toContain("border-transparent");
  });

  it("highlights Media tab when activeTab is media", () => {
    render(<ProfileTabs activeTab="media" onTabChange={() => {}} postCount={0} mediaCount={0} />);
    const mediaBtn = screen.getByText("0 Media").closest("button") as HTMLButtonElement;
    expect(mediaBtn.className).toContain("text-accent-500");
    expect(mediaBtn.className).toContain("border-accent-500");
  });

  it("does not highlight Posts tab when activeTab is media", () => {
    render(<ProfileTabs activeTab="media" onTabChange={() => {}} postCount={0} mediaCount={0} />);
    const postsBtn = screen.getByText("0 Posts").closest("button") as HTMLButtonElement;
    expect(postsBtn.className).toContain("text-gray-400");
  });

  it("calls onTabChange with posts when Posts tab is clicked", () => {
    let tab: string = "media";
    render(
      <ProfileTabs
        activeTab="media"
        onTabChange={(t) => {
          tab = t;
        }}
        postCount={1}
        mediaCount={1}
      />
    );
    fireEvent.click(screen.getByText("1 Posts"));
    expect(tab).toBe("posts");
  });

  it("calls onTabChange with media when Media tab is clicked", () => {
    let tab: string = "posts";
    render(
      <ProfileTabs
        activeTab="posts"
        onTabChange={(t) => {
          tab = t;
        }}
        postCount={1}
        mediaCount={1}
      />
    );
    fireEvent.click(screen.getByText("1 Media"));
    expect(tab).toBe("media");
  });
});
