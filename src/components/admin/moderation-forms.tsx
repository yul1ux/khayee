"use client";

import { useActionState } from "react";
import {
  resolveReport,
  reviewOrganizerApplication,
  reviewTrip,
  type AdminActionState,
} from "@/app/admin/actions";

function ActionFeedback({ state }: { state: AdminActionState }) {
  return (
    <>
      {state.error ? <p className="text-sm font-medium text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="text-sm font-medium text-[#31513b]" role="status">{state.message}</p> : null}
    </>
  );
}

export function OrganizerReviewForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(reviewOrganizerApplication, {});
  return (
    <form action={action} className="mt-5 space-y-3 border-t border-[#e5e3db] pt-4">
      <input name="profileId" type="hidden" value={profileId} />
      <label className="block text-sm font-semibold text-[#29382d]">
        Rejection reason
        <textarea className="mt-2 min-h-20 w-full border border-[#d9d8cf] bg-white p-3 text-sm" maxLength={2000} name="reason" rows={3} />
      </label>
      <p className="text-xs text-[#73776e]">A reason is required to reject the application; leave it blank to approve.</p>
      <ActionFeedback state={state} />
      <div className="flex flex-wrap gap-3">
        <button className="bg-[#294a35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} name="decision" type="submit" value="verified">
          {pending ? "Saving…" : "Approve organizer"}
        </button>
        <button className="border border-[#8a4034] px-4 py-2.5 text-sm font-semibold text-[#8a4034] disabled:opacity-60" disabled={pending} name="decision" type="submit" value="rejected">
          Reject application
        </button>
      </div>
    </form>
  );
}

export function TripReviewForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(reviewTrip, {});
  return (
    <form action={action} className="mt-5 space-y-3 border-t border-[#e5e3db] pt-4">
      <input name="tripId" type="hidden" value={tripId} />
      <label className="block text-sm font-semibold text-[#29382d]">
        Rejection reason
        <textarea className="mt-2 min-h-20 w-full border border-[#d9d8cf] bg-white p-3 text-sm" maxLength={2000} name="reason" rows={3} />
      </label>
      <p className="text-xs text-[#73776e]">A reason is required to reject the trip; leave it blank to approve.</p>
      <ActionFeedback state={state} />
      <div className="flex flex-wrap gap-3">
        <button className="bg-[#294a35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} name="decision" type="submit" value="approve">
          {pending ? "Saving…" : "Approve and publish"}
        </button>
        <button className="border border-[#8a4034] px-4 py-2.5 text-sm font-semibold text-[#8a4034] disabled:opacity-60" disabled={pending} name="decision" type="submit" value="reject">
          Reject trip
        </button>
      </div>
    </form>
  );
}

export function ReportResolutionForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(resolveReport, {});
  return (
    <form action={action} className="mt-5 space-y-3 border-t border-[#e5e3db] pt-4">
      <input name="reportId" type="hidden" value={reportId} />
      <label className="block text-sm font-semibold text-[#29382d]">
        Resolution notes <span className="font-normal text-[#73776e]">(optional)</span>
        <textarea className="mt-2 min-h-20 w-full border border-[#d9d8cf] bg-white p-3 text-sm" maxLength={5000} name="notes" rows={3} />
      </label>
      <ActionFeedback state={state} />
      <div className="flex flex-wrap gap-3">
        <button className="bg-[#294a35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} name="decision" type="submit" value="reviewed">
          Mark reviewed
        </button>
        <button className="border border-[#8a4034] px-4 py-2.5 text-sm font-semibold text-[#8a4034] disabled:opacity-60" disabled={pending} name="decision" type="submit" value="dismissed">
          Dismiss report
        </button>
      </div>
    </form>
  );
}
