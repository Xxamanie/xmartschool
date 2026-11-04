import { expect, test } from '@jest/globals';
import { calculateAssessment, defaultConfiguration, gradeFor } from '../src/services/assessmentService';
import { toKobo, fromKobo } from '../src/utils/money';

test.each([
  [0, 0],
  [1.25, 125],
  [-1, -100],
  ['10.01', 1001],
  ['999999999999.99', 99999999999999],
])('converts %s naira to exact kobo', (amount, expected) => {
  expect(toKobo(amount)).toBe(expected);
  expect(fromKobo(expected)).toBe(Number(amount));
});

test.each([NaN, Infinity, 1.001, 'not an amount'])('rejects invalid currency values: %s', amount => {
  expect(() => toKobo(amount as number | string)).toThrow('Amounts must be finite values with at most two decimal places');
});

test('assessment percentage, grade, and pass remark use configured maximum scores', () => {
  const result = calculateAssessment({
    studentId: 'student',
    subjectId: 'subject',
    term: 'term',
    ca1: 10,
    ca2: 10,
    ca3: 10,
    exam: 50,
  }, defaultConfiguration);

  expect(result).toMatchObject({
    average: 80,
    grade: 'A',
    remarks: 'Pass',
    details: { total: 80, maximum: 100, percentage: 80 },
  });
});

test.each([
  [{ ca1: 11, ca2: 0, ca3: 0 }, 0],
  [{ ca1: 0, ca2: 0, ca3: 0 }, 71],
])('rejects scores exceeding their configured maximum', (scores, exam) => {
  expect(() => calculateAssessment({
    studentId: 'student',
    subjectId: 'subject',
    term: 'term',
    ca1: 0,
    ca2: 0,
    ca3: 0,
    exam,
    scores,
  }, defaultConfiguration)).toThrow();
});

test('grade selection uses the highest threshold not greater than the percentage', () => {
  expect(gradeFor(89.99, defaultConfiguration)).toBe('A');
  expect(gradeFor(49.99, defaultConfiguration)).toBe('F');
  expect(gradeFor(50, defaultConfiguration)).toBe('D');
});
