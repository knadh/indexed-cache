/* eslint-disable */

// http://stackoverflow.com/a/33268326/786644 - works in browser, worker, and Node.js
var globalVar = typeof window !== 'undefined' ? window :
   typeof WorkerGlobalScope !== 'undefined' ? self :
   typeof global !== 'undefined' ? global :
   Function('return this;')();

(function (window) {
    "use strict";

    var Event, IDBIndex, IDBObjectStore, IDBRequest, getAllFactory;

    IDBObjectStore = window.IDBObjectStore || window.webkitIDBObjectStore || window.mozIDBObjectStore || window.msIDBObjectStore;
    IDBIndex = window.IDBIndex || window.webkitIDBIndex || window.mozIDBIndex || window.msIDBIndex;

    if (typeof IDBObjectStore === "undefined" || typeof IDBIndex === "undefined") {
        return;
    }

    var override = false;

    // Safari 10.1 has getAll but inside a Worker it crashes https://bugs.webkit.org/show_bug.cgi?id=172434
    if (typeof WorkerGlobalScope !== "undefined" && (navigator.userAgent.indexOf("Safari/602") >= 0 || navigator.userAgent.indexOf("Safari/603") >= 0)) {
        override = true;
    }

    if (!override && (IDBObjectStore.prototype.getAll !== undefined && IDBIndex.prototype.getAll !== undefined && IDBObjectStore.prototype.getAllKeys !== undefined && IDBIndex.prototype.getAllKeys !== undefined)) {
        return;
    }

    // IDBRequest and Event objects mostly from https://github.com/dumbmatter/fakeIndexedDB
    IDBRequest = function () {
        this.result = null;
        this.error = null;
        this.source = null;
        this.transaction = null;
        this.readyState = 'pending';
        this.onsuccess = null;
        this.onerror = null;

        this.toString = function () {
            return '[object IDBRequest]';
        };

        this._listeners = {
            success: [],
            error: [],
        };

        var that = this;
        this.addEventListener = function (type, listener) {
            if (that._listeners[type]) {
                that._listeners[type].push(listener);
            }

        }
        this.removeEventListener = function (type, listener) {
            if (that._listeners[type]) {
                that._listeners[type] = that._listeners[type]
                    .filter(function (listener2) {
                        return listener !== listener2;
                    });
            }
        }
    };
    Event = function (type) {
        this.type = type;
        this.target = null;
        this.currentTarget = null;

        this.NONE = 0;
        this.CAPTURING_PHASE = 1;
        this.AT_TARGET = 2;
        this.BUBBLING_PHASE = 3;
        this.eventPhase = this.NONE;

        this.stopPropagation = function () {
            console.log('stopPropagation not implemented in IndexedDB-getAll-shim');
        };
        this.stopImmediatePropagation = function () {
            console.log('stopImmediatePropagation not implemented in IndexedDB-getAll-shim');
        };

        this.bubbles = false;
        this.cancelable = false;
        this.preventDefault = function () {
            console.log('preventDefault not implemented in IndexedDB-getAll-shim');
        };
        this.defaultPrevented = false;

        this.isTrusted = false;
        this.timestamp = Date.now();
    };

    // Based on spec draft https://w3c.github.io/IndexedDB/#dom-idbobjectstore-getall
    getAllFactory = function (parent, type) {
        return function (key, count) {
            var cursorRequest, i, request, result;

            key = key !== undefined ? key : null;

            request = new IDBRequest();
            result = [];

            // this is either an IDBObjectStore or an IDBIndex, depending on the context.
            cursorRequest = this.openCursor(key);

            cursorRequest.onsuccess = function (event) {
                var cursor, e, i, value;

                cursor = event.target.result;
                if (cursor) {
                    if (type === "value") {
                        value = cursor.value;
                    } else if (parent === "index") {
                        value = cursor.primaryKey;
                    } else {
                        value = cursor.key;
                    }
                    result.push(value);
                    if (count === undefined || result.length < count) {
                        cursor.continue();
                        return;
                    }
                }

                request.result = result;
                e = new Event("success");
                e.target = {
                    readyState: "done",
                    result: result
                };
                if (typeof request.onsuccess === "function") {
                    request.onsuccess(e);
                }
                if (request._listeners.success.length > 0) {
                    for (i = 0; i < request._listeners.success.length; i++) {
                        request._listeners.success[i](e);
                    }
                }
            };

            cursorRequest.onerror = function (event) {
                var i;

                console.log('IndexedDB-getAll-shim error when getting data:', event.target.error);
                if (typeof request.onerror === "function") {
                    request.onerror(event);
                }
                if (request._listeners.error.length > 0) {
                    for (i = 0; i < request._listeners.error.length; i++) {
                        request._listeners.error[i](e);
                    }
                }
            };

            return request;
        };
    };

    if (override || IDBObjectStore.prototype.getAll === undefined) {
        IDBObjectStore.prototype.getAll = getAllFactory("objectStore", "value");
    }

    if (override || IDBIndex.prototype.getAll === undefined) {
        IDBIndex.prototype.getAll = getAllFactory("index", "value");
    }

    if (override || IDBObjectStore.prototype.getAllKeys === undefined) {
        IDBObjectStore.prototype.getAllKeys = getAllFactory("objectStore", "key");
    }

    if (override || IDBIndex.prototype.getAllKeys === undefined) {
        IDBIndex.prototype.getAllKeys = getAllFactory("index", "key");
    }
}(globalVar));
