import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/openapi';

// GET /api/openapi.json - Serve the OpenAPI 3.1.0 specification
export async function GET() {
  const spec = generateOpenAPISpec();
  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
