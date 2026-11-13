// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "../src/components/auth/login-form";
import { SignupForm } from "../src/components/auth/signup-form";
import { OrganizerOnboardingForm } from "../src/components/auth/organizer-onboarding-form";
import { TripDashboard } from "../src/components/organizer/trip-dashboard";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  submitOrganizerApplication: vi.fn(),
}));
vi.mock("@/app/login/actions", () => ({ signIn: mocks.signIn }));
vi.mock("@/app/signup/actions", () => ({ signUp: mocks.signUp }));
vi.mock("@/app/organizer/onboarding/actions", () => ({
  submitOrganizerApplication: mocks.submitOrganizerApplication,
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe("signup form", () => {
  it("preserves an allowed protected destination through signup and sign-in links", async () => {
    mocks.signUp.mockResolvedValue({ message: "Check your inbox for confirmation." });
    render(<SignupForm nextPath="/account/requests" />);
    expect(screen.getByDisplayValue("/account/requests").getAttribute("name")).toBe("nextPath");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "A long passphrase" } });
    fireEvent.submit(screen.getByRole("form", { name: "Create account" }));

    const signInLink = await screen.findByRole("link", { name: "Sign in" });
    expect(signInLink.getAttribute("href")).toBe("/login?next=%2Faccount%2Frequests");
  });

  it("uses browser constraints for email and password validation", () => {
    render(<SignupForm />);
    const form = screen.getByRole("form", { name: "Create account" }) as HTMLFormElement;
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;

    expect(email.required).toBe(true);
    expect(email.type).toBe("email");
    expect(password.minLength).toBe(8);
    expect(form.checkValidity()).toBe(false);
  });

  describe("login form", () => {
    it("preserves a protected destination when a visitor chooses signup", () => {
      render(<LoginForm nextPath="/organizer/trips/new" />);
      expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href"))
        .toBe("/signup?next=%2Forganizer%2Ftrips%2Fnew");
    });
  });

  it("shows loading state during signup and confirmation guidance on success", async () => {
    let finish!: (state: { message: string }) => void;
    mocks.signUp.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "A long passphrase" } });
    fireEvent.submit(screen.getByRole("form", { name: "Create account" }));

    expect(await screen.findByRole("button", { name: "Creating account…" })).toBeTruthy();
    finish({ message: "Check your inbox for a confirmation link." });
    expect((await screen.findByRole("status")).textContent).toContain("confirmation link");
    expect(await screen.findByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("shows registration errors", async () => {
    mocks.signUp.mockResolvedValue({ error: "The email may already be registered." });
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "A long passphrase" } });
    fireEvent.submit(screen.getByRole("form", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent).toContain("may already be registered");
  });
});

describe("organizer onboarding form", () => {
  it("displays the current verification state and rejection note", () => {
    render(
      <OrganizerOnboardingForm
        application={{
          profileId: "profile-id",
          displayName: "Local Guides",
          bio: "Local knowledge",
          websiteUrl: "",
          status: "rejected",
          rejectionReason: "Please add safety experience.",
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: /Application status: rejected/i })).toBeTruthy();
    expect(screen.getByText(/Please add safety experience/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save organizer details" })).toBeTruthy();
  });

  it("submits organizer details and shows a pending review confirmation", async () => {
    mocks.submitOrganizerApplication.mockResolvedValue({
      message: "Your application is awaiting administrator review.",
      application: {
        profileId: "profile-id",
        displayName: "Local Guides",
        bio: "",
        websiteUrl: "",
        status: "pending",
        rejectionReason: null,
      },
    });
    render(<OrganizerOnboardingForm />);
    fireEvent.change(screen.getByLabelText("Organizer display name"), { target: { value: "Local Guides" } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit for review" }).closest("form")!);
    await waitFor(() => expect(mocks.submitOrganizerApplication).toHaveBeenCalled());
    expect((await screen.findByRole("status")).textContent).toContain("awaiting administrator review");
    expect(screen.getByRole("heading", { name: /Application status: pending/i })).toBeTruthy();
  });
});

describe("organizer dashboard trip list", () => {
  it("shows an empty state and create link", () => {
    render(<TripDashboard trips={[]} />);
    expect(screen.getByText("No trips yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a trip" }).getAttribute("href")).toBe("/organizer/trips/new");
  });

  it("shows status and management links for an owned draft", () => {
    render(<TripDashboard trips={[{
      id: "trip-id",
      title: "Forest trail",
      status: "draft",
      starts_at: "2027-01-01T00:00:00Z",
    }]} />);
    expect(screen.getByText("Forest trail")).toBeTruthy();
    expect(screen.getByText(/draft/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit trip" }).getAttribute("href")).toBe("/organizer/trips/trip-id/edit");
    expect(screen.getByRole("link", { name: "Manage images" }).getAttribute("href")).toBe("/organizer/trips/trip-id/images");
  });
});
