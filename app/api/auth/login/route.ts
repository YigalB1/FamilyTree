import { findUserByEmail, verifyPassword, updateLastLogin } from '../../../lib/db/users';
import { createSession } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await updateLastLogin(user.id);
    await createSession(user.id);

    return Response.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
