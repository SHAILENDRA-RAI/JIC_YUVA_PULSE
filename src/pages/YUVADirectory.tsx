import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Mail, RefreshCw, Search, Users, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { Department, MemberDepartment, Profile } from '@/types';

type Member = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'designation' | 'role' | 'status' | 'skills' | 'interests'>;

const roleStyles: Record<string, string> = {
  admin: 'bg-orange-100 text-orange-800',
  lead: 'bg-blue-100 text-blue-800',
  yuva: 'bg-emerald-100 text-emerald-800',
};
const statusStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  inactive: 'bg-slate-100 text-slate-600',
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'YU';
}

export function YUVADirectory() {
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<MemberDepartment[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDirectory() {
    setLoading(true);
    setError('');
    const [memberResult, departmentResult, assignmentResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('departments').select('*').order('name', { ascending: true }),
      supabase.from('member_departments').select('*'),
    ]);
    if (memberResult.error) {
      setError(memberResult.error.message);
      setMembers([]);
    } else {
      setMembers((memberResult.data || []) as Member[]);
    }
    if (!departmentResult.error) setDepartments((departmentResult.data || []) as Department[]);
    if (!assignmentResult.error) setAssignments((assignmentResult.data || []) as MemberDepartment[]);
    setLoading(false);
  }

  useEffect(() => { void loadDirectory(); }, []);

  const departmentMap = useMemo(() => new Map(departments.map(dept => [dept.id, dept])), [departments]);
  const memberDepartments = useMemo(() => {
    const map = new Map<string, Department[]>();
    assignments.forEach(assignment => {
      const dept = departmentMap.get(assignment.department_id);
      if (!dept || dept.status !== 'active') return;
      map.set(assignment.member_id, [...(map.get(assignment.member_id) || []), dept]);
    });
    return map;
  }, [assignments, departmentMap]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter(member => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (statusFilter !== 'all' && member.status !== statusFilter) return false;
      const depts = memberDepartments.get(member.id) || [];
      const haystack = [
        member.full_name, member.email, member.designation || '',
        ...(member.skills || []), ...(member.interests || []), ...depts.map(dept => dept.name),
      ].join(' ').toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [members, search, roleFilter, statusFilter, memberDepartments]);

  const activeCount = members.filter(member => member.status === 'active').length;
  const leadCount = members.filter(member => member.role === 'lead' && member.status === 'active').length;
  const activeDepartments = departments.filter(dept => dept.status === 'active').length;

  if (loading) return <LoadingState message="Loading the YUVA directory..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">YUVA Directory</h1>
          <p className="text-jic-text-secondary mt-2">Find team members, explore skills, and view department assignments.</p>
        </div>
        <button onClick={() => void loadDirectory()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh directory
        </button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardBody className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center text-jic-blue bg-blue-50"><Users className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active members</p><p className="text-2xl font-bold text-jic-text">{activeCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center text-jic-orange bg-orange-50"><UserRound className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active leads</p><p className="text-2xl font-bold text-jic-text">{leadCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center text-emerald-700 bg-emerald-50"><BriefcaseBusiness className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active departments</p><p className="text-2xl font-bold text-jic-text">{activeDepartments}</p></div></CardBody></Card>
      </section>

      <Card>
        <CardHeader title="Community members" subtitle={`${filteredMembers.length} of ${members.length} profiles`} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_170px_170px] gap-3">
            <label className="relative block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jic-text-secondary" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, skill, department..." aria-label="Search members" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange" />
            </label>
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filter by role" className="w-full px-3 py-2.5 rounded-xl border border-jic-border text-sm bg-white">
              <option value="all">All roles</option><option value="admin">Admin</option><option value="lead">Department lead</option><option value="yuva">YUVA</option>
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by status" className="w-full px-3 py-2.5 rounded-xl border border-jic-border text-sm bg-white">
              <option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option>
            </select>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-800">Could not load member profiles</p><p className="text-sm text-red-700 mt-1">{error}</p><button onClick={() => void loadDirectory()} className="mt-3 text-sm font-semibold text-red-800 underline">Try again</button></div>
          ) : filteredMembers.length === 0 ? (
            <div className="mt-4"><EmptyState icon={<Users className="w-8 h-8" />} title="No matching members" description="Try changing the search or filters. Authorised profiles will appear here." /></div>
          ) : (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {filteredMembers.map(member => {
                const depts = memberDepartments.get(member.id) || [];
                return (
                  <article key={member.id} className="rounded-2xl border border-jic-border p-4 hover:border-jic-orange/40 hover:shadow-sm transition-all min-w-0">
                    <div className="flex items-start gap-3">
                      {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-jic-muted shrink-0" /> : <div className="w-12 h-12 rounded-xl bg-jic-orange-soft text-jic-orange font-bold flex items-center justify-center shrink-0">{initials(member.full_name)}</div>}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-jic-text truncate">{member.full_name}</h3>
                        <p className="text-sm text-jic-text-secondary truncate">{member.designation || 'Designation not set'}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge className={roleStyles[member.role] || 'bg-slate-100 text-slate-700'}>{member.role === 'lead' ? 'Department lead' : member.role === 'admin' ? 'Admin' : 'YUVA'}</Badge>
                          <Badge className={statusStyles[member.status] || 'bg-slate-100 text-slate-700'}>{member.status}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-start gap-2 text-sm text-jic-text-secondary min-w-0"><Mail className="w-4 h-4 mt-0.5 shrink-0" /><a href={`mailto:${member.email}`} className="truncate hover:text-jic-orange">{member.email}</a></div>
                    {depts.length > 0 && <div className="mt-3 flex items-start gap-2"><BriefcaseBusiness className="w-4 h-4 text-jic-text-secondary mt-0.5 shrink-0" /><div className="flex flex-wrap gap-1.5">{depts.map(dept => <span key={dept.id} className="inline-flex items-center rounded-lg bg-jic-muted px-2 py-1 text-xs font-medium text-jic-text">{dept.name}</span>)}</div></div>}
                    {(member.skills || []).length > 0 && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-jic-text-secondary mb-1">Skills</p><div className="flex flex-wrap gap-1.5">{member.skills.slice(0, 8).map(skill => <span key={skill} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">{skill}</span>)}</div></div>}
                    {(member.interests || []).length > 0 && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-jic-text-secondary mb-1">Interests</p><p className="text-sm text-jic-text-secondary">{member.interests.slice(0, 5).join(', ')}</p></div>}
                  </article>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
