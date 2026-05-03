'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from './components/Sidebar';
import ProfileSection from './components/ProfileSection';
import AddressBook from './components/AddressBook';
import PaymentMethods from './components/PaymentMethods';
import SecurityCenter from './components/SecurityCenter';
import { ActiveSection } from './types';

export default function ClientPanel() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSection />;
      case 'addresses':
        return <AddressBook />;
      case 'payments':
        return <PaymentMethods />;
      case 'security':
        return <SecurityCenter />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Powrót do panelu</span>
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <div className="w-5 h-5 flex flex-col justify-center space-y-1">
              <span className="block w-full h-0.5 bg-gray-600"></span>
              <span className="block w-full h-0.5 bg-gray-600"></span>
              <span className="block w-full h-0.5 bg-gray-600"></span>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <Sidebar
              activeSection={activeSection}
              setActiveSection={(section) => {
                setActiveSection(section);
                setIsMobileMenuOpen(false);
              }}
              isMobile={true}
            />
          </div>
        )}
      </div>

      <div className="flex h-screen lg:h-auto">
        {/* Desktop Sidebar with Return Button */}
        <div className="hidden lg:flex lg:flex-col">
          <div className="bg-white shadow-sm border-b border-gray-200 p-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Powrót do panelu</span>
            </button>
          </div>
          <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 md:p-8">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}
