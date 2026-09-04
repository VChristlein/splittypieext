/*eslint-disable*/
// firebase-tools and firebase-server (both pinned to old versions) crash on
// current Node because a few APIs they still rely on were removed/renamed.
// Load this before them, e.g. `node -r ./node-legacy-shim.js ...` or via
// NODE_OPTIONS="--require ./node-legacy-shim.js", to patch those back in.
// Safe to load on any Node version - each patch only applies if missing.
"use strict";

const buffer = require("buffer");

if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = function SlowBuffer(length) {
        return Buffer.alloc(length);
    };
    buffer.SlowBuffer.prototype = Buffer.prototype;
}

const util = require("util");

if (!util.isRegExp) {
    util.isRegExp = function isRegExp(value) {
        return Object.prototype.toString.call(value) === "[object RegExp]";
    };
}

if (!util.isArray) {
    util.isArray = Array.isArray;
}
