import { useLocation } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const pageContent: Record<string, { title: string; description: string }> = {
  '/directory': { title: 'YUVA Directory', description: 'Browse your authorised JIC community, skills, departments, and current workload.' },
  '/availability': { title: 'Availability Tracker', description: 'See declared capacity and keep your own availability current.' },
  '/tasks': { title: 'Tasks & Projects', description: 'Coordinate assignments, progress, deadlines, and review workflows.' },
  '/social': { title: 'Social Engagement', description: 'Manage campaigns, contributions, and official social performance records.' },
  '/events': { title: 'Events', description: 'Coordinate event responsibilities, volunteers, and operational readiness.' },
  '/analytics': { title: 'Analytics', description: 'Understand delivery, capacity, contributions, and department performance from recorded data.' },
  '/notifications': { title: 'Notifications', description: 'Review workspace alerts and action items that need your attention.' },
  '/admin': { title: 'Administration', description: 'Configure organisation settings, departments, members, and access roles.' },
};

export function ModulePlaceholder() {
  const { pathname } = useLocation();
  const page = pageContent[pathname] || pageContent['/directory'];
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6"><p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p><h1 className="text-3xl font-bold text-jic-text mt-1">{page.title}</h1><p className="text-jic-text-secondary mt-2">{page.description}</p></div>
      <Card><CardBody className="py-16"><div className="mx-auto max-w-md text-center"><div className="w-16 h-16 mx-auto rounded-2xl bg-jic-orange-soft flex items-center justify-center mb-5"><Activity className="w-8 h-8 text-jic-orange" /></div><h2 className="text-xl font-bold text-jic-text">Your workspace is ready</h2><p className="text-sm text-jic-text-secondary mt-2">This module is connected to the shared JIC database. Add records from the administration workspace and they will appear here.</p><Button className="mt-5" onClick={() => window.location.assign('/')}>Back to overview <ArrowRight className="w-4 h-4" /></Button></div></CardBody></Card>
    </div>
  );
}
