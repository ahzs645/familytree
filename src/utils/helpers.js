/**
 * Utility helpers extracted from the CloudTreeWeb bundle.
 * These replace minified helper functions used throughout the app.
 */

/**
 * Destructure an array to a fixed length (replacement for minified `s(arr, len)`).
 * Used heavily with useState: `const [value, setValue] = arraySlice(useState(initial), 2)`
 */
export function arraySlice(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  const result = new Array(len);
  for (let i = 0; i < len; i++) result[i] = arr[i];
  return result;
}

/**
 * Safe iterable helper (replacement for minified `u(iterable)`).
 * Returns an iterator wrapper with .s() .n() .e() .f() for safe iteration.
 */
export function createSafeIterator(iterable, allowArrayLike) {
  let it;
  if (typeof Symbol === 'undefined' || iterable[Symbol.iterator] == null) {
    if (
      Array.isArray(iterable) ||
      (it = toArray(iterable)) ||
      (allowArrayLike && iterable && typeof iterable.length === 'number')
    ) {
      if (it) iterable = it;
      let i = 0;
      const F = function () {};
      return {
        s: F,
        n: function () {
          if (i >= iterable.length) return { done: true };
          return { done: false, value: iterable[i++] };
        },
        e: function () {},
        f: F,
      };
    }
    throw new TypeError('Invalid attempt to iterate non-iterable instance.');
  }
  let normalCompletion = true;
  let didErr = false;
  let err;
  return {
    s: function () {
      it = iterable[Symbol.iterator]();
    },
    n: function () {
      const step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function (e) {
      didErr = true;
      err = e;
    },
    f: function () {
      try {
        if (!normalCompletion && it.return != null) it.return();
      } finally {
        if (didErr) throw err;
      }
    },
  };
}

/**
 * Convert iterable to array (replacement for minified `a(iterable, len)`).
 */
export function toArray(iterable, len) {
  if (!iterable) return;
  if (typeof iterable === 'string') return arraySlice(iterable, len);
  const name = Object.prototype.toString.call(iterable).slice(8, -1);
  if (name === 'Object' && iterable.constructor) {
    const n = iterable.constructor.name;
    if (n === 'Map' || n === 'Set') return Array.from(iterable);
  }
  if (name === 'Arguments' || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(name)) {
    return arraySlice(iterable, len);
  }
}

/**
 * Async generator runner (replacement for minified `ge(generatorFn)`).
 * Converts a generator function into an async function.
 */
export function asyncGeneratorRunner(generatorFn) {
  return function (...args) {
    const self = this;
    return new Promise(function (resolve, reject) {
      const gen = generatorFn.apply(self, args);
      function step(key, arg) {
        let info, value;
        try {
          info = gen[key](arg);
          value = info.value;
        } catch (error) {
          reject(error);
          return;
        }
        if (info.done) {
          resolve(value);
        } else {
          Promise.resolve(value).then(
            (val) => step('next', val),
            (err) => step('throw', err)
          );
        }
      }
      step('next', undefined);
    });
  };
}

/**
 * UUID v4 generator.
 */
const hexBytes = new Uint8Array(16);
export function generateUUID() {
  const crypto = window.crypto || window.msCrypto;
  if (crypto && crypto.getRandomValues) {
    crypto.getRandomValues(hexBytes);
  } else {
    for (let i = 0; i < 16; i++) hexBytes[i] = (Math.random() * 256) | 0;
  }
  hexBytes[6] = (hexBytes[6] & 0x0f) | 0x40;
  hexBytes[8] = (hexBytes[8] & 0x3f) | 0x80;

  const hex = [];
  for (let i = 0; i < 16; i++) {
    hex.push(hexBytes[i].toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10).join('')
  );
}

/**
 * Class instance check (replacement for minified `xe(instance, Class)`).
 */
export function assertClassInstance(instance, Class) {
  if (!(instance instanceof Class)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

/**
 * Define class methods (replacement for minified `we(proto, methods)` + `Ne(Class, proto, statics)`).
 */
export function defineClassMethods(proto, methods) {
  for (const descriptor of methods) {
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ('value' in descriptor) descriptor.writable = true;
    Object.defineProperty(proto, descriptor.key, descriptor);
  }
}

export function createClass(Class, protoMethods, staticMethods) {
  if (protoMethods) defineClassMethods(Class.prototype, protoMethods);
  if (staticMethods) defineClassMethods(Class, staticMethods);
  return Class;
}
