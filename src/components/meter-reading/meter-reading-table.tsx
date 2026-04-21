"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";


import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { MeterReadingTableProps } from "@/types/meter-reading";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { meterReadinColumns } from "./meter-reading-column";

export function MeterReadingTable<TValue>({
  data: initialData,
  branchId,
  userRole,
  canEdit,
}: MeterReadingTableProps<TValue> & { branchId?: string; userRole?: string; canEdit?: boolean }) {
  const columns = meterReadinColumns(userRole, canEdit);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 16
  });

  // Fetch data from API with pagination
  const fetchData = useCallback(async (page: number, searchTerm: string = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '16'
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (branchId) {
        params.append('branchId', branchId);
      }

      const response = await fetch(`/api/meterreadings?${params.toString()}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result.withDifference);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching meter readings:', error);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  // Initial data load
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setData(initialData);
    } else {
      fetchData(1);
    }
  }, [initialData, fetchData]);

  // Listen for delete event to refresh data
  useEffect(() => {
    const handleDelete = () => {
      fetchData(pagination.currentPage, globalFilter);
    };

    window.addEventListener('meter-reading-deleted', handleDelete);
    return () => window.removeEventListener('meter-reading-deleted', handleDelete);
  }, [fetchData, pagination.currentPage, globalFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (globalFilter !== "") {
        fetchData(1, globalFilter);
      } else {
        fetchData(1);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [globalFilter, fetchData]);

const table = useReactTable({
  data,
  columns,
  onSortingChange: setSorting,
  onGlobalFilterChange: setGlobalFilter,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  state: {
    sorting,
    globalFilter,
  },
  globalFilterFn: (row, columnId, filterValue) => {
    const fuelType = row.getValue("fuelType") as string;
    const date = row.getValue("date") as string;
    const filter = String(filterValue || "").toLowerCase();
    return fuelType.toLowerCase().includes(filter) || date.toLowerCase().includes(filter);
  },
});

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          {/* Left side (title + description) */}
          <div>
            <CardTitle className="font-bold">All Meter Readings</CardTitle>
            <CardDescription>
              Complete list of all meter readings
            </CardDescription>
          </div>

          {/* Right side (search box) */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Meter Readings Item..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="bg-primary text-primary-foreground font-black"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="ml-2">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* API Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {data.length} of {pagination.totalCount} records
              {pagination.totalPages > 1 && (
                <span> • Page {pagination.currentPage} of {pagination.totalPages}</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(pagination.currentPage - 1, globalFilter)}
                disabled={!pagination.hasPrevPage || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(pagination.currentPage + 1, globalFilter)}
                disabled={!pagination.hasNextPage || loading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
