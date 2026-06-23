import test from 'ava';

import { Prng } from './Prng';

test('same seed yields an identical sequence', (t) => {
  const a = new Prng(123456);
  const b = new Prng(123456);

  const seqA = [];
  const seqB = [];
  for (let i = 0; i < 200; i += 1) {
    seqA.push(a.number(0, 1000));
    seqB.push(b.number(0, 1000));
  }

  t.deepEqual(seqA, seqB);
});

test('different seeds diverge', (t) => {
  const a = new Prng(1);
  const b = new Prng(2);

  const seqA = [];
  const seqB = [];
  for (let i = 0; i < 50; i += 1) {
    seqA.push(a.next());
    seqB.push(b.next());
  }

  t.notDeepEqual(seqA, seqB);
});

test('reseed restarts the same sequence', (t) => {
  const p = new Prng(999);
  const first = [p.number(), p.number(), p.number()];

  p.reseed(999);
  const second = [p.number(), p.number(), p.number()];

  t.deepEqual(first, second);
});

test('getSeed returns the original seed after draws', (t) => {
  const p = new Prng(42);
  p.number();
  p.number();

  t.is(p.getSeed(), 42);
});

test('number stays within [min, max)', (t) => {
  const p = new Prng(7);

  for (let i = 0; i < 2000; i += 1) {
    const n = p.number(5, 10);
    t.true(n >= 5 && n < 10);
  }
});

test('arrayElement only returns in-range elements', (t) => {
  const p = new Prng(2024);
  const values = ['a', 'b', 'c', 'd'];

  for (let i = 0; i < 100; i += 1) {
    t.true(values.includes(p.arrayElement(values)));
  }
});
