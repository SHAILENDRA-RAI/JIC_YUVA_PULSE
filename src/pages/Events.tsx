import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
  Pencil,
  Trash2,
  X,
  ClipboardList,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type {
  Department,
  Event as JICEvent,
  EventAssignment,
  EventResponsibility,
  Profile,
} from '@/types';

type EventDraft = {
  title: string;
  description: string;
  venue: string;
  start_time: string;
  end_time: string;
};

type RoleDraft = {
  event_id: string;
  name: string;
  description: string;
  department_id: string;
  required_capacity: number;
  deadline: string;
};

type Member = Pick<Profile, 'id' | 'full_name' | 'designation' | 'status'>;
type EventFilter = 'all' | 'upcoming' | 'past';

type EventStatus = 'planning' | 'preparing' | 'ready' | 'live' | 'completed' | 'cancelled';
type AssignmentStatus = 'interested' | 'assigned' | 'confirmed' | 'declined' | 'completed';

const eventStatuses: EventStatus[] = ['planning', 'preparing', 'ready', 'live', 'completed', 'cancelled'];
const assignmentStatuses: AssignmentStatus[] = ['interested', 'assigned', 'confirmed', 'declined', 'completed'];

const eventStatusStyle: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-emerald-100 text-emerald-800',
  live: 'bg-orange-100 text-orange-800',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-800',
};

const assignmentStatusStyle: Record<string, string> = {
  interested: 'bg-amber-100 text-amber-800',
  assigned: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-slate-100 text-slate-600',
  completed: 'bg-teal-100 text-teal-800',
};

const emptyEventDraft: EventDraft = {
  title: '',
  description: '',
  venue: '',
  start_time: '',
  end_time: '',
};

const emptyRoleDraft: RoleDraft = {
  event_id: '',
  name: '',
  description: '',
  department_id: '',
  required_capacity: 1,
  deadline: '',
};

function pretty(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return 'Time to be announced';
