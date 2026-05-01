import { cookies } from 'next/headers';
import { findUserById } from './db/users';
import type { User } from './db/users';

const SESSION_COOKIE = 'familytree_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

// Simple session: store user ID in a signed cookie
// In production you'd use JWT or a session table

export async function createSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  // Encode userId in base64 as a simple session token
  const token = Buffer.from(userId).toString('base64');
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   SESSION_DURATION,
    path:     '/',
    sameSite: 'lax',
  });
}

export async function getSession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const userId = Buffer.from(token, 'base64').toString('utf8');
    const user   = await findUserById(userId);
    return user;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireAuth(): Promise<User> {
  const user = await getSession();
  if (!user) throw new Error('Not authenticated');
  return user;
}

export async function requireRole(role: 'admin' | 'editor'): Promise<User> {
  const user = await requireAuth();
  if (role === 'admin' && user.role !== 'admin') throw new Error('Admin required');
  if (role === 'editor' && user.role === 'viewer') throw new Error('Editor required');
  return user;
}
