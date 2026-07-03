import MiniSearch from 'minisearch';
import { normalizeForSearch } from '@/lib/search';

export interface SearchDocument {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride?: string | null;
  organization: string | null;
  jobTitle: string | null;
  notes: string | null;
  phones: string;
  emails: string;
  addresses: string;
  urls: string;
  imHandles: string;
  groups: string;
  customFields: string;
  photo: string | null;
}

export interface PersonSearchResult {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  photo: string | null;
  score: number;
}

const INDEXED_FIELDS = [
  'name', 'surname', 'middleName', 'secondLastName', 'nickname', 'displayNameOverride',
  'organization', 'jobTitle', 'notes',
  'phones', 'emails', 'addresses', 'urls', 'imHandles',
  'groups', 'customFields',
];

const STORED_FIELDS = [
  'id', 'name', 'surname', 'middleName', 'secondLastName', 'nickname', 'displayNameOverride', 'photo',
];

export function createSearchIndex(documents: SearchDocument[]): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>({
    fields: INDEXED_FIELDS,
    storeFields: STORED_FIELDS,
    processTerm: (term) => normalizeForSearch(term) || null,
  });
  index.addAll(documents);
  return index;
}

export function searchIndex(
  index: MiniSearch<SearchDocument>,
  query: string,
  maxResults = 20
): PersonSearchResult[] {
  if (!query.trim()) return [];

  // AND: all query words must appear on the same person
  const results = index.search(query, {
    fuzzy: 0.2,
    prefix: true,
    combineWith: 'AND',
  });

  return results.slice(0, maxResults).map((result) => ({
    id: result.id as string,
    name: result.name as string,
    surname: (result.surname as string | null) ?? null,
    middleName: (result.middleName as string | null) ?? null,
    secondLastName: (result.secondLastName as string | null) ?? null,
    nickname: (result.nickname as string | null) ?? null,
    displayNameOverride: (result.displayNameOverride as string | null) ?? null,
    photo: (result.photo as string | null) ?? null,
    score: result.score,
  }));
}
