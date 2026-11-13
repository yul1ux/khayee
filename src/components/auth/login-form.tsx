"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {nextPath ? <input name="nextPath" type="hidden" value={nextPath} /> : null}
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-[#29382d]"
          htmlFor="login-email"
        >
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="login-email"
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-[#29382d]"
          htmlFor="login-password"
        >
          Password
        </label>
        <input
          autoComplete="current-password"
          className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
          id="login-password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p aria-live="polite" className="text-sm font-medium text-red-800">
          {state.error}
        </p>
      ) : null}
      <button
        className="w-full bg-[#294a35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d3c2a] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-[#73776e]">
        New to Khayee?{" "}
        <Link
          className="font-semibold underline underline-offset-4"
          href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
