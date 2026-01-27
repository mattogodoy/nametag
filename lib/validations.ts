import { z } from 'zod';

// ============================================
// Common schemas
// ============================================

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (!@#$%^&*)')
  .describe('Min 8 chars, must include uppercase, lowercase, number, and special character');

export const cuidSchema = z.string().cuid('Invalid ID format');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
  .nullable()
  .optional()
  .describe('Hex color, e.g. #FF5733');

// ============================================
// Auth schemas
// ============================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100),
  surname: z.string().max(100).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const checkVerificationSchema = z.object({
  email: emailSchema,
});

// ============================================
// Person schemas
// ============================================

const reminderIntervalUnitSchema = z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']);

const importantDateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(100),
  date: z.iso.date({ error: 'Invalid date' }),
  reminderEnabled: z.boolean().optional(),
  reminderType: z.enum(['ONCE', 'RECURRING']).nullable().optional(),
  reminderInterval: z.number().int().min(1).max(99).nullable().optional(),
  reminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),
});

// vCard field schemas
const phoneNumberSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['work', 'home', 'mobile', 'fax', 'other']),
  number: z.string().min(1, 'Phone number is required').max(50),
  isPrimary: z.boolean().optional().default(false),
});

const emailAddressSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['work', 'home', 'other']),
  email: emailSchema,
  isPrimary: z.boolean().optional().default(false),
});

const addressSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['work', 'home', 'other']),
  street: z.string().max(200).nullable().optional(),
  locality: z.string().max(100).nullable().optional(), // City
  region: z.string().max(100).nullable().optional(), // State/Province
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

const urlSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['work', 'home', 'personal', 'other']),
  url: z.string().url('Invalid URL format').max(500),
  label: z.string().max(100).nullable().optional(),
});

const imHandleSchema = z.object({
  id: z.string().optional(),
  protocol: z.enum(['skype', 'whatsapp', 'telegram', 'signal', 'other']),
  handle: z.string().min(1, 'Handle is required').max(200),
});

const locationSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['home', 'work', 'other']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.string().max(100).nullable().optional(),
});

const customFieldSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1, 'Key is required').max(100),
  value: z.string().max(1000),
  type: z.string().max(50).nullable().optional(),
});

export const createPersonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  surname: z.string().max(100).nullable().optional(),
  middleName: z.string().max(100).nullable().optional(),
  secondLastName: z.string().max(100).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),

  // vCard identification fields
  prefix: z.string().max(50).nullable().optional(),
  suffix: z.string().max(50).nullable().optional(),
  uid: z.string().max(100).nullable().optional(),

  // Professional fields
  organization: z.string().max(200).nullable().optional(),
  jobTitle: z.string().max(200).nullable().optional(),
  role: z.string().max(200).nullable().optional(),

  // Other vCard fields
  photo: z.string().max(1000).nullable().optional(),
  gender: z.string().max(50).nullable().optional(),
  anniversary: z.preprocess(
    (val) => (val === '' ? null : val),
    z.iso.date({ error: 'Invalid date' }).nullable().optional(),
  ),

  lastContact: z.preprocess(
    (val) => (val === '' ? null : val),
    z.iso.date({ error: 'Invalid date' }).nullable().optional(),
  ).describe('Date of last contact'),
  notes: z.string().max(10000).nullable().optional()
    .describe('Markdown-formatted notes'),
  relationshipToUserId: z.string().nullable().optional()
    .describe('ID of the relationship type to the user'),
  groupIds: z.array(z.string()).optional()
    .describe('Group IDs to add this person to'),
  connectedThroughId: z.string().optional()
    .describe('If set, creates a person-to-person relationship instead of person-to-user'),
  importantDates: z.array(importantDateSchema).optional(),
  contactReminderEnabled: z.boolean().optional(),
  contactReminderInterval: z.number().int().min(1).max(99).nullable().optional(),
  contactReminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),

  // Multi-value vCard fields
  phoneNumbers: z.array(phoneNumberSchema).optional(),
  emails: z.array(emailAddressSchema).optional(),
  addresses: z.array(addressSchema).optional(),
  urls: z.array(urlSchema).optional(),
  imHandles: z.array(imHandleSchema).optional(),
  locations: z.array(locationSchema).optional(),
  customFields: z.array(customFieldSchema).optional(),
});

export const updatePersonSchema = createPersonSchema.partial();

export const deletePersonSchema = z.object({
  deleteOrphans: z.boolean().optional()
    .describe('Also delete people only connected through this person'),
  orphanIds: z.array(z.string()).optional()
    .describe('Specific orphan IDs to delete'),
  deleteFromCardDav: z.boolean().optional(),
});

// ============================================
// Group schemas
// ============================================

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  color: hexColorSchema,
  peopleIds: z.array(z.string()).optional()
    .describe('Person IDs to add as initial members'),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  color: hexColorSchema,
});

export const addGroupMemberSchema = z.object({
  personId: z.string().min(1, 'Person ID is required'),
});

// ============================================
// Relationship schemas
// ============================================

export const createRelationshipSchema = z.object({
  personId: z.string().min(1, 'Person ID is required')
    .describe('First person ID'),
  relatedPersonId: z.string().min(1, 'Related person ID is required')
    .describe('Second person ID'),
  relationshipTypeId: z.string().nullable().optional()
    .describe('Relationship type ID'),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateRelationshipSchema = z.object({
  relationshipTypeId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ============================================
// Relationship Type schemas
// ============================================

export const createRelationshipTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50)
    .describe('Internal name (will be upper-cased)'),
  label: z.string().min(1, 'Label is required').max(50)
    .describe('Display label'),
  color: hexColorSchema,
  inverseId: z.string().nullable().optional()
    .describe('ID of existing inverse type'),
  inverseLabel: z.string().max(50).optional()
    .describe('Label for a new inverse type to auto-create'),
  symmetric: z.boolean().optional()
    .describe('If true, the type is its own inverse'),
});

export const updateRelationshipTypeSchema = createRelationshipTypeSchema;

// ============================================
// User schemas
// ============================================

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  surname: z.string().max(100).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
  email: emailSchema,
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const updateThemeSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK']),
});

export const updateDateFormatSchema = z.object({
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']),
});

// ============================================
// Import schema
// ============================================

export const importDataSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  groups: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
  })),
  people: z.array(z.object({
    id: z.string(),
    name: z.string(),
    surname: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
    secondLastName: z.string().nullable().optional(),
    nickname: z.string().nullable().optional(),
    lastContact: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    relationshipToUser: z.object({
      name: z.string(),
      label: z.string(),
    }).nullable().optional(),
    groups: z.array(z.string()),
    relationships: z.array(z.object({
      relatedPersonId: z.string(),
      relatedPersonName: z.string(),
      relationshipType: z.object({
        name: z.string(),
        label: z.string(),
      }).nullable().optional(),
      notes: z.string().nullable().optional(),
    })),
  })),
  // Support both old field name (customRelationshipTypes) and new field name (relationshipTypes)
  customRelationshipTypes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    color: z.string().nullable().optional(),
    inverseId: z.string().nullable().optional(),
  })).optional(),
  relationshipTypes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    label: z.string(),
    color: z.string().nullable().optional(),
    inverseId: z.string().nullable().optional(),
  })).optional(),
});

// ============================================
// Important Date schemas
// ============================================

export const createImportantDateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  date: z.iso.date({ error: 'Invalid date' }),
  reminderEnabled: z.boolean().optional(),
  reminderType: z.enum(['ONCE', 'RECURRING']).nullable().optional(),
  reminderInterval: z.number().int().min(1).max(99).nullable().optional(),
  reminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),
});

export const updateImportantDateSchema = createImportantDateSchema;

// ============================================
// Helper function for API validation
// ============================================

import { NextResponse } from 'next/server';

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
