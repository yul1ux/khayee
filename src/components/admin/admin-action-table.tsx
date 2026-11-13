export type AdminActionRow = {
  id: string;
  action: string;
  target_kind: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
};

export function AdminActionTable({ actions }: { actions: AdminActionRow[] }) {
  if (actions.length === 0) {
    return <p className="mt-5 border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">No administrative actions have been recorded.</p>;
  }
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#d9d8cf] text-[#73776e]">
            <th className="py-3 pr-4 font-medium">Action</th>
            <th className="py-3 pr-4 font-medium">Target</th>
            <th className="py-3 pr-4 font-medium">Actor ID</th>
            <th className="py-3 pr-4 font-medium">Details</th>
            <th className="py-3 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr className="border-b border-[#e5e3db] align-top" key={action.id}>
              <td className="py-3 pr-4 capitalize">{action.action.replaceAll("_", " ")}</td>
              <td className="py-3 pr-4">{action.target_kind} · <span className="font-mono text-xs">{action.target_id}</span></td>
              <td className="py-3 pr-4 font-mono text-xs">{action.actor_id ?? "Deleted account"}</td>
              <td className="max-w-sm whitespace-pre-wrap break-words py-3 pr-4 text-xs text-[#51564e]">{JSON.stringify(action.details)}</td>
              <td className="py-3">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yangon" }).format(new Date(action.created_at))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
