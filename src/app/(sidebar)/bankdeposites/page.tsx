export const dynamic = "force-dynamic";

import { headers, cookies } from "next/headers";
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BankDepositsWithBranchTabs } from "@/components/banks-deposite/bank-deposits-with-branch-tabs";
import { BankDeposite } from "@/types/bank-deposite";

export default async function BankDepositePage() {
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

// Fetch bank deposits and branches
const bankDepositsUrl = new URL(`${proto}://${host}/api/bank-deposite`);
bankDepositsUrl.searchParams.set("limit", "1000");

const [bankDepositsRes, branchesRes] = await Promise.all([
  fetch(bankDepositsUrl.toString(), {
    cache: "no-store",
    headers: { cookie },
  }),
  fetch(`${proto}://${host}/api/branch`, {
    cache: "no-store",
    headers: { cookie },
  })
]);

const { bankDeposite }: { bankDeposite: BankDeposite[] } = await bankDepositsRes.json();
const { data: allBranches } = await branchesRes.json();

// Filter branches based on user role
const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

// Group bank deposits by visible branches only and sort by newest first
const depositsByBranch = visibleBranches.map((branch: { id: string; name: string }) => {
  const branchDeposits = bankDeposite
    .filter((deposit) => deposit.branchId === branch.id)
    .sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  return {
    branchId: branch.id,
    branchName: branch.name,
    deposits: branchDeposits,
  };
});

  return (
    <div className="flex flex-1 flex-col">
      <BankDepositsWithBranchTabs 
        branches={visibleBranches} 
        depositsByBranch={depositsByBranch}
        userRole={session.user.role || undefined}
        canEdit={session.user.canEdit || false}
        userBranchId={userBranchId}
        isGm={isGm}
      />
    </div>
  );
}
