"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type SignupState } from "@/app/signup/actions";

const initialState: SignupState = {};

export function SignupForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} aria-label="Create account" className="mt-8 space-y-5">
      {nextPath ? <input name="nextPath" type="hidden" value={nextPath} /> : null}
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="signup-email">
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="signup-email"
          maxLength={320}
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="signup-password">
          Password
        </label>
        <input
          autoComplete="new-password"
          className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="signup-password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="mt-2 text-xs text-[#73776e]">Use at least 8 characters.</p>
      </div>
      {state.error ? (
        <p aria-live="polite" className="text-sm font-medium text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="border border-[#cbd6c0] bg-[#f0f3eb] p-3 text-sm leading-6 text-[#31513b]" role="status">
          {state.message}{" "}
          <Link
            className="font-semibold underline underline-offset-4"
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          >
            Sign in
          </Link>
        </p>
      ) : null}
      <button
        className="w-full bg-[#294a35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d3c2a] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
