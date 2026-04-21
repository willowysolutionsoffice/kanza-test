export const dynamic = "force-dynamic";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseFormDialog } from "@/components/expenses/expense-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { headers, cookies } from "next/headers";
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ExpensePage() {
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

// Fetch expenses and branches
const [expensesRes, branchesRes] = await Promise.all([
  fetch(`${proto}://${host}/api/expenses`, {
    cache: "no-store",
    headers: { cookie },
  }),
  fetch(`${proto}://${host}/api/branch`, {
    cache: "no-store",
    headers: { cookie },
  })
]);

const { data: expenses } = await expensesRes.json();
const { data: allBranches } = await branchesRes.json();

// Filter branches based on user role
const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

// Group expenses by visible branches only
const expensesByBranch = visibleBranches.map((branch: { id: string; name: string }) => ({
  branchId: branch.id,
  branchName: branch.name,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expenses: expenses.filter((expense: any) => expense.branchId === branch.id)
}));

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Expense Management</h1>
              <p className="text-muted-foreground">Manage your expenses by branch</p>
            </div>
              {!isGm && <ExpenseFormDialog userRole={session.user.role || undefined} userBranchId={userBranchId} />}
          </div>

          <Tabs defaultValue={visibleBranches[0]?.id} className="w-full">
            <TabsList className="mb-4 flex flex-wrap gap-2 w-full">
              {visibleBranches.map((branch: { id: string; name: string }) => (
                <TabsTrigger key={branch.id} value={branch.id} className="min-w-[120px] flex-1 data-[state=active]:bg-secondary data-[state=active]:text-white">
                  {branch.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {expensesByBranch.map(({ branchId, branchName, expenses }: { branchId: string; branchName: string; expenses: any[] }) => (
              <TabsContent key={branchId} value={branchId}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{branchName} Expenses</h2>
                  <p className="text-sm text-muted-foreground">
                    {expenses.length} expense{expenses.length !== 1 ? 's' : ''} in this branch
                  </p>
                </div>
                <ExpenseTable 
                  userRole={session.user.role || undefined} 
                  canEdit={session.user.canEdit || false}
                  data={expenses} 
                  branchId={branchId} 
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
