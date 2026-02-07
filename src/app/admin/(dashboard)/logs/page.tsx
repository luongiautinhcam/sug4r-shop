import Link from "next/link";
import {
  getAuditLogs,
  getAuditActions,
  getSecurityEvents,
  getSecurityEventTypes,
} from "@/actions/admin/logs";
import { formatDate, truncate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Logs",
};

const PAGE_SIZE = 30;

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    action?: string;
    entityType?: string;
    eventType?: string;
    severity?: string;
  }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "security" ? "security" : "audit";
  const page = Math.max(1, parseInt(params.page ?? "1"));

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { tab, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") p.set(k, v);
    }
    return `/admin/logs?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Logs
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Audit trail and security events
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        <Link
          href={buildUrl({ tab: undefined, page: "1", action: undefined, entityType: undefined, eventType: undefined, severity: undefined })}
          className={`rounded-md px-3 py-1 text-sm ${
            tab === "audit"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Audit Logs
        </Link>
        <Link
          href={buildUrl({ tab: "security", page: "1", action: undefined, entityType: undefined, eventType: undefined, severity: undefined })}
          className={`rounded-md px-3 py-1 text-sm ${
            tab === "security"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Security Events
        </Link>
      </div>

      {tab === "audit" ? (
        <AuditLogsTab
          page={page}
          action={params.action}
          entityType={params.entityType}
          buildUrl={buildUrl}
        />
      ) : (
        <SecurityEventsTab
          page={page}
          eventType={params.eventType}
          severity={params.severity}
          buildUrl={buildUrl}
        />
      )}
    </div>
  );
}

async function AuditLogsTab({
  page,
  action,
  entityType,
  buildUrl,
}: {
  page: number;
  action?: string;
  entityType?: string;
  buildUrl: (overrides: Record<string, string | undefined>) => string;
}) {
  const [{ logs, total }, actions] = await Promise.all([
    getAuditLogs({
      action,
      entityType,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getAuditActions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {/* Filters */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Action:</span>
          <Link
            href={buildUrl({ action: undefined, page: "1" })}
            className={`rounded-md px-3 py-1 text-sm ${
              !action
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {actions.map((a) => (
            <Link
              key={a}
              href={buildUrl({ action: a, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                action === a
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Time</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Admin</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Action</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Entity</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Details</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {log.adminEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-50">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {log.entityType ? `${log.entityType}` : "—"}
                    {log.entityId && (
                      <span className="ml-1 font-mono text-xs text-zinc-400">
                        {log.entityId.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {Object.keys(log.details).length > 0
                      ? truncate(JSON.stringify(log.details), 60)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} total={total} buildUrl={buildUrl} />
      )}
    </>
  );
}

async function SecurityEventsTab({
  page,
  eventType,
  severity,
  buildUrl,
}: {
  page: number;
  eventType?: string;
  severity?: string;
  buildUrl: (overrides: Record<string, string | undefined>) => string;
}) {
  const [{ events, total }, eventTypes] = await Promise.all([
    getSecurityEvents({
      eventType,
      severity,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getSecurityEventTypes(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {eventTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Type:</span>
            <Link
              href={buildUrl({ eventType: undefined, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                !eventType
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              All
            </Link>
            {eventTypes.map((t) => (
              <Link
                key={t}
                href={buildUrl({ eventType: t, page: "1" })}
                className={`rounded-md px-3 py-1 text-sm ${
                  eventType === t
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Severity:</span>
          {["all", "info", "warn", "critical"].map((s) => (
            <Link
              key={s}
              href={buildUrl({ severity: s === "all" ? undefined : s, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                (severity ?? "all") === s
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {s === "all" ? "All" : s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Time</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Type</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Severity</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">IP</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Target</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No security events found.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {formatDate(event.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-50">
                    {event.eventType}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={severityColors[event.severity] ?? ""}>
                      {event.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {event.ipAddress ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {event.targetEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {Object.keys(event.details).length > 0
                      ? truncate(JSON.stringify(event.details), 60)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} total={total} buildUrl={buildUrl} />
      )}
    </>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  buildUrl,
}: {
  page: number;
  totalPages: number;
  total: number;
  buildUrl: (overrides: Record<string, string | undefined>) => string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link href={buildUrl({ page: String(page - 1) })}>
            <Button variant="outline" size="sm">Previous</Button>
          </Link>
        )}
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Page {page} of {totalPages}
        </span>
        {page < totalPages && (
          <Link href={buildUrl({ page: String(page + 1) })}>
            <Button variant="outline" size="sm">Next</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
