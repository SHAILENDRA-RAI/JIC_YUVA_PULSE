import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadNotifs() {
      if (!profile) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read_at).length || 0);
    }
    loadNotifs();

    const channel = supabase
      .channel('notifications-topbar')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${profile?.id}` },
        loadNotifs
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAllRead() {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', profile.id)
      .is('read_at', null);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-jic-border h-16 flex items-center px-4 lg:px-6 gap-4">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-jic-muted">
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
          <input
            type="text"
            placeholder="Search members, tasks, projects..."
            onFocus={() => navigate('/directory')}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-jic-muted border border-transparent text-sm focus:outline-none focus:bg-white focus:border-jic-orange/30 transition-all"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
          className="relative p-2 rounded-xl hover:bg-jic-muted transition-colors"
        >
          <Bell className="w-5 h-5 text-jic-text" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-jic-orange text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {showNotifs && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-jic-border overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-jic-border flex items-center justify-between">
              <h4 className="font-bold text-sm text-jic-text">Notifications</h4>
              {unreadCount > 0 && <span className="text-xs text-jic-orange font-semibold">{unreadCount} new</span>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-jic-text-secondary">No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { navigate('/notifications'); setShowNotifs(false); }}
                    className="px-4 py-3 hover:bg-jic-muted cursor-pointer border-b border-jic-border/50 last:border-0"
                  >
                    <p className="text-sm font-semibold text-jic-text">{n.title}</p>
                    {n.message && <p className="text-xs text-jic-text-secondary mt-0.5">{n.message}</p>}
                    <p className="text-xs text-jic-text-secondary/70 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-jic-muted transition-colors"
        >
          <Avatar name={profile?.full_name || 'User'} avatarUrl={profile?.avatar_url} size="sm" />
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold text-jic-text leading-tight">{profile?.full_name}</p>
            <p className="text-xs text-jic-text-secondary capitalize leading-tight">{profile?.role}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-jic-text-secondary hidden sm:block" />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-jic-border overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-jic-border">
              <p className="text-sm font-bold text-jic-text">{profile?.full_name}</p>
              <p className="text-xs text-jic-text-secondary">{profile?.email}</p>
            </div>
            <button
              onClick={() => { signOut(); setShowMenu(false); }}
              className="w-full px-4 py-3 flex items-center gap-2 text-sm text-jic-error hover:bg-jic-error-bg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
