'use strict';

const assert = require('assert');

const Cache = require('../lib/cache');
const withBackends = require('./_backends');
const { delay } = require('./_helper');

function assertRejects(promise) {
  return promise.then(
    () => {
      throw new Error('Did not fail as expected');
    },
    error => error
  );
}

describe('Cache::getOrElse', () => {
  describe('backed.get failing', () => {
    let cache;
    before(() => {
      cache = new Cache({ backend: 'memory', name: 'awesome-name' });
      cache.getWrapped = () =>
        Promise.reject(new Error('backend get troubles'));
    });

    function generateCats() {
      return 'fresh cats';
    }

    it('falls back on the value refresher', async () => {
      const value = await cache.getOrElse('bad_get', generateCats, {
        freshFor: 5,
      });
      assert.strictEqual(value, 'fresh cats');
    });
  });

  describe('backend.set failing', () => {
    let cache;
    before(() => {
      cache = new Cache({ backend: 'memory', name: 'awesome-name' });
      cache.set = () => Promise.reject(new Error('backend set troubles'));
    });

    function generateBunnies() {
      return 'generated bunnies';
    }

    it('falls back on the generated value', async () => {
      const value = await cache.getOrElse('bad_set', generateBunnies, {
        freshFor: 5,
      });
      assert.strictEqual(value, 'generated bunnies');
    });
  });

  describe('backends:', () => {
    withBackends(cache => {
      it('replaces values lazily', async () => {
        let generatorCalled = 0;
        // generate a value in a certain time
        function valueGenerator(v, ms) {
          return async () => {
            ++generatorCalled;
            await delay(ms);
            return v;
          };
        }

        const originalValue = 'original-value';

        // 1. Set the value with a freshFor of 1 second
        await cache.set('key1', originalValue, { freshFor: 1 });
        // 2. Wait more than 1 second (the value is now stale)
        await delay(1200);
        // 3. Make sure we can still retrieve the original value.
        //    It's stale - but not expired/gone.
        assert.strictEqual(await cache.get('key1'), originalValue);

        // 4. The value is stale, so it should be calling the value generator.
        //    But it should *return* the original value asap.
        assert.strictEqual(
          await cache.getOrElse('key1', valueGenerator('G1', 100), {
            freshFor: 5,
          }),
          originalValue
        );

        // Let the generator be generating...
        await delay(50);

        // 5. Generating 'G1' in the last step takes 100ms but we only waited 50ms yet.
        //    This means we still expect to see the original value.
        //    'G2' should never be generated since there's already a pending value.
        assert.strictEqual(
          await cache.getOrElse('key1', valueGenerator('G2', 5000), {
            freshFor: 5,
          }),
          originalValue
        );

        // Let the generator be generating...
        await delay(100);

        // 6. Now G1 is done generating (we waited a total of 150ms), so we shouldn't
        //    see the original value anymore but the new, improved 'G1'.
        assert.strictEqual(
          await cache.getOrElse('key1', valueGenerator('G3', 5000), {
            freshFor: 5,
          }),
          'G1'
        );

        // 7. Making sure that the value generator was only called once during this test.
        //    We just generated 'G1', the other times we either had a pending value
        //    or the value was still fresh (last/'G3' call).
        assert.strictEqual(generatorCalled, 1);
      });

      it('throws errors', async () => {
        function errorGenerator() {
          throw new Error('Big Error');
        }

        const error = await assertRejects(
          cache.getOrElse('bad_keys', errorGenerator, { freshFor: 1 })
        );
        assert.strictEqual(error.message, 'Big Error');
      });

      describe('refresh of expired value failing', () => {
        const key = 'refresh-key';
        const value = 'refresh-value';

        before('set value that is stale after a second', () =>
          cache.set(key, value, { freshFor: 1, expire: 3 })
        );

        before('wait >1 seconds', () => delay(1100));

        function generator() {
          return Promise.reject(new Error('Oops'));
        }

        it('returns the original value if generating a new value fails', async () => {
          assert.strictEqual(await cache.getOrElse(key, generator), value);
        });

        describe('after two more second', () => {
          before('wait >2 seconds', () => delay(2100));

          it('fails to return a value if generating fails again', async () => {
            const error = await assertRejects(cache.getOrElse(key, generator));
            assert.strictEqual(error.message, 'Oops');
          });
        });
      });
    });
  });
});
