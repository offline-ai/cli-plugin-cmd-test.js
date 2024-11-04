import { describe, it, expect } from 'vitest';
import {formatTemplate, formatObject, validateMatch} from './to-match-object.js';
import { stripConsoleColor } from '@isdk/ai-tool';
import { YamlTypeJsonSchema } from './yaml-types/json-schema.js';

describe('validateMatch', async () => {
  it('should handle simple equality', async () => {
    const actual = 10;
    const expected = 10;
    const result = await validateMatch(actual, expected);
    expect(result).toBeFalsy();
  });

  it('should handle string equality', async () => {
    const actual = 'hello';
    const expected = 'hello';
    const result = await validateMatch(actual, expected);
    expect(result).toBeFalsy();
  });

  it('should handle string inequality', async () => {
    const actual = 'hello';
    const expected = 'world';
    const result = await validateMatch(actual, expected);
    expect(result).toHaveLength(1)
    expect(stripConsoleColor(result![0])).toEqual('-"wor"+"he"l-"d"+"lo"');
  });

  it('should handle regex matching', async () => {
    const actual = 'hello world';
    const expected = /hello/;
    const result = await validateMatch(actual, expected);
    expect(result).toBeFalsy();
  });

  it('should handle regex non-matching', async () => {
    const actual = 'hello world';
    const expected = /^world/;
    const result = await validateMatch(actual, expected);
    expect(result).toEqual(['/^world/.test("hello world") failed']);
  });

  it('should handle array equality', async () => {
    const actual = [1, 2, 3];
    const expected = [1, 2, 3];
    const result = await validateMatch(actual, expected);
    expect(result).toBeFalsy();
  });

  it('should handle array inequality', async () => {
    const actual = [1, 2, 3];
    const expected = [1, 2, 4];
    const result = await validateMatch(actual, expected);
    expect(result).toEqual(['[2]: 3 != 4']);
  });

  it('should handle object equality', async () => {
    const actual = { a: 1, b: 2 };
    const expected = { a: 1, b: 2 };
    const result = await validateMatch(actual, expected);
    expect(result).toBeFalsy();
  });

  it('should handle object inequality', async () => {
    const actual = { a: 1, b: 2 };
    const expected = { a: 1, b: 3 };
    const result = await validateMatch(actual, expected);
    expect(result).toEqual(['b: 2 != 3']);
  });

  it('should handle nested object equality', async () => {
    const actual = { a: { b: 1, c: 2 }, d: 3 };
    const expected = { a: { b: 1, c: 2 }, d: 3 };
    const result = await validateMatch(actual, expected);
    expect(result).toBeFalsy();
  });

  it('should handle nested object inequality', async () => {
    const actual = { a: { b: 1, c: 2 }, d: 3 };
    const expected = { a: { b: 1, c: 3 }, d: 3 };
    const result = await validateMatch(actual, expected);
    expect(result).toEqual(['a.c: 2 != 3']);
  });

  it('should handle template string matching', async () => {
    const actual = { a: 'hello' };
    const expected = { a: '{{ a }}' };
    const data = { a: 'hello' };
    const result = await validateMatch(actual, expected, { data });
    expect(result).toBeFalsy();
  });

  it('should handle template string non-matching', async () => {
    const actual = { a: 'hello' };
    const expected = { a: '{{ a }}' };
    const data = { a: 'world' };
    const result = await validateMatch(actual, expected, { data });
    expect(result).toHaveLength(1)
    expect(stripConsoleColor(result![0])).toEqual('a: -"wor"+"he"l-"d"+"lo"');
  });

  it('should validate json-schema', async () => {
    const actual = { name: 'hello', age: 12 };
    const expected = YamlTypeJsonSchema.create({ type: 'object', properties: { name: { type: 'string' }, age: { type: 'number', minimum: 18 }} });
    const data = { a: 'world' };
    const result = await validateMatch(actual, expected, { data });
    expect(result).toHaveLength(1)
    expect(result![0]).match(/must be >= 18"/)
  });

  it('should validate diff', async () => {
    const actual = '它的建筑阴影非常少，\n 吉尔安慰自己说、';
    const expected = '它的建筑阴影非常少，吉尔安慰(wèi)自己说';
    const options = { input: {diff: [{value: '\n'}, {removed: true, value: '(wèi)'}, {added: true, value: '、'}]} };
    let result = await validateMatch(actual, expected, options );
    expect(result).toBeFalsy()
    result = await validateMatch(actual, '它的建筑阴yǐng非常少，吉尔安慰(wèi)自己说', options );
    expect(stripConsoleColor(result![0])).toEqual('它的建筑阴-"yǐng"+"影"非常少，✓(+"\n ")吉尔安慰✓(-"(wèi)")自己说✓(+"、")');
  });
});

describe('formatTemplate', () => {
  it('should handle string values with data', async () => {
    const value = 'Hello {{name}}!';
    const options = { data: { name: 'Alice' } };
    const result = await formatTemplate(value, options);
    expect(result).toBe('Hello Alice!');
  });

  it('should handle regular expressions', async () => {
    const value = /{{name}}/;
    const options = { data: { name: 'Alice' } };
    const result = await formatTemplate(value, options);
    expect(result).toEqual(new RegExp('Alice'));
  });

  it('should handle unchanged regular expressions', async () => {
    const value = /name/;
    const options = { data: { name: 'Alice' } };
    const result = await formatTemplate(value, options);
    expect(result).toEqual(value);
  });
});

describe('formatInput', () => {
  it('should handle arrays', async () => {
    const input = ['Hello {{name}}!', 'Goodbye {{name}}!'];
    const options = { data: { name: 'Alice' } };
    const result = await formatObject(input, options);
    expect(result).toEqual(['Hello Alice!', 'Goodbye Alice!']);
  });

  it('should handle strings', async () => {
    const input = 'Hello {{name}}!';
    const options = { data: { name: 'Alice' } };
    const result = await formatObject(input, options);
    expect(result).toBe('Hello Alice!');
  });

  it('should handle regular expressions', async () => {
    const input = /{{name}}/;
    const options = { data: { name: 'Alice' } };
    const result = await formatObject(input, options);
    expect(result).toEqual(new RegExp('Alice'));
  });

  it('should handle objects', async () => {
    const input = {
      greeting: 'Hello {{name}}!',
      farewell: 'Goodbye {{name}}!',
      nested: {
        message: 'Welcome {{name}}!',
      },
    };
    const options = { data: { name: 'Alice' } };
    const result = await formatObject(input, options);
    expect(result).toEqual({
      greeting: 'Hello Alice!',
      farewell: 'Goodbye Alice!',
      nested: {
        message: 'Welcome Alice!',
      },
    });
  });
});
