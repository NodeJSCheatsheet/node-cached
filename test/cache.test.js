'use strict';

const assert = require('assert');

const Cache = require('../lib/cache');

describe('Cache', () => {
  it('always has a backend', () => {
    const cache = new Cache({});

    assert.ok(cache.backend);
  });

  it('has a "noop" backend by default', () => {
    const cache = new Cache({});

    assert.strictEqual(cache.backend.type, 'noop');
  });

  it('throws for unknown backend', () => {
    assert.throws(() => new Cache({ backend: { type: 'foo' } }));
  });
});
