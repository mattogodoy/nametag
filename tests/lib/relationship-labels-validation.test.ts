import { describe, it, expect } from 'vitest';
import { labelVariantsSchema, previewLabelSchema } from '@/lib/validations';

function condition(overrides: Record<string, unknown> = {}) {
  return {
    subject: 'DESCRIBED',
    source: 'PERSON_FIELD',
    subjectRef: 'gender',
    operator: 'IS',
    operand: 'lit:Homme',
    ...overrides,
  };
}

describe('labelVariantsSchema', () => {
  it('accepts a sound configuration', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'frere', conditions: [condition()] },
      { label: 'fratrie', conditions: [] },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts an empty list, which clears the configuration', () => {
    expect(labelVariantsSchema.safeParse([]).success).toBe(true);
  });

  it('rejects a native field outside the allowed list', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'x', conditions: [condition({ subjectRef: 'notes' })] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects an operator that does not fit the source', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'x', conditions: [condition({ source: 'GROUP', subjectRef: 'g1', operator: 'CONTAINS' })] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a missing operand when the operator needs one', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'x', conditions: [condition({ operand: null })] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects an operand present when the operator takes none', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'x', conditions: [condition({ operator: 'IS_SET', operand: 'lit:Homme' })] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects an unprefixed operand', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'x', conditions: [condition({ operand: 'Homme' })] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects more than one fallback', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'a', conditions: [] },
      { label: 'b', conditions: [] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a fallback that is not last', () => {
    const result = labelVariantsSchema.safeParse([
      { label: 'a', conditions: [] },
      { label: 'b', conditions: [condition()] },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects more than twenty variants', () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      label: `v${index}`,
      conditions: [condition({ operand: `lit:v${index}` })],
    }));
    expect(labelVariantsSchema.safeParse(many).success).toBe(false);
  });

  it('rejects more than five conditions in one variant', () => {
    const conditions = Array.from({ length: 6 }, (_, index) =>
      condition({ operand: `lit:v${index}` })
    );
    expect(labelVariantsSchema.safeParse([{ label: 'x', conditions }]).success).toBe(false);
  });
});

describe('previewLabelSchema', () => {
  it('requires two person ids and a label', () => {
    const result = previewLabelSchema.safeParse({
      typeLabel: 'Frere/Soeur',
      describedPersonId: 'p1',
      otherPersonId: 'p2',
      variants: [{ label: 'frere', conditions: [condition()] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing person', () => {
    const result = previewLabelSchema.safeParse({
      typeLabel: 'x',
      describedPersonId: 'p1',
      variants: [],
    });
    expect(result.success).toBe(false);
  });
});
