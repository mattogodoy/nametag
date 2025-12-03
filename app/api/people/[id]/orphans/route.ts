import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/people/[id]/orphans - Check which people would become orphans if this person is deleted
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get all people related to this person (both directions)
    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [
          { personId: id },
          { relatedPersonId: id },
        ],
      },
      include: {
        person: {
          include: {
            relationshipToUser: true,
          },
        },
        relatedPerson: {
          include: {
            relationshipToUser: true,
          },
        },
      },
    });

    // Get unique person IDs related to this person
    const relatedPersonIds = new Set<string>();
    relationships.forEach((rel) => {
      if (rel.personId === id && rel.relatedPersonId) {
        relatedPersonIds.add(rel.relatedPersonId);
      }
      if (rel.relatedPersonId === id && rel.personId) {
        relatedPersonIds.add(rel.personId);
      }
    });

    // For each related person, check if they would become orphans
    const potentialOrphans = [];

    for (const relatedPersonId of relatedPersonIds) {
      // Get all relationships for this related person
      const relatedPersonRelationships = await prisma.relationship.findMany({
        where: {
          OR: [
            { personId: relatedPersonId },
            { relatedPersonId: relatedPersonId },
          ],
        },
      });

      // Count relationships excluding the one with the person being deleted
      const otherRelationships = relatedPersonRelationships.filter(
        (rel) => rel.personId !== id && rel.relatedPersonId !== id
      );

      // Check if this person has a direct relationship to the user
      const relatedPerson = await prisma.person.findUnique({
        where: { id: relatedPersonId },
        select: {
          id: true,
          fullName: true,
          relationshipToUserId: true,
        },
      });

      // A person becomes an orphan if:
      // 1. They have no direct relationship to the user (relationshipToUserId is null)
      // 2. After deleting this person, they would have no other relationships
      if (relatedPerson && !relatedPerson.relationshipToUserId && otherRelationships.length === 0) {
        potentialOrphans.push({
          id: relatedPerson.id,
          fullName: relatedPerson.fullName,
        });
      }
    }

    return NextResponse.json({ orphans: potentialOrphans });
  } catch (error) {
    console.error('Error checking for orphans:', error);
    return NextResponse.json(
      { error: 'Failed to check for orphans' },
      { status: 500 }
    );
  }
}
