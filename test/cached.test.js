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

  it('dropNamedCache() removes specific cache', () => {
    cached('bar');
    cached('foo');
    cached('ponyfoo');

    cached.dropNamedCache('foo');

    assert.deepStrictEqual(cached.knownCaches(), ['bar', 'ponyfoo']);
  });

  it('knownCaches() returns all named caches', () => {
    cached('bar');

    assert.deepStrictEqual(cached.knownCaches(), ['bar']);
  });

  it('dropNamedCaches() removes all caches', () => {
    cached('bar');

    cached.dropNamedCaches();

    assert.deepStrictEqual(cached.knownCaches(), []);
  });

  it('deferred() promisifies passed function', async () => {
    const fn = cb => {
      return cb();
    };
    const deferred = cached.deferred(fn);

    assert.strictEqual(typeof deferred, 'function');
    assert.strictEqual(
      Object.getPrototypeOf(deferred()).constructor.name,
      'Promise'
    );
  });
});
