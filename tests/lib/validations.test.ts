import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  cuidSchema,
  hexColorSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createPersonSchema,
  createGroupSchema,
  createRelationshipSchema,
  updateRelationshipSchema,
  createRelationshipTypeSchema,
  updateProfileSchema,
  updatePasswordSchema,
  updateThemeSchema,
  updateDateFormatSchema,
  updateImportantDateSchema,
  validateRequest,
} from '@/lib/validations';

describe('validations', () => {
  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
      expect(emailSchema.safeParse('user.name@domain.co.uk').success).toBe(true);
      expect(emailSchema.safeParse('user+tag@example.com').success).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('missing@domain').success).toBe(false);
      expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
      expect(emailSchema.safeParse('').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(passwordSchema.safeParse('password123').success).toBe(true);
      expect(passwordSchema.safeParse('12345678').success).toBe(true);
      expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    });

    it('should reject short passwords', () => {
      const result = passwordSchema.safeParse('short');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('8 characters');
      }
    });

    it('should reject too long passwords', () => {
      const result = passwordSchema.safeParse('a'.repeat(129));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('128 characters');
      }
    });
  });

  describe('cuidSchema', () => {
    it('should accept valid CUIDs', () => {
      expect(cuidSchema.safeParse('clh3z9x0y0000qwer1234abcd').success).toBe(true);
      expect(cuidSchema.safeParse('cm123456789abcdefghijklmno').success).toBe(true);
    });

    it('should reject invalid CUIDs', () => {
      expect(cuidSchema.safeParse('not-a-cuid').success).toBe(false);
      expect(cuidSchema.safeParse('123').success).toBe(false);
      expect(cuidSchema.safeParse('').success).toBe(false);
    });
  });

  describe('hexColorSchema', () => {
    it('should accept valid hex colors', () => {
      expect(hexColorSchema.safeParse('#FF5733').success).toBe(true);
      expect(hexColorSchema.safeParse('#000000').success).toBe(true);
      expect(hexColorSchema.safeParse('#ffffff').success).toBe(true);
      expect(hexColorSchema.safeParse('#AbCdEf').success).toBe(true);
    });

    it('should accept null', () => {
      expect(hexColorSchema.safeParse(null).success).toBe(true);
    });

    it('should accept undefined', () => {
      expect(hexColorSchema.safeParse(undefined).success).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(hexColorSchema.safeParse('FF5733').success).toBe(false); // Missing #
      expect(hexColorSchema.safeParse('#FFF').success).toBe(false); // Short form
      expect(hexColorSchema.safeParse('#GGGGGG').success).toBe(false); // Invalid chars
      expect(hexColorSchema.safeParse('#FF573').success).toBe(false); // Too short
      expect(hexColorSchema.safeParse('#FF57331').success).toBe(false); // Too long
    });
  });

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        name: 'John',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        name: 'John',
        surname: 'Doe',
        nickname: 'Johnny',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should require email', () => {
      const result = registerSchema.safeParse({
        password: 'password123',
        name: 'John',
      });
      expect(result.success).toBe(false);
    });

    it('should require password', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'John',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should accept valid email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'test@example.com' }).success).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'not-email' }).success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should accept valid data', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'newpassword123',
      });
      expect(result.success).toBe(true);
    });

    it('should require token', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'newpassword123',
      });
      expect(result.success).toBe(false);
    });

    it('should require valid password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createPersonSchema', () => {
    it('should accept valid person data', () => {
      const result = createPersonSchema.safeParse({
        name: 'John',
      });
      expect(result.success).toBe(true);
    });

    it('should accept full person data', () => {
      const result = createPersonSchema.safeParse({
        name: 'John',
        surname: 'Doe',
        nickname: 'Johnny',
        lastContact: '2024-01-01',
        notes: 'Some notes',
        relationshipToUserId: 'rel-type-id',
        groupIds: ['group-1', 'group-2'],
        importantDates: [
          { title: 'Birthday', date: '2024-06-15', reminderEnabled: true, reminderType: 'RECURRING', reminderInterval: 1, reminderIntervalUnit: 'YEARS' },
        ],
        contactReminderEnabled: true,
        contactReminderInterval: 2,
        contactReminderIntervalUnit: 'WEEKS',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createPersonSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = createPersonSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject name over 100 characters', () => {
      const result = createPersonSchema.safeParse({ name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = createPersonSchema.safeParse({
        name: 'John',
        lastContact: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid important date', () => {
      const result = createPersonSchema.safeParse({
        name: 'John',
        importantDates: [{ title: '', date: 'invalid' }],
      });
      expect(result.success).toBe(false);
    });

    it('should validate reminder interval unit', () => {
      const result = createPersonSchema.safeParse({
        name: 'John',
        contactReminderEnabled: true,
        contactReminderInterval: 1,
        contactReminderIntervalUnit: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('should validate reminder interval range', () => {
      const result = createPersonSchema.safeParse({
        name: 'John',
        contactReminderEnabled: true,
        contactReminderInterval: 100, // Max is 99
        contactReminderIntervalUnit: 'WEEKS',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createGroupSchema', () => {
    it('should accept valid group data', () => {
      const result = createGroupSchema.safeParse({
        name: 'Friends',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = createGroupSchema.safeParse({
        name: 'Friends',
        description: 'My friends group',
        color: '#FF5733',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createGroupSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = createGroupSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject description over 500 characters', () => {
      const result = createGroupSchema.safeParse({
        name: 'Friends',
        description: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createRelationshipSchema', () => {
    it('should accept valid relationship data', () => {
      const result = createRelationshipSchema.safeParse({
        personId: 'person-1',
        relatedPersonId: 'person-2',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = createRelationshipSchema.safeParse({
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipTypeId: 'rel-type-1',
        notes: 'Best friends since childhood',
      });
      expect(result.success).toBe(true);
    });

    it('should require personId', () => {
      const result = createRelationshipSchema.safeParse({
        relatedPersonId: 'person-2',
      });
      expect(result.success).toBe(false);
    });

    it('should require relatedPersonId', () => {
      const result = createRelationshipSchema.safeParse({
        personId: 'person-1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateRelationshipSchema', () => {
    it('should accept valid update data', () => {
      const result = updateRelationshipSchema.safeParse({
        relationshipTypeId: 'new-type',
        notes: 'Updated notes',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateRelationshipSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject notes over 1000 characters', () => {
      const result = updateRelationshipSchema.safeParse({
        notes: 'a'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createRelationshipTypeSchema', () => {
    it('should accept valid data', () => {
      const result = createRelationshipTypeSchema.safeParse({
        name: 'parent',
        label: 'Parent',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = createRelationshipTypeSchema.safeParse({
        name: 'parent',
        label: 'Parent',
        color: '#FF0000',
        inverseId: 'child-id',
        inverseLabel: 'Child',
      });
      expect(result.success).toBe(true);
    });

    it('should accept symmetric flag', () => {
      const result = createRelationshipTypeSchema.safeParse({
        name: 'friend',
        label: 'Friend',
        symmetric: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symmetric).toBe(true);
      }
    });

    it('should accept symmetric as false', () => {
      const result = createRelationshipTypeSchema.safeParse({
        name: 'parent',
        label: 'Parent',
        symmetric: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symmetric).toBe(false);
      }
    });

    it('should reject non-boolean symmetric', () => {
      const result = createRelationshipTypeSchema.safeParse({
        name: 'friend',
        label: 'Friend',
        symmetric: 'yes',
      });
      expect(result.success).toBe(false);
    });

    it('should require name', () => {
      const result = createRelationshipTypeSchema.safeParse({
        label: 'Parent',
      });
      expect(result.success).toBe(false);
    });

    it('should require label', () => {
      const result = createRelationshipTypeSchema.safeParse({
        name: 'parent',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should accept valid profile data', () => {
      const result = updateProfileSchema.safeParse({
        name: 'John',
        email: 'john@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const result = updateProfileSchema.safeParse({
        name: 'John',
        surname: 'Doe',
        nickname: 'Johnny',
        email: 'john@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = updateProfileSchema.safeParse({
        email: 'john@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should require email', () => {
      const result = updateProfileSchema.safeParse({
        name: 'John',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePasswordSchema', () => {
    it('should accept valid password data', () => {
      const result = updatePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
      });
      expect(result.success).toBe(true);
    });

    it('should require currentPassword', () => {
      const result = updatePasswordSchema.safeParse({
        newPassword: 'newpassword123',
      });
      expect(result.success).toBe(false);
    });

    it('should validate newPassword', () => {
      const result = updatePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateThemeSchema', () => {
    it('should accept LIGHT theme', () => {
      expect(updateThemeSchema.safeParse({ theme: 'LIGHT' }).success).toBe(true);
    });

    it('should accept DARK theme', () => {
      expect(updateThemeSchema.safeParse({ theme: 'DARK' }).success).toBe(true);
    });

    it('should reject invalid theme', () => {
      expect(updateThemeSchema.safeParse({ theme: 'SYSTEM' }).success).toBe(false);
    });
  });

  describe('updateDateFormatSchema', () => {
    it('should accept MDY format', () => {
      expect(updateDateFormatSchema.safeParse({ dateFormat: 'MDY' }).success).toBe(true);
    });

    it('should accept DMY format', () => {
      expect(updateDateFormatSchema.safeParse({ dateFormat: 'DMY' }).success).toBe(true);
    });

    it('should accept YMD format', () => {
      expect(updateDateFormatSchema.safeParse({ dateFormat: 'YMD' }).success).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(updateDateFormatSchema.safeParse({ dateFormat: 'ISO' }).success).toBe(false);
    });
  });

  describe('updateImportantDateSchema', () => {
    it('should accept valid data', () => {
      const result = updateImportantDateSchema.safeParse({
        title: 'Birthday',
        date: '2024-06-15',
      });
      expect(result.success).toBe(true);
    });

    it('should accept reminder fields', () => {
      const result = updateImportantDateSchema.safeParse({
        title: 'Anniversary',
        date: '2024-06-15',
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'YEARS',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = updateImportantDateSchema.safeParse({
        title: '',
        date: '2024-06-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date', () => {
      const result = updateImportantDateSchema.safeParse({
        title: 'Birthday',
        date: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateRequest', () => {
    it('should return success with valid data', () => {
      const result = validateRequest(emailSchema, 'test@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should return error response with invalid data', async () => {
      const result = validateRequest(emailSchema, 'not-an-email');
      expect(result.success).toBe(false);
      if (!result.success) {
        const body = await result.response.json();
        expect(body.error).toBe('Validation failed');
        expect(body.details).toBeInstanceOf(Array);
        expect(body.details[0].field).toBe('');
        expect(body.details[0].message).toContain('email');
      }
    });

    it('should return 400 status for validation errors', async () => {
      const result = validateRequest(emailSchema, 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
      }
    });

    it('should include field path in error details', async () => {
      const result = validateRequest(createPersonSchema, { name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const body = await result.response.json();
        expect(body.details[0].field).toBe('name');
      }
    });
  });
});
