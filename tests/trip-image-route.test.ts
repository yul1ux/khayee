import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/organizer/trips/[tripId]/images/route";
import {
  MAX_TRIP_IMAGE_BYTES,
  MAX_TRIP_IMAGE_REQUEST_BYTES,
  MAX_TRIP_IMAGE_TOTAL_BYTES,
} from "../src/lib/trip-images/rules";

const mocks = vi.hoisted(() => ({
  createRepository: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  countImages: vi.fn(),
  getEditableTrip: vi.fn(),
  getNextSortOrder: vi.fn(),
  insertImage: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/trip-images/supabase-repository", () => ({
  createSupabaseTripImageRepository: mocks.createRepository,
}));

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_URL = `http://localhost/api/organizer/trips/${TRIP_ID}/images`;
const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4y8AAAAASUVORK5CYII=",
    "base64",
  ),
);

function routeContext() {
  return { params: Promise.resolve({ tripId: TRIP_ID }) };
}

function makeRequest(formData: FormData) {
  return new Request(REQUEST_URL, {
    method: "POST",
    headers: { origin: new URL(REQUEST_URL).origin },
    body: formData,
  });
}

function makePngFormData() {
  const formData = new FormData();
  formData.set("file", new File([PNG_BYTES], "trail.png", { type: "image/png" }));
  formData.set("altText", "A trail through the forest");
  return formData;
}

function makePngFile(size: number, name: string) {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_BYTES);
  return new File([bytes], name, { type: "image/png" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
  mocks.getEditableTrip.mockResolvedValue({
    data: { id: TRIP_ID, status: "draft" },
    error: null,
  });
  mocks.countImages.mockResolvedValue({ data: 0, error: null });
  mocks.getNextSortOrder.mockResolvedValue({ data: 0, error: null });
  mocks.insertImage.mockResolvedValue({
    data: { id: "33333333-3333-4333-8333-333333333333" },
    error: null,
  });
  mocks.storageUpload.mockResolvedValue({ error: null });
  mocks.storageRemove.mockResolvedValue({ error: null });
  mocks.createRepository.mockReturnValue({
    getEditableTrip: mocks.getEditableTrip,
    countImages: mocks.countImages,
    getNextSortOrder: mocks.getNextSortOrder,
    insertImage: mocks.insertImage,
    getImage: vi.fn(),
    deleteImage: vi.fn(),
  });
  mocks.createSupabaseServerClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    storage: {
      from: () => ({
        upload: mocks.storageUpload,
        remove: mocks.storageRemove,
      }),
    },
  });
});

describe("trip image upload route", () => {
  it("rejects a declared request body larger than the multipart limit", async () => {
    const requestInit: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: {
        origin: new URL(REQUEST_URL).origin,
        "content-type": "multipart/form-data; boundary=audit",
        "content-length": String(MAX_TRIP_IMAGE_REQUEST_BYTES + 1),
      },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
      }),
      duplex: "half",
    };
    const request = new Request(REQUEST_URL, requestInit);

    const response = await POST(request, routeContext());

    expect(response.status).toBe(413);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("bounds and rejects a streamed body when Content-Length is missing", async () => {
    let cancelCalled = false;
    let chunksProduced = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const requestInit: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: {
        origin: new URL(REQUEST_URL).origin,
        "content-type": "multipart/form-data; boundary=audit",
      },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          chunksProduced += 1;
          controller.enqueue(chunk);
        },
        cancel() {
          cancelCalled = true;
        },
      }),
      duplex: "half",
    };
    const request = new Request(REQUEST_URL, requestInit);

    expect(request.headers.has("content-length")).toBe(false);
    const response = await POST(request, routeContext());

    expect(response.status).toBe(413);
    expect(cancelCalled).toBe(true);
    expect(chunksProduced).toBeLessThan(10);
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("accepts an image below 3.5 MiB with multipart overhead under 4 MiB", async () => {
    const formData = new FormData();
    const file = makePngFile(MAX_TRIP_IMAGE_BYTES - 1, "large.png");
    formData.set("file", file);
    formData.set("altText", "A large trail image");
    const request = makeRequest(formData);
    const requestBodyBytes = (await request.clone().arrayBuffer()).byteLength;

    expect(requestBodyBytes).toBeGreaterThan(file.size);
    expect(requestBodyBytes).toBeLessThanOrEqual(MAX_TRIP_IMAGE_REQUEST_BYTES);
    expect(request.headers.has("content-length")).toBe(false);

    const response = await POST(request, routeContext());

    expect(response.status).toBe(201);
    expect(mocks.storageUpload).toHaveBeenCalledOnce();
  });

  it("rejects combined image bytes above 3.5 MiB", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      makePngFile(Math.floor(MAX_TRIP_IMAGE_TOTAL_BYTES / 2) + 1, "first.png"),
    );
    formData.append(
      "file",
      makePngFile(Math.floor(MAX_TRIP_IMAGE_TOTAL_BYTES / 2) + 1, "second.png"),
    );
    formData.set("altText", "Two large images");

    const response = await POST(makeRequest(formData), routeContext());

    expect(response.status).toBe(413);
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("accepts a valid multipart upload without Content-Length", async () => {
    const request = makeRequest(makePngFormData());
    expect(request.headers.has("content-length")).toBe(false);

    const response = await POST(request, routeContext());

    expect(response.status).toBe(201);
    expect(mocks.storageUpload).toHaveBeenCalledOnce();
    expect(mocks.insertImage).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: TRIP_ID,
        alt_text: "A trail through the forest",
        sort_order: 0,
      }),
    );
  });

  it("rejects unauthenticated uploads", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(makeRequest(makePngFormData()), routeContext());

    expect(response.status).toBe(401);
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("preserves image signature validation before storage upload", async () => {
    const formData = new FormData();
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "fake.png", {
      type: "image/png",
    }));
    formData.set("altText", "A fake image");

    const response = await POST(makeRequest(formData), routeContext());

    expect(response.status).toBe(400);
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });
});
