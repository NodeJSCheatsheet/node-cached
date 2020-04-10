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

const Backend = require('./backend');
const getOrElse = require('./get-or-else');
const util = require('./util');

class Cache {
  constructor(options) {
    this.defaults = {
      freshFor: 0,
      expire: 0,
    };
    this.name = options.name || 'default';
    this.prefix = `${this.name}:`;
    this.staleOrPending = {};

    this.setDefaults(options.defaults);
    Backend.register();
    this.setBackend(options.backend);
  }

  applyPrefix(key) {
    return [this.prefix, key].join('');
  }

  get(rawKey, cb) {
    const key = this.applyPrefix(rawKey);

    return this._getWrapped(key).then(util.extractValue).nodeify(cb);
  }

  getOrElse(rawKey, val, _opts, _cb) {
    const key = this.applyPrefix(rawKey);
    const args = util.optionalOpts(_opts, _cb);
    const optsWithDefaults = this.prepareOptions(args.opts);

    return getOrElse(this, key, val, optsWithDefaults).nodeify(args.cb);
  }

  /**
   * FIXME: getWrapped should be deprecated from public API
   *
   * @param {string} key
   */
  getWrapped(key) {
    return this._getWrapped(key);
  }

  end() {
    if (this.backend && this.backend.end) {
      return this.backend.end();
    }
    return null;
  }

  setBackend(backendOpts = {}) {
    if (typeof backendOpts === 'string')
      backendOpts = {
        type: backendOpts,
      };

    this.end();
    this.backend = Backend.create(backendOpts);
    return this.backend;
  }

  setDefaults(defaultsOpts) {
    this.defaults = this.prepareOptions(defaultsOpts);
    return this.defaults; // FIXME: why return
  }

  prepareOptions(options) {
    return { ...this.defaults, ...options };
  }

  set(rawKey, val, _opts, _cb) {
    const args = util.optionalOpts(_opts, _cb);
    const key = this.applyPrefix(rawKey);
    const optsWithDefaults = this.prepareOptions(args.opts);

    return this._set(key, val, optsWithDefaults).nodeify(args.cb);
  }

  unset(rawKey, cb) {
    const key = this.applyPrefix(rawKey);

    return this._unset(key).nodeify(cb);
  }

  /**
   *
   * @param {Bluebird} value
   * @return {Bluebird}
   * @private
   */
  _applyTimeout(value) {
    const timeoutMs = this.defaults.timeout;
    if (timeoutMs > 0) {
      return value.timeout(timeoutMs);
    }
    return value;
  }

  /**
   *
   * @param {string} key
   * @return {Bluebird}
   * @private
   */
  _getWrapped(key) {
    return this._applyTimeout(this.backend.get(key));
  }

  _set(key, val, options) {
    return this._applyTimeout(
      util.toPromise(val).then(this._writeToBackend.bind(this, key, options))
    );
  }

  _unset(key) {
    return this._applyTimeout(this.backend.unset(key));
  }

  _writeToBackend(key, options, resolvedValue) {
    return this.backend.set(
      key,
      {
        b: util.expiresAt(options.freshFor),
        d: resolvedValue,
      },
      options
    );
  }
}

module.exports = Cache;
