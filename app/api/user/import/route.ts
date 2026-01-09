import { prisma } from '@/lib/prisma';
import { importDataSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, MAX_REQUEST_SIZE, parseRequestBody, withAuth } from '@/lib/api-utils';
import { canCreateResource, getUserUsage } from '@/lib/billing';
import { isSaasMode } from '@/lib/features';

import { z } from 'zod';

type ImportData = z.infer<typeof importDataSchema>;
type ImportRequestBody = ImportData & { groupIds?: string[] };

export const POST = withAuth(async (request, session) => {
  try {
    // Use larger size limit for import data (5MB)
    const body = await parseRequestBody(request, MAX_REQUEST_SIZE * 5);
    const validation = validateRequest(importDataSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const data: ImportData = validation.data;

    // Check if we're importing specific groups
    const selectedGroupIds = (body as ImportRequestBody)?.groupIds;
    let filteredData = data;

    if (selectedGroupIds && selectedGroupIds.length > 0) {
      // Filter groups to only include selected ones
      const selectedGroups = data.groups.filter(g => selectedGroupIds.includes(g.id));

      // Get people who are members of at least one selected group
      const selectedGroupNames = selectedGroups.map(g => g.name);
      const filteredPeople = data.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      // Get the IDs of people we're importing
      const filteredPeopleIds = new Set(filteredPeople.map(p => p.id));

      // Filter people's relationships to only include relationships with other people we're importing
      const filteredPeopleWithRelationships = filteredPeople.map(person => ({
        ...person,
        relationships: person.relationships.filter(rel =>
          filteredPeopleIds.has(rel.relatedPersonId)
        ),
      }));

      // Update filteredData to only include selected groups, filtered people, and all relationship types
      filteredData = {
        ...data,
        groups: selectedGroups,
        people: filteredPeopleWithRelationships,
      };
    }

    // Check tier limits before importing (only in SaaS mode)
    if (isSaasMode()) {
      // Get current usage
      const currentUsage = await getUserUsage(session.user.id);

      // Count how many NEW people will be created (not existing ones)
      let newPeopleCount = 0;
      for (const person of filteredData.people) {
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

        if (!existingPerson) {
          newPeopleCount++;
        }
      }

      // Check if adding these people would exceed the limit
      const usageCheck = await canCreateResource(session.user.id, 'people');
      const totalAfterImport = currentUsage.people + newPeopleCount;

      if (!usageCheck.isUnlimited && totalAfterImport > usageCheck.limit) {
        return apiResponse.forbidden(
          `Import would exceed your plan limit. You would have ${totalAfterImport} people ` +
          `but your plan allows ${usageCheck.limit}. You need to add ${newPeopleCount} new people ` +
          `but only have ${usageCheck.limit - currentUsage.people} slots remaining. ` +
          `Please upgrade your plan or reduce the import size.`
        );
      }

      // Count how many NEW groups will be created
      let newGroupsCount = 0;
      for (const group of filteredData.groups) {
        const existingGroup = await prisma.group.findFirst({
          where: {
            userId: session.user.id,
            name: {
              equals: group.name,
              mode: 'insensitive',
            },
          },
        });

        if (!existingGroup) {
          newGroupsCount++;
        }
      }

      // Check if adding these groups would exceed the limit
      const groupsCheck = await canCreateResource(session.user.id, 'groups');
      const totalGroupsAfterImport = currentUsage.groups + newGroupsCount;

      if (!groupsCheck.isUnlimited && totalGroupsAfterImport > groupsCheck.limit) {
        return apiResponse.forbidden(
          `Import would exceed your group limit. You would have ${totalGroupsAfterImport} groups ` +
          `but your plan allows ${groupsCheck.limit}. You need to add ${newGroupsCount} new groups ` +
          `but only have ${groupsCheck.limit - currentUsage.groups} slots remaining. ` +
          `Please upgrade your plan or reduce the import size.`
        );
      }
    }

    // Track mapping of old IDs to new IDs
    const groupIdMap = new Map<string, string>();
    const personIdMap = new Map<string, string>();
    const relationshipTypeIdMap = new Map<string, string>();

    // Support both old field name (customRelationshipTypes) and new field name (relationshipTypes)
    const importRelationshipTypes = data.relationshipTypes || data.customRelationshipTypes;

    // 1. Import relationship types first
    if (importRelationshipTypes && importRelationshipTypes.length > 0) {
      for (const relType of importRelationshipTypes) {
        // Check if a relationship type with this name already exists (case-insensitive, including defaults)
        const existing = await prisma.relationshipType.findFirst({
          where: {
            userId: session.user.id,
            name: { equals: relType.name, mode: 'insensitive' },
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
            },
          });
          relationshipTypeIdMap.set(relType.id, newRelType.id);
        }
      }

      // Update inverse relationships
      for (const relType of importRelationshipTypes) {
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
    for (const group of filteredData.groups) {
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
    for (const person of filteredData.people) {
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
              userId: session.user.id,
              name: person.relationshipToUser.name,
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
        const oldGroup = filteredData.groups.find((g) => g.name === groupName);
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
    for (const person of filteredData.people) {
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
              userId: session.user.id,
              name: relationship.relationshipType.name,
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

    return apiResponse.ok({
      success: true,
      imported: {
        groups: groupIdMap.size,
        people: personIdMap.size,
        relationshipTypes: relationshipTypeIdMap.size,
      },
    });
  } catch (error) {
    return handleApiError(error, 'user-import');
  }
});
