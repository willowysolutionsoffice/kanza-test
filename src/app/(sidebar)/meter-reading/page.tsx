export const dynamic = "force-dynamic";
import MeterTabManagement from "@/components/meter-tab-management/reading-management";
import { headers } from "next/headers";
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MeterReadingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  const session = await auth.api.getSession({
    headers: hdrs,
  });

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    (session.user.role ?? "").toLowerCase() === "admin" ||
    (session.user.role ?? "").toLowerCase() === "gm";

  const isGm = (session.user.role ?? "").toLowerCase() === "gm";

  const userBranchId =
    typeof session.user.branch === "string" ? session.user.branch : undefined;

  const cookie = hdrs.get("cookie") ?? "";

  // ⬇️ now use params instead of searchParams
  const page = typeof params.page === "string" ? parseInt(params.page) : 1;

  const branchesRes = await fetch(`${proto}://${host}/api/branch`, {
    cache: "no-store",
    headers: { cookie },
  });

  const { data: allBranches } = await branchesRes.json();

  const visibleBranches = isAdmin
    ? allBranches
    : allBranches.filter((b: { id: string }) => b.id === (userBranchId ?? ""));

  const branchFromQuery =
    typeof params.branchId === "string" ? params.branchId : undefined;

  const activeBranchId =
    branchFromQuery ||
    (!isAdmin ? userBranchId : undefined) ||
    visibleBranches[0]?.id;

  const meterReadingRes = await fetch(`${proto}://${host}/api/meterreadings`, {
    cache: "no-store",
    headers: { cookie },
  });

  let salesUrl = `${proto}://${host}/api/sales?page=${page}&limit=15`;
  if (activeBranchId) salesUrl += `&branchId=${activeBranchId}`;

  const salesRes = await fetch(salesUrl, {
    cache: "no-store",
    headers: { cookie },
  });

  const { withDifference } = await meterReadingRes.json();
  const { sales, pagination } = await salesRes.json();

  return (
    <div className="flex flex-1 flex-col">
      <MeterTabManagement
        meterReading={withDifference}
        oil={[]}
        sales={sales}
        branches={visibleBranches}
        userRole={session.user.role || undefined}
        canEdit={session.user.canEdit || false}
        isGm={isGm}
        initialBranchId={activeBranchId}
        salesPagination={pagination}
        currentPage={page}
      />
    </div>
  );
}

