export const dynamic = "force-dynamic";
import { headers, cookies } from "next/headers";
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CreditsWithBranchTabs } from "@/components/credits/credits-with-branch-tabs";

export default async function CreditsPage() {
const hdrs = await headers();
const host = hdrs.get("host");
const proto = hdrs.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const cookie = (await cookies()).toString();

// Get session to check user role and branch
const session = await auth.api.getSession({
  headers: hdrs,
});

if (!session) {
  redirect('/login');
}

const isAdmin = (session.user.role ?? '').toLowerCase() === 'admin' || (session.user.role ?? '').toLowerCase() === 'gm';
const isGm = (session.user.role ?? '').toLowerCase() === 'gm';
const userBranchId = typeof session.user.branch === 'string' ? session.user.branch : undefined;

// Fetch credits and branches
const [creditsRes, branchesRes] = await Promise.all([
  fetch(`${proto}://${host}/api/credits`, {
    cache: "no-store",
    headers: { cookie },
  }),
  fetch(`${proto}://${host}/api/branch`, {
    cache: "no-store",
    headers: { cookie },
  })
]);

const { data: credits } = await creditsRes.json();
const { data: allBranches } = await branchesRes.json();

// Filter branches based on user role
const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

// Group credits by visible branches only
const creditsByBranch = visibleBranches.map((branch: { id: string; name: string }) => ({
  branchId: branch.id,
  branchName: branch.name,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  credits: credits.filter((credit: any) => credit.branchId === branch.id)
}));

  return (
    <div className="flex flex-1 flex-col">
      <CreditsWithBranchTabs 
        branches={visibleBranches} 
        creditsByBranch={creditsByBranch} 
        isGm={isGm} 
        userRole={session.user.role || undefined} 
        canEdit={session.user.canEdit || false}
        userBranchId={userBranchId} 
      />
    </div>
  );
}
