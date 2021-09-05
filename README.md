<a href="https://zerodha.tech"><img src="https://zerodha.tech/static/images/github-badge.svg" align="right" /></a>

# indexed-cache.js

indexed-cache is a tiny Javascript library that "sideloads" static assets (script, link, and img tags) on webpages using the fetch() API and caches them in an IndexedDB store to eliminate the dependency on the standard browser static asset cache, and to eliminate HTTP requests on subsequent page loads. Javascript, CSS, and image assets are stored in IndexedDB as Blob()s.

### For very specific scenarios only!
This library is only meant to be used in very specific scenarios.

Unlike the browser's asset cache, IndexedDB is not cleared automatically, providing a longer term static file storage on the client side. The lib uses ES6 (and IndexedDB) and is only expected to work on recent versions of modern browsers. Ideally, this should have been handled with ServiceWorkers, but they don't work in mobile webviews.

Use if at least a few of these are true:
- There are large static files (JS, CSS) that rarely change.
- High traffic from a large number of returning users who access web pages with the same assets regularly and frequently.
- The pages are mostly inside mobile webviews where browser cache gets evicted  (OS pressure) causing the same assets to be fetched afresh over and over wasting bandwidth.
- Bandwidth is a concern.

### Features
- Supports script, img, link tags.
- Respects `defer / async` on script tags.
- Can invalidate cached items with a TTL per tag.
- Can invalidate cached items with a simple random hash per tag.

### Gotchas
- CORS.
- First-paint "flash" (needs to be handled manually) as scripts and styles only load after HTML is fetched and rendered by the browser.
- Browser compatibility.
- Empty space or line breaks between the opening and closing `<script data-src="remote.js"></script>` tags will be executed as an inline script by the browser, after which the browser will not load the remote script when applied. Ensure that the opening and closing script ags have nothing between then.

## Usage

To cache and sideload static assets:
- Change the original `src` (`href` for CSS) attribute on tags to `data-src`.
- Give tags a unique ID with `data-key`. The cached items are stored in the database with this key. The actual filenames of the assets can change freely, like in the case of JS build systems.
- Load and invoke indexed-cache at the end.

#### Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>indexed-cache</title>
    <meta charset="utf-8" />

    <script data-key="bundle" data-src="bundle_file1234.js"></script>

    <link rel="stylesheet" type="text/css"
        data-key="style.css"
        data-src="style.css" />
</head>
<body>
    <h1>indexed-cache</h1>

    <script src="normal-non-side-loaded.js"></script>

    <!--
        Whenever the value of data-hash changes (eg: from a build system)
        or the expiry (optional) is crossed, the file is re-fetched
        and re-cached.
    //-->
    <script data-src="sideloaded.js"
        data-key="mybigsideloadedscript"
        data-hash="randomhash"
        data-expiry="2029-03-25T12:00:00-06:30">
    </script>

    <img data-src="thumb.png"
        data-key="thumb.png"
        data-hash="randomhash" />

    <!--
        Always include and invoke indexed-cache at the end, right before </body>.
        Use the unpkg CDN or download and host the script locally (dist/indexed-cache.min.js).
    !-->
    <script src="https://unpkg.com/@knadh/indexed-cache@0.2.1/dist/indexed-cache.min.js"></script>
    <script>new IndexedCache().load();</script>
</body>
</html>
```


#### Optional configuration

One or more of these optional params can be passed during initialization. Default values are shown below. 

```javascript
new IndexedCache({
    tags: ["script", "img", "link"],
    dbName: "indexed-cache",
    storeName: "objects",

    // If this is enabled, all objects in the cache with keys not
    // found on elements on the page (data-key) will be deleted.
    // This can be problematic in scenarios where there are multiple
    // pages on the same domain that have different assets, some on
    // certain pages and some on other.
    prune: false,

    // Default expiry for an object in minutes (default 3 months).
    // Set to null for no expiry.
    expiry: 131400
}).load();
```


Licensed under the MIT license.
