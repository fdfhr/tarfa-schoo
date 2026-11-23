import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import supabase from '../lib/supabase';
import { api } from '../lib/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);
  const [settings, setSettings] = useState(null);
  const [theme, setTheme] = useState(() => (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'));
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const loadMe = useCallback(async () => {
    if (!session) {
      setMe(null);
      return;
    }
    try {
      setMe(await api('/api/me'));
    } catch (e) {
      setMe({ error: e.message });
    }
  }, [session]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await api('/api/settings'));
    } catch {
      setSettings({});
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  const profile = me?.profile || null;
  const value = {
    session,
    loading: session === undefined || (!!session && !me),
    me,
    profile,
    entity: me?.entity || null,
    role: profile?.role || null,
    settings: settings || {},
    refreshSettings,
    refreshMe: loadMe,
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    toasts,
    toast,
    signIn,
    signOut,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
