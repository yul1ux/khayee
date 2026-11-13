import { createSupabaseTripImageRepository } from "@/lib/trip-images/supabase-repository";
import {
  createTripImageService,
  TripImageServiceError,
} from "@/lib/trip-images/service";
import {
  getCombinedImageSizeValidationError,
  MAX_TRIP_IMAGE_BYTES,
  MAX_TRIP_IMAGE_REQUEST_BYTES,
} from "@/lib/trip-images/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_SIZE_ERROR = `Images must be ${MAX_TRIP_IMAGE_BYTES / 1024 / 1024} MiB or smaller.`;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

async function readRequestBodyWithinLimit(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value.byteLength > limit - totalBytes) {
        void reader
          .cancel()
          .catch((error) =>
            console.error("Could not stop an oversized trip image request", error),
          );
        return null;
      }

      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function handleError(error: unknown) {
  if (error instanceof TripImageServiceError) {
    if (error.status >= 500) {
      console.error("Trip image operation failed", error);
    }

    return jsonError(error.message, error.status);
  }

  console.error("Trip image operation failed unexpectedly", error);
  return jsonError("The trip image operation could not be completed.", 500);
}

async function getAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase.auth.getUser();

  if (error && !isUnauthenticatedSessionError(error)) {
    console.error("Could not verify the trip image request session", error);
    throw new Error("Could not verify the current session.", { cause: error });
  }
  if (!data.user) {
    throw new TripImageServiceError(
      "unauthorized",
      "Sign in to manage trip images.",
      401,
    );
  }

  return data.user;
}

function createService(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  return createTripImageService(
    createSupabaseTripImageRepository(supabase),
    {
      async upload(storagePath, file, contentType) {
        const { error } = await supabase.storage
          .from("trip-images")
          .upload(storagePath, file, {
            cacheControl: "3600",
            contentType,
            upsert: false,
          });
        return { error };
      },
      async remove(storagePath) {
        const { error } = await supabase.storage
          .from("trip-images")
          .remove([storagePath]);
        return { error };
      },
    },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tripId: string }> },
) {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin requests are not allowed.", 403);
  }

  const { tripId } = await context.params;
  if (!UUID_PATTERN.test(tripId)) {
    return jsonError("The trip ID is invalid.", 400);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return jsonError("Send the image as multipart form data.", 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const bodyLength = Number(contentLength);
    if (
      !/^\d+$/.test(contentLength) ||
      !Number.isSafeInteger(bodyLength) ||
      bodyLength > MAX_TRIP_IMAGE_REQUEST_BYTES
    ) {
      return jsonError(IMAGE_SIZE_ERROR, 413);
    }
  }

  try {
    const supabase = await createSupabaseServerClient({ writeCookies: true });
    const user = await getAuthenticatedUser(supabase);
    let requestBody: Uint8Array<ArrayBuffer> | null;
    try {
      requestBody = await readRequestBodyWithinLimit(
        request,
        MAX_TRIP_IMAGE_REQUEST_BYTES,
      );
    } catch {
      return jsonError("The multipart request body is invalid.", 400);
    }
    if (!requestBody) {
      return jsonError(IMAGE_SIZE_ERROR, 413);
    }

    let formData: FormData;
    try {
      formData = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": contentType },
        body: requestBody,
      }).formData();
    } catch {
      return jsonError("The multipart request body is invalid.", 400);
    }
    const formFiles = formData.getAll("file");
    const altText = formData.get("altText");

    const files: File[] = [];
    for (const formFile of formFiles) {
      if (!(formFile instanceof File)) {
        return jsonError("Choose an image to upload.", 400);
      }
      files.push(formFile);
    }
    if (files.length === 0) {
      return jsonError("Choose an image to upload.", 400);
    }

    const combinedSizeError = getCombinedImageSizeValidationError(files);
    if (combinedSizeError) {
      return jsonError(combinedSizeError, 413);
    }
    if (files.length !== 1) {
      return jsonError("Upload one image at a time.", 400);
    }
    if (typeof altText !== "string") {
      return jsonError("Add alternative text for this image.", 400);
    }

    const file = files[0];
    if (!file) {
      return jsonError("Choose an image to upload.", 400);
    }
    const service = createService(supabase);
    const image = await service.upload({
      tripId,
      userId: user.id,
      file,
      altText,
    });

    return Response.json({ image }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tripId: string }> },
) {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin requests are not allowed.", 403);
  }

  const { tripId } = await context.params;
  if (!UUID_PATTERN.test(tripId)) {
    return jsonError("The trip ID is invalid.", 400);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonError("Send the image ID as JSON.", 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("The request body is not valid JSON.", 400);
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("imageId" in payload) ||
    typeof payload.imageId !== "string"
  ) {
    return jsonError("The image ID is required.", 400);
  }

  try {
    const supabase = await createSupabaseServerClient({ writeCookies: true });
    const user = await getAuthenticatedUser(supabase);
    const service = createService(supabase);
    const result = await service.remove({
      tripId,
      imageId: payload.imageId,
      userId: user.id,
    });

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
