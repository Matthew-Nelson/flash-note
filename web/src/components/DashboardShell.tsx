'use client';

import { createContext, useContext, useState } from 'react';
import { Sidebar } from './Sidebar';

const SidebarContext = createContext<{ openSidebar: () => void }>({
  openSidebar: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

interface DashboardShellProps {
  user: { email: string };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ openSidebar: () => setSidebarOpen(true) }}>
      <div className="flex min-h-screen">
        <Sidebar
          user={user}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
