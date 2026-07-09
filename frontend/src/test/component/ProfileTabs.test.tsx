import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ProfileTabs } from "../../components/ProfileTabs";

describe("ProfileTabs", () => {
  it("renders post and media counts", () => {
    render(<ProfileTabs activeTab="posts" onTabChange={() => {}} postCount={42} mediaCount={7} />);
    expect(screen.getByText("42 Posts")).toBeInTheDocument();
    expect(screen.getByText("7 Media")).toBeInTheDocument();
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
