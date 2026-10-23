import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Inbox, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { Notification } from '@/types';

type ReadFilter = 'all' | 'unread' | 'read';

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function notificationLabel(type: string) {
  const value = type.replace(/[_-]+/g, ' ').trim();
  return value ? value.replace(/\b\w/g, letter => letter.toUpperCase()) : 'Update';
}

export function Notifications() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReadFilter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  async function loadNotifications(isRefresh = false) {
    if (!profile?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (queryError) {
      setError(queryError.message);
      setNotifications([]);
    } else {
      setNotifications((data || []) as Notification[]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadNotifications();
    // Load again when the signed-in profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.read_at).length,
    [notifications],
  );

  const visibleNotifications = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notifications.filter(item => {
      if (filter === 'unread' && item.read_at) return false;
      if (filter === 'read' && !item.read_at) return false;
      const haystack = [item.title, item.message || '', item.type, item.entity_type || '']
        .join(' ')
        .toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [notifications, filter, search]);

  async function markAsRead(item: Notification) {
    if (item.read_at || !profile?.id) return;
    setWorkingId(item.id);
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', item.id)
      .eq('recipient_id', profile.id);

    if (updateError) {
      showToast('error', `Could not mark notification as read: ${updateError.message}`);
    } else {
      setNotifications(previous => previous.map(row => row.id === item.id ? { ...row, read_at: readAt } : row));
    }
    setWorkingId(null);
  }

  async function markAllAsRead() {
    if (!profile?.id || unreadCount === 0) return;
    setWorkingId('all');
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', profile.id)
      .is('read_at', null);

    if (updateError) {
      showToast('error', `Could not mark notifications as read: ${updateError.message}`);
    } else {
      setNotifications(previous => previous.map(row => row.read_at ? row : { ...row, read_at: readAt }));
      showToast('success', 'All notifications marked as read.');
    }
    setWorkingId(null);
  }

  async function dismissNotification(item: Notification) {
    if (!profile?.id) return;
    setWorkingId(item.id);
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', item.id)
      .eq('recipient_id', profile.id);

    if (deleteError) {
      showToast('error', `Could not dismiss notification: ${deleteError.message}`);
    } else {
      setNotifications(previous => previous.filter(row => row.id !== item.id));
      showToast('success', 'Notification dismissed.');
    }
    setWorkingId(null);
  }

  if (loading) return <LoadingState message="Loading your notifications..." />;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Notifications</h1>
          <p className="text-jic-text-secondary mt-2">Your workspace updates and action reminders, all in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadNotifications(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0 || workingId === 'all'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold hover:bg-jic-orange-deep disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center"><Bell className="w-5 h-5" /></div>
            <div><p className="text-sm text-jic-text-secondary">Total notifications</p><p className="text-2xl font-bold text-jic-text">{notifications.length}</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><Inbox className="w-5 h-5" /></div>
            <div><p className="text-sm text-jic-text-secondary">Unread</p><p className="text-2xl font-bold text-jic-text">{unreadCount}</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Check className="w-5 h-5" /></div>
            <div><p className="text-sm text-jic-text-secondary">Read</p><p className="text-2xl font-bold text-jic-text">{notifications.length - unreadCount}</p></div>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader title="Inbox" subtitle={`${visibleNotifications.length} notifications shown`} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-3">
            <label className="relative block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jic-text-secondary" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search notifications..."
                aria-label="Search notifications"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange"
              />
            </label>
            <select
              value={filter}
              onChange={event => setFilter(event.target.value as ReadFilter)}
              aria-label="Filter notifications by read status"
              className="w-full px-3 py-2.5 rounded-xl border border-jic-border text-sm bg-white"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
              <option value="read">Read only</option>
            </select>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-800">Could not load notifications</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button type="button" onClick={() => void loadNotifications()} className="mt-3 text-sm font-semibold text-red-800 underline">Try again</button>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={<Inbox className="w-8 h-8" />} title={notifications.length ? 'No matching notifications' : 'You’re all caught up'} description={notifications.length ? 'Try a different search term or filter.' : 'Notifications for your account will appear here when generated by workspace activity.'} />
            </div>
          ) : (
            <div className="mt-4 divide-y divide-jic-border">
              {visibleNotifications.map(item => (
                <article key={item.id} className={`py-4 flex gap-3 sm:gap-4 ${item.read_at ? '' : 'bg-orange-50/40 -mx-2 px-2 rounded-xl'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.read_at ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-jic-orange'}`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-sm ${item.read_at ? 'font-medium text-jic-text' : 'font-bold text-jic-text'}`}>{item.title}</h3>
                      {!item.read_at && <Badge className="bg-orange-100 text-orange-800">New</Badge>}
                      <Badge className="bg-slate-100 text-slate-700">{notificationLabel(item.type)}</Badge>
                    </div>
                    {item.message && <p className="text-sm text-jic-text-secondary mt-1 whitespace-pre-line">{item.message}</p>}
                    <p className="text-xs text-jic-text-secondary mt-2">{formatNotificationDate(item.created_at)}</p>
                  </div>
                  <div className="flex items-start gap-1 shrink-0">
                    {!item.read_at && (
                      <button
                        type="button"
                        title="Mark as read"
                        aria-label={`Mark ${item.title} as read`}
                        disabled={workingId === item.id || workingId === 'all'}
                        onClick={() => void markAsRead(item)}
                        className="p-2 rounded-lg text-jic-text-secondary hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      ><Check className="w-4 h-4" /></button>
                    )}
                    <button
                      type="button"
                      title="Dismiss notification"
                      aria-label={`Dismiss ${item.title}`}
                      disabled={workingId === item.id || workingId === 'all'}
                      onClick={() => void dismissNotification(item)}
                      className="p-2 rounded-lg text-jic-text-secondary hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                    ><Trash2 className="w-4 h-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
