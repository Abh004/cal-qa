// Loaded before every spec.
import "./commands";

/**
 * Cal.diy v6.2.0's booking page throws React error #418 (a hydration mismatch:
 * the server's HTML differs from what React renders in the browser). Browsers
 * recover from it, so users don't see a failure. We ignore exactly this error,
 * and log it, so that any other application error still fails the test.
 * Tracked as rough edge RE-02 in docs/bugs/README.md.
 */
const KNOWN_HYDRATION_ERROR = /Minified React error #418\b/;

Cypress.on("uncaught:exception", (err) => {
  if (KNOWN_HYDRATION_ERROR.test(err.message)) {
    Cypress.log({ name: "known app error", message: "React #418 hydration mismatch (ignored)" });
    return false;
  }
  return undefined; // anything else fails the test as normal
});
