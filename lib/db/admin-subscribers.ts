import "server-only";
import type {
  AdminSubscriberRow,
  SubscriberKpi,
  SubscriberSource,
} from "@/lib/admin/subscriber";
import { type AdminRead, loadAdmin } from "./admin-read";
import { createServerClient } from "./server";

export type AdminSubscribersData = {
  rows: AdminSubscriberRow[];
  kpis: SubscriberKpi[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const EMPTY: AdminSubscribersData = {
  rows: [],
  kpis: [
    { label: "Total subscribers", value: "0", accent: "#71182B" },
    { label: "Joined this week", value: "0", accent: "#15692F" },
    { label: "Top source", value: "—", accent: "#B7791F" },
  ],
};

/**
 * Admin mailing list (TASKS 3.9). Reads every `subscriber` row through the
 * admin's cookie session (0017 `subscriber_admin_read` RLS policy), newest
 * first, and derives the three prototype KPI cards. Writes go through the
 * `subscribe_email` / `admin_remove_subscriber` RPCs (0017). Degrades to an
 * empty list on error so the console chrome still renders.
 */
export async function listAdminSubscribers(): Promise<
  AdminRead<AdminSubscribersData>
> {
  return loadAdmin("subscribers", async () => {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("subscriber")
      .select("id, email, source, created_at")
      .order("created_at", { ascending: false });

    const rows: AdminSubscriberRow[] = (data ?? []).map((s) => ({
      id: s.id,
      email: s.email,
      source: s.source as SubscriberSource,
      createdAt: s.created_at,
    }));

    return { rows, kpis: buildKpis(rows) };
  }, EMPTY);
}

/** Total, joined-this-week, and the leading source with its count. */
function buildKpis(rows: AdminSubscriberRow[]): SubscriberKpi[] {
  const cutoff = Date.now() - WEEK_MS;
  const thisWeek = rows.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;

  const bySource = new Map<string, number>();
  for (const row of rows) {
    bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);
  }
  const top = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  const topLabel = top ? `${labelForSource(top[0])} · ${top[1]}` : "—";

  return [
    { label: "Total subscribers", value: String(rows.length), accent: "#71182B" },
    { label: "Joined this week", value: String(thisWeek), accent: "#15692F" },
    { label: "Top source", value: topLabel, accent: "#B7791F" },
  ];
}

function labelForSource(source: string): string {
  return source.charAt(0).toUpperCase() + source.slice(1);
}
