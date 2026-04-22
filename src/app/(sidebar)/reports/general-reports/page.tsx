export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { GeneralReportsWithBranchTabs } from "@/components/reports/general-reports-with-branch-tabs";

export default async function GeneralReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : "all";
  const from = params.from ? new Date(params.from as string) : undefined;
  const to = params.to ? new Date(params.to as string) : undefined;

  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  
  // Get session to check user role and branch
  const session = await auth.api.getSession({
    headers: hdrs,
  });

  if (!session) {
    redirect('/login');
  }

  const isAdmin = ((session.user.role ?? '').toLowerCase() === 'admin') || ((session.user.role ?? '').toLowerCase() === 'gm');
  const userBranchId = typeof session.user.branch === 'string' ? session.user.branch : undefined;
  
  // Forward cookies
  const cookie = hdrs.get("cookie") ?? "";
  
  // Fetch branches first
  const branchesRes = await fetch(`${proto}://${host}/api/branch`, {
    cache: "no-store",
    headers: { cookie },
  });
  
  const { data: allBranches } = await branchesRes.json();

  // Filter branches based on user role
  const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

  // Fetch general report data for each branch
  const reportsByBranch = await Promise.all(
    visibleBranches.map(async (branch: { id: string; name: string }) => {
      const apiUrl = new URL(`${proto}://${host}/api/reports/general`);
      apiUrl.searchParams.set('filter', filter);
      apiUrl.searchParams.set('branchId', branch.id);
      if (from) {
        apiUrl.searchParams.set('from', from.toISOString());
      }
      if (to) {
        apiUrl.searchParams.set('to', to.toISOString());
      }

      const generalReportRes = await fetch(apiUrl.toString(), {
        cache: "no-store",
        headers: { cookie },
      });

      const { rows, totals } = await generalReportRes.json();

      return {
        branchId: branch.id,
        branchName: branch.name,
        rows: rows || [],
        totals: totals || {
          totalSales: 0,
          totalPurchases: 0,
          totalExpenses: 0,
          totalCustomerPayments: 0,
          totalFinal: 0,
        },
      };
    })
  );

  return (
    <div className="flex flex-1 flex-col">
      <GeneralReportsWithBranchTabs 
        branches={visibleBranches} 
        reportsByBranch={reportsByBranch}
        filter={filter}
        from={from}
        to={to}
      />
    </div>
  );
}
