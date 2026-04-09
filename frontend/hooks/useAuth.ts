import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { User } from '@/types';

export function useAuth({ required = false } = {}) {
  const router = useRouter();
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token  = localStorage.getItem('bluqq_token');
    const stored = localStorage.getItem('bluqq_user');
    if (token && stored) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.clear(); }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && required && !user) router.replace('/login');
  }, [loading, required, user, router]);

  const login = (token: string, userData: User) => {
    localStorage.setItem('bluqq_token', token);
    localStorage.setItem('bluqq_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    router.push('/login');
  };

  return { user, loading, login, logout };
}