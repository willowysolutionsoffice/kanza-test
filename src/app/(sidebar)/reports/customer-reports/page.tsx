export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { CustomerReportsWithBranchTabs } from "@/components/reports/customer-reports-with-branch-tabs";

export default async function CustomerReportPage() {
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

  // Fetch all customers per branch (no pagination limit)
  const customersByBranch = await Promise.all(
    visibleBranches.map(async (branch: { id: string; name: string }) => {
      const customersRes = await fetch(
        `${proto}://${host}/api/customers?branchId=${branch.id}&limit=10000`,
        {
          cache: "no-store",
          headers: { cookie },
        }
      );
      
      const { data: customers = [] } = await customersRes.json();
      
      return {
        branchId: branch.id,
        branchName: branch.name,
        customers: customers || []
      };
    })
  );

  return (
    <div className="flex flex-1 flex-col">
      <CustomerReportsWithBranchTabs branches={visibleBranches} customersByBranch={customersByBranch} />
    </div>
  );
}
