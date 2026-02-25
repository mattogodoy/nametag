import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/openapi';
import { withLogging } from '@/lib/api-utils';

// GET /api/openapi.json - Serve the OpenAPI 3.1.0 specification
// Intentionally unauthenticated — the spec is public documentation.
export const GET = withLogging(async function GET() {
  const spec = generateOpenAPISpec();
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
