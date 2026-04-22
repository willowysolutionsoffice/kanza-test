export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { StockReportsWithBranchTabs } from "@/components/reports/stock-reports-with-branch-tabs";

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : "all";
  const from = params.from ? new Date(params.from as string) : undefined;
  const to = params.to ? new Date(params.to as string) : undefined;
  const productName = typeof params.productName === "string" ? params.productName : undefined;
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

  // Fetch stock reports for each branch separately
  const stockReportsByBranch = await Promise.all(
    visibleBranches.map(async (branch: { id: string; name: string }) => {
      const stockReportRes = await fetch(
        `${proto}://${host}/api/stocks/report?filter=${filter}&from=${from?.toISOString()}&to=${to?.toISOString()}&page=${page}&limit=15&branchId=${branch.id}${productName ? `&productName=${encodeURIComponent(productName)}` : ''}`,
        {
          cache: "no-store",
          headers: { cookie },
        }
      );
      
      const { data: stockReport = [], pagination } = await stockReportRes.json();
      
      return {
        branchId: branch.id,
        branchName: branch.name,
        stockReport: stockReport,
        pagination: pagination,
      };
    })
  );
  
  // Use pagination from first branch (all branches should have same pagination)
  const pagination = stockReportsByBranch[0]?.pagination;
  
  return (
    <div className="flex flex-1 flex-col">
      <StockReportsWithBranchTabs 
        branches={visibleBranches} 
        stockReportsByBranch={stockReportsByBranch}
        filter={filter}
        from={from}
        to={to}
        productName={productName}
        pagination={pagination}
        currentPage={page}
      />
    </div>
  );
}

