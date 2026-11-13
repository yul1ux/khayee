import { beforeEach, describe, expect, it, vi } from "vitest";
import { signUp } from "../src/app/signup/actions";
import { submitOrganizerApplication } from "../src/app/organizer/onboarding/actions";
import { GET as authCallback } from "../src/app/auth/callback/route";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  redirect: vi.fn(),
  signUp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function builder(result: unknown) {
  const value = {
    select: vi.fn(() => value),
    eq: vi.fn(() => value),
    insert: vi.fn(() => value),
    update: vi.fn(() => value),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return value;
}

describe("auth action integration (mocked Supabase client)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers without assuming a session when email confirmation is required", async () => {
    const auth = { signUp: mocks.signUp };
    const from = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({ auth, from });
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: "new-user" } },
      error: null,
    });
    const result = await signUp({}, form({
      email: "Person@Example.com",
      password: "A long passphrase",
      role: "admin",
    }));

    expect(result.message).toContain("check your inbox");
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "person@example.com",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    }));
    expect(mocks.signUp.mock.calls[0][0].options).not.toHaveProperty("data");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("preserves an allowed destination through signup email confirmation", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signUp: mocks.signUp },
    });
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: "new-user" } },
      error: null,
    });

    await signUp({}, form({
      email: "person@example.com",
      password: "A long passphrase",
      nextPath: "/account/requests",
    }));

    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Faccount%2Frequests",
      },
    }));
  });

  it("redirects immediately only when Supabase returned an active session", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signUp: mocks.signUp },
      rpc: mocks.rpc,
    });
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: "session" }, user: { id: "new-user" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });

    await expect(signUp({}, form({
      email: "person@example.com",
      password: "A long passphrase",
    }))).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_customer_profile");
  });

  it("exchanges email confirmation codes and redirects customers to the homepage", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "confirmed-session" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
      rpc: mocks.rpc,
    });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });

    await expect(authCallback(new Request("https://khayee.test/auth/callback?code=confirmation-code")))
      .rejects.toThrow("redirect");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("confirmation-code");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_customer_profile");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("keeps a safe requested destination through email confirmation", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "confirmed-session" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
      rpc: mocks.rpc,
    });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });

    await expect(authCallback(new Request(
      "https://khayee.test/auth/callback?code=confirmation-code&next=%2Faccount%2Frequests",
    ))).rejects.toThrow("redirect");

    expect(mocks.redirect).toHaveBeenCalledWith("/account/requests");
  });

  it("provisions idempotently if immediate signup and confirmation both deliver sessions", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signUp: mocks.signUp },
      rpc: mocks.rpc,
    });
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: "signup-session" }, user: { id: "new-user" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });

    await expect(signUp({}, form({
      email: "person@example.com",
      password: "A long passphrase",
    }))).rejects.toThrow("redirect");

    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "confirmed-session" } },
      error: null,
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
      rpc: mocks.rpc,
    });
    await expect(authCallback(new Request("https://khayee.test/auth/callback?code=confirmation-code")))
      .rejects.toThrow("redirect");

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "ensure_customer_profile");
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "ensure_customer_profile");
  });

  it("reports provisioning failure instead of treating signup as complete", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signUp: mocks.signUp, signOut: mocks.signOut },
      rpc: mocks.rpc,
    });
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: "signup-session" }, user: { id: "new-user" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ error: new Error("private database detail") });
    mocks.signOut.mockResolvedValue({ error: null });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await signUp({}, form({
      email: "person@example.com",
      password: "A long passphrase",
    }));

    expect(result.error).toContain("profile setup could not be completed");
    expect(result.error).not.toContain("private database detail");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not claim account setup succeeded when confirmation provisioning fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "confirmed-session" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ error: new Error("private database detail") });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession, signOut: mocks.signOut },
      rpc: mocks.rpc,
    });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(authCallback(new Request("https://khayee.test/auth/callback?code=confirmation-code")))
      .rejects.toThrow("redirect");

    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_customer_profile");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/signup?confirmation=setup-failed");
    errorSpy.mockRestore();
  });

  it("reports signup errors without exposing Supabase error details", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signUp: mocks.signUp },
    });
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("email_exists private internal detail"),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await signUp({}, form({
      email: "person@example.com",
      password: "A long passphrase",
    }));

    expect(result.error).toContain("may already be registered");
    expect(result.error).not.toContain("private internal detail");
    errorSpy.mockRestore();
  });

  it("creates an organizer profile without accepting a role from the form", async () => {
    const roles = builder({ data: [{ role: "customer" }], error: null });
    const details = builder({ data: null, error: null });
    const profile = builder({ data: { id: "profile-id", verification_status: "pending" }, error: null });
    const contact = builder({ data: null, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "user_roles") return roles;
      if (table === "organizer_verification_details") {
        return { ...details, update: vi.fn(() => contact) };
      }
      if (table === "organizer_profiles") return profile;
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "customer-id", email: "customer@example.com" } },
      error: null,
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });

    const result = await submitOrganizerApplication({}, form({
      displayName: "Local Guides",
      contactEmail: "guide@example.com",
      bio: "Local experience",
      websiteUrl: "",
      role: "admin",
    }));

    expect(result.application?.status).toBe("pending");
    expect(profile.insert).toHaveBeenCalledWith({
      user_id: "customer-id",
      display_name: "Local Guides",
      bio: "Local experience",
      website_url: null,
    });
    expect(profile.insert).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalledWith("user_roles", expect.anything());
  });

  it("updates an existing organizer application rather than inserting a duplicate", async () => {
    const roles = builder({ data: [{ role: "customer" }, { role: "organizer" }], error: null });
    const details = builder({
      data: { organizer_profile_id: "existing-profile", verification_rejection_reason: null },
      error: null,
    });
    const profile = builder({ data: { id: "existing-profile", verification_status: "pending" }, error: null });
    const contact = builder({ data: null, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "user_roles") return roles;
      if (table === "organizer_verification_details") {
        return { ...details, update: vi.fn(() => contact) };
      }
      return profile;
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });

    await submitOrganizerApplication({}, form({
      displayName: "Updated Guides",
      contactEmail: "",
      bio: "",
      websiteUrl: "",
    }));

    expect(profile.insert).not.toHaveBeenCalled();
    expect(profile.update).toHaveBeenCalledWith({
      display_name: "Updated Guides",
      bio: null,
      website_url: null,
    });
  });

  it("rejects admin account organizer applications without profile writes", async () => {
    mocks.from.mockReturnValue(builder({ data: [{ role: "admin" }], error: null }));
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });

    const result = await submitOrganizerApplication({}, form({
      displayName: "Not allowed",
      contactEmail: "",
      bio: "",
      websiteUrl: "",
    }));

    expect(result.error).toContain("Administrator accounts");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated organizer application attempts", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });

    await expect(submitOrganizerApplication({}, form({
      displayName: "Not signed in",
      contactEmail: "",
      bio: "",
      websiteUrl: "",
    }))).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Forganizer%2Fonboarding");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns a safe error when role lookup fails", async () => {
    const roles = builder({ data: null, error: new Error("database detail") });
    mocks.from.mockReturnValue(roles);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await submitOrganizerApplication({}, form({
      displayName: "Local Guides",
      contactEmail: "",
      bio: "",
      websiteUrl: "",
    }));

    expect(result.error).toContain("verify your permissions");
    expect(result.error).not.toContain("database detail");
    errorSpy.mockRestore();
  });

  it("returns a safe error when organizer profile insertion fails", async () => {
    const roles = builder({ data: [{ role: "customer" }], error: null });
    const details = builder({ data: null, error: null });
    const profile = builder({ data: null, error: new Error("unique violation details") });
    mocks.from.mockImplementation((table: string) => {
      if (table === "user_roles") return roles;
      if (table === "organizer_verification_details") return details;
      return profile;
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer-id" } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await submitOrganizerApplication({}, form({
      displayName: "Local Guides",
      contactEmail: "",
      bio: "",
      websiteUrl: "",
    }));

    expect(result.error).toContain("may already exist");
    expect(result.error).not.toContain("unique violation details");
    errorSpy.mockRestore();
  });
});
