import { getSession } from '../../lib/auth';
import { parseGedcom } from '../../lib/parseGedcom';
import { importGedcomToDb } from '../../lib/importToDb';

export async function POST(request: Request) {
  try {
    // Check auth
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    // Get form data
    const formData = await request.formData();
    const file     = formData.get('file') as File;
    const source   = formData.get('source') as string || 'Geni';

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    // Parse GEDCOM
    const text   = await file.text();
    const parsed = parseGedcom(text);

    // Import to database
    const result = await importGedcomToDb(parsed, file.name, source, user.id);

    return Response.json({
      success: true,
      ...result,
      totalPersons:  parsed.persons.length,
      totalFamilies: parsed.families.length,
    });
  } catch (err) {
    console.error('Import error:', err);
    return Response.json({ error: 'Import failed' }, { status: 500 });
  }
}
