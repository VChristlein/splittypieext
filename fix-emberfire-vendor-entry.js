/*eslint-disable*/
// emberfire@2.0.10's build step webpacks the app's `firebase` npm package as
// its vendor bundle, hardcoding the entry file name `firebase-browser.js` -
// that file only existed in the firebase package's 3.x line. From v4 onward
// the SDK restructured its package layout and ships the equivalent full
// UMD bundle as `firebase.js` at the package root instead. Since we need a
// modern firebase version (regional Realtime Database URLs, e.g.
// "<project>-default-rtdb.<region>.firebasedatabase.app", are unparseable by
// the 3.x line - see memory/firebase_sdk_regional_url_incompatible.md), patch
// emberfire's entry filename in place. Runs as a `postinstall` step since
// node_modules isn't committed to the repo. Idempotent - only rewrites if
// the old entry name is still present.
//
// (emberfire's adapter also has one use of the old Reference API's `.path`
// property, removed in firebase@8 - that's fixed by overriding the affected
// method in app/adapters/online/application.js instead of patching
// node_modules, since it's actual application logic, not a build config.)
"use strict";

const fs = require("fs");
const path = require("path");

function patchFile(relativePath, replacements) {
    const filePath = path.join(__dirname, "node_modules", ...relativePath.split("/"));

    if (!fs.existsSync(filePath)) {
        // emberfire not installed (e.g. a partial/dev install) - nothing to patch
        return;
    }

    const original = fs.readFileSync(filePath, "utf8");
    let patched = original;

    replacements.forEach(({ pattern, replacement, alreadyDoneCheck }) => {
        if (pattern.test(patched)) {
            patched = patched.replace(pattern, replacement);
            console.log(`[fix-emberfire-vendor-entry] patched ${relativePath}: ${replacement}`);
        } else if (!alreadyDoneCheck.test(patched)) {
            console.warn(`[fix-emberfire-vendor-entry] could not find expected pattern in ${relativePath} - check it hasn't changed shape: ${pattern}`);
        }
    });

    if (patched !== original) {
        fs.writeFileSync(filePath, patched);
    }
}

patchFile("emberfire/index.js", [{
    pattern: /entry:\s*['"]\.\/firebase-browser\.js['"]/,
    replacement: "entry: './firebase.js'",
    alreadyDoneCheck: /entry:\s*['"]\.\/firebase\.js['"]/,
}]);
