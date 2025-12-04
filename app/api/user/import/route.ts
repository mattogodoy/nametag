import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ImportData {
  version: string;
  exportDate: string;
  groups: Array<{
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
  }>;
  people: Array<{
    id: string;
    fullName: string;
    birthDate?: string | null;
    phone?: string | null;
    address?: string | null;
    lastContact?: string | null;
    notes?: string | null;
    relationshipToUser?: {
      name: string;
      label: string;
    } | null;
    groups: string[];
    relationships: Array<{
      relatedPersonId: string;
      relatedPersonName: string;
      relationshipType?: {
        name: string;
        label: string;
      } | null;
      notes?: string | null;
    }>;
  }>;
  customRelationshipTypes: Array<{
    id: string;
    name: string;
    label: string;
    color?: string | null;
    inverseId?: string | null;
  }>;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data: ImportData = await request.json();

    // Validate data structure
    if (!data.version || !data.groups || !data.people) {
      return NextResponse.json(
        { error: 'Invalid import file format' },
        { status: 400 }
      );
    }

    // Track mapping of old IDs to new IDs
    const groupIdMap = new Map<string, string>();
    const personIdMap = new Map<string, string>();
    const relationshipTypeIdMap = new Map<string, string>();

    // 1. Import custom relationship types first
    if (data.customRelationshipTypes && data.customRelationshipTypes.length > 0) {
      for (const relType of data.customRelationshipTypes) {
        // Check if a relationship type with this name already exists
        const existing = await prisma.relationshipType.findFirst({
          where: {
            userId: session.user.id,
            name: relType.name,
          },
        });

        if (existing) {
          relationshipTypeIdMap.set(relType.id, existing.id);
        } else {
          // Create new relationship type (without inverse for now)
          const newRelType = await prisma.relationshipType.create({
            data: {
              userId: session.user.id,
              name: relType.name,
              label: relType.label,
              color: relType.color,
              isDefault: false,
            },
          });
          relationshipTypeIdMap.set(relType.id, newRelType.id);
        }
      }

      // Update inverse relationships
      for (const relType of data.customRelationshipTypes) {
        if (relType.inverseId) {
          const newId = relationshipTypeIdMap.get(relType.id);
          const newInverseId = relationshipTypeIdMap.get(relType.inverseId);

          if (newId && newInverseId) {
            await prisma.relationshipType.update({
              where: { id: newId },
              data: { inverseId: newInverseId },
            });
          }
        }
      }
    }

    // 2. Import groups
    for (const group of data.groups) {
      const newGroup = await prisma.group.create({
        data: {
          userId: session.user.id,
          name: group.name,
          description: group.description,
          color: group.color,
        },
      });
      groupIdMap.set(group.id, newGroup.id);
    }

    // 3. Import people (without relationships first)
    for (const person of data.people) {
      // Find relationship type to user by name
      let relationshipToUserId: string | null = null;
      if (person.relationshipToUser) {
        const relType = await prisma.relationshipType.findFirst({
          where: {
            OR: [
              { userId: null, name: person.relationshipToUser.name }, // Default types
              { userId: session.user.id, name: person.relationshipToUser.name }, // Custom types
            ],
          },
        });
        relationshipToUserId = relType?.id || null;
      }

      const newPerson = await prisma.person.create({
        data: {
          userId: session.user.id,
          fullName: person.fullName,
          birthDate: person.birthDate ? new Date(person.birthDate) : null,
          phone: person.phone,
          address: person.address,
          lastContact: person.lastContact ? new Date(person.lastContact) : null,
          notes: person.notes,
          relationshipToUserId,
        },
      });
      personIdMap.set(person.id, newPerson.id);

      // Add person to groups
      for (const groupName of person.groups) {
        // Find the group by name (since we just created them)
        const oldGroup = data.groups.find((g) => g.name === groupName);
        if (oldGroup) {
          const newGroupId = groupIdMap.get(oldGroup.id);
          if (newGroupId) {
            await prisma.personGroup.create({
              data: {
                personId: newPerson.id,
                groupId: newGroupId,
              },
            });
          }
        }
      }
    }

    // 4. Import relationships between people
    for (const person of data.people) {
      const newPersonId = personIdMap.get(person.id);
      if (!newPersonId) continue;

      for (const relationship of person.relationships) {
        const newRelatedPersonId = personIdMap.get(relationship.relatedPersonId);
        if (!newRelatedPersonId) continue;

        // Find relationship type by name
        let relationshipTypeId: string | null = null;
        if (relationship.relationshipType) {
          const relType = await prisma.relationshipType.findFirst({
            where: {
              OR: [
                { userId: null, name: relationship.relationshipType.name }, // Default types
                { userId: session.user.id, name: relationship.relationshipType.name }, // Custom types
              ],
            },
          });
          relationshipTypeId = relType?.id || null;
        }

        // Check if relationship already exists (to avoid duplicates)
        const existingRel = await prisma.relationship.findFirst({
          where: {
            personId: newPersonId,
            relatedPersonId: newRelatedPersonId,
          },
        });

        if (!existingRel) {
          await prisma.relationship.create({
            data: {
              personId: newPersonId,
              relatedPersonId: newRelatedPersonId,
              relationshipTypeId,
              notes: relationship.notes,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: {
        groups: groupIdMap.size,
        people: personIdMap.size,
        customRelationshipTypes: relationshipTypeIdMap.size,
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data. Please check the file format and try again.' },
      { status: 500 }
    );
  }
}
