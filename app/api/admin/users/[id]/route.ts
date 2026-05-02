import { getSession }      from '../../../../lib/auth';
import { updateUserRole }  from '../../../../lib/db/users';
import pool                from '../../../../lib/db/client';
import bcrypt              from 'bcryptjs';

// PATCH — update role or password
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user)                return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' },       { status: 403 });

    const { id }                   = await params;
    const { role, password, name } = await request.json();

    // Prevent admin from demoting themselves
    if (id === user.id && role && role !== 'admin') {
      return Response.json({ error: 'You cannot change your own role' }, { status: 400 });
    } // end if self-demotion

    if (role) {
      await updateUserRole(id, role);
    } // end if role

    if (name) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, id]);
    } // end if name

    if (password) {
      if (password.length < 6) {
        return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      } // end if short password
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    } // end if password

    // Return updated user
    const result = await pool.query(
      'SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1', [id]
    );
    return Response.json({ user: result.rows[0] });
  } catch (err) {
    console.error('PATCH user error:', err);
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
} // end of PATCH

// DELETE — remove a user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user)                return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' },       { status: 403 });

    const { id } = await params;

    // Prevent admin from deleting themselves
    if (id === user.id) {
      return Response.json({ error: 'You cannot delete your own account' }, { status: 400 });
    } // end if self-delete

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return Response.json({ success: true });
  } catch (err) {
    console.error('DELETE user error:', err);
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
} // end of DELETE
