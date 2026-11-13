import {
  getImageValidationError,
  IMAGE_EXTENSIONS,
  isTripImageMimeType,
  MAX_TRIP_IMAGES,
  type TripImageMimeType,
} from "./rules";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i;

export type EditableTrip = {
  id: string;
  status: string;
};

export type TripImageRecord = {
  id: string;
  trip_id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
};

type Result<T> = {
  data: T;
  error: Error | null;
};

export interface TripImageRepository {
  getEditableTrip(tripId: string, userId: string): Promise<Result<EditableTrip | null>>;
  countImages(tripId: string): Promise<Result<number | null>>;
  getNextSortOrder(tripId: string): Promise<Result<number | null>>;
  insertImage(input: {
    trip_id: string;
    storage_path: string;
    alt_text: string;
    sort_order: number;
  }): Promise<Result<{ id: string } | null>>;
  getImage(imageId: string): Promise<Result<TripImageRecord | null>>;
  deleteImage(imageId: string): Promise<Result<boolean>>;
}

export interface TripImageStorage {
  upload(
    storagePath: string,
    file: File,
    contentType: TripImageMimeType,
  ): Promise<{ error: Error | null }>;
  remove(storagePath: string): Promise<{ error: Error | null }>;
}

export class TripImageServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TripImageServiceError";
  }
}

function assertUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new TripImageServiceError(
      "invalid_id",
      `The ${label} is invalid.`,
      400,
    );
  }
}

function assertEditableTripStatus(status: string) {
  if (status !== "draft" && status !== "rejected") {
    throw new TripImageServiceError(
      "trip_not_editable",
      "Images can only be changed on draft or rejected trips.",
      409,
    );
  }
}

export function createTripImageService(
  repository: TripImageRepository,
  storage: TripImageStorage,
) {
  async function getEditableTrip(tripId: string, userId: string) {
    assertUuid(tripId, "trip ID");

    if (!userId) {
      throw new TripImageServiceError(
        "unauthorized",
        "Sign in to manage trip images.",
        401,
      );
    }

    const result = await repository.getEditableTrip(tripId, userId);
    if (result.error) {
      throw result.error;
    }
    if (!result.data) {
      throw new TripImageServiceError(
        "forbidden",
        "You can only manage images for your own trips.",
        403,
      );
    }

    assertEditableTripStatus(result.data.status);
    return result.data;
  }

  return {
    async upload(input: {
      tripId: string;
      userId: string;
      file: File;
      altText: string;
    }) {
      await getEditableTrip(input.tripId, input.userId);

      const validationError = await getImageValidationError(input.file);
      if (validationError) {
        throw new TripImageServiceError(
          "invalid_image",
          validationError,
          400,
        );
      }

      const altText = input.altText.trim();
      if (altText.length === 0 || altText.length > 500) {
        throw new TripImageServiceError(
          "invalid_alt_text",
          "Add alternative text between 1 and 500 characters.",
          400,
        );
      }

      const [count, nextSortOrder] = await Promise.all([
        repository.countImages(input.tripId),
        repository.getNextSortOrder(input.tripId),
      ]);
      if (count.error || nextSortOrder.error) {
        throw count.error ?? nextSortOrder.error;
      }
      if (count.data === null) {
        throw new Error("Trip image count was not returned by the database.");
      }
      if (nextSortOrder.data === null) {
        throw new Error("Trip image sort order was not returned by the database.");
      }
      if (count.data >= MAX_TRIP_IMAGES) {
        throw new TripImageServiceError(
          "image_limit_reached",
          `A trip can have up to ${MAX_TRIP_IMAGES} images.`,
          409,
        );
      }

      if (!isTripImageMimeType(input.file.type)) {
        throw new TripImageServiceError(
          "invalid_image",
          "Choose a JPEG, PNG, or WebP image.",
          400,
        );
      }

      const mimeType = input.file.type;
      const extension = IMAGE_EXTENSIONS[mimeType];
      const storagePath = `${input.tripId}/${crypto.randomUUID()}.${extension}`;
      const upload = await storage.upload(storagePath, input.file, mimeType);
      if (upload.error) {
        throw new TripImageServiceError(
          "storage_upload_failed",
          "The image could not be uploaded.",
          502,
          { cause: upload.error },
        );
      }

      const inserted = await repository.insertImage({
        trip_id: input.tripId,
        storage_path: storagePath,
        alt_text: altText,
        sort_order: nextSortOrder.data,
      });

      if (inserted.error || !inserted.data) {
        const metadataError =
          inserted.error ??
          new Error("The database did not return the saved image.");
        const cleanup = await storage.remove(storagePath);

        if (cleanup.error) {
          throw new TripImageServiceError(
            "orphan_cleanup_failed",
            "The image uploaded, but saving its details failed and cleanup did not complete. Contact support.",
            500,
            { cause: new AggregateError([metadataError, cleanup.error]) },
          );
        }

        throw new TripImageServiceError(
          "metadata_insert_failed",
          "The image uploaded, but its details could not be saved. The uploaded file was removed.",
          500,
          { cause: metadataError },
        );
      }

      return { id: inserted.data.id, altText, storagePath };
    },

    async remove(input: {
      tripId: string;
      imageId: string;
      userId: string;
    }) {
      assertUuid(input.tripId, "trip ID");
      assertUuid(input.imageId, "image ID");

      if (!input.userId) {
        throw new TripImageServiceError(
          "unauthorized",
          "Sign in to manage trip images.",
          401,
        );
      }

      const image = await repository.getImage(input.imageId);
      if (image.error) {
        throw image.error;
      }
      if (!image.data) {
        throw new TripImageServiceError(
          "image_not_found",
          "The trip image was not found.",
          404,
        );
      }

      if (image.data.trip_id !== input.tripId) {
        throw new TripImageServiceError(
          "image_not_found",
          "The trip image was not found.",
          404,
        );
      }

      await getEditableTrip(image.data.trip_id, input.userId);

      const pathMatch = STORAGE_PATH_PATTERN.exec(image.data.storage_path);
      if (!pathMatch || pathMatch[1].toLowerCase() !== image.data.trip_id.toLowerCase()) {
        throw new Error("The image metadata contains an invalid storage path.");
      }

      const removedObject = await storage.remove(image.data.storage_path);
      if (removedObject.error) {
        throw new TripImageServiceError(
          "storage_delete_failed",
          "The image file could not be removed. Its details were kept so you can retry.",
          502,
          { cause: removedObject.error },
        );
      }

      const deleted = await repository.deleteImage(input.imageId);
      if (deleted.error || !deleted.data) {
        throw new TripImageServiceError(
          "metadata_delete_failed",
          "The image file was removed, but its details could not be deleted. Retry removal.",
          500,
          { cause: deleted.error },
        );
      }

      return { id: input.imageId };
    },
  };
}
