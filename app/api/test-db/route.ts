import { testConnection } from '../../lib/db/test';

export async function GET() {
  const ok = await testConnection();
  return Response.json({ connected: ok });
}