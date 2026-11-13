import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitReport } from "../src/app/reports/actions";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireSignedInUser: vi.fn(),
  requireOrganizerProfileId: vi.fn(),
  revalidatePath: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/lib/organizer/access", () => ({
  requireSignedInUser: mocks.requireSignedInUser,
  requireOrganizerProfileId: mocks.requireOrganizerProfileId,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

const reporterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tripId = "11111111-1111-4111-8111-111111111111";
const organizerId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

type Result = { data?: unknown; error?: unknown };

function query(result: Result) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

function setup({
  roles = ["customer"],
  trip = { id: tripId },
  organizer = { id: organizerId },
  ownOrganizer = null,
  request = { id: requestId, trip_id: tripId, customer_id: customerId },
  ownedTrip = { id: tripId },
  existingReport = null,
  insertError = null,
  roleError = null,
}: {
  roles?: string[];
  trip?: unknown;
  organizer?: unknown;
  ownOrganizer?: unknown;
  request?: unknown;
  ownedTrip?: unknown;
  existingReport?: unknown;
  insertError?: unknown;
  roleError?: unknown;
} = {}) {
  const builders = new Map<string, ReturnType<typeof query>[]>();
  const enqueue = (table: string, result: Result) => {
    const items = builders.get(table) ?? [];
    items.push(query(result));
    builders.set(table, items);
  };

  enqueue("user_roles", { data: roles.map((role) => ({ role })), error: roleError });
  enqueue("trips", { data: trip, error: null });
  enqueue("organizer_profiles", { data: organizer, error: null });
  enqueue("organizer_verification_details", {
    data: ownOrganizer ? { organizer_profile_id: (ownOrganizer as { id: string }).id } : null,
    error: null,
  });
  enqueue("trip_requests", { data: request, error: null });
  enqueue("trips", { data: ownedTrip, error: null });
  enqueue("reports", { data: existingReport, error: null });
  enqueue("reports", { data: null, error: insertError });

  mocks.from.mockImplementation((table: string) => {
    const next = builders.get(table)?.shift();
    if (!next) throw new Error(`Unexpected table query: ${table}`);
    return next;
  });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.from });
  mocks.requireSignedInUser.mockResolvedValue({ id: reporterId });
  mocks.requireOrganizerProfileId.mockResolvedValue(organizerId);
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe("report submission (mocked Supabase client)", () => {
  it("prevents unauthorized customer reports before looking up targets", async () => {
    setup({ roles: ["organizer"] });
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "safety",
      details: "",
    }));

    expect(result.error).toMatch(/customer account/i);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a target that cannot be found as a published trip", async () => {
    setup({ trip: null });
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "safety",
      details: "",
    }));

    expect(result.error).toMatch(/no longer available/i);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it("prevents an organizer from reporting their own trip", async () => {
    setup({
      roles: ["customer"],
      trip: { id: tripId, organizer_profile_id: organizerId },
      ownOrganizer: { id: organizerId },
    });
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "safety",
      details: "Concern",
    }));

    expect(result.error).toMatch(/cannot report your own trip/i);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a duplicate pending report for the same target and category", async () => {
    setup({ existingReport: { id: "existing-report" } });
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "safety",
      details: "Concern",
    }));

    expect(result.error).toMatch(/already have a pending report/i);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a duplicate rejected by the database uniqueness guard", async () => {
    setup({ insertError: { code: "23505", message: "duplicate key" } });
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "safety",
      details: "Concern",
    }));

    expect(result.error).toMatch(/already have a pending report/i);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("submits a report using the authenticated reporter and validated trip target", async () => {
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "safety",
      details: "",
    }));

    expect(result.message).toMatch(/submitted for review/i);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/account/reports");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("allows an organizer to report only a customer from their own request", async () => {
    setup({ roles: ["organizer"], ownOrganizer: { id: organizerId } });
    const result = await submitReport({}, form({
      targetType: "customer",
      targetId: customerId,
      requestId,
      category: "harassment",
      details: "Repeated abusive messages.",
    }));

    expect(result.message).toMatch(/submitted for review/i);
  });

  it("rejects organizer reports for customers outside the organizer's trips", async () => {
    setup({
      roles: ["organizer"],
      ownOrganizer: { id: organizerId },
      trip: null,
    });
    const result = await submitReport({}, form({
      targetType: "customer",
      targetId: customerId,
      requestId,
      category: "other",
      details: "Concern.",
    }));

    expect(result.error).toMatch(/outside your own trip/i);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a safe error if report insertion fails", async () => {
    setup({ insertError: { code: "XX000", message: "database error" } });
    const result = await submitReport({}, form({
      targetType: "trip",
      targetId: tripId,
      category: "other",
      details: "Details",
    }));

    expect(result.error).toMatch(/could not submit your report/i);
  });
});
