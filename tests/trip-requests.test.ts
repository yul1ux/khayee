import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelTripRequest,
  respondToTripRequest,
  submitTripRequest,
} from "../src/app/account/requests/actions";
import { validateTripRequest } from "../src/lib/trip-requests/validation";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
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
    maybeSingle: vi.fn(async () => result),
    insert: vi.fn(() => value),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return value;
}

function setup({
  roles = ["customer"],
  trip = {
    id: "11111111-1111-4111-8111-111111111111",
    organizer_profile_id: "trip-owner-profile",
    capacity: 8,
    starts_at: "2099-01-01T00:00:00Z",
  },
  organizerDetails = roles.includes("organizer")
    ? { organizer_profile_id: "organizer-id" }
    : null,
  organizerDetailsError = null,
  insertError = null,
  rpcError = null,
}: {
  roles?: string[];
  trip?: unknown;
  organizerDetails?: unknown;
  organizerDetailsError?: unknown;
  insertError?: unknown;
  rpcError?: unknown;
} = {}) {
  const roleQuery = builder({ data: roles.map((role) => ({ role })), error: null });
  const tripQuery = builder({ data: trip, error: null });
  const requestInsert = builder({ data: null, error: insertError });
  const detailsQuery = builder({ data: organizerDetails, error: organizerDetailsError });
  mocks.from.mockImplementation((table: string) => {
    if (table === "user_roles") return roleQuery;
    if (table === "trips") return tripQuery;
    if (table === "trip_requests") return requestInsert;
    if (table === "organizer_verification_details") return detailsQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.rpc.mockResolvedValue({ error: rpcError });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "authenticated-customer" } },
    error: null,
  });
  mocks.createSupabaseServerClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  });
  return { roleQuery, tripQuery, requestInsert, detailsQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trip request validation", () => {
  const tripId = "11111111-1111-4111-8111-111111111111";

  it("accepts a positive party size and bounded message", () => {
    expect(validateTripRequest(tripId, 3, "We are visiting from Mandalay.")).toBeNull();
  });

  it("rejects malformed trip IDs, non-positive parties, and oversized messages", () => {
    expect(validateTripRequest("not-a-trip", 1, "")).toMatch(/trip could not be found/i);
    expect(validateTripRequest(tripId, 0, "")).toMatch(/participant/i);
    expect(validateTripRequest(tripId, 1.5, "")).toMatch(/participant/i);
    expect(validateTripRequest(tripId, Number.MAX_SAFE_INTEGER + 1, "")).toMatch(/participant/i);
    expect(validateTripRequest(tripId, 1, "x".repeat(2001))).toMatch(/2,000/i);
  });
});

describe("trip request actions (mocked Supabase client)", () => {
  const tripId = "11111111-1111-4111-8111-111111111111";
  const requestId = "22222222-2222-4222-8222-222222222222";

  it("inserts a request without trusting a client-supplied customer or status", async () => {
    const { requestInsert } = setup();
    const result = await submitTripRequest({}, form({
      tripId,
      partySize: "2",
      message: "Please let us know what to bring.",
      customer_id: "someone-else",
      status: "accepted",
    }));

    expect(result.message).toMatch(/sent to the organizer/i);
    expect(requestInsert.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      party_size: 2,
      message: "Please let us know what to bring.",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("rejects organizers and party sizes beyond trip capacity before insertion", async () => {
    const { requestInsert } = setup({ roles: ["organizer"] });
    const result = await submitTripRequest({}, form({ tripId, partySize: "2", message: "" }));
    expect(result.error).toMatch(/customer account/i);
    expect(requestInsert.insert).not.toHaveBeenCalled();

    setup();
    const tooMany = await submitTripRequest({}, form({ tripId, partySize: "9", message: "" }));
    expect(tooMany.error).toMatch(/capacity/i);
  });

  it("prevents a customer-organizer from requesting their own trip", async () => {
    const { requestInsert, detailsQuery } = setup({
      roles: ["customer", "organizer"],
      organizerDetails: { organizer_profile_id: "trip-owner-profile" },
    });
    const result = await submitTripRequest({}, form({ tripId, partySize: "2", message: "" }));

    expect(result.error).toMatch(/own trip/i);
    expect(requestInsert.insert).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalledWith("organizer_verification_details");
    expect(detailsQuery.select).toHaveBeenCalledWith("organizer_profile_id");
  });

  it("returns a clear error if ownership cannot be checked", async () => {
    setup({ organizerDetailsError: { message: "database unavailable" } });
    const result = await submitTripRequest({}, form({ tripId, partySize: "2", message: "" }));
    expect(result.error).toMatch(/verify trip ownership/i);
    expect(mocks.from).not.toHaveBeenCalledWith("trip_requests");
  });

  it("does not submit requests for trips that have already departed", async () => {
    const { requestInsert } = setup({
      trip: {
        id: tripId,
        capacity: 8,
        starts_at: "2000-01-01T00:00:00Z",
      },
    });
    const result = await submitTripRequest({}, form({ tripId, partySize: "1", message: "" }));
    expect(result.error).toMatch(/no longer accepting/i);
    expect(requestInsert.insert).not.toHaveBeenCalled();
  });

  it("reports an already-active request using the database unique constraint", async () => {
    setup({ insertError: { code: "23505", message: "duplicate key" } });
    const result = await submitTripRequest({}, form({ tripId, partySize: "1", message: "" }));
    expect(result.error).toMatch(/already have an active request/i);
  });

  it("uses the owner-authorized RPC to cancel a request", async () => {
    setup();
    const result = await cancelTripRequest({}, form({ requestId }));
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_trip_request", { p_request_id: requestId });
    expect(result.message).toMatch(/cancelled/i);
  });

  it("reports cancellation of a non-pending request", async () => {
    setup({ rpcError: { code: "23514", message: "only pending requests can be cancelled" } });
    const result = await cancelTripRequest({}, form({ requestId }));
    expect(result.error).toMatch(/only pending requests/i);
  });

  it("does not allow a customer to decide a request", async () => {
    setup();
    const result = await respondToTripRequest({}, form({ requestId, decision: "accept" }));
    expect(result.error).toMatch(/organizer account/i);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the transaction-safe organizer decision RPC and reports capacity conflicts", async () => {
    setup({ roles: ["customer", "organizer"], rpcError: { code: "23514", message: "accepting this request would exceed trip capacity" } });
    const result = await respondToTripRequest({}, form({ requestId, decision: "accept" }));
    expect(mocks.rpc).toHaveBeenCalledWith("accept_trip_request", { p_request_id: requestId });
    expect(result.error).toMatch(/not enough places/i);
  });

  it("routes rejection through the owner-authorized database transition", async () => {
    setup({ roles: ["organizer"] });
    const result = await respondToTripRequest({}, form({ requestId, decision: "reject" }));
    expect(mocks.rpc).toHaveBeenCalledWith("reject_trip_request", { p_request_id: requestId });
    expect(result.message).toMatch(/declined/i);
  });
});
