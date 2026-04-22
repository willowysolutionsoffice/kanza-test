export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { PaymentReportsWithBranchTabs } from "@/components/reports/payment-reports-with-branch-tabs";

export default async function PaymentHistoryPage({
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

  // Fetch 20 payments per branch
  const paymentsByBranchData = await Promise.all(
    visibleBranches.map(async (branch: { id: string; name: string }) => {
      const paymentHistoryRes = await fetch(
        `${proto}://${host}/api/payments/history?filter=${filter}&from=${from?.toISOString()}&to=${to?.toISOString()}&page=${page}&limit=20&branchId=${branch.id}`,
        {
          cache: "no-store",
          headers: { cookie },
        }
      );
      
      const { paymentHistory = [], pagination: branchPagination } = await paymentHistoryRes.json();
      
      // Remove duplicates by using a Set of payment IDs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniquePayments = paymentHistory.filter((payment: any, index: number, self: any[]) => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        index === self.findIndex((p: any) => p.id === payment.id)
      );
      
      return {
        branchId: branch.id,
        branchName: branch.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerPayments: uniquePayments.filter((p: any) => p.customerId && !p.supplierId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supplierPayments: uniquePayments.filter((p: any) => p.supplierId && !p.customerId),
        pagination: branchPagination
      };
    })
  );

  // Extract payments and pagination (use first branch's pagination for shared pagination controls)
  const paymentsByBranch = paymentsByBranchData.map(({ pagination, ...rest }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = pagination; // Extract pagination but don't use it in the map
    return rest;
  });
  const pagination = paymentsByBranchData[0]?.pagination;

  return (
    <div className="flex flex-1 flex-col">
      <PaymentReportsWithBranchTabs 
        branches={visibleBranches} 
        paymentsByBranch={paymentsByBranch}
        filter={filter}
        from={from}
        to={to}
        pagination={pagination}
        currentPage={page}
      />
    </div>
  );
}
