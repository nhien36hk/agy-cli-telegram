# Errors and Solutions

## 1. Mocking failure due to destructuring child_process
* **Error**: Tests hung or failed because `exec` was destructured before mocking.
* **Resolution**: Replaced destructuring with direct property access: `child_process.exec(...)`.

## 2. Test assertion failures due to strict HTML/Whitespace formatting
* **Error**: Assertions using `assert.match` failed because of slight formatting variations (e.g. spaces/nested tags).
* **Resolution**: Adjusted regex patterns in `tests/router.test.js` to strictly match the actual translated HTML output.
