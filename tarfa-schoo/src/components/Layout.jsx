import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, School, Users, UserSquare2, Contact, ShieldCheck, CalendarCheck, GraduationCap,
  Star, Trophy, CalendarDays, Megaphone, FileBarChart2, Radio, Settings, Info, LogOut, Menu, X,
  Sun, Moon, UserCog, MessageSquare, Bot,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ROLE_LABELS, DEFAULT_SCHOOL, cx } from '../lib/utils';
import { DEVELOPER_NAMES } from '../../lib/fixed.js';
import { Logo, Avatar } from './ui';
import Chatbot from './Chatbot';

const STAFF = ['admin', 'assistant'];
const TEACHING = ['admin', 'assistant', 'teacher'];
const ALL = ['admin', 'assistant', 'teacher', 'student', 'guardian'];

const NAV = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard, roles: ALL },
  { to: '/classes', label: 'الفصول', icon: School, roles: TEACHING },
  { to: '/students', label: 'الطلاب', icon: Users, roles: TEACHING },
  { to: '/accounts', label: 'المدرسون وأولياء الأمور', icon: Contact, roles: STAFF },
  { to: '/attendance', label: 'الغياب', icon: CalendarCheck, roles: TEACHING },
  { to: '/grades', label: 'الدرجات', icon: GraduationCap, roles: TEACHING },
  { to: '/behavior', label: 'السلوك والنقاط', icon: Star, roles: TEACHING },
  { to: '/honor', label: 'لوحة الشرف', icon: Trophy, roles: ALL },
  { to: '/schedule', label: 'الجدول والتقويم', icon: CalendarDays, roles: ALL },
  { to: '/announcements', label: 'الإعلانات', icon: Megaphone, roles: ALL },
  { to: '/reports', label: 'التقارير', icon: FileBarChart2, roles: ['admin', 'assistant', 'teacher'] },
  { to: '/channel', label: 'قناة المدرسة', icon: Radio, roles: ALL },
  { to: '/messages', label: 'الرسائل', icon: MessageSquare, roles: ['admin', 'assistant', 'student', 'guardian'] },
  { to: '/ai-assistant', label: 'المساعد الذكي للمدير', icon: Bot, roles: ['admin'] },
  { to: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin'] },
  { to: '/profile', label: 'حسابي', icon: UserCog, roles: ALL },
  { to: '/about', label: 'عن المدرسة والمطورين', icon: Info, roles: ALL },
];

export default function Layout() {
  const { profile, role, settings, theme, toggleTheme, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const schoolName = settings.school_name || DEFAULT_SCHOOL;
  const items = NAV.filter((n) => n.roles.includes(role));
  const devs = DEVELOPER_NAMES;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="relative h-16 overflow-hidden">
        <img src="/school.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-l from-brand-900/40 to-brand-900/80" />
      </div>
      <div className="flex items-center gap-3 border-b border-line px-5 pb-5 pt-3">
        <Logo className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-snug">{schoolName}</p>
          <p className="text-xs text-muted">نظام الإدارة المدرسية</p>
        </div>
      </div>
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl bg-soft p-3">
        <Avatar name={profile?.full_name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{profile?.full_name}</p>
          <p className="truncate text-xs text-muted">{ROLE_LABELS[role]}</p>
        </div>
      </div>
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:bg-soft hover:text-ink',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line p-4">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted hover:bg-soft hover:text-ink"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-72 border-l border-line bg-surface lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-xl p-2 hover:bg-soft" aria-label="القائمة">
          <Menu className="h-6 w-6" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-sm font-bold">{schoolName}</span>
        </Link>
        <button onClick={toggleTheme} className="rounded-xl p-2 hover:bg-soft" aria-label="تبديل الوضع">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] border-l border-line bg-surface shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute left-3 top-4 rounded-lg p-1.5 hover:bg-soft" aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="lg:pr-72">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
        <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted sm:px-6 lg:px-8">
          <Link to="/about" className="font-semibold text-primary hover:underline">عن المدرسة والمطورين</Link>
          <p className="mt-2">
            تم تطوير هذا النظام بواسطة {devs.length ? devs.join(' و') : 'فريق التطوير'} - {schoolName}
          </p>
        </footer>
      </main>

      {(role === 'student' || role === 'guardian') && <Chatbot />}
    </div>
  );
}
