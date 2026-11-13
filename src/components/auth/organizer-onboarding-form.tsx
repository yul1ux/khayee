"use client";

import { useActionState } from "react";
import {
  submitOrganizerApplication,
  type OnboardingState,
} from "@/app/organizer/onboarding/actions";

const initialState: OnboardingState = {};

type OrganizerOnboardingFormProps = {
  application?: OnboardingState["application"];
  email?: string;
};

export function OrganizerOnboardingForm({
  application,
  email = "",
}: OrganizerOnboardingFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitOrganizerApplication,
    initialState,
  );
  const currentApplication = state.application ?? application;

  return (
    <div className="space-y-8">
      {currentApplication ? (
        <section className="border border-[#d9d8cf] bg-[#f7f6f1] p-5" aria-labelledby="application-status">
          <h2 className="font-semibold text-[#29382d]" id="application-status">
            Application status: <span className="capitalize">{currentApplication.status}</span>
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#73776e]">
            {currentApplication.status === "pending"
              ? "An administrator will review your organizer information. You can update your profile below while it is pending."
              : currentApplication.status === "verified"
                ? "Your organizer profile is verified. You can create and manage trips."
                : "Your application was not approved. Update your information below; an administrator can review it again."}
          </p>
          {currentApplication.rejectionReason ? (
            <p className="mt-3 text-sm text-[#8a4034]">
              Review note: {currentApplication.rejectionReason}
            </p>
          ) : null}
        </section>
      ) : null}

      <form action={formAction} aria-label="Organizer application" className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="organizer-display-name">
            Organizer display name
          </label>
          <input
            className="w-full max-w-xl border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
            defaultValue={currentApplication?.displayName ?? ""}
            id="organizer-display-name"
            maxLength={160}
            name="displayName"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="organizer-contact-email">
            Private contact email
          </label>
          <input
            autoComplete="email"
            className="w-full max-w-xl border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
            defaultValue={email}
            id="organizer-contact-email"
            maxLength={320}
            name="contactEmail"
            type="email"
          />
          <p className="mt-2 text-xs text-[#73776e]">Only you and authorized administrators can view this address.</p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="organizer-bio">
            About your trips <span className="font-normal text-[#73776e]">(optional)</span>
          </label>
          <textarea
            className="min-h-28 w-full max-w-xl border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
            defaultValue={currentApplication?.bio ?? ""}
            id="organizer-bio"
            maxLength={4000}
            name="bio"
            rows={4}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="organizer-website">
            Website <span className="font-normal text-[#73776e]">(optional)</span>
          </label>
          <input
            className="w-full max-w-xl border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
            defaultValue={currentApplication?.websiteUrl ?? ""}
            id="organizer-website"
            maxLength={2048}
            name="websiteUrl"
            placeholder="https://example.com"
            type="url"
          />
        </div>
        {state.error ? <p className="text-sm font-medium text-red-800" role="alert">{state.error}</p> : null}
        {state.message ? <p className="text-sm font-medium text-[#31513b]" role="status">{state.message}</p> : null}
        <button
          className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving…" : currentApplication ? "Save organizer details" : "Submit for review"}
        </button>
      </form>
    </div>
  );
}
