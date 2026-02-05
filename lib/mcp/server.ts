import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prisma } from '../prisma';
import { sanitizeName, sanitizeNotes } from '../sanitize';
import { canCreateResource, canEnableReminder } from '../billing';
import pkg from '../../package.json';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type NametagMcpServerOptions = {
  userId: string | null;
};

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const reminderIntervalUnitSchema = z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']);
const reminderTypeSchema = z.enum(['ONCE', 'RECURRING']);

const importantDateInputSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  reminderEnabled: z.boolean().optional(),
  reminderType: reminderTypeSchema.nullish(),
  reminderInterval: z.number().int().min(1).max(99).nullish(),
  reminderIntervalUnit: reminderIntervalUnitSchema.nullish(),
});

function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function requireUserId(userId: string | null): string | null {
  return userId ?? null;
}

async function ensureGroupOwnership(userId: string, groupIds: string[]): Promise<boolean> {
  if (groupIds.length === 0) {
    return true;
  }

  const groups = await prisma.group.findMany({
    where: {
      userId,
      id: { in: groupIds },
    },
    select: { id: true },
  });

  return groups.length === groupIds.length;
}

function normalizeRelationshipName(name: string): string {
  return name.toUpperCase().replace(/\s+/g, '_');
}

export function createNametagMcpServer(
  options: NametagMcpServerOptions = { userId: null }
): McpServer {
  const userId = options.userId;
  const server = new McpServer(
    {
      name: 'nametag',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        'Nametag MCP server provides read/write access to people, groups, relationships, and reminders. Authenticate with a NextAuth session token (Authorization: Bearer <token>) or configure MCP_DEFAULT_USER_ID for local development.',
    }
  );

  server.registerTool(
    'list_people',
    {
      title: 'List people',
      description: 'List people in the authenticated user\'s network, ordered by most recently updated.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of people to return'),
      },
    },
    async ({ limit }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const people = await prisma.person.findMany({
        where: { userId: resolvedUserId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          relationshipToUser: true,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              people.map((person) => ({
                id: person.id,
                name: person.name,
                surname: person.surname,
                nickname: person.nickname,
                lastContact: person.lastContact,
                relationship: person.relationshipToUser?.label ?? null,
                updatedAt: person.updatedAt,
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    'search_people',
    {
      title: 'Search people',
      description: 'Search people by name, surname, or nickname.',
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of people to return'),
      },
    },
    async ({ query, limit }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const people = await prisma.person.findMany({
        where: {
          userId: resolvedUserId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { surname: { contains: query, mode: 'insensitive' } },
            { nickname: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(people, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'get_person',
    {
      title: 'Get person details',
      description: 'Fetch a person record including groups and important dates.',
      inputSchema: {
        personId: z.string().describe('Person ID to fetch'),
      },
    },
    async ({ personId }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const person = await prisma.person.findUnique({
        where: { id: personId, userId: resolvedUserId },
        include: {
          groups: {
            include: {
              group: true,
            },
          },
          importantDates: true,
          relationshipToUser: true,
        },
      });

      if (!person) {
        return errorResult(`No person found for id ${personId}.`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(person, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'create_person',
    {
      title: 'Create person',
      description: 'Create a new person in the authenticated user\'s network.',
      inputSchema: {
        name: z.string().min(1).max(100),
        surname: z.string().max(100).nullable().optional(),
        middleName: z.string().max(100).nullable().optional(),
        secondLastName: z.string().max(100).nullable().optional(),
        nickname: z.string().max(100).nullable().optional(),
        lastContact: z.string().nullable().optional(),
        notes: z.string().max(10000).nullable().optional(),
        relationshipToUserId: z.string().nullable().optional(),
        groupIds: z.array(z.string()).optional(),
        connectedThroughId: z.string().optional(),
        importantDates: z.array(importantDateInputSchema).optional(),
        contactReminderEnabled: z.boolean().optional(),
        contactReminderInterval: z.number().int().min(1).max(99).nullable().optional(),
        contactReminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),
      },
    },
    async (input): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const usageCheck = await canCreateResource(resolvedUserId, 'people');
      if (!usageCheck.allowed) {
        return errorResult(
          `You've reached your plan limit of ${usageCheck.limit} people. Please upgrade your plan to add more.`
        );
      }

      const {
        name,
        surname,
        middleName,
        secondLastName,
        nickname,
        lastContact,
        notes,
        relationshipToUserId,
        groupIds,
        connectedThroughId,
        importantDates,
        contactReminderEnabled,
        contactReminderInterval,
        contactReminderIntervalUnit,
      } = input;

      if (!relationshipToUserId) {
        if (connectedThroughId) {
          return errorResult('Relationship type is required for person-to-person connections.');
        }
        return errorResult('Relationship to user is required.');
      }

      if (connectedThroughId) {
        const basePerson = await prisma.person.findUnique({
          where: { id: connectedThroughId, userId: resolvedUserId },
        });

        if (!basePerson) {
          return errorResult('Base connection person not found.');
        }
      }

      if (relationshipToUserId) {
        const relationshipType = await prisma.relationshipType.findFirst({
          where: { id: relationshipToUserId, userId: resolvedUserId },
        });

        if (!relationshipType) {
          return errorResult('Relationship type not found.');
        }
      }

      const newRemindersCount =
        (contactReminderEnabled ? 1 : 0) +
        (importantDates?.filter((d) => d.reminderEnabled).length ?? 0);

      if (newRemindersCount > 0) {
        const reminderCheck = await canEnableReminder(resolvedUserId);
        if (!reminderCheck.isUnlimited) {
          const remainingSlots = reminderCheck.limit - reminderCheck.current;
          if (newRemindersCount > remainingSlots) {
            return errorResult(
              `You can only add ${remainingSlots} more reminder(s) on your current plan (limit: ${reminderCheck.limit}).`
            );
          }
        }
      }

      if (groupIds && !(await ensureGroupOwnership(resolvedUserId, groupIds))) {
        return errorResult('One or more groups were not found for this user.');
      }

      const sanitizedName = sanitizeName(name) || name;
      const sanitizedSurname = surname ? sanitizeName(surname) : null;
      const sanitizedMiddleName = middleName ? sanitizeName(middleName) : null;
      const sanitizedSecondLastName = secondLastName ? sanitizeName(secondLastName) : null;
      const sanitizedNickname = nickname ? sanitizeName(nickname) : null;
      const sanitizedNotes = notes ? sanitizeNotes(notes) : null;

      const personData = {
        user: {
          connect: { id: resolvedUserId },
        },
        name: sanitizedName,
        surname: sanitizedSurname,
        middleName: sanitizedMiddleName,
        secondLastName: sanitizedSecondLastName,
        nickname: sanitizedNickname,
        lastContact: lastContact ? new Date(lastContact) : null,
        notes: sanitizedNotes,
        contactReminderEnabled: contactReminderEnabled ?? false,
        contactReminderInterval: contactReminderEnabled ? contactReminderInterval : null,
        contactReminderIntervalUnit: contactReminderEnabled ? contactReminderIntervalUnit : null,
        groups: groupIds
          ? {
              create: groupIds.map((groupId) => ({
                groupId,
              })),
            }
          : undefined,
        importantDates:
          importantDates && importantDates.length > 0
            ? {
                create: importantDates.map((date) => ({
                  title: date.title,
                  date: new Date(date.date),
                  reminderEnabled: date.reminderEnabled ?? false,
                  reminderType: date.reminderEnabled ? date.reminderType : null,
                  reminderInterval:
                    date.reminderEnabled && date.reminderType === 'RECURRING'
                      ? date.reminderInterval
                      : null,
                  reminderIntervalUnit:
                    date.reminderEnabled && date.reminderType === 'RECURRING'
                      ? date.reminderIntervalUnit
                      : null,
                })),
              }
            : undefined,
        relationshipToUser: !connectedThroughId && relationshipToUserId
          ? { connect: { id: relationshipToUserId } }
          : undefined,
      };

      const person = await prisma.person.create({
        data: personData,
        include: {
          groups: {
            include: {
              group: true,
            },
          },
        },
      });

      if (connectedThroughId) {
        const relationshipType = await prisma.relationshipType.findUnique({
          where: { id: relationshipToUserId },
          select: { inverseId: true },
        });

        await prisma.relationship.create({
          data: {
            personId: person.id,
            relatedPersonId: connectedThroughId,
            relationshipTypeId: relationshipToUserId,
          },
        });

        await prisma.relationship.create({
          data: {
            personId: connectedThroughId,
            relatedPersonId: person.id,
            relationshipTypeId: relationshipType?.inverseId || relationshipToUserId,
          },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(person, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_person',
    {
      title: 'Update person',
      description: 'Update fields for a person in the authenticated user\'s network.',
      inputSchema: {
        personId: z.string().describe('Person ID to update'),
        name: z.string().min(1).max(100).optional(),
        surname: z.string().max(100).nullable().optional(),
        middleName: z.string().max(100).nullable().optional(),
        secondLastName: z.string().max(100).nullable().optional(),
        nickname: z.string().max(100).nullable().optional(),
        lastContact: z.string().nullable().optional(),
        notes: z.string().max(10000).nullable().optional(),
        relationshipToUserId: z.string().nullable().optional(),
        groupIds: z.array(z.string()).optional(),
        importantDates: z.array(importantDateInputSchema).optional(),
        contactReminderEnabled: z.boolean().optional(),
        contactReminderInterval: z.number().int().min(1).max(99).nullable().optional(),
        contactReminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),
      },
    },
    async ({ personId, ...input }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existingPerson = await prisma.person.findUnique({
        where: {
          id: personId,
          userId: resolvedUserId,
        },
      });

      if (!existingPerson) {
        return errorResult('Person not found.');
      }

      const currentPersonReminders = await prisma.importantDate.count({
        where: { personId, reminderEnabled: true },
      });
      const currentContactReminder = existingPerson.contactReminderEnabled ? 1 : 0;

      const newContactReminder = input.contactReminderEnabled ? 1 : 0;
      const newImportantDateReminders =
        input.importantDates?.filter((d) => d.reminderEnabled).length ?? 0;

      const currentTotal = currentPersonReminders + currentContactReminder;
      const newTotal = newImportantDateReminders + newContactReminder;
      const netChange = newTotal - currentTotal;

      if (netChange > 0) {
        const reminderCheck = await canEnableReminder(resolvedUserId);
        if (!reminderCheck.isUnlimited) {
          const remainingSlots = reminderCheck.limit - reminderCheck.current;
          if (netChange > remainingSlots) {
            return errorResult(
              `You can only add ${remainingSlots} more reminder(s) on your current plan (limit: ${reminderCheck.limit}).`
            );
          }
        }
      }

      if (input.groupIds && !(await ensureGroupOwnership(resolvedUserId, input.groupIds))) {
        return errorResult('One or more groups were not found for this user.');
      }

      if (input.relationshipToUserId !== undefined && input.relationshipToUserId !== null) {
        const relationshipType = await prisma.relationshipType.findFirst({
          where: { id: input.relationshipToUserId, userId: resolvedUserId },
        });

        if (!relationshipType) {
          return errorResult('Relationship type not found.');
        }
      }

      const sanitizedName = input.name ? sanitizeName(input.name) || input.name : undefined;
      const sanitizedSurname = input.surname ? sanitizeName(input.surname) : null;
      const sanitizedMiddleName = input.middleName ? sanitizeName(input.middleName) : null;
      const sanitizedSecondLastName = input.secondLastName
        ? sanitizeName(input.secondLastName)
        : null;
      const sanitizedNickname = input.nickname ? sanitizeName(input.nickname) : null;
      const sanitizedNotes = input.notes ? sanitizeNotes(input.notes) : null;

      const updateData = {
        name: sanitizedName,
        surname: input.surname === undefined ? undefined : sanitizedSurname,
        middleName: input.middleName === undefined ? undefined : sanitizedMiddleName,
        secondLastName: input.secondLastName === undefined ? undefined : sanitizedSecondLastName,
        nickname: input.nickname === undefined ? undefined : sanitizedNickname,
        lastContact: input.lastContact ? new Date(input.lastContact) : input.lastContact === null ? null : undefined,
        notes: input.notes === undefined ? undefined : sanitizedNotes,
        contactReminderEnabled: input.contactReminderEnabled ?? false,
        contactReminderInterval: input.contactReminderEnabled ? input.contactReminderInterval : null,
        contactReminderIntervalUnit: input.contactReminderEnabled ? input.contactReminderIntervalUnit : null,
        groups: input.groupIds
          ? {
              deleteMany: {},
              create: input.groupIds.map((groupId) => ({
                groupId,
              })),
            }
          : undefined,
        importantDates: input.importantDates
          ? {
              deleteMany: {},
              create: input.importantDates.map((date) => ({
                title: date.title,
                date: new Date(date.date),
                reminderEnabled: date.reminderEnabled ?? false,
                reminderType: date.reminderEnabled ? date.reminderType : null,
                reminderInterval:
                  date.reminderEnabled && date.reminderType === 'RECURRING'
                    ? date.reminderInterval
                    : null,
                reminderIntervalUnit:
                  date.reminderEnabled && date.reminderType === 'RECURRING'
                    ? date.reminderIntervalUnit
                    : null,
              })),
            }
          : undefined,
        relationshipToUser:
          input.relationshipToUserId !== undefined
            ? input.relationshipToUserId
              ? { connect: { id: input.relationshipToUserId } }
              : { disconnect: true }
            : undefined,
      };

      const person = await prisma.person.update({
        where: {
          id: personId,
        },
        data: updateData,
        include: {
          groups: {
            include: {
              group: true,
            },
          },
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(person, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'delete_person',
    {
      title: 'Delete person',
      description: 'Soft delete a person (and optionally their orphans).',
      inputSchema: {
        personId: z.string().describe('Person ID to delete'),
        deleteOrphans: z.boolean().optional(),
        orphanIds: z.array(z.string()).optional(),
      },
    },
    async ({ personId, deleteOrphans, orphanIds }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existingPerson = await prisma.person.findUnique({
        where: {
          id: personId,
          userId: resolvedUserId,
        },
      });

      if (!existingPerson) {
        return errorResult('Person not found.');
      }

      await prisma.person.update({
        where: {
          id: personId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (deleteOrphans && orphanIds && Array.isArray(orphanIds)) {
        await prisma.person.updateMany({
          where: {
            id: {
              in: orphanIds,
            },
            userId: resolvedUserId,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      return {
        content: [{ type: 'text', text: 'Person deleted successfully.' }],
      };
    }
  );

  server.registerTool(
    'list_groups',
    {
      title: 'List groups',
      description: 'List groups defined for the authenticated user.',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const groups = await prisma.group.findMany({
        where: { userId: resolvedUserId },
        orderBy: { name: 'asc' },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(groups, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'create_group',
    {
      title: 'Create group',
      description: 'Create a new group and optionally add members.',
      inputSchema: {
        name: z.string().min(1).max(100),
        description: z.string().max(500).nullable().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        peopleIds: z.array(z.string()).optional(),
      },
    },
    async ({ name, description, color, peopleIds }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const usageCheck = await canCreateResource(resolvedUserId, 'groups');
      if (!usageCheck.allowed) {
        return errorResult(
          `You've reached your plan limit of ${usageCheck.limit} groups. Please upgrade your plan to add more.`
        );
      }

      const existingGroup = await prisma.group.findFirst({
        where: {
          userId: resolvedUserId,
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingGroup) {
        return errorResult('A group with this name already exists.');
      }

      if (peopleIds && peopleIds.length > 0) {
        const people = await prisma.person.findMany({
          where: {
            id: { in: peopleIds },
            userId: resolvedUserId,
          },
          select: { id: true },
        });

        if (people.length !== peopleIds.length) {
          return errorResult('One or more people were not found for this user.');
        }
      }

      const sanitizedName = sanitizeName(name) || name;
      const sanitizedDescription = description ? sanitizeNotes(description) : null;

      const group = await prisma.group.create({
        data: {
          userId: resolvedUserId,
          name: sanitizedName,
          description: sanitizedDescription,
          color: color || null,
          ...(peopleIds && peopleIds.length > 0 && {
            people: {
              create: peopleIds.map((personId) => ({
                person: {
                  connect: { id: personId },
                },
              })),
            },
          }),
        },
        include: {
          people: {
            include: {
              person: true,
            },
          },
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(group, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_group',
    {
      title: 'Update group',
      description: 'Update a group name/description/color.',
      inputSchema: {
        groupId: z.string().describe('Group ID to update'),
        name: z.string().min(1).max(100),
        description: z.string().max(500).nullable().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      },
    },
    async ({ groupId, name, description, color }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existingGroup = await prisma.group.findUnique({
        where: {
          id: groupId,
          userId: resolvedUserId,
        },
      });

      if (!existingGroup) {
        return errorResult('Group not found.');
      }

      const duplicateGroup = await prisma.group.findFirst({
        where: {
          userId: resolvedUserId,
          name: {
            equals: name,
            mode: 'insensitive',
          },
          id: {
            not: groupId,
          },
        },
      });

      if (duplicateGroup) {
        return errorResult('A group with this name already exists.');
      }

      const group = await prisma.group.update({
        where: {
          id: groupId,
        },
        data: {
          name,
          description: description || null,
          color: color || null,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(group, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'delete_group',
    {
      title: 'Delete group',
      description: 'Soft delete a group and optionally delete its members.',
      inputSchema: {
        groupId: z.string().describe('Group ID to delete'),
        deletePeople: z.boolean().optional(),
      },
    },
    async ({ groupId, deletePeople }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existingGroup = await prisma.group.findUnique({
        where: {
          id: groupId,
          userId: resolvedUserId,
        },
        include: {
          people: {
            select: {
              personId: true,
            },
          },
        },
      });

      if (!existingGroup) {
        return errorResult('Group not found.');
      }

      if (deletePeople && existingGroup.people.length > 0) {
        const personIds = existingGroup.people.map((p) => p.personId);
        await prisma.person.updateMany({
          where: {
            id: { in: personIds },
            userId: resolvedUserId,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      await prisma.group.update({
        where: {
          id: groupId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        content: [{ type: 'text', text: 'Group deleted successfully.' }],
      };
    }
  );

  server.registerTool(
    'add_group_member',
    {
      title: 'Add group member',
      description: 'Add a person to a group.',
      inputSchema: {
        groupId: z.string().describe('Group ID'),
        personId: z.string().describe('Person ID'),
      },
    },
    async ({ groupId, personId }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const group = await prisma.group.findUnique({
        where: {
          id: groupId,
          userId: resolvedUserId,
        },
      });

      if (!group) {
        return errorResult('Group not found.');
      }

      const person = await prisma.person.findUnique({
        where: {
          id: personId,
          userId: resolvedUserId,
        },
      });

      if (!person) {
        return errorResult('Person not found.');
      }

      const existingMembership = await prisma.personGroup.findUnique({
        where: {
          personId_groupId: {
            personId,
            groupId,
          },
        },
      });

      if (existingMembership) {
        return errorResult('Person is already a member of this group.');
      }

      await prisma.personGroup.create({
        data: {
          personId,
          groupId,
        },
      });

      return {
        content: [{ type: 'text', text: 'Person added to group.' }],
      };
    }
  );

  server.registerTool(
    'remove_group_member',
    {
      title: 'Remove group member',
      description: 'Remove a person from a group.',
      inputSchema: {
        groupId: z.string().describe('Group ID'),
        personId: z.string().describe('Person ID'),
      },
    },
    async ({ groupId, personId }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const group = await prisma.group.findUnique({
        where: {
          id: groupId,
          userId: resolvedUserId,
        },
      });

      if (!group) {
        return errorResult('Group not found.');
      }

      const deleted = await prisma.personGroup.deleteMany({
        where: {
          personId,
          groupId,
        },
      });

      if (deleted.count === 0) {
        return errorResult('Person is not a member of this group.');
      }

      return {
        content: [{ type: 'text', text: 'Person removed from group.' }],
      };
    }
  );

  server.registerTool(
    'list_relationship_types',
    {
      title: 'List relationship types',
      description: 'List relationship types for the authenticated user.',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const relationshipTypes = await prisma.relationshipType.findMany({
        where: { userId: resolvedUserId, deletedAt: null },
        orderBy: { name: 'asc' },
        include: {
          inverse: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relationshipTypes, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'list_relationships',
    {
      title: 'List relationships',
      description:
        'List person-to-person relationships (edges) with relationship type details and minimal person info.',
      inputSchema: {
        personId: z.string().optional().describe('Filter by outgoing personId.'),
        relatedPersonId: z.string().optional().describe('Filter by incoming relatedPersonId.'),
        relationshipTypeId: z.string().optional().describe('Filter by relationship type ID.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of relationships to return'),
      },
    },
    async ({ personId, relatedPersonId, relationshipTypeId, limit }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const where: {
        deletedAt: null;
        relationshipTypeId: { not: null } | string;
        person: { userId: string; deletedAt: null };
        relatedPerson: { userId: string; deletedAt: null };
        relationshipType: { userId: string; deletedAt: null };
        OR?: Array<{ personId?: string; relatedPersonId?: string }>;
        personId?: string;
        relatedPersonId?: string;
      } = {
        deletedAt: null,
        relationshipTypeId: relationshipTypeId ?? { not: null },
        person: { userId: resolvedUserId, deletedAt: null },
        relatedPerson: { userId: resolvedUserId, deletedAt: null },
        relationshipType: { userId: resolvedUserId, deletedAt: null },
      };

      if (personId && relatedPersonId) {
        where.OR = [
          { personId, relatedPersonId },
          { personId: relatedPersonId, relatedPersonId: personId },
        ];
      } else if (personId) {
        where.personId = personId;
      } else if (relatedPersonId) {
        where.relatedPersonId = relatedPersonId;
      }

      const relationships = await prisma.relationship.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          relationshipType: {
            select: {
              id: true,
              name: true,
              label: true,
              color: true,
              inverseId: true,
            },
          },
          person: {
            select: {
              id: true,
              name: true,
              surname: true,
              nickname: true,
            },
          },
          relatedPerson: {
            select: {
              id: true,
              name: true,
              surname: true,
              nickname: true,
            },
          },
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relationships, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'list_relationships_to_user',
    {
      title: 'List relationships to user',
      description:
        'List person-to-user relationship edges (relationshipToUser) with relationship type details.',
      inputSchema: {
        relationshipTypeId: z.string().optional().describe('Filter by relationship type ID.'),
        relationshipTypeName: z
          .string()
          .optional()
          .describe('Filter by relationship type name (case-insensitive).'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of relationships to return'),
      },
    },
    async ({ relationshipTypeId, relationshipTypeName, limit }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const relationshipTypeFilter: {
        userId: string;
        deletedAt: null;
        id?: string;
        name?: { equals: string; mode: 'insensitive' };
      } = {
        userId: resolvedUserId,
        deletedAt: null,
      };

      if (relationshipTypeId) {
        relationshipTypeFilter.id = relationshipTypeId;
      }

      if (relationshipTypeName) {
        relationshipTypeFilter.name = { equals: relationshipTypeName, mode: 'insensitive' };
      }

      const people = await prisma.person.findMany({
        where: {
          userId: resolvedUserId,
          deletedAt: null,
          relationshipToUserId: { not: null },
          relationshipToUser: relationshipTypeFilter,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          surname: true,
          nickname: true,
          relationshipToUser: {
            select: {
              id: true,
              name: true,
              label: true,
              color: true,
              inverseId: true,
            },
          },
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(people, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'create_relationship_type',
    {
      title: 'Create relationship type',
      description: 'Create a relationship type and its inverse.',
      inputSchema: {
        name: z.string().min(1).max(50),
        label: z.string().min(1).max(50),
        color: hexColorSchema.nullable().optional(),
        inverseId: z.string().nullable().optional(),
        inverseLabel: z.string().max(50).optional(),
        symmetric: z.boolean().optional(),
      },
    },
    async ({ name, label, color, inverseId, inverseLabel, symmetric }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const normalizedName = normalizeRelationshipName(name);

      const existingType = await prisma.relationshipType.findFirst({
        where: {
          userId: resolvedUserId,
          name: { equals: normalizedName, mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (existingType) {
        return errorResult('A relationship type with this name already exists.');
      }

      if (symmetric) {
        const relationshipType = await prisma.relationshipType.create({
          data: {
            userId: resolvedUserId,
            name: normalizedName,
            label,
            color: color || null,
          },
        });

        const updatedType = await prisma.relationshipType.update({
          where: { id: relationshipType.id },
          data: { inverseId: relationshipType.id },
          include: {
            inverse: {
              select: {
                id: true,
                name: true,
                label: true,
              },
            },
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedType, null, 2),
            },
          ],
        };
      }

      let finalInverseId = inverseId || null;

      if (inverseId) {
        const inverseType = await prisma.relationshipType.findFirst({
          where: {
            id: inverseId,
            userId: resolvedUserId,
            deletedAt: null,
          },
        });

        if (!inverseType) {
          return errorResult('Inverse relationship type not found.');
        }

        if (inverseType.inverseId && inverseType.inverseId !== inverseType.id) {
          return errorResult('Inverse relationship type is already paired.');
        }

        if (inverseType.inverseId === inverseType.id) {
          return errorResult('Cannot use a symmetric relationship type as an inverse.');
        }
      }

      if (inverseLabel && !inverseId) {
        const inverseName = normalizeRelationshipName(inverseLabel);

        const existingInverseType = await prisma.relationshipType.findFirst({
          where: {
            userId: resolvedUserId,
            name: { equals: inverseName, mode: 'insensitive' },
            deletedAt: null,
          },
        });

        if (existingInverseType) {
          return errorResult(`The inverse relationship type "${inverseLabel}" already exists.`);
        }

        const inverseType = await prisma.relationshipType.create({
          data: {
            userId: resolvedUserId,
            name: inverseName,
            label: inverseLabel,
            color: color || null,
          },
        });

        finalInverseId = inverseType.id;
      }

      const relationshipType = await prisma.relationshipType.create({
        data: {
          userId: resolvedUserId,
          name: normalizedName,
          label,
          color: color || null,
          inverseId: finalInverseId,
        },
        include: {
          inverse: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
        },
      });

      if (finalInverseId) {
        await prisma.relationshipType.updateMany({
          where: { id: finalInverseId, userId: resolvedUserId },
          data: { inverseId: relationshipType.id },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relationshipType, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_relationship_type',
    {
      title: 'Update relationship type',
      description: 'Update a relationship type and keep its inverse consistent.',
      inputSchema: {
        relationshipTypeId: z.string().describe('Relationship type ID to update'),
        name: z.string().min(1).max(50),
        label: z.string().min(1).max(50),
        color: hexColorSchema.nullable().optional(),
        inverseId: z.string().nullable().optional(),
        inverseLabel: z.string().max(50).optional(),
        symmetric: z.boolean().optional(),
      },
    },
    async ({ relationshipTypeId, name, label, color, inverseId, inverseLabel, symmetric }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existing = await prisma.relationshipType.findFirst({
        where: {
          id: relationshipTypeId,
          userId: resolvedUserId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return errorResult('Relationship type not found.');
      }

      const normalizedName = normalizeRelationshipName(name);

      const duplicateType = await prisma.relationshipType.findFirst({
        where: {
          userId: resolvedUserId,
          name: { equals: normalizedName, mode: 'insensitive' },
          id: { not: relationshipTypeId },
          deletedAt: null,
        },
      });

      if (duplicateType) {
        return errorResult('A relationship type with this name already exists.');
      }

      let finalInverseId: string | null = inverseId ?? null;

      if (symmetric) {
        finalInverseId = relationshipTypeId;
      } else if (inverseLabel && !inverseId) {
        const inverseName = normalizeRelationshipName(inverseLabel);

        const existingInverseType = await prisma.relationshipType.findFirst({
          where: {
            userId: resolvedUserId,
            name: { equals: inverseName, mode: 'insensitive' },
            deletedAt: null,
          },
        });

        if (existingInverseType) {
          return errorResult(`The inverse relationship type "${inverseLabel}" already exists.`);
        }

        const inverseType = await prisma.relationshipType.create({
          data: {
            userId: resolvedUserId,
            name: inverseName,
            label: inverseLabel,
            color: color || null,
            inverseId: relationshipTypeId,
          },
        });

        finalInverseId = inverseType.id;
      } else if (inverseId) {
        const inverseType = await prisma.relationshipType.findFirst({
          where: {
            id: inverseId,
            userId: resolvedUserId,
            deletedAt: null,
          },
        });

        if (!inverseType) {
          return errorResult('Inverse relationship type not found.');
        }

        if (inverseType.inverseId && inverseType.inverseId !== inverseType.id) {
          return errorResult('Inverse relationship type is already paired.');
        }

        if (inverseType.inverseId === inverseType.id) {
          return errorResult('Cannot use a symmetric relationship type as an inverse.');
        }
      }

      const relationshipType = await prisma.relationshipType.update({
        where: { id: relationshipTypeId },
        data: {
          name: normalizedName,
          label,
          color: color || null,
          inverseId: finalInverseId,
        },
        include: {
          inverse: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
        },
      });

      const previousInverseId = existing.inverseId;

      if (previousInverseId && previousInverseId !== relationshipTypeId && previousInverseId !== finalInverseId) {
        await prisma.relationshipType.updateMany({
          where: {
            id: previousInverseId,
            userId: resolvedUserId,
            inverseId: relationshipTypeId,
          },
          data: {
            inverseId: null,
          },
        });
      }

      if (finalInverseId && finalInverseId !== relationshipTypeId) {
        await prisma.relationshipType.updateMany({
          where: { id: finalInverseId, userId: resolvedUserId },
          data: {
            inverseId: relationshipTypeId,
            color: color || null,
          },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relationshipType, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'delete_relationship_type',
    {
      title: 'Delete relationship type',
      description: 'Soft delete a relationship type (and its inverse).',
      inputSchema: {
        relationshipTypeId: z.string().describe('Relationship type ID to delete'),
      },
    },
    async ({ relationshipTypeId }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existing = await prisma.relationshipType.findFirst({
        where: {
          id: relationshipTypeId,
          userId: resolvedUserId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return errorResult('Relationship type not found.');
      }

      const idsToDelete = new Set<string>([relationshipTypeId]);
      if (existing.inverseId) {
        idsToDelete.add(existing.inverseId);
      }

      const ids = Array.from(idsToDelete);

      const inUseCount = await prisma.relationship.count({
        where: {
          relationshipTypeId: { in: ids },
          deletedAt: null,
          person: {
            userId: resolvedUserId,
          },
        },
      });

      if (inUseCount > 0) {
        return errorResult(
          `Cannot delete relationship type that is in use by ${inUseCount} relationship(s).`
        );
      }

      await prisma.relationshipType.updateMany({
        where: {
          id: { in: ids },
          userId: resolvedUserId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        content: [{ type: 'text', text: 'Relationship type deleted successfully.' }],
      };
    }
  );

  server.registerTool(
    'create_relationship',
    {
      title: 'Create relationship',
      description: 'Create a bidirectional relationship between two people.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        relatedPersonId: z.string().describe('Related person ID'),
        relationshipTypeId: z.string().nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      },
    },
    async ({ personId, relatedPersonId, relationshipTypeId, notes }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      if (!relationshipTypeId) {
        return errorResult('Relationship type is required.');
      }

      if (personId === relatedPersonId) {
        return errorResult('Cannot create a relationship with the same person.');
      }

      const existingRelationship = await prisma.relationship.findFirst({
        where: {
          personId,
          relatedPersonId,
          relationshipTypeId,
          deletedAt: null,
          person: { userId: resolvedUserId },
          relatedPerson: { userId: resolvedUserId },
        },
      });

      if (existingRelationship) {
        return errorResult('This relationship already exists.');
      }

      const [person, relatedPerson, relationshipType] = await Promise.all([
        prisma.person.findUnique({
          where: { id: personId, userId: resolvedUserId },
        }),
        prisma.person.findUnique({
          where: { id: relatedPersonId, userId: resolvedUserId },
        }),
        prisma.relationshipType.findFirst({
          where: {
            id: relationshipTypeId,
            userId: resolvedUserId,
          },
        }),
      ]);

      if (!person || !relatedPerson) {
        return errorResult('One or both people not found.');
      }

      if (!relationshipType) {
        return errorResult('Relationship type not found.');
      }

      const relationship = await prisma.relationship.create({
        data: {
          personId,
          relatedPersonId,
          relationshipTypeId,
          notes: notes || null,
        },
      });

      const inverseTypeId = relationshipType.inverseId || relationshipTypeId;

      const existingInverse = await prisma.relationship.findFirst({
        where: {
          personId: relatedPersonId,
          relatedPersonId: personId,
          relationshipTypeId: inverseTypeId,
          deletedAt: null,
        },
      });

      if (!existingInverse) {
        await prisma.relationship.create({
          data: {
            personId: relatedPersonId,
            relatedPersonId: personId,
            relationshipTypeId: inverseTypeId,
            notes: notes || null,
          },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relationship, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_relationship',
    {
      title: 'Update relationship',
      description: 'Update a relationship and its inverse.',
      inputSchema: {
        relationshipId: z.string().describe('Relationship ID'),
        relationshipTypeId: z.string().nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      },
    },
    async ({ relationshipId, relationshipTypeId, notes }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existing = await prisma.relationship.findUnique({
        where: { id: relationshipId },
        include: {
          person: true,
          relatedPerson: true,
        },
      });

      if (!existing) {
        return errorResult('Relationship not found.');
      }

      if (existing.person.userId !== resolvedUserId) {
        return errorResult('Unauthorized to modify this relationship.');
      }

      if (!relationshipTypeId) {
        return errorResult('Relationship type is required.');
      }

      const [currentType, relationshipType] = await Promise.all([
        prisma.relationshipType.findFirst({
          where: {
            id: existing.relationshipTypeId,
            userId: resolvedUserId,
          },
        }),
        prisma.relationshipType.findFirst({
          where: {
            id: relationshipTypeId,
            userId: resolvedUserId,
          },
        }),
      ]);

      if (!currentType) {
        return errorResult('Relationship type not found.');
      }

      if (!relationshipType) {
        return errorResult('Relationship type not found.');
      }

      const relationship = await prisma.relationship.update({
        where: { id: relationshipId },
        data: {
          relationshipTypeId,
          notes: notes || null,
        },
      });

      const currentInverseId = currentType.inverseId ?? currentType.id;
      const inverse = await prisma.relationship.findFirst({
        where: {
          personId: existing.relatedPersonId,
          relatedPersonId: existing.personId,
          relationshipTypeId: currentInverseId,
          person: { userId: resolvedUserId },
        },
      });

      if (inverse) {
        const newInverseId = relationshipType.inverseId ?? relationshipTypeId;
        await prisma.relationship.update({
          where: { id: inverse.id },
          data: {
            relationshipTypeId: newInverseId,
            notes: notes || null,
          },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relationship, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'delete_relationship',
    {
      title: 'Delete relationship',
      description: 'Soft delete a relationship and its inverse.',
      inputSchema: {
        relationshipId: z.string().describe('Relationship ID'),
      },
    },
    async ({ relationshipId }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const existing = await prisma.relationship.findUnique({
        where: { id: relationshipId },
        include: {
          person: true,
        },
      });

      if (!existing) {
        return errorResult('Relationship not found.');
      }

      if (existing.person.userId !== resolvedUserId) {
        return errorResult('Unauthorized to delete this relationship.');
      }

      await prisma.relationship.update({
        where: { id: relationshipId },
        data: {
          deletedAt: new Date(),
        },
      });

      const currentType = await prisma.relationshipType.findFirst({
        where: {
          id: existing.relationshipTypeId,
          userId: resolvedUserId,
        },
      });

      if (!currentType) {
        return errorResult('Relationship type not found.');
      }

      const currentInverseId = currentType.inverseId ?? currentType.id;
      const inverse = await prisma.relationship.findFirst({
        where: {
          personId: existing.relatedPersonId,
          relatedPersonId: existing.personId,
          relationshipTypeId: currentInverseId,
          person: { userId: resolvedUserId },
        },
      });

      if (inverse) {
        await prisma.relationship.update({
          where: { id: inverse.id },
          data: {
            deletedAt: new Date(),
          },
        });
      }

      return {
        content: [{ type: 'text', text: 'Relationship deleted successfully.' }],
      };
    }
  );

  server.registerTool(
    'add_important_date',
    {
      title: 'Add important date',
      description: 'Add an important date to a person.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        title: z.string().min(1).max(100),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
        reminderEnabled: z.boolean().optional(),
        reminderType: reminderTypeSchema.nullish(),
        reminderInterval: z.number().int().min(1).max(99).nullish(),
        reminderIntervalUnit: reminderIntervalUnitSchema.nullish(),
      },
    },
    async (input): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const person = await prisma.person.findUnique({
        where: {
          id: input.personId,
          userId: resolvedUserId,
        },
      });

      if (!person) {
        return errorResult('Person not found.');
      }

      if (input.reminderEnabled) {
        const reminderCheck = await canEnableReminder(resolvedUserId);
        if (!reminderCheck.isUnlimited && reminderCheck.current >= reminderCheck.limit) {
          return errorResult(
            `You have reached your reminder limit (limit: ${reminderCheck.limit}). Please upgrade to add more reminders.`
          );
        }
      }

      const importantDate = await prisma.importantDate.create({
        data: {
          personId: input.personId,
          title: input.title,
          date: new Date(input.date),
          reminderEnabled: input.reminderEnabled ?? false,
          reminderType: input.reminderEnabled ? input.reminderType : null,
          reminderInterval:
            input.reminderEnabled && input.reminderType === 'RECURRING'
              ? input.reminderInterval
              : null,
          reminderIntervalUnit:
            input.reminderEnabled && input.reminderType === 'RECURRING'
              ? input.reminderIntervalUnit
              : null,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(importantDate, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'update_important_date',
    {
      title: 'Update important date',
      description: 'Update an important date for a person.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        dateId: z.string().describe('Important date ID'),
        title: z.string().min(1).max(100),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
        reminderEnabled: z.boolean().optional(),
        reminderType: reminderTypeSchema.nullish(),
        reminderInterval: z.number().int().min(1).max(99).nullish(),
        reminderIntervalUnit: reminderIntervalUnitSchema.nullish(),
      },
    },
    async (input): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const person = await prisma.person.findUnique({
        where: {
          id: input.personId,
          userId: resolvedUserId,
        },
      });

      if (!person) {
        return errorResult('Person not found.');
      }

      const updatedDate = await prisma.importantDate.update({
        where: {
          id: input.dateId,
          personId: input.personId,
        },
        data: {
          title: input.title,
          date: new Date(input.date),
          reminderEnabled: input.reminderEnabled ?? false,
          reminderType: input.reminderEnabled ? input.reminderType : null,
          reminderInterval:
            input.reminderEnabled && input.reminderType === 'RECURRING'
              ? input.reminderInterval
              : null,
          reminderIntervalUnit:
            input.reminderEnabled && input.reminderType === 'RECURRING'
              ? input.reminderIntervalUnit
              : null,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedDate, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    'delete_important_date',
    {
      title: 'Delete important date',
      description: 'Soft delete an important date for a person.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        dateId: z.string().describe('Important date ID'),
      },
    },
    async ({ personId, dateId }): Promise<ToolResult> => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return errorResult('Unauthorized: missing user context.');
      }

      const person = await prisma.person.findUnique({
        where: {
          id: personId,
          userId: resolvedUserId,
        },
      });

      if (!person) {
        return errorResult('Person not found.');
      }

      await prisma.importantDate.update({
        where: {
          id: dateId,
          personId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        content: [{ type: 'text', text: 'Important date deleted successfully.' }],
      };
    }
  );

  server.registerResource(
    'person',
    new ResourceTemplate('nametag://people/{personId}', {
      list: async () => {
        const resolvedUserId = requireUserId(userId);
        if (!resolvedUserId) {
          return { resources: [] };
        }

        const people = await prisma.person.findMany({
          where: { userId: resolvedUserId },
          orderBy: { updatedAt: 'desc' },
          take: DEFAULT_LIST_LIMIT,
        });

        return {
          resources: people.map((person) => ({
            uri: `nametag://people/${person.id}`,
            name: person.name,
            description: person.nickname
              ? `${person.name} (${person.nickname})`
              : person.name,
            mimeType: 'application/json',
          })),
        };
      },
      complete: {
        personId: async () => {
          const resolvedUserId = requireUserId(userId);
          if (!resolvedUserId) {
            return [];
          }

          const people = await prisma.person.findMany({
            where: { userId: resolvedUserId },
            orderBy: { updatedAt: 'desc' },
            take: DEFAULT_LIST_LIMIT,
          });

          return people.map((person) => person.id);
        },
      },
    }),
    {
      description: 'Person records from Nametag',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const resolvedUserId = requireUserId(userId);
      if (!resolvedUserId) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Unauthorized' }, null, 2),
            },
          ],
        };
      }

      const personId = variables.personId as string | undefined;
      if (!personId) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Missing personId' }, null, 2),
            },
          ],
        };
      }

      const person = await prisma.person.findUnique({
        where: { id: personId, userId: resolvedUserId },
        include: {
          groups: {
            include: {
              group: true,
            },
          },
          importantDates: true,
          relationshipToUser: true,
        },
      });

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(person ?? { error: 'Not found' }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
