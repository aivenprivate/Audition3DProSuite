/**
 * 🌐 GAS API Bridge + google.script.run Shim
 * 
 * This file replaces google.script.run with fetch() calls to the
 * Google Apps Script Web App deployed as a REST API.
 * 
 * Drop-in compatible: No changes needed in existing HTML/JS code.
 */

const GAS_API = (() => {
    // API endpoint (split to avoid scrapers)
    const _u = [
        'https://script.google.com/macros/s/',
        'AKfycbwguDbpCB2kn0qoAJqArDNXip6ialc6Gg',
        'hmZ-s1pN1j-_141dlG4XUknR8RPhts2CB7ow',
        '/exec'
    ].join('');

    async function call(action, args) {
        const res = await fetch(_u, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, args }),
            redirect: 'follow'
        });
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
    }

    return { call, url: _u };
})();

/**
 * google.script.run compatibility shim
 * 
 * Supports all chaining patterns:
 *   google.script.run.withSuccessHandler(cb).functionName(args)
 *   google.script.run.withSuccessHandler(cb).withFailureHandler(cb2).functionName(args)
 *   google.script.run.functionName(args) (fire-and-forget)
 */
(function () {
    function createChain(successCb, failureCb) {
        return new Proxy({}, {
            get(_, prop) {
                if (prop === 'withSuccessHandler') {
                    return function (cb) { return createChain(cb, failureCb); };
                }
                if (prop === 'withFailureHandler') {
                    return function (cb) { return createChain(successCb, cb); };
                }
                // Any other property = the actual GAS function name
                return function (...args) {
                    GAS_API.call(prop, args)
                        .then(data => { if (successCb) successCb(data); })
                        .catch(err => { if (failureCb) failureCb(err); else console.error('GAS API error:', prop, err); });
                };
            }
        });
    }

    window.google = {
        script: {
            run: new Proxy({}, {
                get(_, prop) {
                    if (prop === 'withSuccessHandler') {
                        return function (cb) { return createChain(cb, null); };
                    }
                    if (prop === 'withFailureHandler') {
                        return function (cb) { return createChain(null, cb); };
                    }
                    // Direct call without handlers
                    return function (...args) {
                        GAS_API.call(prop, args).catch(err => console.error('GAS API error:', prop, err));
                    };
                }
            })
        }
    };
})();

console.log('🌐 GAS API Bridge loaded. google.script.run shim active.');
