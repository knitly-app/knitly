import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { SettingsRoute } from "../../../routes/settings";
import { useUIStore } from "../../../stores/ui";
import { useAppSettings } from "../../../hooks/useAppSettings";
import { queryKeys } from "../../../api/queryKeys";
import type { User } from "../../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

const baseUser: User = {
  id: "u1",
  username: "ada",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  createdAt: "2024-01-01",
  role: "member",
};

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
  useAppSettings.setState({
    appName: "Knitly",
    logoIcon: "Zap",
    isLoaded: true,
    isFetching: false,
    isSaving: false,
    error: null,
  });
});

async function renderSettings(user: User | null = baseUser) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.auth.me(), user);
  qc.setQueryData(queryKeys.circles.all(), []);

  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes("/api/auth/me")) return user;
    if (url.includes("/api/circles")) return [];
    if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
    return null;
  });

  return renderWithProviders(<SettingsRoute />, {
    path: "/settings",
    initialEntries: ["/settings"],
    queryClient: qc,
  });
}

function setFileInputFiles(input: HTMLInputElement, files: File[]) {
  // Override the `files` getter so e.target.files?.[0] returns our file.
  // Then dispatch a native change event — preact/compat picks it up via
  // the bubbling change listener it registered on the root.
  Object.defineProperty(input, "files", { configurable: true, get: () => files });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("SettingsRoute — basic render", () => {
  it("renders the Settings heading", async () => {
    await renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders user display name and username", async () => {
    await renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("@ada")).toBeInTheDocument();
    });
  });

  it("renders Profile section", async () => {
    await renderSettings();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders Security section", async () => {
    await renderSettings();
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("renders Email section", async () => {
    await renderSettings();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders Danger Zone section", async () => {
    await renderSettings();
    expect(screen.getByText("Danger Zone")).toBeInTheDocument();
  });

  it("renders Sign Out button", async () => {
    await renderSettings();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("renders app version footer", async () => {
    await renderSettings();
    expect(screen.getByText(/Knitly v1\.0\.0/)).toBeInTheDocument();
  });

  it("renders Circles link", async () => {
    await renderSettings();
    expect(screen.getByText("Circles")).toBeInTheDocument();
  });

  it("shows current email in Email section", async () => {
    await renderSettings();
    await waitFor(() => {
      expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    });
  });

  it("does not show current email when not present", async () => {
    const userNoEmail = { ...baseUser, email: undefined };
    await renderSettings(userNoEmail);
    expect(screen.queryByText("ada@example.com")).toBeNull();
  });

  it("clicking Back navigates away", async () => {
    await renderSettings();
    const backBtn = screen.getByRole("button", { name: /Back/i });
    fireEvent.click(backBtn);
  });
});

describe("SettingsRoute — profile form", () => {
  it("pre-fills display name from user", async () => {
    await renderSettings();
    const input = screen.getByPlaceholderText("Your name");
    expect(input.value).toBe("Ada Lovelace");
  });

  it("pre-fills username from user", async () => {
    await renderSettings();
    const input = screen.getByPlaceholderText("username");
    expect(input.value).toBe("ada");
  });

  it("updates display name on input", async () => {
    await renderSettings();
    const input = screen.getByPlaceholderText("Your name");
    fireEvent.input(input, { target: { value: "Ada K" } });
    expect(input.value).toBe("Ada K");
  });

  it("updates username on input", async () => {
    await renderSettings();
    const input = screen.getByPlaceholderText("username");
    fireEvent.input(input, { target: { value: "ada_k" } });
    expect(input.value).toBe("ada_k");
  });

  it("updates bio on input", async () => {
    await renderSettings();
    const textarea = screen.getByPlaceholderText("A short bio");
    fireEvent.input(textarea, { target: { value: "I love knitting" } });
    expect(textarea.value).toBe("I love knitting");
  });

  it("updates location on input", async () => {
    await renderSettings();
    const input = screen.getByPlaceholderText("City, State");
    fireEvent.input(input, { target: { value: "London" } });
    expect(input.value).toBe("London");
  });

  it("updates website on input", async () => {
    await renderSettings();
    const input = screen.getByPlaceholderText("https://yoursite.com");
    fireEvent.input(input, { target: { value: "https://ada.dev" } });
    expect(input.value).toBe("https://ada.dev");
  });

  it("saves profile via PATCH /api/users/me", async () => {
    const updatedUser = { ...baseUser, displayName: "Ada K" };
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/users/me") && method === "PATCH") return updatedUser;
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    const input = screen.getByPlaceholderText("Your name");
    fireEvent.input(input, { target: { value: "Ada K" } });
    fireEvent.click(screen.getByText("Save Profile"));

    await waitFor(() => {
      const patchCall = fetchMock.calls.find(
        (c) => c.url.includes("/api/users/me") && c.method === "PATCH"
      );
      expect(patchCall).toBeDefined();
    });
  });

  it("shows error toast on save failure", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/users/me") && method === "PATCH") {
        return new Response(JSON.stringify({ error: "Failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.click(screen.getByText("Save Profile"));
    await waitFor(() => {
      expect(screen.getByText("Failed to save profile")).toBeInTheDocument();
    });
  });
});

describe("SettingsRoute — security (change password)", () => {
  it("renders Change Password button disabled initially", async () => {
    await renderSettings();
    const btn = screen.getByRole("button", { name: "Change Password" });
    expect(btn).toBeDisabled();
  });

  it("enables Change Password when all fields are valid", async () => {
    await renderSettings();
    fireEvent.input(screen.getByPlaceholderText("Enter current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpass1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter new password"), {
      target: { value: "newpass1" },
    });
    const btn = screen.getByRole("button", { name: "Change Password" });
    expect(btn).not.toBeDisabled();
  });

  it("shows too short warning when new password < 8 chars", async () => {
    await renderSettings();
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "short" },
    });
    await waitFor(() => {
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });
  });

  it("shows mismatch warning when passwords don't match", async () => {
    await renderSettings();
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpass1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter new password"), {
      target: { value: "different" },
    });
    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });
  });

  it("submits change password via POST /api/auth/change-password", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/change-password") && method === "POST") {
        return { success: true };
      }
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/auth/logout")) return {};
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.input(screen.getByPlaceholderText("Enter current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpass12" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter new password"), {
      target: { value: "newpass12" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Change Password" }).closest("form")!);

    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/api/auth/change-password") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("shows error when change password fails", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/change-password") && method === "POST") {
        return new Response(JSON.stringify({ error: "Wrong password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.input(screen.getByPlaceholderText("Enter current password"), {
      target: { value: "wrongpass" },
    });
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpass12" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter new password"), {
      target: { value: "newpass12" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Change Password" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Incorrect current password")).toBeInTheDocument();
    });
  });
});

describe("SettingsRoute — email change", () => {
  it("Change Email button is disabled when email is empty", async () => {
    await renderSettings();
    const btn = screen.getByRole("button", { name: "Change Email" });
    expect(btn).toBeDisabled();
  });

  it("enables Change Email button when email is typed", async () => {
    await renderSettings();
    fireEvent.input(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "new@example.com" },
    });
    expect(screen.getByRole("button", { name: "Change Email" })).not.toBeDisabled();
  });

  it("submits change email via POST /api/auth/change-email", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/change-email") && method === "POST") return { success: true };
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.input(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "newemail@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Change Email" }).closest("form")!);

    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/api/auth/change-email") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("shows error when change email fails", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/change-email") && method === "POST") {
        return new Response(JSON.stringify({ error: "Error" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.input(screen.getByPlaceholderText("new@example.com"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Change Email" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Failed to update email")).toBeInTheDocument();
    });
  });
});

describe("SettingsRoute — danger zone (delete account)", () => {
  it("shows Delete Account button in danger zone", async () => {
    await renderSettings();
    expect(screen.getByRole("button", { name: "Delete Account" })).toBeInTheDocument();
  });

  it("clicking Delete Account shows confirmation form", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByText(/30-day grace period/)).toBeInTheDocument();
    });
  });

  it("shows password and username inputs in confirm form", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByText(/30-day grace period/)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ada")).toBeInTheDocument();
  });

  it("Permanently Delete button is disabled until both fields are filled", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Permanently Delete" })).toBeDisabled();
  });

  it("enables Permanently Delete when password and correct username are filled", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("ada")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "mypassword" },
    });
    fireEvent.input(screen.getByPlaceholderText("ada"), {
      target: { value: "ada" },
    });
    expect(screen.getByRole("button", { name: "Permanently Delete" })).not.toBeDisabled();
  });

  it("Cancel in delete form hides confirmation", async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Permanently Delete")).toBeNull();
    });
    expect(screen.getByRole("button", { name: "Delete Account" })).toBeInTheDocument();
  });

  it("submits delete account via POST /api/auth/delete-account", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/delete-account") && method === "POST") {
        return { success: true, deletionDate: "2024-02-01" };
      }
      if (url.includes("/api/auth/logout")) return {};
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("ada")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "mypassword" },
    });
    fireEvent.input(screen.getByPlaceholderText("ada"), {
      target: { value: "ada" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Permanently Delete" }).closest("form")!);

    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/api/auth/delete-account") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("shows error when delete account fails", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/delete-account") && method === "POST") {
        return new Response(JSON.stringify({ error: "Wrong password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("ada")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "wrongpass" },
    });
    fireEvent.input(screen.getByPlaceholderText("ada"), {
      target: { value: "ada" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Permanently Delete" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Incorrect password")).toBeInTheDocument();
    });
  });
});

describe("SettingsRoute — sign out", () => {
  it("clicking Sign Out calls /api/auth/logout", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/auth/logout") && method === "POST") return {};
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    fireEvent.click(screen.getByText("Sign Out"));
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/api/auth/logout") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("SettingsRoute — circles badge", () => {
  it("shows circle count badge when user has circles", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), [
      { id: "c1", userId: "u1", name: "Family", color: "blue", createdAt: "2024-01-01" },
      { id: "c2", userId: "u1", name: "Friends", color: "green", createdAt: "2024-01-01" },
    ]);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles"))
        return [
          { id: "c1", userId: "u1", name: "Family", color: "blue", createdAt: "2024-01-01" },
          { id: "c2", userId: "u1", name: "Friends", color: "green", createdAt: "2024-01-01" },
        ];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});

describe("SettingsRoute — image upload", () => {
  it("shows error toast when a non-image file is selected for avatar", async () => {
    await renderSettings();
    const fileInput = document.querySelector(
      'input[type="file"][accept="image/*"]'
    ) as HTMLInputElement;
    const nonImageFile = new File(["content"], "doc.pdf", { type: "application/pdf" });
    setFileInputFiles(fileInput, [nonImageFile]);
    await waitFor(() => {
      expect(screen.getByText("Please select an image file")).toBeInTheDocument();
    });
  });

  it("uploads avatar: presign → PUT → complete → profile update", async () => {
    const presignResponse = {
      uploadUrl: "https://s3.example.com/upload",
      key: "media/avatar.jpg",
      expiresIn: 300,
    };
    const mediaItem = {
      id: "m1",
      url: "https://cdn.example.com/avatar.jpg",
      key: "media/avatar.jpg",
      contentType: "image/jpeg",
      size: 1024,
    };
    const updatedUser = { ...baseUser, avatar: mediaItem.url };

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/media/presign") && method === "POST") return presignResponse;
      if (url === presignResponse.uploadUrl && method === "PUT")
        return new Response(null, { status: 200 });
      if (url.includes("/api/media/complete") && method === "POST") return mediaItem;
      if (url.includes("/api/users/me") && method === "PATCH") return updatedUser;
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    const fileInputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
    const avatarInput = fileInputs[0] as HTMLInputElement;
    const imageFile = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    setFileInputFiles(avatarInput, [imageFile]);

    await waitFor(() => {
      const presignCall = fetchMock.calls.find((c) => c.url.includes("/api/media/presign"));
      expect(presignCall).toBeDefined();
    });
    await waitFor(() => {
      const putCall = fetchMock.calls.find(
        (c) => c.url === presignResponse.uploadUrl && c.method === "PUT"
      );
      expect(putCall).toBeDefined();
    });
    await waitFor(() => {
      const completeCall = fetchMock.calls.find((c) => c.url.includes("/api/media/complete"));
      expect(completeCall).toBeDefined();
    });
  });

  it("uploads header image: presign → PUT → complete → profile update", async () => {
    const presignResponse = {
      uploadUrl: "https://s3.example.com/upload-header",
      key: "media/header.jpg",
      expiresIn: 300,
    };
    const mediaItem = {
      id: "m2",
      url: "https://cdn.example.com/header.jpg",
      key: "media/header.jpg",
      contentType: "image/jpeg",
      size: 2048,
    };
    const updatedUser = { ...baseUser, header: mediaItem.url };

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/media/presign") && method === "POST") return presignResponse;
      if (url === presignResponse.uploadUrl && method === "PUT")
        return new Response(null, { status: 200 });
      if (url.includes("/api/media/complete") && method === "POST") return mediaItem;
      if (url.includes("/api/users/me") && method === "PATCH") return updatedUser;
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    const fileInputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
    const headerInput = fileInputs[1] as HTMLInputElement;
    const imageFile = new File(["img"], "header.jpg", { type: "image/jpeg" });
    setFileInputFiles(headerInput, [imageFile]);

    await waitFor(() => {
      const presignCall = fetchMock.calls.find((c) => c.url.includes("/api/media/presign"));
      expect(presignCall).toBeDefined();
    });
    await waitFor(() => {
      const completeCall = fetchMock.calls.find((c) => c.url.includes("/api/media/complete"));
      expect(completeCall).toBeDefined();
    });
  });

  it("shows error toast when avatar upload fails", async () => {
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/media/presign") && method === "POST") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/auth/me")) return baseUser;
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<SettingsRoute />, {
      path: "/settings",
      initialEntries: ["/settings"],
      queryClient: qc,
    });

    const fileInputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
    const avatarInput = fileInputs[0] as HTMLInputElement;
    const imageFile = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    setFileInputFiles(avatarInput, [imageFile]);

    await waitFor(() => {
      expect(screen.getByText("Failed to upload avatar")).toBeInTheDocument();
    });
  });
});
