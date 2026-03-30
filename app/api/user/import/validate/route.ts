import { prisma } from '@/lib/prisma';
import { importDataSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, MAX_REQUEST_SIZE, parseRequestBody, withAuth } from '@/lib/api-utils';
import { canCreateResource, getUserUsage } from '@/lib/billing';
import { isSaasMode } from '@/lib/features';

import { z } from 'zod';

type ImportData = z.infer<typeof importDataSchema>;

export const POST = withAuth(async (request, session) => {
  try {
    // Use larger size limit for import data (5MB)
    const body = await parseRequestBody(request, MAX_REQUEST_SIZE * 5);
    const validation = validateRequest(importDataSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const data: ImportData = validation.data;

    // In non-SaaS mode, always allow
    if (!isSaasMode()) {
      return apiResponse.ok({
        valid: true,
        newPeopleCount: data.people.length,
        newGroupsCount: data.groups.length,
        journalEntries: data.journalEntries?.length || 0,
      });
    }

    // Get current usage
    const currentUsage = await getUserUsage(session.user.id);

    // Count how many NEW people will be created (not existing ones)
    let newPeopleCount = 0;
    for (const person of data.people) {
      const existingPerson = await prisma.person.findFirst({
        where: {
          userId: session.user.id,
          deletedAt: null,
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
      return apiResponse.ok({
        valid: false,
        error: 'people',
        message:
          `Import would exceed your plan limit. You would have ${totalAfterImport} people ` +
          `but your plan allows ${usageCheck.limit}. You need to add ${newPeopleCount} new people ` +
          `but only have ${usageCheck.limit - currentUsage.people} slots remaining. ` +
          `Please upgrade your plan or reduce the import size.`,
        current: currentUsage.people,
        newCount: newPeopleCount,
        limit: usageCheck.limit,
        totalAfterImport,
      });
    }

    // Count how many NEW groups will be created
    let newGroupsCount = 0;
    for (const group of data.groups) {
      const existingGroup = await prisma.group.findFirst({
        where: {
          userId: session.user.id,
          deletedAt: null,
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
      return apiResponse.ok({
        valid: false,
        error: 'groups',
        message:
          `Import would exceed your group limit. You would have ${totalGroupsAfterImport} groups ` +
          `but your plan allows ${groupsCheck.limit}. You need to add ${newGroupsCount} new groups ` +
          `but only have ${groupsCheck.limit - currentUsage.groups} slots remaining. ` +
          `Please upgrade your plan or reduce the import size.`,
        current: currentUsage.groups,
        newCount: newGroupsCount,
        limit: groupsCheck.limit,
        totalAfterImport,
      });
    }

    return apiResponse.ok({
      valid: true,
      newPeopleCount,
      newGroupsCount,
      journalEntries: data.journalEntries?.length || 0,
      currentPeople: currentUsage.people,
      currentGroups: currentUsage.groups,
      peopleLimit: usageCheck.limit,
      groupsLimit: groupsCheck.limit,
    });
  } catch (error) {
    return handleApiError(error, 'user-import-validate');
  }
});
