"use client";

import { motion, type Variants } from "framer-motion";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import type { AdminDashboardData } from "@/lib/admin-dashboard";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

const funnelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: 0.2 + i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] } }),
};

export function OverviewPanel({ data, onOpenReview }: { data: AdminDashboardData; onOpenReview?: () => void }) {
  const { stats } = data;
  const alarmed = stats.oldestHours > 48;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{
          opacity: 1,
          scale: 1,
          boxShadow: alarmed ? ["0 0 0 0 rgba(138,74,38,0)", "0 0 0 6px rgba(138,74,38,0.06)", "0 0 0 0 rgba(138,74,38,0)"] : "none",
        }}
        transition={{ boxShadow: { duration: 2.5, repeat: alarmed ? Infinity : 0, ease: "easeInOut" }, default: { duration: 0.4 } }}
        className={`flex items-center justify-between rounded-sm2 border px-4 py-3 text-sm font-medium ${
          alarmed ? "border-cognac-deep/30 bg-cognac-deep/10 text-cognac-deep" : "border-[#3f6b4a]/25 bg-[#3f6b4a]/5 text-[#3f6b4a]"
        }`}
      >
        <span>
          Oldest unreviewed submission: <strong>{stats.oldestLabel ? `${stats.oldestHours} hours` : "none pending"}</strong>
          {stats.oldestLabel && ` — ${stats.oldestLabel}`}
        </span>
        <span className="text-xs opacity-80">Target under 48</span>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile index={0} label="Awaiting review" value={stats.pendingCount} onClick={onOpenReview} />
        <Tile index={1} label="Active ambassadors" value={stats.activeCount} />
        <Tile index={2} label="Invited / Suspended" value={stats.invitedCount} suffix={` / ${stats.suspendedCount}`} stringValue />
        <Tile index={3} label="Accept rate, 30d" value={stats.acceptRate ?? "N/A"} suffix={stats.acceptRate !== null ? "%" : undefined} stringValue={stats.acceptRate === null} />
        <Tile index={4} label="At risk" value={stats.atRisk} tone={stats.atRisk > 0 ? "warn" : undefined} />
      </div>

      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show" className="card p-5">
        <p className="eyebrow mb-4 !text-[0.6rem]">This week&apos;s funnel · week {data.cohort.week}</p>
        <div className="grid grid-cols-4 gap-3 text-center">
          <Funnel index={0} label="Cells open" value={stats.funnel.opened} />
          <Funnel index={1} label="Drafted" value={stats.funnel.drafted} />
          <Funnel index={2} label="Submitted" value={stats.funnel.submitted} />
          <Funnel index={3} label="Reviewed" value={stats.funnel.reviewed} />
        </div>
      </motion.div>
    </div>
  );
}

function Tile({ index, label, value, suffix, tone, onClick, stringValue }: { index: number; label: string; value: number | string; suffix?: string; tone?: "warn"; onClick?: () => void; stringValue?: boolean }) {
  const El = onClick ? motion.button : motion.div;
  return (
    <El
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      whileHover={onClick ? { y: -3, boxShadow: "0 10px 28px -14px rgba(26,23,18,.22)" } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`card flex flex-col gap-1 p-4 text-left ${onClick ? "cursor-pointer" : ""}`}
    >
      <p className="eyebrow !text-[0.6rem]">{label}</p>
      <p className={`font-display text-2xl ${tone === "warn" ? "text-cognac-deep" : "text-ink"}`}>
        {stringValue ? <span>{value}</span> : <AnimatedNumber value={value as number} />}
        {suffix}
      </p>
    </El>
  );
}

function Funnel({ index, label, value }: { index: number; label: string; value: number }) {
  return (
    <motion.div
      custom={index}
      variants={funnelVariants}
      initial="hidden"
      animate="show"
      className="rounded-sm2 border border-line bg-canvas-2/40 py-4"
    >
      <p className="font-display text-2xl">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-[0.65rem] uppercase tracking-wider text-ink-45">{label}</p>
    </motion.div>
  );
}
