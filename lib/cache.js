/*
 * Copyright (c) 2014, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const backends = require('./backend');
const getOrElse = require('./get-or-else');
const util = require('./util');

/**
 * @typedef {Object} backendOpts
 * @property {?string} type
 * @property {?function} client
 * @property {?string} hosts
 */

/**
 * @typedef {Object} cacheOpts
 * @property {?string} name
 * @property {{freshFor: number, expire: number}} defaults
 * @property {string|backendOpts} backend
 */

class Cache {
  /**
   *
   * @param {cacheOpts} options
   */
  constructor(options) {
    this.defaults = {
      freshFor: 0,
      expire: 0,
    };
    this.name = options.name || 'default';
    this.prefix = `${this.name}:`;
    /**
     * @type {Map<string, Promise|any>}
     */
    this.staleOrPending = new Map(); // Keep - internal cache for pending requests

    backends.register();

    this._set = this._set.bind(this);
    this._get = this._get.bind(this);
    this._unset = this._unset.bind(this);

    this.setDefaults(options.defaults);
    this._setBackend(options.backend);
  }

  /**
   * Get the value for the given key.
   *
   * @param {string} rawKey
   * @param {?function} cb
   * @return {Promise<any>|any}
   */
  get(rawKey, cb) {
    const key = this._applyPrefix(rawKey);

    return util.resolve(this._get(key).then(util.extractValue), cb);
  }

  /**
   * Get the value for the given key.
   *
   * @param {string} rawKey
   * @param {any} val
   * @param {?Record<string, any>} opts
   * @param {?function} cb
   * @return {Promise<any>|any}
   */
  getOrElse(rawKey, val, opts, cb) {
    const key = this._applyPrefix(rawKey);
    const args = util.optionalOpts(opts, cb);
    const optsWithDefaults = this._prepareOptions(args.opts);

    return util.resolve(getOrElse(this, key, val, optsWithDefaults), args.cb);
  }

  /**
   * @param {string} rawKey
   * @param {any} val
   * @param {?Object} opts
   * @param {?function} cb
   * @return {Promise<void>|null}
   */
  set(rawKey, val, opts, cb) {
    const key = this._applyPrefix(rawKey);
    const args = util.optionalOpts(opts, cb);
    const optsWithDefaults = this._prepareOptions(args.opts);

    const promiseOrValue = this._set(key, val, optsWithDefaults);

    return util.resolve(promiseOrValue, args.cb);
  }

  /**
   * @param {Record<string, any>} defaultsOpts
   */
  setDefaults(defaultsOpts) {
    this.defaults = this._prepareOptions(defaultsOpts);
  }

  /**
   * Remove the key from backend.
   *
   * @param {string} rawKey
   * @param {?function} cb
   * @return {Promise<void>|undefined}
   */
  unset(rawKey, cb) {
    const key = this._applyPrefix(rawKey);

    return util.resolve(this._unset(key), cb);
  }

  /**
   * @param {string} key
   * @return {string}
   * @private
   */
  _applyPrefix(key) {
    return [this.prefix, key].join('');
  }

  /**
   *
   * @param {Promise} promise
   * @return {Promise}
   * @private
   */
  _applyTimeout(promise) {
    const timeout = this.defaults.timeout;
    if (timeout > 0) {
      return util.promiseTimeout(promise, timeout);
    }
    return promise;
  }

  /**
   * @param {string} key
   * @return {Promise<{b:number, d:any}>}
   * @private
   */
  _get(key) {
    return this._applyTimeout(this.backend.get(key));
  }

  _end() {
    if (this.backend && this.backend.end) {
      return this.backend.end();
    }
    return null;
  }

  /**
   * @param {Record<string, any>} options
   * @return {{freshFor: number, expire: number} & Record<string, any>}
   * @private
   */
  _prepareOptions(options) {
    return { ...this.defaults, ...options };
  }

  /**
   * @param {string} key
   * @param {any} val
   * @param {{freshFor: number} & Record<string, any>} options
   * @return {Promise<void>}
   * @private
   */
  _set(key, val, options) {
    const value = {
      b: util.expiresAt(options.freshFor),
      d: val,
    };

    return this._applyTimeout(this.backend.set(key, value, options));
  }

  /**
   * @param {string|{type:string} & Record<string, any>} backendOpts
   * @private
   */
  _setBackend(backendOpts = {}) {
    if (typeof backendOpts === 'string')
      backendOpts = {
        type: backendOpts,
      };

    this._end();
    this.backend = backends.create(backendOpts);
  }

  /**
   * @param {string}key
   * @return {Promise<void>}
   * @private
   */
  _unset(key) {
    return this._applyTimeout(this.backend.unset(key));
  }
}

module.exports = Cache;
