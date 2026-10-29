import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Clock3,
  CheckSquare,
  Share2,
  CalendarDays,
  ChartNoAxesCombined,
  Bell,
  Settings2,
  ChevronLeft,
  Activity,
  Building2,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { to: '/directory', label: 'YUVA Directory', icon: Users },
      { to: '/availability', label: 'Availability', icon: Clock3 },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/tasks', label: 'Tasks & Projects', icon: CheckSquare },
      { to: '/social', label: 'Social Engagement', icon: Share2 },
      { to: '/events', label: 'Events', icon: CalendarDays },
    ],
  },
  {
    label: 'WORKSPACE',
    items: [
      { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
      { to: '/chat', label: 'Pulse Chat', icon: MessageCircle },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

const adminItems: NavItem[] = [
  { to: '/admin', label: 'Administration', icon: Settings2 },
  {
    to: '/department-membership',
    label: 'Department Membership',
    icon: Building2,
  },
];

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const roleLabel =
    profile?.role === 'admin'
      ? 'Administrator'
      : profile?.role === 'lead'
        ? 'Department lead'
        : 'YUVA member';

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-jic-navy/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 flex h-screen flex-shrink-0 flex-col',
          'border-r border-white/[0.07] bg-[#111F33] text-white',
          'transition-[width,transform] duration-300 ease-out',
          'shadow-[8px_0_30px_rgba(15,23,42,0.06)]',
          collapsed ? 'w-[78px]' : 'w-[264px]',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-[78px] flex-shrink-0 items-center border-b border-white/[0.08]',
            collapsed ? 'justify-center px-3' : 'gap-3 px-5',
          )}
        >
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-orange-400 via-jic-orange to-orange-700 shadow-[0_5px_18px_rgba(249,115,22,0.24)]">
            <Activity
              className="h-6 w-6 text-white"
              strokeWidth={2.3}
            />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#111F33] bg-emerald-400" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-[15px] font-extrabold leading-tight tracking-[-0.045em] text-white">
                JIC YUVA
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-400">
                  PULSE
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-500" />
                <span className="text-[10px] font-medium text-slate-400">
                  Workspace
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Workspace label */}
        {!collapsed && (
          <div className="px-5 pb-1 pt-6">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[11px] font-semibold tracking-wide text-slate-300">
                Community workspace
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden pb-4 pt-4',
            collapsed ? 'px-2.5' : 'px-3',
          )}
        >
          <div className="space-y-5">
            {navGroups.map((group) => (
              <section key={group.label}>
                {!collapsed && (
                  <h2 className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500">
                    {group.label}
                  </h2>
                )}

                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex min-h-[43px] items-center rounded-xl',
                          'transition-all duration-200',
                          collapsed
                            ? 'justify-center px-0'
                            : 'gap-3 px-3.5',
                          isActive
                            ? [
                                'bg-gradient-to-r from-jic-orange to-[#F8660B]',
                                'font-semibold text-white',
                                'shadow-[0_5px_16px_rgba(249,115,22,0.19)]',
                              ].join(' ')
                            : [
                                'font-medium text-slate-400',
                                'hover:bg-white/[0.055] hover:text-slate-100',
                              ].join(' '),
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-white/90" />
                          )}

                          <item.icon
                            className={cn(
                              'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                              isActive
                                ? 'text-white'
                                : 'text-slate-500 group-hover:text-slate-200',
                            )}
                            strokeWidth={isActive ? 2.2 : 1.8}
                          />

                          {!collapsed && (
                            <span className="min-w-0 flex-1 truncate text-[13px] tracking-[-0.01em]">
                              {item.label}
                            </span>
                          )}

                          {!collapsed && isActive && (
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/80" />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}

            {/* Administrator navigation */}
            {isAdmin && (
              <section>
                {!collapsed && (
                  <h2 className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500">
                    MANAGEMENT
                  </h2>
                )}

                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex min-h-[43px] items-center rounded-xl transition-all duration-200',
                          collapsed
                            ? 'justify-center px-0'
                            : 'gap-3 px-3.5',
                          isActive
                            ? 'bg-gradient-to-r from-jic-orange to-[#F8660B] font-semibold text-white shadow-[0_5px_16px_rgba(249,115,22,0.19)]'
                            : 'font-medium text-slate-400 hover:bg-white/[0.055] hover:text-slate-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-white/90" />
                          )}

                          <item.icon
                            className={cn(
                              'h-[18px] w-[18px] flex-shrink-0',
                              isActive
                                ? 'text-white'
                                : 'text-slate-500 group-hover:text-slate-200',
                            )}
                            strokeWidth={isActive ? 2.2 : 1.8}
                          />

                          {!collapsed && (
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {item.label}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </section>
            )}
          </div>
        </nav>

        {/* Member profile */}
        <div className="flex-shrink-0 border-t border-white/[0.08] p-3">
          <div
            className={cn(
              'flex min-h-[58px] items-center rounded-xl bg-white/[0.045]',
              collapsed ? 'justify-center p-1.5' : 'gap-3 px-2.5 py-2',
            )}
            title={collapsed ? profile?.full_name || 'Your profile' : undefined}
          >
            <Avatar
              name={profile?.full_name || 'User'}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold leading-5 text-slate-100">
                  {profile?.full_name || 'JIC Member'}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {roleLabel}
                </p>
              </div>
            )}

            {!collapsed && (
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400"
                title="Active workspace"
              />
            )}
          </div>

          {/* Collapse control */}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'mt-2 hidden h-9 items-center justify-center rounded-lg',
              'text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white lg:flex',
              collapsed ? 'w-full' : 'w-full gap-2',
            )}
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                collapsed && 'rotate-180',
              )}
            />
            {!collapsed && (
              <span className="text-[11px] font-medium">
                Collapse sidebar
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
