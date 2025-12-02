import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/people - List all people for the current user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const people = await prisma.person.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 }
    );
  }
}

// POST /api/people - Create a new person
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, birthDate, phone, address, lastContact, notes, groupIds } =
      body;

    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    const person = await prisma.person.create({
      data: {
        userId: session.user.id,
        fullName,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone: phone || null,
        address: address || null,
        lastContact: lastContact ? new Date(lastContact) : null,
        notes: notes || null,
        groups: groupIds
          ? {
              create: groupIds.map((groupId: string) => ({
                groupId,
              })),
            }
          : undefined,
      },
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
    });

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: 'Failed to create person' },
      { status: 500 }
    );
  }
}
