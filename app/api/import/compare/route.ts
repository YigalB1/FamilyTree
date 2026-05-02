import { getSession } from '../../../lib/auth';
import { parseGedcom } from '../../../lib/parseGedcom';
import { compareGedcomWithDb } from '../../../lib/compareGedcom';

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const formData = await request.formData();
    const file     = formData.get('file') as File;
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    // Parse GEDCOM
    const text   = await file.text();
    const parsed = parseGedcom(text);

    // Compare with database
    const result = await compareGedcomWithDb(parsed);

    return Response.json({
      success:  true,
      filename: file.name,
      ...result,
    });
  } catch (err) {
    console.error('Compare error:', err);
    return Response.json({ error: 'Comparison failed' }, { status: 500 });
  }
} // end of POST
