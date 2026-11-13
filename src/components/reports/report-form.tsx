"use client";

import { useActionState } from "react";
import {
  submitReport,
  type ReportActionState,
} from "@/app/reports/actions";

type Props = {
  targetType: "trip" | "organizer" | "customer";
  targetId: string;
  requestId?: string;
  label: string;
};

const categories = [
  { value: "safety", label: "Safety concern" },
  { value: "misleading_information", label: "Misleading information" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

export function ReportForm({ targetType, targetId, requestId, label }: Props) {
  const [state, action, pending] = useActionState(
    submitReport,
    {} satisfies ReportActionState,
  );
  const formId = `report-${targetType}-${targetId}${requestId ? `-${requestId}` : ""}`;

  return (
    <details className="mt-5 border-t border-[#e5e3db] pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#8a4034] underline underline-offset-4">
        {label}
      </summary>
      <form action={action} className="mt-4 space-y-4">
        <input name="targetType" type="hidden" value={targetType} />
        <input name="targetId" type="hidden" value={targetId} />
        {requestId ? <input name="requestId" type="hidden" value={requestId} /> : null}
        <label className="block space-y-2 text-sm font-semibold text-[#29382d]" htmlFor={`${formId}-category`}>
          Report reason
          <select
            className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm"
            id={`${formId}-category`}
            name="category"
            required
            defaultValue=""
          >
            <option disabled value="">Choose a reason</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-semibold text-[#29382d]" htmlFor={`${formId}-details`}>
          Additional details <span className="font-normal text-[#73776e]">(optional)</span>
          <textarea
            className="min-h-24 w-full border border-[#d9d8cf] bg-white p-3 text-sm"
            id={`${formId}-details`}
            maxLength={5000}
            name="details"
            rows={4}
          />
        </label>
        {state.error ? <p className="text-sm text-red-800" role="alert">{state.error}</p> : null}
        {state.message ? <p className="text-sm text-[#31513b]" role="status">{state.message}</p> : null}
        <button
          className="border border-[#8a4034] px-4 py-2 text-sm font-semibold text-[#8a4034] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Submitting…" : "Submit private report"}
        </button>
        <p className="text-xs leading-5 text-[#73776e]">
          Reports are visible to you and authorized moderators only. Do not include passwords or unnecessary personal information.
        </p>
      </form>
    </details>
  );
}
