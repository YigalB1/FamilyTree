import { getSession }          from '../../lib/auth';
import { runDataQualityChecks } from '../../lib/dataQuality';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const result = await runDataQualityChecks();
    return Response.json(result);
  } catch (err) {
    console.error('Quality check error:', err);
    return Response.json({ error: 'Quality check failed' }, { status: 500 });
  }
} // end of GET
