import { useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Clock3, Inbox, RefreshCw, Search, Trash2 } from 'lucide-react';
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
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
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

  useEffect(() => { void loadNotifications(); }, [profile?.id]);

  const unreadCount = useMemo(() => notifications.filter(item => !item.read_at).length, [notifications]);
  const visibleNotifications = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notifications.filter(item => {
      if (filter === 'unread' && item.read_at) return false;
      if (filter === 'read' && !item.read_at) return false;
      const text = [item.title, item.message || '', item.type, item.entity_type || ''].join(' ').toLowerCase();
      return !needle || text.includes(needle);
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
