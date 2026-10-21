/*
# JIC YUVA PULSE - Core Database Schema

## Overview
Creates the foundational schema for the JIC YUVA PULSE startup ecosystem platform.

## Tables (22 tables)
profiles, departments, member_departments, availability_updates, projects,
project_members, tasks, task_assignees, task_updates, task_comments, task_reviews,
events, event_responsibilities, event_assignments, campaigns, social_posts,
social_metric_snapshots, campaign_contributions, daily_pulse, notifications,
audit_logs, app_settings

## Security
- RLS on all tables
- Helper functions is_admin(), is_lead() for permission scoping
- Owner-scoped policies using auth.uid()
- Auto-profile creation on signup via trigger

## Notes
1. Profiles table + helper functions created first (functions depend on table)
2. Policies referencing functions created after functions exist
3. Auto-creates profile when a user signs up
4. Default app settings seeded
*/

-- ============================================================================
-- 1. PROFILES TABLE (no policies yet — functions must exist first)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  designation text,
  role text NOT NULL DEFAULT 'yuva' CHECK (role IN ('admin', 'lead', 'yuva')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  skills text[] DEFAULT '{}',
  interests text[] DEFAULT '{}',
  join_date date,
  phone text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- ============================================================================
-- 2. HELPER FUNCTIONS (profiles table now exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_role(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = p_user_id),
    'yuva'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lead(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'lead'
  );
$$;

-- ============================================================================
-- 3. PROFILE POLICIES (functions now exist)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  lead_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  color text DEFAULT '#2563EB',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_departments_status ON public.departments(status);

DROP POLICY IF EXISTS "departments_select_all" ON public.departments;
CREATE POLICY "departments_select_all" ON public.departments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "departments_insert_admin" ON public.departments;
CREATE POLICY "departments_insert_admin" ON public.departments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "departments_update_admin" ON public.departments;
CREATE POLICY "departments_update_admin" ON public.departments
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "departments_delete_admin" ON public.departments;
CREATE POLICY "departments_delete_admin" ON public.departments
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 5. MEMBER_DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'primary' CHECK (assignment_type IN ('primary', 'secondary')),
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.member_departments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_member_dept_member ON public.member_departments(member_id);
CREATE INDEX IF NOT EXISTS idx_member_dept_dept ON public.member_departments(department_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_dept_unique ON public.member_departments(member_id, department_id);

DROP POLICY IF EXISTS "member_departments_select_all" ON public.member_departments;
CREATE POLICY "member_departments_select_all" ON public.member_departments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "member_departments_insert_admin" ON public.member_departments;
CREATE POLICY "member_departments_insert_admin" ON public.member_departments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR auth.uid() = member_id);
DROP POLICY IF EXISTS "member_departments_update_admin" ON public.member_departments;
CREATE POLICY "member_departments_update_admin" ON public.member_departments
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "member_departments_delete_admin" ON public.member_departments;
CREATE POLICY "member_departments_delete_admin" ON public.member_departments
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 6. AVAILABILITY_UPDATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.availability_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('available', 'limited', 'busy', 'unavailable')),
  start_time timestamptz DEFAULT now(),
  expiry_time timestamptz NOT NULL,
  capacity text,
  preferred_categories text[] DEFAULT '{}',
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.availability_updates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_avail_member ON public.availability_updates(member_id);
CREATE INDEX IF NOT EXISTS idx_avail_created ON public.availability_updates(created_at DESC);

DROP POLICY IF EXISTS "availability_select_all" ON public.availability_updates;
CREATE POLICY "availability_select_all" ON public.availability_updates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "availability_insert_own" ON public.availability_updates;
CREATE POLICY "availability_insert_own" ON public.availability_updates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS "availability_update_own" ON public.availability_updates;
CREATE POLICY "availability_update_own" ON public.availability_updates
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS "availability_delete_own" ON public.availability_updates;
CREATE POLICY "availability_delete_own" ON public.availability_updates
  FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- ============================================================================
-- 7. PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'at_risk', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  start_date date,
  target_completion date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

DROP POLICY IF EXISTS "projects_select_all" ON public.projects;
CREATE POLICY "projects_select_all" ON public.projects
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "projects_insert_admin_lead" ON public.projects;
CREATE POLICY "projects_insert_admin_lead" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "projects_update_admin_lead" ON public.projects;
CREATE POLICY "projects_update_admin_lead" ON public.projects
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_lead() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR public.is_lead() OR owner_id = auth.uid());
DROP POLICY IF EXISTS "projects_delete_admin" ON public.projects;
CREATE POLICY "projects_delete_admin" ON public.projects
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 8. PROJECT_MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pm_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_member ON public.project_members(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_unique ON public.project_members(project_id, member_id);

DROP POLICY IF EXISTS "project_members_select_all" ON public.project_members;
CREATE POLICY "project_members_select_all" ON public.project_members
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "project_members_insert_admin_lead" ON public.project_members;
CREATE POLICY "project_members_insert_admin_lead" ON public.project_members
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "project_members_delete_admin_lead" ON public.project_members;
CREATE POLICY "project_members_delete_admin_lead" ON public.project_members
  FOR DELETE TO authenticated USING (public.is_admin() OR public.is_lead());

-- ============================================================================
-- 9. TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'assigned', 'not_started', 'in_progress', 'blocked', 'submitted', 'revision_requested', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  estimated_effort text,
  start_date date,
  deadline date,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  checklist jsonb DEFAULT '[]',
  blocker_note text,
  deliverable_urls text[] DEFAULT '{}',
  is_claimable boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);

DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_all" ON public.tasks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tasks_insert_admin_lead" ON public.tasks;
CREATE POLICY "tasks_insert_admin_lead" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead() OR auth.uid() = assignee_id);
DROP POLICY IF EXISTS "tasks_update_admin_lead_assignee" ON public.tasks;
CREATE POLICY "tasks_update_admin_lead_assignee" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_lead() OR auth.uid() = assignee_id OR auth.uid() = reviewer_id OR auth.uid() = created_by)
  WITH CHECK (public.is_admin() OR public.is_lead() OR auth.uid() = assignee_id OR auth.uid() = reviewer_id OR auth.uid() = created_by);
DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;
CREATE POLICY "tasks_delete_admin" ON public.tasks
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 10. TASK_ASSIGNEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_type text DEFAULT 'collaborator' CHECK (assignment_type IN ('owner', 'collaborator')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ta_task ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_ta_member ON public.task_assignees(member_id);

DROP POLICY IF EXISTS "task_assignees_select_all" ON public.task_assignees;
CREATE POLICY "task_assignees_select_all" ON public.task_assignees
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_assignees_insert_admin_lead" ON public.task_assignees;
CREATE POLICY "task_assignees_insert_admin_lead" ON public.task_assignees
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "task_assignees_delete_admin_lead" ON public.task_assignees;
CREATE POLICY "task_assignees_delete_admin_lead" ON public.task_assignees
  FOR DELETE TO authenticated USING (public.is_admin() OR public.is_lead());

-- ============================================================================
-- 11. TASK_UPDATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_status text,
  new_status text,
  update_text text,
  blocker_info text,
  submitted_deliverables text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tu_task ON public.task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_tu_created ON public.task_updates(created_at DESC);

DROP POLICY IF EXISTS "task_updates_select_all" ON public.task_updates;
CREATE POLICY "task_updates_select_all" ON public.task_updates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_updates_insert_own" ON public.task_updates;
CREATE POLICY "task_updates_insert_own" ON public.task_updates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- ============================================================================
-- 12. TASK_COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tc_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_tc_created ON public.task_comments(created_at DESC);

DROP POLICY IF EXISTS "task_comments_select_all" ON public.task_comments;
CREATE POLICY "task_comments_select_all" ON public.task_comments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_comments_insert_own" ON public.task_comments;
CREATE POLICY "task_comments_insert_own" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "task_comments_delete_own" ON public.task_comments;
CREATE POLICY "task_comments_delete_own" ON public.task_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- ============================================================================
-- 13. TASK_REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'revision_requested')),
  feedback text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tr_task ON public.task_reviews(task_id);

DROP POLICY IF EXISTS "task_reviews_select_all" ON public.task_reviews;
CREATE POLICY "task_reviews_select_all" ON public.task_reviews
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_reviews_insert_reviewer" ON public.task_reviews;
CREATE POLICY "task_reviews_insert_reviewer" ON public.task_reviews
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead() OR auth.uid() = reviewer_id);

-- ============================================================================
-- 14. EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  venue text,
  start_time timestamptz,
  end_time timestamptz,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'preparing', 'ready', 'live', 'completed', 'cancelled')),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  post_event_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_start ON public.events(start_time);

DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "events_insert_admin_lead" ON public.events;
CREATE POLICY "events_insert_admin_lead" ON public.events
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "events_update_admin_lead" ON public.events;
CREATE POLICY "events_update_admin_lead" ON public.events
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_lead() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR public.is_lead() OR owner_id = auth.uid());
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
CREATE POLICY "events_delete_admin" ON public.events
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 15. EVENT_RESPONSIBILITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  required_capacity integer NOT NULL DEFAULT 1,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deadline date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_responsibilities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_er_event ON public.event_responsibilities(event_id);

DROP POLICY IF EXISTS "event_resp_select_all" ON public.event_responsibilities;
CREATE POLICY "event_resp_select_all" ON public.event_responsibilities
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "event_resp_insert_admin_lead" ON public.event_responsibilities;
CREATE POLICY "event_resp_insert_admin_lead" ON public.event_responsibilities
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "event_resp_update_admin_lead" ON public.event_responsibilities;
CREATE POLICY "event_resp_update_admin_lead" ON public.event_responsibilities
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_lead())
  WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "event_resp_delete_admin_lead" ON public.event_responsibilities;
CREATE POLICY "event_resp_delete_admin_lead" ON public.event_responsibilities
  FOR DELETE TO authenticated USING (public.is_admin() OR public.is_lead());

-- ============================================================================
-- 16. EVENT_ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsibility_id uuid NOT NULL REFERENCES public.event_responsibilities(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('interested', 'assigned', 'confirmed', 'declined', 'completed')),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ea_resp ON public.event_assignments(responsibility_id);
CREATE INDEX IF NOT EXISTS idx_ea_member ON public.event_assignments(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ea_unique ON public.event_assignments(responsibility_id, member_id);

DROP POLICY IF EXISTS "event_assignments_select_all" ON public.event_assignments;
CREATE POLICY "event_assignments_select_all" ON public.event_assignments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "event_assignments_insert_admin_lead_self" ON public.event_assignments;
CREATE POLICY "event_assignments_insert_admin_lead_self" ON public.event_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead() OR auth.uid() = member_id);
DROP POLICY IF EXISTS "event_assignments_update_admin_lead" ON public.event_assignments;
CREATE POLICY "event_assignments_update_admin_lead" ON public.event_assignments
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_lead())
  WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "event_assignments_delete_admin_lead" ON public.event_assignments;
CREATE POLICY "event_assignments_delete_admin_lead" ON public.event_assignments
  FOR DELETE TO authenticated USING (public.is_admin() OR public.is_lead());

-- ============================================================================
-- 17. CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  platform text CHECK (platform IN ('instagram', 'linkedin', 'both', 'other')),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
  expected_actions text[] DEFAULT '{}',
  target_contributions integer,
  campaign_post_url text,
  objectives text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

DROP POLICY IF EXISTS "campaigns_select_all" ON public.campaigns;
CREATE POLICY "campaigns_select_all" ON public.campaigns
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "campaigns_insert_admin_lead" ON public.campaigns;
CREATE POLICY "campaigns_insert_admin_lead" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "campaigns_update_admin_lead" ON public.campaigns;
CREATE POLICY "campaigns_update_admin_lead" ON public.campaigns
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_lead() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR public.is_lead() OR owner_id = auth.uid());
DROP POLICY IF EXISTS "campaigns_delete_admin" ON public.campaigns;
CREATE POLICY "campaigns_delete_admin" ON public.campaigns
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 18. SOCIAL_POSTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('instagram', 'linkedin')),
  account_reference text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  post_url text,
  post_type text,
  published_at timestamptz,
  caption text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  views integer DEFAULT 0,
  saves integer DEFAULT 0,
  follower_change integer DEFAULT 0,
  metrics_source text DEFAULT 'manual',
  last_metrics_update timestamptz,
  metrics_updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sp_platform ON public.social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_sp_campaign ON public.social_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sp_published ON public.social_posts(published_at DESC);

DROP POLICY IF EXISTS "social_posts_select_all" ON public.social_posts;
CREATE POLICY "social_posts_select_all" ON public.social_posts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "social_posts_insert_admin_lead" ON public.social_posts;
CREATE POLICY "social_posts_insert_admin_lead" ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "social_posts_update_admin_lead" ON public.social_posts;
CREATE POLICY "social_posts_update_admin_lead" ON public.social_posts
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_lead())
  WITH CHECK (public.is_admin() OR public.is_lead());
DROP POLICY IF EXISTS "social_posts_delete_admin" ON public.social_posts;
CREATE POLICY "social_posts_delete_admin" ON public.social_posts
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================================
-- 19. SOCIAL_METRIC_SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value integer NOT NULL,
  snapshot_at timestamptz DEFAULT now(),
  source text DEFAULT 'manual',
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.social_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sms_post ON public.social_metric_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_sms_at ON public.social_metric_snapshots(snapshot_at DESC);

DROP POLICY IF EXISTS "snapshots_select_all" ON public.social_metric_snapshots;
CREATE POLICY "snapshots_select_all" ON public.social_metric_snapshots
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "snapshots_insert_admin_lead" ON public.social_metric_snapshots;
CREATE POLICY "snapshots_insert_admin_lead" ON public.social_metric_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_lead());

-- ============================================================================
-- 20. CAMPAIGN_CONTRIBUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_type text NOT NULL,
  evidence_url text,
  description text,
  submitted_at timestamptz DEFAULT now(),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'revision_requested')),
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_feedback text
);

ALTER TABLE public.campaign_contributions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cc_campaign ON public.campaign_contributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cc_member ON public.campaign_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_cc_status ON public.campaign_contributions(review_status);

DROP POLICY IF EXISTS "contributions_select_all" ON public.campaign_contributions;
CREATE POLICY "contributions_select_all" ON public.campaign_contributions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "contributions_insert_own" ON public.campaign_contributions;
CREATE POLICY "contributions_insert_own" ON public.campaign_contributions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS "contributions_update_reviewer" ON public.campaign_contributions;
CREATE POLICY "contributions_update_reviewer" ON public.campaign_contributions
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_lead() OR auth.uid() = member_id)
  WITH CHECK (public.is_admin() OR public.is_lead() OR auth.uid() = member_id);
DROP POLICY IF EXISTS "contributions_delete_admin_own" ON public.campaign_contributions;
CREATE POLICY "contributions_delete_admin_own" ON public.campaign_contributions
  FOR DELETE TO authenticated USING (public.is_admin() OR auth.uid() = member_id);

-- ============================================================================
-- 21. DAILY_PULSE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_pulse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pulse_date date NOT NULL DEFAULT CURRENT_DATE,
  priority_update text,
  current_task text,
  expected_deliverable text,
  capacity_note text,
  blocker text,
  assistance_needed text,
  reference_url text,
  end_of_day_update text,
  submitted_at timestamptz DEFAULT now()
);

ALTER TABLE public.daily_pulse ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_dp_member ON public.daily_pulse(member_id);
CREATE INDEX IF NOT EXISTS idx_dp_date ON public.daily_pulse(pulse_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_member_date ON public.daily_pulse(member_id, pulse_date);

DROP POLICY IF EXISTS "daily_pulse_select_all" ON public.daily_pulse;
CREATE POLICY "daily_pulse_select_all" ON public.daily_pulse
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_pulse_insert_own" ON public.daily_pulse;
CREATE POLICY "daily_pulse_insert_own" ON public.daily_pulse
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS "daily_pulse_update_own" ON public.daily_pulse;
CREATE POLICY "daily_pulse_update_own" ON public.daily_pulse
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS "daily_pulse_delete_own" ON public.daily_pulse;
CREATE POLICY "daily_pulse_delete_own" ON public.daily_pulse
  FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- ============================================================================
-- 22. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notif_created ON public.notifications(created_at DESC);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "notifications_insert_admin_system" ON public.notifications;
CREATE POLICY "notifications_insert_admin_system" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = recipient_id);

-- ============================================================================
-- 23. AUDIT_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  change_summary jsonb,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id OR public.is_admin());

-- ============================================================================
-- 24. APP_SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON public.app_settings;
CREATE POLICY "settings_select_all" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings_update_admin" ON public.app_settings;
CREATE POLICY "settings_update_admin" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "settings_insert_admin" ON public.app_settings;
CREATE POLICY "settings_insert_admin" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated') THEN
    CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_departments_updated') THEN
    CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated') THEN
    CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updated') THEN
    CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated') THEN
    CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaigns_updated') THEN
    CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

-- ============================================================================
-- DEFAULT SETTINGS
-- ============================================================================

INSERT INTO public.app_settings (key, value, description) VALUES
  ('availability_expiry_hours', '24', 'Default hours before availability expires'),
  ('workload_threshold_moderate', '3', 'Task count threshold for moderate workload'),
  ('workload_threshold_high', '5', 'Task count threshold for high workload'),
  ('notification_task_assignment', 'true', 'Send notification when task is assigned'),
  ('notification_deadline_approaching', 'true', 'Send notification when deadline is approaching'),
  ('notification_task_overdue', 'true', 'Send notification when task is overdue'),
  ('notification_contribution_review', 'true', 'Send notification when contribution is reviewed'),
  ('score_weight_task_delivery', '40', 'Performance score weight for task delivery'),
  ('score_weight_ownership', '25', 'Performance score weight for ownership'),
  ('score_weight_collaboration', '20', 'Performance score weight for collaboration'),
  ('score_weight_social', '10', 'Performance score weight for social contributions'),
  ('score_weight_initiative', '5', 'Performance score weight for initiative'),
  ('org_name', '"JIC YUVA PULSE"', 'Organisation display name')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'active'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_updates;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_updates;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_contributions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_assignments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  END IF;
END
$$;
