'use strict';

const assert = require('assert');

const withBackends = require('./_backends');
const { delay } = require('./_helper');

describe('Cache::{get,set,unset}', () => {
  withBackends(cache => {
    it('get/set (callback style)', done => {
      cache.set('callback-key', 'callback-value', setError => {
        if (setError) return done(setError);
        cache.get('callback-key', (getError, value) => {
          if (getError) return done(getError);
          let assertError = null;
          try {
            assert.strictEqual(value, 'callback-value');
          } catch (error) {
            assertError = error;
          }
          return done(assertError);
        });
        return null;
      });
    });

    it('get/set (promise style)', async () => {
      await cache.set('promise-key', 'promise-value', { expire: 1 });
      const value = await cache.get('promise-key');

      assert.strictEqual(value, 'promise-value');
    });

    it('set/unset (callback style)', done => {
      cache.set('callback-key', 'callback-value', setError => {
        if (setError) return done(setError);
        cache.unset('callback-key', unsetError => {
          if (unsetError) return done(unsetError);
          cache.get('callback-key', (getError, value) => {
            if (getError) return done(getError);
            let assertError = null;
            try {
              assert.strictEqual(value, null);
            } catch (error) {
              assertError = error;
            }
            return done(assertError);
          });
          return null;
        });
        return null;
      });
    });

    it('set/unset (promise style)', async () => {
      await cache.set('promise-key', 'promise-value', { expire: 1 });
      await cache.unset('promise-key');

      assert.strictEqual(await cache.get('promise-key'), null);
    });

    it('honors expires', async () => {
      const values = {
        key1: 'Value 1',
        key2: 'Value 2',
        key3: 'Value 3',
      };

      await Promise.all([
        cache.set('key1', values.key1, { expire: 1 }),
        cache.set('key2', values.key2, { expire: 0 }),
        cache.set('key3', values.key3, { expire: 4 }),
      ]);

      await delay(2000);

      const [expired, eternal, hit] = await Promise.all(
        ['key', 'key2', 'key3'].map(key => cache.get(key))
      );

      assert.strictEqual(expired, null);
      assert.strictEqual(eternal, values.key2);
      assert.strictEqual(hit, values.key3);
    });
  });
});
