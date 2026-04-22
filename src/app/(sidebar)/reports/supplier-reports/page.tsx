export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { SupplierReportsWithBranchTabs } from "@/components/reports/supplier-reports-with-branch-tabs";

export default async function SupplierReportPage() {
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
  
  // Fetch suppliers and branches in parallel
  const [suppliersRes, branchesRes] = await Promise.all([
    fetch(`${proto}://${host}/api/suppliers`, {
      cache: "no-store",
      headers: { cookie },
    }),
    fetch(`${proto}://${host}/api/branch`, {
      cache: "no-store",
      headers: { cookie },
    })
  ]);
  
  const { data: suppliers = [] } = await suppliersRes.json();
  const { data: allBranches = [] } = await branchesRes.json();

  // Filter branches based on user role
  const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

  // Group suppliers by visible branches only
  const suppliersByBranch = visibleBranches.map((branch: { id: string; name: string }) => ({
    branchId: branch.id,
    branchName: branch.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    suppliers: (suppliers || []).filter((supplier: any) => supplier.branchId === branch.id)
  }));

  return (
    <div className="flex flex-1 flex-col">
      <SupplierReportsWithBranchTabs branches={visibleBranches} suppliersByBranch={suppliersByBranch} />
    </div>
  );
}
