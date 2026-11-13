"use client";

import { useActionState } from "react";
import {
  updateCustomerProfile,
  type ProfileState,
} from "@/app/account/profile/actions";

const initialState: ProfileState = {};

export function CustomerProfileForm({
  profile,
}: {
  profile: {
    displayName: string;
    phoneNumber: string;
    bio: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateCustomerProfile, initialState);

  return (
    <form action={formAction} className="mt-8 max-w-2xl space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="profile-display-name">Display name</label>
        <input
          autoComplete="name"
          className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="profile-display-name"
          maxLength={120}
          name="displayName"
          required
          defaultValue={profile.displayName}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="profile-phone-number">Phone number <span className="font-normal text-[#73776e]">(optional)</span></label>
        <input
          autoComplete="tel"
          className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="profile-phone-number"
          maxLength={40}
          name="phoneNumber"
          type="tel"
          defaultValue={profile.phoneNumber}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="profile-bio">About you <span className="font-normal text-[#73776e]">(optional)</span></label>
        <textarea
          className="min-h-32 w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="profile-bio"
          maxLength={2000}
          name="bio"
          rows={5}
          defaultValue={profile.bio}
        />
      </div>
      {state.error ? <p className="text-sm font-medium text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="text-sm font-medium text-[#31513b]" role="status">{state.message}</p> : null}
      <button
        className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d3c2a] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
