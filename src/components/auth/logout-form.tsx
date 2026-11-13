"use client";

import { useActionState } from "react";
import { signOut, type LogoutState } from "@/app/logout/actions";

const initialState: LogoutState = {};

export function LogoutForm() {
  const [state, formAction, pending] = useActionState(signOut, initialState);

  return (
    <form action={formAction}>
      <button
        className="rounded-sm border border-[#d9d8cf] px-3 py-2 text-sm font-medium text-[#51564e] transition-colors hover:border-[#294a35] hover:text-[#244734] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#68794d] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing out…" : "Log out"}
      </button>
      {state.error ? <p className="absolute right-4 mt-2 max-w-64 bg-[#fbf1ed] p-2 text-xs text-red-800 sm:right-8" role="alert">{state.error}</p> : null}
    </form>
  );
}
