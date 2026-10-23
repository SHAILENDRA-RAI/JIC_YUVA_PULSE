import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, CheckSquare, Share2,
  Calendar, BarChart3, Bell, Settings, ChevronLeft, Activity, Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/directory', label: 'YUVA Directory', icon: Users },
  { to: '/availability', label: 'Availability', icon: Clock },
  { to: '/tasks', label: 'Tasks & Projects', icon: CheckSquare },
  { to: '/social', label: 'Social Engagement', icon: Share2 },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

const adminItems = [
  { to: '/admin', label: 'Administration', icon: Settings },
  { to: '/department-membership', label: 'Department Membership', icon: Building2 },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = profile?.role === 'admin';

  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-jic-navy/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen z-40 bg-jic-navy flex flex-col transition-all duration-300',
          collapsed ? 'w-20' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jic-orange to-jic-orange-deep flex items-center justify-center flex-shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight">JIC YUVA</p>
              <p className="text-jic-orange font-semibold text-xs leading-tight">PULSE</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map(item => {
            const active = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                  active
                    ? 'bg-jic-orange text-white shadow-lg shadow-jic-orange/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center py-3 text-slate-400 hover:text-white border-t border-white/10 transition-colors"
        >
          <ChevronLeft className={cn('w-5 h-5 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>
    </>
  );
}
