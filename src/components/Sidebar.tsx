import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Package,
  TrendingUp,
  KanbanSquare,
  CheckSquare,
  Settings,
  PieChart,
  Calculator,
  Archive,
  BookOpen,
  Building2,
  Receipt,
  X,
  UserCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from './BrandLogo';

type AppArea = 'summary' | 'crm' | 'finance';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  invoices?: Array<{ status?: string }>;
  expenses?: Array<{ status?: string }>;
  appArea?: AppArea;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentPage,
  onPageChange,
  invoices = [],
  expenses = [],
  appArea = 'finance',
  isOpen = false,
  onClose,
}: SidebarProps) {
  const { t } = useTranslation();
  
  const activeInvoiceCount = invoices.filter(invoice =>
    invoice.status !== 'paid' && invoice.status !== 'overdue'
  ).length;

  const pendingExpenseCount = expenses.filter(expense =>
    expense.status === 'draft' || expense.status === 'approved'
  ).length;

  const menuItems = (() => {
    if (appArea === 'summary') {
      return [
        { icon: LayoutDashboard, label: t('sidebar.summary'), page: 'summary' },
      ];
    }

    if (appArea === 'crm') {
      return [
        { icon: LayoutDashboard, label: t('sidebar.crmDashboard'), page: 'crm-dashboard' },
        { icon: KanbanSquare, label: t('sidebar.crmPipeline'), page: 'crm-pipeline' },
        { icon: TrendingUp, label: t('sidebar.crmOpportunities'), page: 'crm-opportunities' },
        { icon: UserCircle, label: t('sidebar.crmLeads'), page: 'crm-leads' },
        { icon: Building2, label: t('sidebar.customers'), page: 'customers' },
        { icon: UserCircle, label: t('sidebar.crmContacts'), page: 'crm-contacts' },
        { icon: Receipt, label: t('sidebar.crmActivities'), page: 'crm-activities' },
        { icon: CheckSquare, label: t('sidebar.crmTasks'), page: 'crm-tasks' },
        { icon: FileText, label: t('sidebar.quotes'), page: 'quotes' },
        { icon: PieChart, label: t('sidebar.reports'), page: 'reports' },
      ];
    }

    // finance
    return [
      { icon: LayoutDashboard, label: t('sidebar.dashboard'), page: 'dashboard' },
      { icon: FileText, label: t('sidebar.invoices'), page: 'invoices', badge: activeInvoiceCount > 0 ? activeInvoiceCount : null },
      { icon: Receipt, label: t('sidebar.expenses'), page: 'expenses', badge: pendingExpenseCount > 0 ? pendingExpenseCount : null },
      { icon: Package, label: t('sidebar.products'), page: 'products' },
      { icon: Building2, label: t('sidebar.suppliers'), page: 'suppliers' },
      { icon: CreditCard, label: t('sidebar.banks'), page: 'banks' },
      { icon: TrendingUp, label: t('sidebar.sales'), page: 'sales' },
      { icon: PieChart, label: t('sidebar.reports'), page: 'reports' },
      { icon: Calculator, label: t('sidebar.accounting'), page: 'general-ledger' },
      { icon: BookOpen, label: t('sidebar.chartOfAccounts'), page: 'chart-of-accounts' },
      { icon: Archive, label: t('sidebar.archive'), page: 'archive' },
      { icon: Settings, label: t('sidebar.settings'), page: 'settings' },
    ];
  })();

  const handleNavigation = (page: string) => {
    onPageChange(page);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-gray-200 bg-white shadow-md transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-center border-b border-gray-200 p-6">
            <BrandLogo className="h-24 w-auto" />
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:hidden"
                aria-label={t('sidebar.close')}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleNavigation(item.page)}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors ${
                  currentPage === item.page
                    ? 'border-r-4 border-blue-600 bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center space-x-3">
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-600">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

