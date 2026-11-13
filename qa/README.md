# Targeted requirement coverage

Sources: [requirements](../kavia-docs/CodeWiki/Specs/FeatureSpecs/little-goods-requirements.md), [existing catalog](test-case-catalog.csv), [new cases](targeted-test-cases.csv), and [automated cases](../tests/browser/requirements.spec.js).

Both CSV files use the original seven columns. IDs TC-001–TC-200 remain stable; TC-201–TC-219 are additions. This is a CSV catalog, not a JSON-backed Spec Builder artifact. New cases are designed coverage, not evidence of execution.

## Reproducible manual setup

Use an isolated QA service and disposable SHOP_DATA_FILE, never a production store. Provision shopper and administrator passwords through environment variables as described in the root README. Sign in with the corresponding account. Start each independent case with an empty shopper bag and initial catalog, unless its steps explicitly establish another case.

For API steps, use the signed-in browser's session cookie and same-origin requests. Every write includes Content-Type: application/json and X-Shop-Request: 1. GET /api/cart reads the bag; PUT /api/cart accepts productId and numeric quantity. POST /api/checkout/quote accepts discountCode. POST /api/checkout accepts delivery, discountCode (empty by default), and idempotencyKey: a newly generated UUID for each submission. Do not reuse a successful checkout key when testing validation: retries return the original order.

**Fresh shopper setup:** initial tote canvas-tote costs 2800 cents and has stock 30. Remove all existing lines using quantity 0 before adding the specified products.

**Capacity setup:** in a separate administrator session POST /api/admin/products 31 times with unique names QA Product 01 through QA Product 31, description "Capacity test product", category Home, price 100 cents, stock 20, icon Q and color #e9d7bd. Capture each returned ID. In an empty shopper bag use only these IDs. Do not assume the initial six products are enough to reach 30 distinct lines.

**Price setup:** create an administrator-owned QA product using the same valid product fields and the specified integer-cent price; add only one unit to the shopper bag. For subsequent prices PUT /api/admin/products/:id with all product fields and the changed price.

**Baseline delivery:** name Alex Shopper; email shopper@example.com; address 12 Oak Street; city Portland; postalCode 97201.

**Order API setup:** fresh shopper setup, one tote, blank discount and baseline delivery. Snapshot GET /api/cart, GET /api/products and the isolated QA store's order count before submission. Override only the field under test. For rejection cases assert HTTP 400, field-specific error, unchanged bag and stock and no additional saved order. For success cases assert HTTP 201 and returned delivery values; restore a fresh bag/store for the next independent success. Text repetitions in the catalog mean exact ASCII lengths, excluding surrounding spaces.

## Existing-catalog review

| Cases | Change and reason |
| --- | --- |
| TC-081–TC-088 | Added explicit fixture, request values, reload/read-back, totals and full unchanged-state assertions. Prevents stock or insufficient catalog size masking quantity limits. |
| TC-103–TC-109, TC-111–TC-114 | Defined exact inputs and totals, canonical code, request paths and error types. TC-112 now specifies clearing an applied code and fills its missing expected result, catching stale totals. |
| TC-110 | Added its missing REQ-013 link and exact setup/totals; it already tested merchandise-wide discount calculation. |
| TC-133–TC-139, TC-141–TC-148 | Replaced unspecified valid/long inputs with baseline values and exact lengths. Added response, field values, no-order and preserved-state expectations. TC-137 now explicitly uses 101 characters and has a complete expected result. |
| TC-081 versus TC-071/TC-079 | Flagged overlapping first-item flows; retained TC-081 for explicit lower-bound persistence. TC-071 and TC-079 themselves are duplicate-intent candidates outside the requested linked scope. |
| TC-105 versus TC-104 | Flagged case-insensitivity overlap; retained mixed-case variation rather than deleting a stable ID. |
| TC-114 versus TC-107 | Flagged equivalent zero-discount outcome; whitespace trimming makes TC-114 a useful variation, not an exact duplicate. |

All 34 originally linked rows were refined; TC-110 was additionally linked/refined. Unrelated rows, including their existing quality issues, were left unchanged.

## Previously uncovered behavior and additions

| Requirement | Gaps before review | Added coverage |
| --- | --- | --- |
| REQ-010 | Interior quantity, rejected new-line insertion, 29-line boundary, replacing a line at capacity, nonnumeric quantities | TC-201–TC-205; existing TC-081–TC-088 cover 1/10/11, fractions, negatives, 30/31 and editing at capacity. Zero removal is already TC-092 under REQ-011. |
| REQ-013 | Combined normalization, exact 30-character code, raw versus normalized length, rounding either side of half-cent, invalid code at actual order placement; two-product case lacked traceability | TC-206–TC-210 and link repair TC-110; TC-109 retains half-cent rounding, TC-111 repeat-customer ordering, TC-112 code removal. |
| REQ-016 | Name/address maxima, city minimum and below, postal below minimum and maximum, required fields on server, trimming before bounds, delivery-specific email boundaries and recovery | TC-211–TC-219; existing cases cover remaining field boundary pairs, invalid format and length-only postal validation. |

REQ-013 does not explicitly say whether its 30-character limit is measured before or after trimming. TC-208 records the implementation's trim-first behavior in server/validation.js and server/checkout.js; confirm this interpretation with the product owner. REQ-016 explicitly requires trim-first lengths. Its referenced email minimum of 3 cannot yield a format-valid address with the current email pattern; TC-218 distinguishes length rejection from format rejection and uses a@b.c as the smallest format-valid example.

No explicit clause in these three requirements remains without a designed case across the two CSVs, subject to the discount-length interpretation above. Not every data combination or cross-requirement security/control-character behavior is covered. Designed coverage is not automated coverage: capacity, rounding, repeat orders, and exhaustive delivery boundaries remain manual.

## Automation and execution

Three independent Playwright tests map to:
- TC-083 (+ TC-082): accept 10, reject 11 from the product-card action and direct API, then prove the persisted bag is unchanged.
- TC-206 (+ TC-108/TC-112): normalized code yields exact quote/UI totals; unsupported code is rejected; clearing it restores full-price totals.
- TC-219 (+ TC-133): whitespace-only name reaches the server and is rejected without clearing the bag; correction places a valid order with exact returned delivery and confirmation.

Run with the locked project dependencies and existing isolated server:

```sh
PATH=/usr/bin:/bin /usr/bin/node /usr/bin/npm ci --engine-strict
PATH=/usr/bin:/bin CI=true PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npm run test:e2e
```

The full browser suite passed: **6 passed in 9.1 seconds**, comprising the three new requirement tests and the three existing sign-in/catalog/bag checks, on system Node 18.20.8, Playwright 1.56.1 and Chromium build 1194. The frontend build also passed and browser coverage reports were regenerated under ignored coverage/browser/. No application code or dependency declarations changed.

The initial attempt failed before any test assertions because Chromium headless shell build 1194 was absent from /ms-playwright. Running the existing test:e2e:install script installed the matching browser and dependencies; the subsequent complete run passed with no retries. This was an environment issue, not a product failure.

CSV integrity checks passed: 200 original cases retained, 19 additions, 219 globally unique IDs, seven columns, and exactly 35 scoped refinements (34 originally linked plus TC-110). git diff --check passed. The remaining designed cases were not manually executed, and server-suite/merged coverage was not rerun.

The existing Playwright configuration uses one worker, no retries, failure traces and a temporary store removed on server shutdown. The tests do not mock business responses or modify application code.
