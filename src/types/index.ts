export type Role = 'admin' | 'lead' | 'yuva';
export type ProfileStatus = 'active' | 'inactive' | 'pending';
export type AvailabilityStatus = 'available' | 'limited' | 'busy' | 'unavailable' | 'needs_update';
export type TaskStatus = 'draft' | 'open' | 'assigned' | 'not_started' | 'in_progress' | 'blocked' | 'submitted' | 'revision_requested' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'at_risk' | 'completed' | 'cancelled';
export type EventStatus = 'planning' | 'preparing' | 'ready' | 'live' | 'completed' | 'cancelled';
export type CampaignStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';
export type ReviewDecision = 'approved' | 'rejected' | 'revision_requested';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  designation: string | null;
  role: Role;
  status: ProfileStatus;
  skills: string[];
  interests: string[];
  join_date: string | null;
  phone: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  lead_id: string | null;
  status: 'active' | 'inactive';
  color: string;
  created_at: string;
  updated_at: string;
}

export interface MemberDepartment {
  id: string;
  member_id: string;
  department_id: string;
  assignment_type: 'primary' | 'secondary';
  start_date: string | null;
  end_date: string | null;
}

export interface AvailabilityUpdate {
  id: string;
  member_id: string;
  status: 'available' | 'limited' | 'busy' | 'unavailable';
  start_time: string;
  expiry_time: string;
  capacity: string | null;
  preferred_categories: string[];
  note: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  status: ProjectStatus;
  priority: Priority;
  start_date: string | null;
  target_completion: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  department_id: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  priority: Priority;
  estimated_effort: string | null;
  start_date: string | null;
  deadline: string | null;
  reviewer_id: string | null;
  completed_at: string | null;
  created_by: string | null;
  checklist: unknown[];
  blocker_note: string | null;
  deliverable_urls: string[];
  is_claimable: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  previous_status: string | null;
  new_status: string | null;
  update_text: string | null;
  blocker_info: string | null;
  submitted_deliverables: string[];
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  comment_text: string;
  parent_id: string | null;
  created_at: string;
}

export interface TaskReview {
  id: string;
  task_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  feedback: string | null;
  created_at: string;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  member_id: string;
  assignment_type: 'owner' | 'collaborator';
  is_active: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  venue: string | null;
  start_time: string | null;
  end_time: string | null;
  status: EventStatus;
  project_id: string | null;
  post_event_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventResponsibility {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  required_capacity: number;
  department_id: string | null;
  owner_id: string | null;
  deadline: string | null;
  status: 'open' | 'filled' | 'completed' | 'cancelled';
  created_at: string;
}

export interface EventAssignment {
  id: string;
  responsibility_id: string;
  member_id: string;
  status: 'interested' | 'assigned' | 'confirmed' | 'declined' | 'completed';
  assigned_by: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  platform: 'instagram' | 'linkedin' | 'both' | 'other' | null;
  owner_id: string | null;
  department_id: string | null;
  project_id: string | null;
  event_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  expected_actions: string[];
  target_contributions: number | null;
  campaign_post_url: string | null;
  objectives: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  platform: 'instagram' | 'linkedin';
  account_reference: string | null;
  campaign_id: string | null;
  post_url: string | null;
  post_type: string | null;
  published_at: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  views: number;
  saves: number;
  follower_change: number;
  metrics_source: string;
  last_metrics_update: string | null;
  metrics_updated_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CampaignContribution {
  id: string;
  campaign_id: string;
  member_id: string;
  contribution_type: string;
  evidence_url: string | null;
  description: string | null;
  submitted_at: string;
  review_status: ReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_feedback: string | null;
}

export interface DailyPulse {
  id: string;
  member_id: string;
  pulse_date: string;
  priority_update: string | null;
  current_task: string | null;
  expected_deliverable: string | null;
  capacity_note: string | null;
  blocker: string | null;
  assistance_needed: string | null;
  reference_url: string | null;
  end_of_day_update: string | null;
  submitted_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  change_summary: Record<string, unknown> | null;
  department_id: string | null;
  created_at: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}
