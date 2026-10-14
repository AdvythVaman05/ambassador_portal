"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Misc";
import { Pill } from "@/components/ui/Pill";
import { AddPersonForm } from "@/components/admin/AddPersonForm";
import { tierLabel } from "@/lib/signal";
import type { AdminDashboardData } from "@/lib/admin-dashboard";

function relativeFromISO(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AmbassadorsPanel({
  ambassadors,
  onOpen,
  canManage,
  cohorts,
  campuses,
}: {
  ambassadors: AdminDashboardData["ambassadors"];
  onOpen: (id: string) => void;
  canManage: boolean;
  cohorts: AdminDashboardData["cohorts"];
  campuses: AdminDashboardData["campuses"];
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="px-6 py-5">
      {canManage && (
        <div className="mb-4 flex flex-col gap-3 rounded-sm2 border border-line bg-paper p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="eyebrow !text-[0.6rem]">People</p>
              <p className="mt-1 text-xs text-ink-45">
                Add an ambassador or a reviewer. They get a sign-in link, not a password.
              </p>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setAdding((v) => !v)}>
              {adding ? "Close" : "Add person"}
            </button>
          </div>
          {adding && <AddPersonForm cohorts={cohorts} campuses={campuses} />}
        </div>
      )}
      <div className="overflow-hidden rounded-sm2 border border-line bg-paper">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas-2 text-left text-[0.62rem] uppercase tracking-wider text-brass-deep">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Campus</th>
              <th className="px-4 py-2 font-medium">Tier</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Signal</th>
              <th className="px-4 py-2 font-medium text-right">Accepted/submitted</th>
              <th className="px-4 py-2 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {ambassadors.map((u) => (
              <tr
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(u.id);
                  }
                }}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas-2/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cognac focus-visible:-outline-offset-2"
              >
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={u.name} color={u.avatarColor} size={24} />
                    <span className="font-medium text-ink">{u.name}</span>
                    {u.atRiskReason && <span className="rounded-full bg-cognac/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-cognac-deep">at risk: {u.atRiskReason}</span>}
                  </span>
                </td>
                <td className="px-4 py-2 text-ink-60">{u.campusName}</td>
                <td className="px-4 py-2 text-ink-60">{tierLabel(u.tier)}</td>
                <td className="px-4 py-2">
                  <Pill status={u.status} />
                </td>
                <td className="px-4 py-2 text-right font-medium text-ink">{u.signalTotal}</td>
                <td className="px-4 py-2 text-right text-ink-60">
                  {u.acceptedCount}/{u.submittedCount}
                </td>
                <td className="px-4 py-2 text-ink-45">{relativeFromISO(u.lastActiveISO)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
