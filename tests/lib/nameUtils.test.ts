import { describe, it, expect } from 'vitest';
import { formatPersonName, formatFullName, formatGraphName } from '@/lib/nameUtils';

describe('nameUtils', () => {
  describe('formatPersonName', () => {
    it('should format name only', () => {
      expect(formatPersonName('John')).toBe('John');
    });

    it('should format name and surname', () => {
      expect(formatPersonName('John', 'Smith')).toBe('John Smith');
    });

    it('should format name with nickname', () => {
      expect(formatPersonName('Charles', null, null, null, 'Charlie')).toBe("Charles 'Charlie'");
    });

    it('should format name, nickname, and surname', () => {
      expect(formatPersonName('Charles', 'Brown', null, null, 'Charlie')).toBe("Charles 'Charlie' Brown");
    });

    it('should handle null surname', () => {
      expect(formatPersonName('John', null)).toBe('John');
    });

    it('should handle undefined surname', () => {
      expect(formatPersonName('John', undefined)).toBe('John');
    });

    it('should handle null nickname', () => {
      expect(formatPersonName('John', 'Smith', null, null, null)).toBe('John Smith');
    });

    it('should handle undefined nickname', () => {
      expect(formatPersonName('John', 'Smith', undefined, undefined, undefined)).toBe('John Smith');
    });

    it('should handle all null/undefined optional params', () => {
      expect(formatPersonName('John', null, null)).toBe('John');
      expect(formatPersonName('John', undefined, undefined)).toBe('John');
    });

    it('should handle names with special characters', () => {
      expect(formatPersonName("Mary-Jane", "O'Connor", null, null, "MJ")).toBe("Mary-Jane 'MJ' O'Connor");
    });

    it('should handle unicode names', () => {
      expect(formatPersonName('José', 'García', null, null, 'Pepe')).toBe("José 'Pepe' García");
    });

    it('should format name with middle name', () => {
      expect(formatPersonName('John', 'Doe', 'Michael')).toBe('John Michael Doe');
    });

    it('should format name with second last name', () => {
      expect(formatPersonName('Jane', 'Smith', null, 'Johnson')).toBe('Jane Smith Johnson');
    });

    it('should format name with middle name and second last name', () => {
      expect(formatPersonName('Matias', 'Godoy', 'Alejandro', 'Biedma')).toBe('Matias Alejandro Godoy Biedma');
    });

    it('should format complete name with nickname, middle name, and second last name', () => {
      expect(formatPersonName('Matias', 'Godoy', 'Alejandro', 'Biedma', 'Matto')).toBe("Matias 'Matto' Alejandro Godoy Biedma");
    });

    it('should handle null middle name and second last name', () => {
      expect(formatPersonName('John', 'Doe', null, null)).toBe('John Doe');
    });

    it('should handle undefined middle name and second last name', () => {
      expect(formatPersonName('John', 'Doe', undefined, undefined)).toBe('John Doe');
    });
  });

  describe('formatPersonName - eastern order', () => {
    it('should format name and surname in eastern order', () => {
      expect(formatPersonName('Taro', 'Tanaka', null, null, null, 'EASTERN')).toBe('Tanaka Taro');
    });

    it('should format name only in eastern order (no change)', () => {
      expect(formatPersonName('Taro', null, null, null, null, 'EASTERN')).toBe('Taro');
    });

    it('should format name with nickname in eastern order', () => {
      expect(formatPersonName('Charles', 'Brown', null, null, 'Charlie', 'EASTERN')).toBe("Brown 'Charlie' Charles");
    });

    it('should format name with middle name in eastern order', () => {
      expect(formatPersonName('John', 'Doe', 'Michael', null, null, 'EASTERN')).toBe('Doe John Michael');
    });

    it('should format name with second last name in eastern order', () => {
      expect(formatPersonName('Matias', 'Godoy', null, 'Biedma', null, 'EASTERN')).toBe('Godoy Biedma Matias');
    });

    it('should format complete name in eastern order', () => {
      expect(formatPersonName('Matias', 'Godoy', 'Alejandro', 'Biedma', 'Matto', 'EASTERN')).toBe("Godoy Biedma 'Matto' Matias Alejandro");
    });

    it('should default to western order when nameOrder is omitted', () => {
      expect(formatPersonName('John', 'Smith')).toBe('John Smith');
    });

    it('should handle western order explicitly', () => {
      expect(formatPersonName('John', 'Smith', null, null, null, 'WESTERN')).toBe('John Smith');
    });
  });

  describe('formatFullName', () => {
    it('should format person object with all fields', () => {
      const person = { name: 'John', surname: 'Doe', nickname: 'Johnny' };
      expect(formatFullName(person)).toBe("John 'Johnny' Doe");
    });

    it('should format person object with only name', () => {
      const person = { name: 'John' };
      expect(formatFullName(person)).toBe('John');
    });

    it('should format person object with name and surname', () => {
      const person = { name: 'John', surname: 'Doe' };
      expect(formatFullName(person)).toBe('John Doe');
    });

    it('should format person object with name and nickname', () => {
      const person = { name: 'John', nickname: 'Johnny' };
      expect(formatFullName(person)).toBe("John 'Johnny'");
    });

    it('should handle null values in person object', () => {
      const person = { name: 'John', surname: null, nickname: null };
      expect(formatFullName(person)).toBe('John');
    });

    it('should format person with middle name', () => {
      const person = { name: 'John', surname: 'Doe', middleName: 'Michael' };
      expect(formatFullName(person)).toBe('John Michael Doe');
    });

    it('should format person with second last name', () => {
      const person = { name: 'Jane', surname: 'Smith', secondLastName: 'Johnson' };
      expect(formatFullName(person)).toBe('Jane Smith Johnson');
    });

    it('should format person with all name fields', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
        nickname: 'Matto'
      };
      expect(formatFullName(person)).toBe("Matias 'Matto' Alejandro Godoy Biedma");
    });
  });

  describe('formatFullName - eastern order', () => {
    it('should format person in eastern order', () => {
      const person = { name: 'Taro', surname: 'Tanaka' };
      expect(formatFullName(person, 'EASTERN')).toBe('Tanaka Taro');
    });

    it('should format person with all fields in eastern order', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
        nickname: 'Matto',
      };
      expect(formatFullName(person, 'EASTERN')).toBe("Godoy Biedma 'Matto' Matias Alejandro");
    });

    it('should default to western when nameOrder is omitted', () => {
      const person = { name: 'John', surname: 'Smith' };
      expect(formatFullName(person)).toBe('John Smith');
    });
  });

  describe('formatGraphName', () => {
    it('should format name only', () => {
      const person = { name: 'John' };
      expect(formatGraphName(person)).toBe('John');
    });

    it('should format name and surname', () => {
      const person = { name: 'John', surname: 'Doe' };
      expect(formatGraphName(person)).toBe('John Doe');
    });

    it('should show full name with nickname in quotes when present', () => {
      const person = { name: 'Matias', surname: 'Godoy', nickname: 'Matto' };
      expect(formatGraphName(person)).toBe("Matias 'Matto' Godoy");
    });

    it('should show only first name and surname (ignore middle names)', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
      };
      expect(formatGraphName(person)).toBe('Matias Godoy');
    });

    it('should show full name with nickname in quotes (ignore middle names)', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
        nickname: 'Matto',
      };
      expect(formatGraphName(person)).toBe("Matias 'Matto' Godoy");
    });

    it('should handle null surname', () => {
      const person = { name: 'John', surname: null };
      expect(formatGraphName(person)).toBe('John');
    });

    it('should handle nickname without surname', () => {
      const person = { name: 'John', surname: null, nickname: 'Johnny' };
      expect(formatGraphName(person)).toBe("John 'Johnny'");
    });
  });

  describe('formatGraphName - eastern order', () => {
    it('should format graph name in eastern order', () => {
      const person = { name: 'Taro', surname: 'Tanaka' };
      expect(formatGraphName(person, 'EASTERN')).toBe('Tanaka Taro');
    });

    it('should show full name with nickname in eastern order', () => {
      const person = { name: 'Matias', surname: 'Godoy', nickname: 'Matto' };
      expect(formatGraphName(person, 'EASTERN')).toBe("Godoy 'Matto' Matias");
    });

    it('should handle no surname in eastern order', () => {
      const person = { name: 'Taro' };
      expect(formatGraphName(person, 'EASTERN')).toBe('Taro');
    });

    it('should default to western when nameOrder is omitted', () => {
      const person = { name: 'John', surname: 'Doe' };
      expect(formatGraphName(person)).toBe('John Doe');
    });
  });

  describe('formatGraphName with nameDisplayFormat', () => {
    // FULL format — shows complete name with nickname in quotes
    it('should show full name with nickname in FULL format', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }, undefined, 'FULL'))
        .toBe("Robert 'Dad' Johnson");
    });

    it('should show name and surname in FULL format when no nickname', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: null }, undefined, 'FULL'))
        .toBe('Robert Johnson');
    });

    it('should show name only in FULL format when no surname or nickname', () => {
      expect(formatGraphName({ name: 'Robert', surname: null, nickname: null }, undefined, 'FULL'))
        .toBe('Robert');
    });

    it('should show name with nickname in FULL format when no surname', () => {
      expect(formatGraphName({ name: 'Robert', surname: null, nickname: 'Bob' }, undefined, 'FULL'))
        .toBe("Robert 'Bob'");
    });

    // NICKNAME_PREFERRED format — nickname replaces first name
    it('should show nickname + surname in NICKNAME_PREFERRED format', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }, undefined, 'NICKNAME_PREFERRED'))
        .toBe('Dad Johnson');
    });

    it('should fall back to name + surname in NICKNAME_PREFERRED when no nickname', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: null }, undefined, 'NICKNAME_PREFERRED'))
        .toBe('Robert Johnson');
    });

    it('should show nickname only in NICKNAME_PREFERRED when no surname', () => {
      expect(formatGraphName({ name: 'Robert', surname: null, nickname: 'Dad' }, undefined, 'NICKNAME_PREFERRED'))
        .toBe('Dad');
    });

    // SHORT format — nickname or name only, no surname
    it('should show nickname only in SHORT format', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }, undefined, 'SHORT'))
        .toBe('Dad');
    });

    it('should fall back to name in SHORT format when no nickname', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: null }, undefined, 'SHORT'))
        .toBe('Robert');
    });

    // EASTERN name order combinations
    it('should use Eastern order in FULL format', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }, 'EASTERN', 'FULL'))
        .toBe("Johnson 'Dad' Robert");
    });

    it('should use Eastern order in NICKNAME_PREFERRED format', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }, 'EASTERN', 'NICKNAME_PREFERRED'))
        .toBe('Johnson Dad');
    });

    it('should use Eastern order in SHORT format (no surname, so order irrelevant)', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }, 'EASTERN', 'SHORT'))
        .toBe('Dad');
    });

    // Default behavior (no nameDisplayFormat passed) matches FULL
    it('should default to FULL behavior when nameDisplayFormat is undefined', () => {
      expect(formatGraphName({ name: 'Robert', surname: 'Johnson', nickname: 'Dad' }))
        .toBe("Robert 'Dad' Johnson");
    });

    // CJK names
    it('should handle CJK names in FULL format with Eastern order', () => {
      expect(formatGraphName({ name: '太郎', surname: '田中', nickname: 'タロウ' }, 'EASTERN', 'FULL'))
        .toBe("田中'タロウ'太郎");
    });

    it('should handle CJK names in NICKNAME_PREFERRED format with Eastern order', () => {
      expect(formatGraphName({ name: '太郎', surname: '田中', nickname: 'タロウ' }, 'EASTERN', 'NICKNAME_PREFERRED'))
        .toBe('田中タロウ');
    });

    it('should handle CJK names in SHORT format', () => {
      expect(formatGraphName({ name: '太郎', surname: '田中', nickname: 'タロウ' }, 'EASTERN', 'SHORT'))
        .toBe('タロウ');
    });
  });

  describe('formatFullName with nameDisplayFormat', () => {
    const person = { name: 'Robert', surname: 'Johnson', middleName: 'Michael', secondLastName: null, nickname: 'Dad' };

    // FULL format — same as current behavior
    it('should show full name in FULL format', () => {
      expect(formatFullName(person, undefined, 'FULL'))
        .toBe("Robert 'Dad' Michael Johnson");
    });

    // NICKNAME_PREFERRED — in full context, still shows all parts (detail views)
    it('should show full name in NICKNAME_PREFERRED format (detail context)', () => {
      expect(formatFullName(person, undefined, 'NICKNAME_PREFERRED'))
        .toBe("Robert 'Dad' Michael Johnson");
    });

    // SHORT format — nickname only
    it('should show nickname only in SHORT format', () => {
      expect(formatFullName(person, undefined, 'SHORT'))
        .toBe('Dad');
    });

    it('should fall back to name in SHORT format when no nickname', () => {
      expect(formatFullName({ name: 'Robert', surname: 'Johnson', nickname: null }, undefined, 'SHORT'))
        .toBe('Robert');
    });

    // Default behavior matches FULL
    it('should default to FULL when nameDisplayFormat is undefined', () => {
      expect(formatFullName(person))
        .toBe("Robert 'Dad' Michael Johnson");
    });
  });

  describe('CJK name handling (no spaces)', () => {
    it('should omit spaces for Chinese names in eastern order', () => {
      expect(formatPersonName('龙', '成', null, null, null, 'EASTERN')).toBe('成龙');
    });

    it('should omit spaces for Japanese names in eastern order', () => {
      expect(formatPersonName('太郎', '田中', null, null, null, 'EASTERN')).toBe('田中太郎');
    });

    it('should omit spaces for Korean names in eastern order', () => {
      expect(formatPersonName('철수', '김', null, null, null, 'EASTERN')).toBe('김철수');
    });

    it('should keep spaces for romanized names in eastern order', () => {
      expect(formatPersonName('Taro', 'Tanaka', null, null, null, 'EASTERN')).toBe('Tanaka Taro');
    });

    it('should keep spaces for mixed CJK and Latin names', () => {
      expect(formatPersonName('Taro', '田中', null, null, null, 'EASTERN')).toBe('田中 Taro');
    });

    it('should omit spaces for CJK names with middle name', () => {
      expect(formatPersonName('太郎', '田中', '次郎', null, null, 'EASTERN')).toBe('田中太郎次郎');
    });

    it('should omit spaces for CJK formatFullName', () => {
      const person = { name: '太郎', surname: '田中' };
      expect(formatFullName(person, 'EASTERN')).toBe('田中太郎');
    });

    it('should omit spaces for CJK formatGraphName', () => {
      const person = { name: '太郎', surname: '田中' };
      expect(formatGraphName(person, 'EASTERN')).toBe('田中太郎');
    });

    it('should omit spaces for CJK formatGraphName with nickname', () => {
      const person = { name: '太郎', surname: '田中', nickname: 'たろちゃん' };
      expect(formatGraphName(person, 'EASTERN')).toBe("田中'たろちゃん'太郎");
    });

    it('should keep spaces for CJK names in western order', () => {
      const person = { name: '太郎', surname: '田中' };
      expect(formatFullName(person)).toBe('太郎 田中');
    });
  });
});
