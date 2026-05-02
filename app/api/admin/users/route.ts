import { getSession }  from '../../../lib/auth';
import { getAllUsers, createUser } from '../../../lib/db/users';

// GET — list all users
export async function GET() {
  try {
    const user = await getSession();
    if (!user)                return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' },       { status: 403 });

    const users = await getAllUsers();
    return Response.json({ users });
  } catch (err) {
    console.error('GET users error:', err);
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
} // end of GET

// POST — create a new user
export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user)                return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' },       { status: 403 });

    const { email, name, password, role } = await request.json();

    if (!email || !name || !password) {
      return Response.json({ error: 'Email, name and password are required' }, { status: 400 });
    } // end if missing fields

    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    } // end if short password

    const newUser = await createUser(email, name, password, role || 'viewer');
    return Response.json({ user: newUser });
  } catch (err: any) {
    console.error('POST user error:', err);
    if (err.code === '23505') {
      return Response.json({ error: 'Email already registered' }, { status: 400 });
    } // end if duplicate email
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
} // end of POST
