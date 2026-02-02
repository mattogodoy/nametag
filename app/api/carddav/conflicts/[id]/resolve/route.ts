import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/carddav/vcard';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { resolution } = body; // "keep_local", "keep_remote", or "merged"

    if (!['keep_local', 'keep_remote', 'merged'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution type' },
        { status: 400 }
      );
    }

    // Get conflict
    const conflict = await prisma.cardDavConflict.findUnique({
      where: { id },
      include: {
        mapping: {
          include: {
            person: {
              include: {
                phoneNumbers: true,
                emails: true,
                addresses: true,
                urls: true,
                imHandles: true,
                locations: true,
                customFields: true,
              },
            },
            connection: true,
          },
        },
      },
    });

    if (!conflict) {
      return NextResponse.json(
        { error: 'Conflict not found' },
        { status: 404 }
      );
    }

    // Verify user owns this connection
    if (conflict.mapping.connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Already resolved?
    if (conflict.resolvedAt) {
      return NextResponse.json(
        { error: 'Conflict already resolved' },
        { status: 400 }
      );
    }

    if (resolution === 'keep_local') {
      // Keep local version - mark as resolved, set sync status to pending push
      await prisma.cardDavConflict.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolution: 'keep_local',
          resolvedBy: 'user',
        },
      });

      await prisma.cardDavMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncStatus: 'pending',
          lastLocalChange: new Date(),
        },
      });
    } else if (resolution === 'keep_remote') {
      // Keep remote version - update person with remote data
      const remoteData = JSON.parse(conflict.remoteVersion);
      const parsedVCard = vCardToPerson(remoteData.vCardData || '');

      // Delete all multi-value fields
      await prisma.$transaction([
        prisma.personPhone.deleteMany({ where: { personId: conflict.mapping.personId } }),
        prisma.personEmail.deleteMany({ where: { personId: conflict.mapping.personId } }),
        prisma.personAddress.deleteMany({ where: { personId: conflict.mapping.personId } }),
        prisma.personUrl.deleteMany({ where: { personId: conflict.mapping.personId } }),
        prisma.personIM.deleteMany({ where: { personId: conflict.mapping.personId } }),
        prisma.personLocation.deleteMany({ where: { personId: conflict.mapping.personId } }),
        prisma.personCustomField.deleteMany({ where: { personId: conflict.mapping.personId } }),
      ]);

      // Update person with remote data
      await prisma.person.update({
        where: { id: conflict.mapping.personId },
        data: {
          name: parsedVCard.name,
          surname: parsedVCard.surname,
          middleName: parsedVCard.middleName,
          prefix: parsedVCard.prefix,
          suffix: parsedVCard.suffix,
          nickname: parsedVCard.nickname,
          organization: parsedVCard.organization,
          jobTitle: parsedVCard.jobTitle,
          photo: parsedVCard.photo,
          gender: parsedVCard.gender,
          anniversary: parsedVCard.anniversary,
          notes: parsedVCard.notes,
          uid: parsedVCard.uid,

          phoneNumbers: parsedVCard.phoneNumbers
            ? { create: parsedVCard.phoneNumbers }
            : undefined,
          emails: parsedVCard.emails
            ? { create: parsedVCard.emails }
            : undefined,
          addresses: parsedVCard.addresses
            ? { create: parsedVCard.addresses }
            : undefined,
          urls: parsedVCard.urls
            ? { create: parsedVCard.urls }
            : undefined,
          imHandles: parsedVCard.imHandles
            ? { create: parsedVCard.imHandles }
            : undefined,
          locations: parsedVCard.locations
            ? { create: parsedVCard.locations }
            : undefined,
          customFields: parsedVCard.customFields
            ? { create: parsedVCard.customFields }
            : undefined,
        },
      });

      await prisma.cardDavConflict.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolution: 'keep_remote',
          resolvedBy: 'user',
        },
      });

      await prisma.cardDavMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncStatus: 'synced',
          lastRemoteChange: new Date(),
          lastSyncedAt: new Date(),
        },
      });
    } else if (resolution === 'merged') {
      // For merged, we expect the client to send the merged data
      // This is handled separately - for now just mark as resolved
      await prisma.cardDavConflict.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolution: 'merged',
          resolvedBy: 'user',
        },
      });

      await prisma.cardDavMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncStatus: 'pending',
          lastLocalChange: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resolving conflict:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
