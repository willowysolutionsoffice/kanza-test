export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { SalesReportsWithBranchTabs } from "@/components/reports/sales-reports-with-branch-tabs";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  
  // Auto-select current month if no date range is provided
  let from: Date | undefined;
  let to: Date | undefined;
  let filter: string;
  
  if (params.from && params.to) {
    from = new Date(params.from as string);
    to = new Date(params.to as string);
    filter = "custom";
  } else {
    // Default to current month
    const now = new Date();
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    filter = "custom";
  }
  
  const page = typeof params.page === "string" ? parseInt(params.page) : 1;

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
  
  const { data: allBranches = [] } = await branchesRes.json();

  // Filter branches based on user role
  const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

  // Fetch 20 sales per branch
  const salesByBranchData = await Promise.all(
    visibleBranches.map(async (branch: { id: string; name: string }) => {
      const salesRes = await fetch(
        `${proto}://${host}/api/sales?filter=${filter}&from=${from?.toISOString()}&to=${to?.toISOString()}&page=${page}&limit=20&branchId=${branch.id}`,
        {
          cache: "no-store",
          headers: { cookie },
        }
      );
      
      const { sales = [], pagination: branchPagination } = await salesRes.json();
      
      return {
        branchId: branch.id,
        branchName: branch.name,
        sales: sales || [],
        pagination: branchPagination
      };
    })
  );

  // Extract sales and pagination (use first branch's pagination for shared pagination controls)
  const salesByBranch = salesByBranchData.map(({ pagination, ...rest }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = pagination; // Extract pagination but don't use it in the map
    return rest;
  });
  const pagination = salesByBranchData[0]?.pagination;

  return (
    <div className="flex flex-1 flex-col">
      <SalesReportsWithBranchTabs 
        branches={visibleBranches} 
        salesByBranch={salesByBranch}
        filter={filter}
        from={from}
        to={to}
        pagination={pagination}
        currentPage={page}
      />
    </div>
  );
}
