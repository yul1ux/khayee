import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTripImageService,
  type TripImageRecord,
  type TripImageRepository,
  type TripImageStorage,
} from "../src/lib/trip-images/service";
import { MAX_TRIP_IMAGE_BYTES } from "../src/lib/trip-images/rules";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TRIP_ID = "22222222-2222-4222-8222-222222222222";
const IMAGE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_USER_ID = "55555555-5555-4555-8555-555555555555";
const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4y8AAAAASUVORK5CYII=",
    "base64",
  ),
);

function createPngFile() {
  return new File([PNG_BYTES], "trail.png", { type: "image/png" });
}

function makeHarness(options?: {
  authorizedUserId?: string;
  status?: string;
  imageCount?: number;
  nextSortOrder?: number;
  insertError?: Error | null;
  removeError?: Error | null;
  image?: TripImageRecord | null;
  deleteError?: Error | null;
}) {
  const objects = new Set<string>();
  const rows = new Map<string, TripImageRecord>();
  let count = options?.imageCount ?? 0;

  const repository: TripImageRepository = {
    getEditableTrip: vi.fn(async (tripId, userId) => ({
      data:
        userId === (options?.authorizedUserId ?? USER_ID) &&
        tripId === TRIP_ID
          ? { id: tripId, status: options?.status ?? "draft" }
          : null,
      error: null,
    })),
    countImages: vi.fn(async () => ({ data: count, error: null })),
    getNextSortOrder: vi.fn(async () => ({
      data: options?.nextSortOrder ?? count,
      error: null,
    })),
    insertImage: vi.fn(async (input) => {
      if (options?.insertError) {
        return { data: null, error: options.insertError };
      }

      const id = IMAGE_ID;
      rows.set(id, {
        id,
        ...input,
      });
      count += 1;
      return { data: { id }, error: null };
    }),
    getImage: vi.fn(async (imageId) => ({
      data: rows.get(imageId) ?? options?.image ?? null,
      error: null,
    })),
    deleteImage: vi.fn(async (imageId) => {
      if (options?.deleteError) {
        return { data: false, error: options.deleteError };
      }
      const deleted =
        rows.delete(imageId) || options?.image?.id === imageId;
      if (deleted) {
        count -= 1;
      }
      return { data: deleted, error: null };
    }),
  };

  const storage: TripImageStorage = {
    upload: vi.fn(async (path) => {
      objects.add(path);
      return { error: null };
    }),
    remove: vi.fn(async (path) => {
      if (options?.removeError) {
        return { error: options.removeError };
      }
      objects.delete(path);
      return { error: null };
    }),
  };

  return {
    objects,
    repository,
    service: createTripImageService(repository, storage),
    storage,
  };
}

describe("trip image management service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a valid image and records its metadata", async () => {
    const harness = makeHarness();

    const result = await harness.service.upload({
      tripId: TRIP_ID,
      userId: USER_ID,
      file: createPngFile(),
      altText: "A trail through the pine forest",
    });

    expect(result.id).toBe(IMAGE_ID);
    expect(result.storagePath).toMatch(
      new RegExp(`^${TRIP_ID}/[0-9a-f-]+\\.png$`),
    );
    expect(harness.objects.has(result.storagePath)).toBe(true);
    expect(harness.repository.insertImage).toHaveBeenCalledWith({
      trip_id: TRIP_ID,
      storage_path: result.storagePath,
      alt_text: "A trail through the pine forest",
      sort_order: 0,
    });
  });

  it("appends after the last image when earlier sort positions were removed", async () => {
    const harness = makeHarness({ imageCount: 2, nextSortOrder: 4 });

    await harness.service.upload({
      tripId: TRIP_ID,
      userId: USER_ID,
      file: createPngFile(),
      altText: "A trail through the pine forest",
    });

    expect(harness.repository.insertImage).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 4 }),
    );
  });

  it("rejects unsupported MIME types before uploading", async () => {
    const harness = makeHarness();
    const file = new File([PNG_BYTES], "image.gif", { type: "image/gif" });

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file,
        altText: "An image",
      }),
    ).rejects.toMatchObject({ code: "invalid_image", status: 400 });
    expect(harness.storage.upload).not.toHaveBeenCalled();
  });

  it("accepts an image below 3.5 MiB", async () => {
    const harness = makeHarness();
    const bytes = new Uint8Array(MAX_TRIP_IMAGE_BYTES - 1);
    bytes.set(PNG_BYTES);
    const file = new File([bytes], "large.png", { type: "image/png" });

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file,
        altText: "A large image",
      }),
    ).resolves.toMatchObject({ id: IMAGE_ID });
    expect(harness.storage.upload).toHaveBeenCalledOnce();
  });

  it("rejects a file that exceeds 3.5 MiB before uploading", async () => {
    const harness = makeHarness();
    const file = new File(
      [new Uint8Array(MAX_TRIP_IMAGE_BYTES + 1)],
      "too-large.png",
      { type: "image/png" },
    );

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file,
        altText: "A large image",
      }),
    ).rejects.toMatchObject({ code: "invalid_image", status: 400 });
    expect(harness.storage.upload).not.toHaveBeenCalled();
  });

  it("rejects uploads when the trip image limit has been reached", async () => {
    const harness = makeHarness({ imageCount: 10 });

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file: createPngFile(),
        altText: "An additional image",
      }),
    ).rejects.toMatchObject({ code: "image_limit_reached", status: 409 });
    expect(harness.storage.upload).not.toHaveBeenCalled();
  });

  it("rejects an image whose contents do not match its MIME type", async () => {
    const harness = makeHarness();
    const file = new File([new Uint8Array([0, 1, 2])], "fake.png", {
      type: "image/png",
    });

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file,
        altText: "An invalid image",
      }),
    ).rejects.toMatchObject({ code: "invalid_image", status: 400 });
    expect(harness.storage.upload).not.toHaveBeenCalled();
  });

  it("rejects a user without organizer ownership", async () => {
    const harness = makeHarness();

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: OTHER_USER_ID,
        file: createPngFile(),
        altText: "Another organizer's image",
      }),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
    expect(harness.storage.upload).not.toHaveBeenCalled();
  });

  it("rejects uploads to another organizer's trip", async () => {
    const harness = makeHarness();

    await expect(
      harness.service.upload({
        tripId: OTHER_TRIP_ID,
        userId: USER_ID,
        file: createPngFile(),
        altText: "An image for a different trip",
      }),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
    expect(harness.storage.upload).not.toHaveBeenCalled();
  });

  it("rejects image removal when the caller does not own the trip", async () => {
    const image: TripImageRecord = {
      id: IMAGE_ID,
      trip_id: TRIP_ID,
      storage_path: `${TRIP_ID}/${IMAGE_ID}.png`,
      alt_text: "A saved image",
      sort_order: 0,
    };
    const harness = makeHarness({
      authorizedUserId: OTHER_USER_ID,
      image,
    });

    await expect(
      harness.service.remove({
        tripId: TRIP_ID,
        imageId: IMAGE_ID,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
    expect(harness.storage.remove).not.toHaveBeenCalled();
    expect(harness.repository.deleteImage).not.toHaveBeenCalled();
  });

  it.each(["pending_review", "published"])(
    "rejects uploads when the trip is %s",
    async (status) => {
      const harness = makeHarness({ status });

      await expect(
        harness.service.upload({
          tripId: TRIP_ID,
          userId: USER_ID,
          file: createPngFile(),
          altText: "A trip image",
        }),
      ).rejects.toMatchObject({ code: "trip_not_editable", status: 409 });
      expect(harness.storage.upload).not.toHaveBeenCalled();
    },
  );

  it.each(["pending_review", "published"])(
    "rejects image removal when the trip is %s",
    async (status) => {
      const image: TripImageRecord = {
        id: IMAGE_ID,
        trip_id: TRIP_ID,
        storage_path: `${TRIP_ID}/${IMAGE_ID}.png`,
        alt_text: "A saved image",
        sort_order: 0,
      };
      const harness = makeHarness({ image, status });

      await expect(
        harness.service.remove({
          tripId: TRIP_ID,
          imageId: IMAGE_ID,
          userId: USER_ID,
        }),
      ).rejects.toMatchObject({ code: "trip_not_editable", status: 409 });
      expect(harness.storage.remove).not.toHaveBeenCalled();
    },
  );

  it("removes the object before deleting its metadata", async () => {
    const image: TripImageRecord = {
      id: IMAGE_ID,
      trip_id: TRIP_ID,
      storage_path: `${TRIP_ID}/${IMAGE_ID}.png`,
      alt_text: "A saved image",
      sort_order: 0,
    };
    const harness = makeHarness({ image });

    await expect(
      harness.service.remove({
        tripId: TRIP_ID,
        imageId: IMAGE_ID,
        userId: USER_ID,
      }),
    ).resolves.toEqual({ id: IMAGE_ID });
    expect(harness.storage.remove).toHaveBeenCalledWith(image.storage_path);
    expect(harness.repository.deleteImage).toHaveBeenCalledWith(IMAGE_ID);
  });

  it("keeps image metadata when Storage deletion fails", async () => {
    const image: TripImageRecord = {
      id: IMAGE_ID,
      trip_id: TRIP_ID,
      storage_path: `${TRIP_ID}/${IMAGE_ID}.png`,
      alt_text: "A saved image",
      sort_order: 0,
    };
    const harness = makeHarness({
      image,
      removeError: new Error("storage delete denied"),
    });

    await expect(
      harness.service.remove({
        tripId: TRIP_ID,
        imageId: IMAGE_ID,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: "storage_delete_failed", status: 502 });
    expect(harness.repository.deleteImage).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded object if metadata insertion fails", async () => {
    const harness = makeHarness({ insertError: new Error("database denied insert") });

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file: createPngFile(),
        altText: "A trail image",
      }),
    ).rejects.toMatchObject({
      code: "metadata_insert_failed",
      status: 500,
    });

    expect(harness.storage.upload).toHaveBeenCalledOnce();
    expect(harness.storage.remove).toHaveBeenCalledOnce();
    expect(harness.objects.size).toBe(0);
  });

  it("reports when uploaded-object cleanup also fails", async () => {
    const harness = makeHarness({
      insertError: new Error("database denied insert"),
      removeError: new Error("storage delete denied"),
    });

    await expect(
      harness.service.upload({
        tripId: TRIP_ID,
        userId: USER_ID,
        file: createPngFile(),
        altText: "A trail image",
      }),
    ).rejects.toMatchObject({
      code: "orphan_cleanup_failed",
      status: 500,
    });

    expect(harness.objects.size).toBe(1);
  });
});
