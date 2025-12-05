import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { importDataSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

import { z } from 'zod';

type ImportData = z.infer<typeof importDataSchema>;

export const POST = withAuth(async (request, session) => {
  try {
    const body = await request.json();
    const validation = validateRequest(importDataSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const data: ImportData = validation.data;

    // Track mapping of old IDs to new IDs
    const groupIdMap = new Map<string, string>();
    const personIdMap = new Map<string, string>();
    const relationshipTypeIdMap = new Map<string, string>();

    // 1. Import custom relationship types first
    if (data.customRelationshipTypes && data.customRelationshipTypes.length > 0) {
      for (const relType of data.customRelationshipTypes) {
        // Check if a relationship type with this name already exists (case-insensitive, including defaults)
        const existing = await prisma.relationshipType.findFirst({
          where: {
            OR: [
              { userId: null, name: { equals: relType.name, mode: 'insensitive' } }, // Default types
              { userId: session.user.id, name: { equals: relType.name, mode: 'insensitive' } }, // User's custom types
            ],
          },
        });

        if (existing) {
          // Reuse existing relationship type
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
      // Check if a group with the same name already exists (case-insensitive)
      const existingGroup = await prisma.group.findFirst({
        where: {
          userId: session.user.id,
          name: {
            equals: group.name,
            mode: 'insensitive',
          },
        },
      });

      if (existingGroup) {
        // Reuse existing group
        groupIdMap.set(group.id, existingGroup.id);
      } else {
        // Create new group
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
    }

    // 3. Import people (without relationships first)
    for (const person of data.people) {
      // Check if a person with the same name already exists (case-insensitive)
      const existingPerson = await prisma.person.findFirst({
        where: {
          userId: session.user.id,
          name: {
            equals: person.name,
            mode: 'insensitive',
          },
          surname: person.surname
            ? {
                equals: person.surname,
                mode: 'insensitive',
              }
            : null,
        },
      });

      let personId: string;

      if (existingPerson) {
        // Reuse existing person
        personId = existingPerson.id;
        personIdMap.set(person.id, existingPerson.id);
      } else {
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

        // Create new person
        const newPerson = await prisma.person.create({
          data: {
            userId: session.user.id,
            name: person.name,
            surname: person.surname,
            nickname: person.nickname,
            lastContact: person.lastContact ? new Date(person.lastContact) : null,
            notes: person.notes,
            relationshipToUserId,
          },
        });
        personId = newPerson.id;
        personIdMap.set(person.id, newPerson.id);
      }

      // Add person to groups
      for (const groupName of person.groups) {
        // Find the group by name (since we just created them)
        const oldGroup = data.groups.find((g) => g.name === groupName);
        if (oldGroup) {
          const newGroupId = groupIdMap.get(oldGroup.id);
          if (newGroupId) {
            // Check if person-group relationship already exists
            const existingPersonGroup = await prisma.personGroup.findUnique({
              where: {
                personId_groupId: {
                  personId: personId,
                  groupId: newGroupId,
                },
              },
            });

            // Only create if it doesn't exist
            if (!existingPersonGroup) {
              await prisma.personGroup.create({
                data: {
                  personId: personId,
                  groupId: newGroupId,
                },
              });
            }
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

        // Check if this specific relationship already exists (to avoid duplicates)
        const existingRel = await prisma.relationship.findFirst({
          where: {
            personId: newPersonId,
            relatedPersonId: newRelatedPersonId,
            relationshipTypeId: relationshipTypeId,
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
    return handleApiError(error, 'user-import');
  }
});
