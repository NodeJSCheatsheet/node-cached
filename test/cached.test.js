'use strict';

const assert = require('assert');

const cached = require('..');

describe('cached', () => {
  beforeEach(() => cached.dropNamedCaches());

  it('is a function', () => assert.ok(typeof cached === 'function'));

  it('starts out with no known caches', () =>
    assert.deepStrictEqual(cached.knownCaches(), []));

  it('can create different named caches', () => {
    assert.notStrictEqual(cached('foo'), cached('bar'));
    assert.notStrictEqual(cached('foo'), cached());

    assert.deepStrictEqual(
      cached.knownCaches().sort(),
      ['bar', 'foo', 'default'].sort()
    );
  });

  it('the default cache is named "default"', () =>
    assert.strictEqual(cached(), cached('default')));

  it('returns the same named cache for subsequent calls', () =>
    assert.strictEqual(cached('foo'), cached('foo')));
});
