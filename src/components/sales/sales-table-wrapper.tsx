'use client';

import { SalesTable } from './sales-table';
import { useSalesColumns } from './sales-column';
import { Sales } from '@/types/sales';

interface SalesTableWrapperProps {
  data: Sales[];
  userRole?: string;
  canEdit?: boolean;
  branchId: string;
}

export function SalesTableWrapper({ data, userRole, canEdit, branchId }: SalesTableWrapperProps) {
  const columns = useSalesColumns(userRole, branchId, canEdit);
  
  return (
    <SalesTable 
      data={data} 
      columns={columns}
      userRole={userRole} 
      branchId={branchId}
    />
  );
}
