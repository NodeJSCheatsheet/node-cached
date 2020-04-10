'use strict';

const assert = require('assert');
const Bluebird = require('bluebird');

const identity = val => val;

const Cache = require('../lib/cache');
const { delay } = require('./_helper');

async function tooSlow(ms, msg) {
  await delay(ms);
  return msg;
}

describe('Cache timeouts', () => {
  const cache = new Cache({
    backend: {
      get() {
        return Bluebird.resolve({ d: 'get result' }).delay(150);
      },
      set() {
        return Bluebird.resolve('set result').delay(150);
      },
    },
    name: 'awesome-name',
    debug: true,
  });

  describe('with a timeout <150ms', () => {
    before(() => (cache.defaults.timeout = 50));

    it('get fails fast', async () => {
      const err = await Promise.race([
        cache.get('my-key').then(null, identity),
        tooSlow(100, 'too slow'), // this should not be used
      ]);
      assert.ok(err instanceof Error);
      assert.strictEqual(err.name, 'TimeoutError');
    });

    it('set fails fast', async () => {
      const err = await Promise.race([
        cache.set('my-key', 'my-value').then(null, identity),
        tooSlow(100, 'too slow'), // this should not be used
      ]);
      assert.ok(err instanceof Error);
      assert.strictEqual(err.name, 'TimeoutError');
    });

    it('getOrElse fails fast', async () => {
      const value = await Promise.race([
        cache.getOrElse('my-key', 'my-value').then(null, identity),
        // We need to add a bit of time here because we'll run into the
        // timeout twice - once when trying to read and once while writing.
        tooSlow(150, 'too slow'), // this should not be used
      ]);
      assert.strictEqual(value, 'my-value');
    });
  });

  describe('with a timeout >150ms', () => {
    before(() => (cache.defaults.timeout = 250));

    it('receives the value', async () => {
      const value = await Promise.race([
        cache.get('my-key').then(null, identity),
        tooSlow(200, 'too slow'), // this should not be used
      ]);
      assert.strictEqual(value, 'get result');
    });

    it('sets the value', async () => {
      const value = await Promise.race([
        cache.set('my-key', 'my-value').then(null, identity),
        tooSlow(200, 'too slow'), // this should not be used
      ]);
      assert.strictEqual(value, 'set result');
    });

    it('getOrElse can retrieve a value', async () => {
      const value = await Promise.race([
        cache.getOrElse('my-key', 'my-value').then(null, identity),
        tooSlow(200, 'too slow'), // this should not be used
      ]);

      assert.strictEqual(value, 'get result');
    });
  });
});
