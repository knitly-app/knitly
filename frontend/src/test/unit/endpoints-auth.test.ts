import { describe, it, expect, afterEach } from "bun:test";
import { auth } from "../../api/endpoints";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

describe("auth endpoints", () => {
  it("validateResetToken fetches the token status", async () => {
    fetchMock = mockFetch({ valid: true });
    await auth.validateResetToken("reset-tok");
    expect(fetchMock.lastCall()!.url).toBe("/api/auth/reset-password/reset-tok");
  });

  it("resetPassword posts the new password", async () => {
    fetchMock = mockFetch({ success: true });
    await auth.resetPassword({ token: "t", password: "newpw" });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/auth/reset-password");
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({ token: "t", password: "newpw" });
  });

  it("forgotPassword wraps the email in a body", async () => {
    fetchMock = mockFetch({ success: true });
    await auth.forgotPassword("x@y.com");
    expect(fetchMock.lastCall()!.body).toEqual({ email: "x@y.com" });
  });

  it("changePassword posts current and new password", async () => {
    fetchMock = mockFetch({ success: true });
    await auth.changePassword({ currentPassword: "old", newPassword: "new" });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/auth/change-password");
    expect(call.body).toMatchObject({ currentPassword: "old", newPassword: "new" });
  });

  it("changeEmail posts the new email", async () => {
    fetchMock = mockFetch({ success: true });
    await auth.changeEmail("new@example.com");
    expect(fetchMock.lastCall()!.body).toMatchObject({ newEmail: "new@example.com" });
  });

  it("confirmEmail interpolates the token into the path", async () => {
    fetchMock = mockFetch({ success: true });
    await auth.confirmEmail("tok123");
    expect(fetchMock.lastCall()!.url).toBe("/api/auth/confirm-email/tok123");
  });

  it("deleteAccount posts the password for confirmation", async () => {
    fetchMock = mockFetch({ success: true, deletionDate: "2030-01-01" });
    await auth.deleteAccount("mypw");
    expect(fetchMock.lastCall()!.body).toMatchObject({ password: "mypw" });
  });

  it("cancelDeletion posts to cancel-deletion", async () => {
    fetchMock = mockFetch({ success: true });
    await auth.cancelDeletion();
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/auth/cancel-deletion",
      method: "POST",
    });
  });
});
