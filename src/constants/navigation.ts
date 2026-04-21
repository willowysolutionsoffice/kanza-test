import {
  IconBox,
  IconBrandProducthunt,
  IconBrandSpeedtest,
  IconBuildingBank,
  IconBuildingPlus,
  IconCash,
  IconCashBanknote,
  IconCategory,
  IconCreditCard,
  IconCreditCardPay,
  IconCurrency,
  IconCylinder,
  IconDashboard,
  IconFileText,
  IconGasStation,
  IconSettingsCog,
  IconShoppingBagPlus,
  IconShoppingCart,
  IconUser,
  IconUserPlus
} from '@tabler/icons-react';
import type { SidebarData } from '@/types/navigation';
import { APP_CONFIG } from '@/config/app';

export const SIDEBAR_DATA: SidebarData = {
  // main navigation for all users
  navMain: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: IconDashboard,
    },
    {
      title: 'Meter Reading',
      url: '/meter-reading',
      icon: IconBrandSpeedtest,
    },
    {
      title: "Expenses",
      url: "/expenses",
      icon: IconCurrency,
    },
    {
      title: 'Credits',
      url: '/credits',
      icon: IconCreditCardPay,
    },
    {
      title: 'Deposit Bank',
      url: '/bankdeposites',
      icon: IconCreditCard,
    },
    {
      title: 'Payments',
      url: '/payments',
      icon: IconCash,
    },
    {
      title: 'Sales',
      url: '/sales',
      icon: IconShoppingCart,
    },
    {
      title: 'Customer',
      url: '/customers',
      icon: IconUser,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: IconFileText,
      children: [
        {
          title: "Sales Report",
          url: "/reports/sales-reports",
        },
        {
          title: "Purchase Report",
          url: "/reports/purchase-reports",
        },
        {
          title: "Payment Report",
          url: "/reports/payment-reports",
        },
        {
          title: "Credit Report",
          url: "/reports/credit-reports",
        },
        {
          title: "Customer Report",
          url: "/reports/customer-reports",
        },
        {
          title: "Supplier Report",
          url: "/reports/supplier-reports",
        },
        {
          title: "Report",
          url: "/reports/general-reports",
        },
        {
          title: "Balance Sheet Report",
          url: "/reports/balancesheet-reports",
        },
        {
          title: "Stock Report",
          url: "/reports/stock-reports",
        },
        
      ],
    },
    {
      title: 'Expense Category',
      url: '/expensescategory',
      icon: IconCategory,
    },
    {
      title: 'Balance Receipt',
      url: '/balance-receipt',
      icon: IconCashBanknote,
    }, 


  ],

  // only admin can see this navigation
  admin: [
    {
      title: 'Tank',
      url: '/admin/tanks',
      icon: IconCylinder,
    },
    {
      title: 'Machine',
      url: '/admin/machines',
      icon: IconSettingsCog,
    },
    {
      title: 'Nozzle',
      url: '/admin/nozzles',
      icon: IconGasStation,
    }, 
    {
      title: 'Stocks',
      url: '/admin/stocks',
      icon: IconBox,
    },
     {
      title: 'Purchase',
      url: '/admin/purchase',
      icon: IconShoppingBagPlus,
    },
    {
      title: 'Products',
      url: '/admin/products',
      icon: IconBrandProducthunt
    },
    {
      title: "Users",
      url: "/admin/users",
      icon: IconUserPlus,
    },
    {
      title: 'Branch',
      url: '/admin/branches',
      icon: IconBuildingPlus,
    },
    // {
    //   title: 'Users',
    //   url: '/admin/staffs',
    //   icon: IconUserPlus,
    // },
    {
      title: 'Bank',
      url: '/admin/banks',
      icon: IconBuildingBank,
    },
    {
      title: 'Supplier',
      url: '/admin/suppliers',
      icon: IconUserPlus,
    },
    {
      title: 'Activity Log',
      url: '/admin/activity-log',
      icon: IconFileText,
    },
  ],

  // only branch can see this navigation
  branch: [
    
    
  ],

  staff: [
    {
      title: 'Meter Reading',
      url: 'staff/meter-reading',
      icon: IconBrandSpeedtest,
    }
  ],

  // secondary navigation for all users
  // navSecondary: [
  //   {
  //     title: 'Settings',
  //     url: '/settings',
  //     icon: IconSettings,
  //   },
  //   {
  //     title: 'Search',
  //     url: '/search',
  //     icon: IconSearch,
  //   },
  //   {
  //     title: 'Help & Support',
  //     url: '/help',
  //     icon: IconHelp,
  //   },
  // ],
};

export const COMPANY_INFO = {
  name: APP_CONFIG.name,
  description: APP_CONFIG.description,
} as const;
