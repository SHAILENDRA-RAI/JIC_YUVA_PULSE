import type { TaskStatus, Priority, ProjectStatus, EventStatus, CampaignStatus, ReviewStatus } from '@/types';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return formatDate(date);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function isOverdue(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function daysUntil(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isAvailabilityExpired(expiryTime: string): boolean {
  return new Date(expiryTime) < new Date();
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getAvailabilityDisplay(status: string | null, expiryTime?: string | null): { label: string; color: string; bgColor: string; textColor: string } {
  if (!status || (expiryTime && isAvailabilityExpired(expiryTime))) {
    return { label: 'Needs Update', color: '#64748B', bgColor: 'bg-slate-100', textColor: 'text-slate-600' };
  }
  switch (status) {
    case 'available':
      return { label: 'Available', color: '#16A34A', bgColor: 'bg-green-100', textColor: 'text-green-700' };
    case 'limited':
      return { label: 'Limited', color: '#EAB308', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' };
    case 'busy':
      return { label: 'Busy', color: '#2563EB', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
    case 'unavailable':
      return { label: 'Unavailable', color: '#64748B', bgColor: 'bg-slate-200', textColor: 'text-slate-600' };
    default:
      return { label: 'Needs Update', color: '#64748B', bgColor: 'bg-slate-100', textColor: 'text-slate-600' };
  }
}

export function getTaskStatusDisplay(status: TaskStatus): { label: string; bgColor: string; textColor: string } {
  const map: Record<TaskStatus, { label: string; bgColor: string; textColor: string }> = {
    draft: { label: 'Draft', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    open: { label: 'Open', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    assigned: { label: 'Assigned', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
    not_started: { label: 'Not Started', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    in_progress: { label: 'In Progress', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    blocked: { label: 'Blocked', bgColor: 'bg-red-100', textColor: 'text-red-700' },
    submitted: { label: 'In Review', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
    revision_requested: { label: 'Revision', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
    completed: { label: 'Completed', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    cancelled: { label: 'Cancelled', bgColor: 'bg-slate-100', textColor: 'text-slate-500' },
  };
  return map[status] || { label: status, bgColor: 'bg-slate-100', textColor: 'text-slate-600' };
}

export function getPriorityDisplay(priority: Priority): { label: string; textColor: string; bgColor: string } {
  const map: Record<Priority, { label: string; textColor: string; bgColor: string }> = {
    low: { label: 'Low', textColor: 'text-slate-600', bgColor: 'bg-slate-100' },
    medium: { label: 'Medium', textColor: 'text-blue-700', bgColor: 'bg-blue-100' },
    high: { label: 'High', textColor: 'text-orange-700', bgColor: 'bg-orange-100' },
    critical: { label: 'Critical', textColor: 'text-red-700', bgColor: 'bg-red-100' },
  };
  return map[priority];
}

export function getProjectStatusDisplay(status: ProjectStatus): { label: string; bgColor: string; textColor: string } {
  const map: Record<ProjectStatus, { label: string; bgColor: string; textColor: string }> = {
    planning: { label: 'Planning', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    active: { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    paused: { label: 'Paused', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    at_risk: { label: 'At Risk', bgColor: 'bg-red-100', textColor: 'text-red-700' },
    completed: { label: 'Completed', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    cancelled: { label: 'Cancelled', bgColor: 'bg-slate-100', textColor: 'text-slate-500' },
  };
  return map[status];
}

export function getEventStatusDisplay(status: EventStatus): { label: string; bgColor: string; textColor: string } {
  const map: Record<EventStatus, { label: string; bgColor: string; textColor: string }> = {
    planning: { label: 'Planning', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    preparing: { label: 'Preparing', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    ready: { label: 'Ready', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    live: { label: 'Live', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    completed: { label: 'Completed', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    cancelled: { label: 'Cancelled', bgColor: 'bg-slate-100', textColor: 'text-slate-500' },
  };
  return map[status];
}

export function getCampaignStatusDisplay(status: CampaignStatus): { label: string; bgColor: string; textColor: string } {
  const map: Record<CampaignStatus, { label: string; bgColor: string; textColor: string }> = {
    planning: { label: 'Planning', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
    active: { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    paused: { label: 'Paused', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    completed: { label: 'Completed', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
    cancelled: { label: 'Cancelled', bgColor: 'bg-slate-100', textColor: 'text-slate-500' },
  };
  return map[status];
}

export function getReviewStatusDisplay(status: ReviewStatus): { label: string; bgColor: string; textColor: string } {
  const map: Record<ReviewStatus, { label: string; bgColor: string; textColor: string }> = {
    pending: { label: 'Pending', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    approved: { label: 'Approved', bgColor: 'bg-green-100', textColor: 'text-green-700' },
    rejected: { label: 'Rejected', bgColor: 'bg-red-100', textColor: 'text-red-700' },
    revision_requested: { label: 'Revision Requested', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
  };
  return map[status];
}

export function getWorkloadLevel(activeTaskCount: number): { label: string; textColor: string; bgColor: string } {
  if (activeTaskCount === 0) return { label: 'No active tasks', textColor: 'text-slate-500', bgColor: 'bg-slate-100' };
  if (activeTaskCount <= 2) return { label: 'Low', textColor: 'text-green-700', bgColor: 'bg-green-100' };
  if (activeTaskCount <= 4) return { label: 'Moderate', textColor: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  return { label: 'High', textColor: 'text-red-700', bgColor: 'bg-red-100' };
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        if (cell === null || cell === undefined) return '';
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-orange-500', 'bg-blue-600', 'bg-green-600', 'bg-yellow-500',
    'bg-red-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500',
  ];
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
