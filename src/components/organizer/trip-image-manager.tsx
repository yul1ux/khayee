"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  getImageValidationError,
  MAX_TRIP_IMAGES,
} from "@/lib/trip-images/rules";

type ImageItem = {
  id: string;
  alt_text: string;
  sort_order: number;
};

type TripImageManagerProps = {
  tripId: string;
  images: ImageItem[];
};

async function getApiError(response: Response) {
  const body: unknown = await response.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return null;
}

export function TripImageManager({
  tripId,
  images,
}: TripImageManagerProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validationRequest = useRef(0);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  function setError(message: string) {
    setSuccessMessage(null);
    setErrorMessage(message);
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const requestId = ++validationRequest.current;
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(null);
    setPreviewUrl(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!selectedFile) {
      return;
    }

    if (images.length >= MAX_TRIP_IMAGES) {
      setError(`This trip already has the maximum of ${MAX_TRIP_IMAGES} images.`);
      event.target.value = "";
      return;
    }

    const validationError = await getImageValidationError(selectedFile);
    if (requestId !== validationRequest.current) {
      return;
    }
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!file) {
      setError("Choose an image before uploading.");
      return;
    }
    if (altText.trim().length === 0 || altText.trim().length > 500) {
      setError("Add alternative text between 1 and 500 characters.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("altText", altText.trim());
    setIsPending(true);

    try {
      const response = await fetch(
        `/api/organizer/trips/${tripId}/images`,
        { method: "POST", body: formData },
      );
      if (!response.ok) {
        const apiError = await getApiError(response);
        setError(apiError ?? "The image could not be uploaded.");
        return;
      }

      setFile(null);
      setPreviewUrl(null);
      setAltText("");
      if (fileInput.current) {
        fileInput.current.value = "";
      }
      setSuccessMessage("Image uploaded.");
      router.refresh();
    } catch (error) {
      console.error("Trip image upload request failed", error);
      setError("The upload could not be completed. Check your connection and retry.");
    } finally {
      setIsPending(false);
    }
  }

  async function removeImage(imageId: string) {
    if (!window.confirm("Remove this trip image?")) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/organizer/trips/${tripId}/images`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageId }),
        },
      );
      if (!response.ok) {
        const apiError = await getApiError(response);
        setError(apiError ?? "The image could not be removed.");
        return;
      }

      setSuccessMessage("Image removed.");
      router.refresh();
    } catch (error) {
      console.error("Trip image removal request failed", error);
      setError("The removal could not be completed. Check your connection and retry.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-10">
      <form className="space-y-5" onSubmit={submitUpload}>
        <div>
          <label
            className="mb-2 block text-sm font-semibold text-[#29382d]"
            htmlFor="trip-image-file"
          >
            Choose an image
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="block w-full border border-[#d9d8cf] bg-white p-3 text-sm text-[#3d463d] file:mr-4 file:border-0 file:bg-[#e8eadf] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#294a35]"
            disabled={isPending || images.length >= MAX_TRIP_IMAGES}
            id="trip-image-file"
            onChange={handleFileChange}
            ref={fileInput}
            type="file"
          />
          <p className="mt-2 text-xs leading-5 text-[#73776e]">
            JPEG, PNG, or WebP; maximum 50 MiB. Up to {MAX_TRIP_IMAGES} images
            per trip.
          </p>
        </div>

        {previewUrl && file ? (
          <div className="max-w-md border border-[#e5e3db] bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Selected image preview"
              className="max-h-72 w-full object-contain"
              src={previewUrl}
            />
            <p className="mt-2 truncate text-xs text-[#73776e]">{file.name}</p>
          </div>
        ) : null}

        <div>
          <label
            className="mb-2 block text-sm font-semibold text-[#29382d]"
            htmlFor="trip-image-alt"
          >
            Image description
          </label>
          <input
            className="w-full max-w-xl border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm text-[#29382d] focus-visible:outline-2 focus-visible:outline-[#68794d]"
            disabled={isPending}
            id="trip-image-alt"
            maxLength={500}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Describe what the image shows"
            value={altText}
          />
        </div>

        <button
          className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d3c2a] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || !file || images.length >= MAX_TRIP_IMAGES}
          type="submit"
        >
          {isPending ? "Working…" : "Upload image"}
        </button>
      </form>

      <div aria-live="polite" className="space-y-2" role="status">
        {errorMessage ? (
          <p className="text-sm font-medium text-red-800">{errorMessage}</p>
        ) : null}
        {successMessage ? (
          <p className="text-sm font-medium text-[#31513b]">{successMessage}</p>
        ) : null}
      </div>

      <section aria-labelledby="saved-images-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            className="text-xl font-semibold tracking-[-0.03em] text-[#29382d]"
            id="saved-images-heading"
          >
            Trip images
          </h2>
          <p className="text-xs text-[#73776e]">
            {images.length} of {MAX_TRIP_IMAGES}
          </p>
        </div>

        {images.length === 0 ? (
          <p className="border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">
            No images have been added to this trip.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <li
                className="flex items-center justify-between gap-4 border border-[#e5e3db] bg-white p-4"
                key={image.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#29382d]">
                    {image.alt_text}
                  </p>
                  <p className="mt-1 text-xs text-[#73776e]">
                    Image {image.sort_order + 1}
                  </p>
                </div>
                <button
                  className="shrink-0 border-b border-[#a9675b] pb-0.5 text-xs font-semibold text-[#8a4034] disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => removeImage(image.id)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
