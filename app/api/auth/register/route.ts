import { countUsers, createUser, findUserByEmail } from '../../../lib/db/users';
import { createSession } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email, name, password } = await request.json();

    if (!email || !name || !password) {
      return Response.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 400 });
    }

    // First user gets admin role automatically
    const totalUsers = await countUsers();
    const role = totalUsers === 0 ? 'admin' : 'viewer';

    const user = await createUser(email, name, password, role);
    await createSession(user.id);

    return Response.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
