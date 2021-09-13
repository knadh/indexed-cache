import { allSettled } from './polyfills'
let _icLoaded = false

export default class IndexedCache {
  constructor (options) {
    if (_icLoaded) {
      throw new Error('indexed-cache is already loaded')
    }
    _icLoaded = true

    this.opt = {
      tags: ['script', 'img', 'link'],
      dbName: 'indexed-cache',
      storeName: 'objects',

      // If this is enabled, all objects in the cash with keys not
      // found on elements on the page (data-key) will be deleted by load().
      // This can be problematic in scenarios where there are multiple
      // pages on the same domain that have different assets, some on
      // certain pages and some on other.
      prune: false,

      // Default expiry for an object in minutes (default 3 months).
      // Set to null for no expiry.
      expiry: 131400,

      ...options
    }
    this.db = null
  }

  // This should be called before calling any other methods.
  async init () {
    if (this.db) {
      return
    }

    await this._initDB(this.opt.dbName, this.opt.storeName).then((db) => {
      this.db = db
    }).catch((e) => {
      console.log('error initializing cache DB. failing over.', e)
    })
  }

  // Initialize the DB and then scan and setup DOM elements to cache.
  async load (elements) {
    // This will setup the elements on the page irrespective of whether
    // the DB is available or not.
    let objs = []
    await this._setupElements(elements).then((_objs) => {
      objs = _objs
    })

    if (!this.db || objs.length === 0) {
      return
    }

    // If pruning is enabled, delete all cached elements that are no longer
    // referenced on the page.
    if (this.opt.prune) {
      // Pass the list of keys found on the page.
      const keys = objs.map(obj => obj.key)
      this._prune(keys)
    }
  }

  deleteKey (key) {
    if (!this.db) {
      return
    }

    this._store().delete(key)
  }

  // Prune all objects in the DB that are not in the given list of keys.
  prune (keys) {
    this._prune(keys)
  }

  clear () {
    if (!this.db) {
      return
    }

    this._store().clear()
  }

  // Initialize the indexedDB database and create the store.
  async _initDB (dbName, storeName) {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('indexedDB is not available'))
      }

      const req = window.indexedDB.open(dbName)

      // Setup the DB schema for the first time.
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!e.target.result.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'key' })
          e.target.transaction.oncomplete = () => {
            resolve(db)
          }
        }
      }

      req.onsuccess = () => resolve(req.result)

      req.onerror = (e) => reject(e.target.error)

      // Hacky fix for IndexedDB randomly locking up in Safari.
      setTimeout(() => {
        if (!this.db) {
          reject(new Error('Opening IndexedbDB timed out'))
        }
      }, 200)
    })
  }

  // Scan all matching elements and either:
  // a) if indexedDB is not available, fallback to loading the assets natively.
  // b) if DB is available but the object is not cached, fetch(), cache in the DB, and apply the blob.
  // c) if DB is available and the object is cached, apply the cached blob.
  // elements should either be null or be a NodeList.
  async _setupElements (elements) {
    const objs = []

    // If there are no elements, scan the entire DOM for groups of each tag type.
    if (elements instanceof NodeList) {
      elements = Array.from(elements)
    } else if (elements instanceof Node) {
      elements = [elements]
    } else {
      const sel = this.opt.tags.map((t) => `${t}[data-src]:not([data-indexed])`).join(',')
      elements = document.querySelectorAll(sel)
    }

    // Get all tags of a particular tag on the page that has the data-src attrib.
    // document.querySelectorAll(`${tag}[data-src]:not([data-indexed])`).forEach((el) => {
    elements.forEach((el) => {
      if ('indexed' in el.dataset) {
        return
      }
      const obj = {
        el: el,
        key: el.dataset.key || el.dataset.src,
        src: el.dataset.src,
        hash: el.dataset.hash || el.dataset.src,
        isAsync: el.tagName !== 'SCRIPT' || el.hasAttribute('async') || el.hasAttribute('defer'),
        expiry: null
      }

      // If there is a global expiry or an expiry on the object, compute that.
      const exp = el.dataset.expiry || this.opt.expiry
      if (exp) {
        obj.expiry = new Date(new Date().getTime() + (parseInt(exp) * 60000))
      }

      // If for any reason the store is not initialized, fall back to
      // the native asset loading mechanism.
      if (this.db) {
        objs.push(obj)
      } else {
        this._applyElement(obj)
      }
    })

    const promises = []
    objs.forEach((obj) => {
      if (obj.isAsync) {
        // Load and apply async objects asynchronously.
        this._getObject(obj).then((result) => {
          this._applyElement(obj, result.data.blob)
        }).catch((e) => {
          this._applyElement(obj)
        })
      } else {
        // Load non-async objects asynchronously (but apply synchronously).
        promises.push(this._getObject(obj))
      }
    })

    if (promises.length === 0) {
      return objs
    }

    // Once the assets have been fetched, apply them synchronously. Since
    // the time take to execute a script is not guaranteed, use the onload() event
    // of each element to load the next element.
    await allSettled(promises).then((results) => {
      results.forEach((cur, n) => {
        if (cur.status === 'rejected') {
          this._applyElement(objs[n])
          return
        }

        if (n >= results.length - 1) {
          return
        }

        cur.value.obj.el.onload = cur.value.obj.el.onerror = () => {
          this._applyElement(results[n + 1].value.obj, results[n + 1].value.data.blob)
        }
      })

      // Start the chain by loading the first element.
      this._applyElement(results[0].value.obj, results[0].value.data.blob)
    })

    return objs
  }

  // Get the object from the DB and if that fails, fetch() it over HTTP
  // This function should not reject a promise and in the case of failure,
  // will return a dummy data object as if it were fetched from the DB.
  _getObject (obj) {
    return new Promise((resolve, reject) => {
      // Get the stored blob.
      this._getDBblob(obj).then((data) => {
        resolve({ obj, data })
      }).catch((e) => {
        // If there is no cause, the object is not cached or has expired.
        if (e.toString() !== 'Error') {
          console.log('error getting cache blob:', e)
        }

        // Couldn't get the stored blog. Attempt to fetch() and cache.
        this._fetchObject(obj).then((data) => {
          resolve({ obj, data })
        }).catch((e) => {
          // Everything failed. Failover to loading assets natively.
          resolve({
            obj,
            data: {
              key: obj.key,
              hash: obj.hash,
              expiry: obj.expiry,
              blob: null
            }
          })
        })
      })
    })
  }

  // Get the blob of an asset stored in the DB. If there is no entry or it has expired
  // (hash changed or date expired), fetch the asset over HTTP, cache it, and load it.
  _getDBblob (obj) {
    return new Promise((resolve, reject) => {
      try {
        const req = this._store().get(obj.key)
        req.onsuccess = (e) => {
          const data = e.target.result

          // Reject if there is no stored data, or if the hash has changed.
          if (!data || (obj.hash && (data.hash !== obj.hash))) {
            reject(new Error(''))
            return
          }

          // Reject and delete if the object has expired.
          if (data.expiry && new Date() > new Date(data.expiry)) {
            this.deleteKey(data.key)
            reject(new Error(''))
            return
          }

          resolve(data)
        }

        req.onerror = (e) => {
          reject(e.target.error)
        }
      } catch (e) {
        reject(e.target.error)
      }
    })
  }

  // Fetch an asset and cache it.
  _fetchObject (obj) {
    return new Promise((resolve, reject) => {
      fetch(obj.src).then((r) => {
        // HTTP request failed.
        if (!r.ok) {
          reject(new Error(`error fetching asset: ${r.status}`))
          return
        }

        // Write the fetched blob to the DB.
        r.blob().then((b) => {
          const data = {
            key: obj.key,
            hash: obj.hash,
            expiry: obj.expiry,
            blob: b
          }

          // onerror() may not always trigger like in the private mode in Safari.
          try {
            const req = this._store().put(data)
            req.onsuccess = () => resolve(data)
            req.onerror = (e) => reject(e.target.error)
          } catch (e) {
            reject(e)
          }
        })
      }).catch((e) => reject(e))
    })
  }

  // Apply the Blob (if given), or the original obj.src URL to the given element.
  _applyElement (obj, blob) {
    let url = obj.src
    if (blob) {
      url = window.URL.createObjectURL(blob)
    }

    switch (obj.el.tagName) {
      case 'SCRIPT':
      case 'IMG':
        obj.el.src = url
        break
      case 'LINK':
        obj.el.href = url
    }
    obj.el.dataset.indexed = true
  }

  // Delete all objects in cache that are not in the given list of objects.
  _prune (keys) {
    if (!this.db) {
      return
    }

    // Prepare a { key: true } lookup map of all keys found on the page.
    const keyMap = keys.reduce((obj, v) => { obj[v] = true; return obj }, {})

    const req = this._store().getAllKeys()
    req.onsuccess = (e) => {
      e.target.result.forEach((key) => {
        if (!(key in keyMap)) {
          this.deleteKey(key)
        }
      })
    }
  }

  _store () {
    return this.db.transaction(this.opt.storeName, 'readwrite').objectStore(this.opt.storeName)
  }
}
