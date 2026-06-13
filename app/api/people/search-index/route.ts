import { prisma } from '@/lib/prisma';
import { apiResponse, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (_request, session) => {
  const people = await prisma.person.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      surname: true,
      middleName: true,
      secondLastName: true,
      nickname: true,
      organization: true,
      jobTitle: true,
      notes: true,
      photo: true,
      phoneNumbers: { select: { number: true } },
      emails: { select: { email: true } },
      addresses: {
        select: {
          streetLine1: true,
          streetLine2: true,
          locality: true,
          region: true,
          postalCode: true,
          country: true,
        },
      },
      urls: { select: { url: true } },
      imHandles: { select: { handle: true } },
      groups: {
        where: { group: { deletedAt: null } },
        include: { group: { select: { name: true } } },
      },
      customFields: { select: { key: true, value: true } },
      customFieldValues: {
        include: { template: { select: { name: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  const indexData = people.map((person) => ({
    id: person.id,
    name: person.name,
    surname: person.surname,
    middleName: person.middleName,
    secondLastName: person.secondLastName,
    nickname: person.nickname,
    organization: person.organization,
    jobTitle: person.jobTitle,
    notes: person.notes,
    photo: person.photo,
    phones: person.phoneNumbers.map((p) => p.number).join(' '),
    emails: person.emails.map((e) => e.email).join(' '),
    addresses: person.addresses
      .flatMap((a) => [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country])
      .filter(Boolean)
      .join(' '),
    urls: person.urls.map((u) => u.url).join(' '),
    imHandles: person.imHandles.map((im) => im.handle).join(' '),
    groups: person.groups.map((pg) => pg.group.name).join(' '),
    customFields: [
      ...person.customFields.map((cf) => `${cf.key} ${cf.value}`),
      ...person.customFieldValues.map((cfv) => `${cfv.template.name} ${cfv.value}`),
    ].join(' '),
  }));

  return apiResponse.ok({ people: indexData });
});
