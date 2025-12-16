import { useState } from 'react';
import { Tab } from '@headlessui/react';
import {
  CalendarIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import CicilanScheduleTracker from './CicilanScheduleTracker';
import CustomerPaymentHistory from './CustomerPaymentHistory';
import CustomerCreditProfile from './CustomerCreditProfile';
import OverdueAlertDashboard from './OverdueAlertDashboard';

interface FinanceCicilanDashboardProps {
  kd_client?: number;
  kd_cicilan?: number;
  showCustomerView?: boolean;
  showFinanceView?: boolean;
}

export default function FinanceCicilanDashboard({
  kd_client,
  kd_cicilan,
  showCustomerView = true,
  showFinanceView = true
}: FinanceCicilanDashboardProps) {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    ...(showFinanceView
      ? [
          {
            label: 'Overdue Alerts',
            icon: ExclamationTriangleIcon,
            description: 'Cicilan overdue yang memerlukan tindak lanjut',
            content: <OverdueAlertDashboard limit={50} />
          }
        ]
      : []),
    ...(kd_cicilan && showCustomerView
      ? [
          {
            label: 'Payment Schedule',
            icon: CalendarIcon,
            description: 'Jadwal pembayaran cicilan',
            content: <CicilanScheduleTracker kd_cicilan={kd_cicilan} />
          }
        ]
      : []),
    ...(kd_client && showCustomerView
      ? [
          {
            label: 'Payment History',
            icon: DocumentCheckIcon,
            description: 'Riwayat pembayaran pelanggan',
            content: <CustomerPaymentHistory kd_client={kd_client} limit={20} />
          },
          {
            label: 'Credit Profile',
            icon: SparklesIcon,
            description: 'Profil kredit dan assessment',
            content: <CustomerCreditProfile kd_client={kd_client} />
          }
        ]
      : [])
  ];

  if (tabs.length === 0) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8 text-center">
        <SparklesIcon className="w-16 h-16 text-yellow-600 mx-auto mb-3" />
        <div className="text-lg font-bold text-yellow-800">Data Tidak Tersedia</div>
        <div className="text-sm text-yellow-700 mt-2">
          {showFinanceView && !showCustomerView
            ? 'Gunakan Finance menu untuk melihat dashboard'
            : 'Silahkan pilih customer atau cicilan untuk melihat detail'}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        {/* Tab Navigation */}
        <Tab.List className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 flex-wrap gap-1">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            return (
              <Tab
                key={idx}
                className={({ selected }) =>
                  `py-3 px-4 font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${
                    selected
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </Tab>
            );
          })}
        </Tab.List>

        {/* Tab Description */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">{tabs[selectedTab]?.description}</p>
        </div>

        {/* Tab Panels */}
        <Tab.Panels>
          {tabs.map((tab, idx) => (
            <Tab.Panel key={idx} className="focus:outline-none">
              <div className="animate-fadeIn">{tab.content}</div>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
