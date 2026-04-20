"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MeterReadingTable } from "../meter-reading/meter-reading-table";
import { MeterReading } from "@/types/meter-reading";
import { useState, useEffect, useCallback } from "react";
import { MeterReadingFormSheet } from "../meter-reading/meter-reading-form";
import { oilColumns } from "../oil/oil-column";
import { OilTable } from "../oil/oil-table";
import { OilFormModal } from "../oil/oil-form";
import { Sales } from "@/types/sales";
import { ReportTable } from "../export-report/report-table";
import { useReportColumns } from "../export-report/report-column";
import { Oil } from "@/types/oils";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

// Wrapper component to use the hook
function ReportTableWithDynamicColumns({
  data: initialData,
  userRole,
  branchId,
  pagination: initialPagination,
  currentPage: initialPage,
}: {
  data: Sales[];
  userRole?: string;
  branchId: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
  currentPage?: number;
}) {
  const [data, setData] = useState<Sales[]>(initialData || []);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(initialPagination || {
    currentPage: initialPage || 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 15
  });

  const columns = useReportColumns(userRole, branchId);

  // Fetch data from API with pagination
  const fetchData = useCallback(async (page: number, branchIdParam?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      
      if (branchIdParam) {
        params.append('branchId', branchIdParam);
      }

      const response = await fetch(`/api/sales?${params.toString()}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result.sales || []);
        setPagination(result.pagination || {
          currentPage: page,
          totalPages: 1,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit: 15
        });
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when branchId changes or on initial load
  useEffect(() => {
    if (branchId) {
      fetchData(1, branchId);
    } else if (initialData && initialData.length > 0) {
      setData(initialData);
      if (initialPagination) {
        setPagination(initialPagination);
      }
    }
  }, [branchId, fetchData, initialData, initialPagination]);

  // Handle pagination
  const handlePageChange = useCallback((newPage: number) => {
    if (branchId) {
      fetchData(newPage, branchId);
    }
  }, [branchId, fetchData]);

  // Listen for report deletion to refresh data
  useEffect(() => {
    const handleReportDeleted = () => {
      fetchData(pagination.currentPage, branchId);
    };

    window.addEventListener('report-deleted', handleReportDeleted);
    return () => {
      window.removeEventListener('report-deleted', handleReportDeleted);
    };
  }, [fetchData, branchId, pagination.currentPage]);
  
  return (
    <ReportTable 
      data={data} 
      columns={columns}
      pagination={pagination}
      currentPage={pagination.currentPage}
      loading={loading}
      onPageChange={handlePageChange}
    />
  );
}

type MeterTabManagementProps = {
  meterReading: MeterReading[];
  oil: Oil[];
  sales: Sales[];
  branches: { id: string; name: string }[];
  userRole?: string;
  isGm?: boolean;
  initialBranchId?: string;
  salesPagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
  currentPage: number;
};

export default function MeterTabManagement({
  meterReading,
  oil,
  sales,
  branches,
  userRole,
  isGm,
  initialBranchId,
  salesPagination,
  currentPage,
}: MeterTabManagementProps) {
  const [activeTab, setActiveTab] = useState("meter-reading");
  const [activeBranch, setActiveBranch] = useState(
    initialBranchId || branches[0]?.id || ""
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep activeBranch in sync with server-selected branchId when URL changes
  useEffect(() => {
    const branchParam = searchParams.get("branchId");
    if (branchParam && branchParam !== activeBranch) {
      setActiveBranch(branchParam);
    }
  }, [searchParams, activeBranch]);

  // Check for tab parameter in URL and set active tab
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["meter-reading", "other-Products", "report"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleBranchChange = (branchId: string) => {
    setActiveBranch(branchId);

    // Preserve existing search params, but update branchId and reset page to 1
    const current = new URLSearchParams(searchParams.toString());
    current.set("branchId", branchId);
    current.set("page", "1");
    router.push(`?${current.toString()}`);
  };

    // Group data by branch
    const dataByBranch = branches.map((branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      meterReading: meterReading.filter((reading: MeterReading) => reading.branchId === branch.id),
      oil: oil.filter((o: Oil) => o.branchId === branch.id),
      sales: sales.filter((sale: Sales) => sale.branchId === branch.id)
    }));

    const oilColumnsForTable = isGm 
        ? oilColumns.filter(column => column.id !== "actions")
        : oilColumns;

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meter Reading</h1>
            <p className="text-muted-foreground">Track daily meter readings for all nozzles by branch</p>
          </div>
          {
            !isGm && (
              <div className="flex gap-2">
            <Button 
              onClick={() => router.push('/meter-reading/wizard')}>
              <Plus className="w-4 h-4 mr-2" />
              All Records
            </Button>
            {activeTab === "meter-reading" ? <MeterReadingFormSheet key={activeBranch} branchId={activeBranch} userRole={userRole} userBranchId={branches.find(b => b.id === activeBranch)?.id} /> : activeTab === "other-Products" ? <OilFormModal key={activeBranch} branchId={activeBranch} userRole={userRole} userBranchId={branches.find(b => b.id === activeBranch)?.id} /> : ""}
          </div>
            )
          }
        </div>

        {/* Branch Tabs */}
        <Tabs value={activeBranch} onValueChange={handleBranchChange} className="w-full">
          <TabsList className="mb-4 flex flex-wrap gap-2 w-full">
            {branches.map((branch) => (
              <TabsTrigger key={branch.id} value={branch.id} className="min-w-[120px] flex-1 data-[state=active]:bg-secondary data-[state=active]:text-white">
                {branch.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {dataByBranch.map(({ branchId, branchName, meterReading: branchMeterReading, oil: branchOil, sales: branchSales }) => (
            <TabsContent key={branchId} value={branchId}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{branchName} Meter Reading</h2>
                <p className="text-sm text-muted-foreground">
                  {branchMeterReading.length} meter reading{branchMeterReading.length !== 1 ? 's' : ''} in this branch
                </p>
              </div>

              {/* Content Tabs for each branch */}
              <Tabs
                value={activeTab}
                className="w-full"
                onValueChange={(value) => setActiveTab(value)}
              >
                <TabsList>
                  <TabsTrigger className="min-w-[120px] flex-1 data-[state=active]:bg-secondary data-[state=active]:text-white" value="meter-reading">Meter Reading</TabsTrigger>
                  <TabsTrigger className="min-w-[120px] flex-1 data-[state=active]:bg-secondary data-[state=active]:text-white" value="other-Products">Other Products</TabsTrigger>
                  <TabsTrigger className="min-w-[120px] flex-1 data-[state=active]:bg-secondary data-[state=active]:text-white" value="report">Report</TabsTrigger>
                </TabsList>

                <TabsContent value="meter-reading">
                  <MeterReadingTable data={branchMeterReading} userRole={userRole} branchId={branchId}/>
                </TabsContent>

                <TabsContent value="other-Products">
                  <OilTable data={branchOil} columns={oilColumnsForTable} branchId={branchId}/>
                </TabsContent>

                <TabsContent value="report">
                  <ReportTableWithDynamicColumns 
                    data={branchSales} 
                    userRole={userRole}
                    branchId={branchId}
                    pagination={salesPagination}
                    currentPage={currentPage}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
