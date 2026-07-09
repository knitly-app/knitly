import { describe, it, expect, beforeEach } from "bun:test";
import { render, screen } from "@testing-library/preact";
import { AuthLayout, AuthCard } from "../../components/AuthLayout";
import { useAppSettings } from "../../hooks/useAppSettings";

beforeEach(() => {
  useAppSettings.setState({ appName: "Knitly" });
});

describe("AuthLayout", () => {
  it("renders the app name from the store", () => {
    render(<AuthLayout>content</AuthLayout>);
    expect(screen.getByText("Knitly")).toBeInTheDocument();
  });

  it("renders a custom app name when the store has one", () => {
    useAppSettings.setState({ appName: "MyApp" });
    render(<AuthLayout>content</AuthLayout>);
    expect(screen.getByText("MyApp")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<AuthLayout>sign in form</AuthLayout>);
    expect(screen.getByText("sign in form")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<AuthLayout subtitle="Welcome back">children</AuthLayout>);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });

  it("does not render a subtitle paragraph when omitted", () => {
    render(<AuthLayout>children</AuthLayout>);
    expect(screen.queryByRole("paragraph")).toBeNull();
  });
});

describe("AuthCard", () => {
  it("renders children", () => {
    render(<AuthCard>card body</AuthCard>);
    expect(screen.getByText("card body")).toBeInTheDocument();
  });
});
