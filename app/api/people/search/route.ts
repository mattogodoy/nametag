import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  // Only search if query is at least 1 character
  if (query.length === 0) {
    return NextResponse.json({ people: [] });
  }

  const people = await prisma.person.findMany({
    where: {
      userId: session.user.id,
      fullName: {
        contains: query,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      fullName: true,
    },
    orderBy: {
      fullName: 'asc',
    },
    take: 20, // Limit to 20 results
  });

  return NextResponse.json({ people });
}
