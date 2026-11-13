---
id: little-goods-client-requirements
type: feature-spec
title: Little Goods Client Requirements
status: current-state
owner: Shop owner
tags:
  - shop
  - business-requirements
  - current-behaviour
---

[CodeWiki](../../index.md) / [Specifications](../index.md) / [Shop Requirements](index.md)

# Little Goods Client Requirements

## Overview

This document describes the shop as currently delivered, rather than a future wish list. Little Goods allows visitors to browse products, account holders to manage a shopping bag and place demonstration orders, and administrators to manage the catalog. All prices and totals are in US dollars.

## User Stories

Visitors want to find useful products and understand their prices. Customers want to sign in, manage their bag, understand discounts and delivery charges, and receive an order confirmation. Administrators want to maintain product information and available stock without giving customers permission to change the catalog.

## Functional Requirements

### Accounts and access

**REQ-001 — Sign in with a provisioned account.** The shop shall allow an existing account holder to sign in using an email address and password. Account access is provisioned by the shop operator; the shop does not offer customer registration or password recovery.

**REQ-002 — Validate sign-in details.** Email addresses shall have a valid email format and contain 3–254 characters after surrounding spaces are removed. Email matching shall ignore letter case. Passwords shall contain 10–128 characters, with spaces counted as part of the password. Missing, incorrectly formatted, or out-of-range details shall be rejected. An unknown account and an incorrect password shall receive the same “Email or password is incorrect” message.

**REQ-003 — Limit repeated sign-in attempts.** The shop shall allow up to 20 sign-in attempts from a network address during a 15-minute period, counting both successful and unsuccessful attempts. Further attempts within that period shall receive a message asking the user to try again later.

**REQ-004 — End sign-in access appropriately.** Sign-in access shall expire eight hours after it is issued. Signing out shall revoke that session immediately. Restarting the shop shall also end existing sessions; the customer shall need to sign in again.

**REQ-005 — Protect private shopping actions.** Only signed-in users shall be allowed to view or change their own bag, obtain checkout totals, or place an order. A person without valid sign-in access shall be asked to sign in. One customer shall not be able to select or change another customer's bag.

### Product discovery

**REQ-006 — Browse available products.** Visitors shall be able to view product names, descriptions, categories, prices, and visual symbols without signing in. Products with no stock shall remain visible, but their “Add to bag” action shall be unavailable.

**REQ-007 — Search the catalog.** Visitors shall be able to search for literal text within product names, descriptions, and categories without regard to letter case. Surrounding spaces shall be ignored. A search shall accept up to 100 characters; longer searches shall be rejected. An empty search shall apply no text restriction.

**REQ-008 — Filter products and handle no matches.** The storefront shall offer All goods, Home, Carry, and Workspace category choices. A selected category shall be combined with the search. Category matching shall be exact, with a maximum category filter length of 40 characters. When nothing matches, the storefront shall explain that no products were found and offer to clear the filters. Administrators may enter other category names, but these do not automatically become storefront category choices.

### Shopping bag

**REQ-009 — Maintain a personal bag.** Signed-in users shall be able to add products, review their bag, and change quantities. The bag shall be saved with the user's account and remain available after signing out or restarting the shop. Bag prices shall reflect current catalog prices, rather than being fixed when an item was first added.

**REQ-010 — Enforce bag quantity boundaries.** A bag shall contain whole-number quantities of 1–10 units for each product and no more than 30 different products. Adding or changing an item beyond either limit shall be rejected without applying that change.

**REQ-011 — Respect stock and allow removal.** A requested positive quantity shall not exceed the product's current stock. A customer shall be able to remove a line from the bag; a quantity of zero shall also remove it. Adding an item to a bag shall not reserve stock.

**REQ-012 — Handle unavailable bag items.** If an administrator deletes a product already in a bag, the bag shall identify it as unavailable and allow its removal. Checkout shall be refused if any bag product is missing or has insufficient stock. The customer shall be asked to update the bag.

### Discounts and checkout

**REQ-013 — Apply the supported discount.** Customers shall be able to enter `WELCOME10` for a 10% discount on the merchandise subtotal. The code shall be accepted without regard to letter case and after surrounding spaces are removed. It shall not be restricted to a customer's first order. The discount shall be rounded to the nearest cent. A blank code shall mean no discount; any other nonblank code shall be rejected. Discount-code input shall be limited to 30 characters.

**REQ-014 — Calculate shipping and the final total.** Shipping shall cost $5.00 when the merchandise subtotal after discount is below $75.00, and shall be free when that amount is exactly $75.00 or more. The final total shall equal the merchandise subtotal minus the discount plus shipping. No separate tax calculation shall be added.

**REQ-015 — Check the bag before ordering.** Checkout shall require a nonempty bag. The shop shall calculate prices, discounts, delivery charges, and available stock itself when preparing checkout totals and again when placing an order. Customer-supplied prices or totals shall not determine the amount recorded.

**REQ-016 — Require valid delivery details.** Order placement shall require a full name of 2–100 characters, a street address of 5–200 characters, a city of 2–80 characters, a postal code of 2–20 characters, and an email address meeting REQ-002's email rules. These text lengths shall be assessed after surrounding spaces are removed. Postal codes shall be checked for length, not against country-specific postal rules.

**REQ-017 — Complete the order together.** A successful order shall save the delivery details, product details, quantities, amounts, order reference, and creation time; reduce stock by the purchased quantities; and empty the customer's bag. These changes shall be saved together. A failed save shall not leave only part of the order completed.

**REQ-018 — Avoid duplicate orders from retries.** Repeating a submission for the same customer with the same checkout reference shall return the original order without reducing stock or creating another order. This protection shall apply to that reference, not to separately started checkouts with new references.

**REQ-019 — Confirm the demonstration purchase.** After successful checkout, the customer shall see confirmation with an abbreviated order reference and total, and an option to return to the shop. The shop shall clearly state that checkout is a demonstration: no payment is collected and no goods are shipped.

### Administration

**REQ-020 — Restrict catalog management.** Only signed-in administrators shall be able to create, edit, or delete products. The management page shall be shown only to administrators. A signed-in customer attempting any of those actions shall receive an administrator-access error, even when bypassing the page.

**REQ-021 — Create and edit complete product records.** Administrators shall be able to maintain a product's name, description, category, price, stock, visual symbol, and background color. Names shall contain 2–100 characters, descriptions 5–500, categories 2–40, and symbols 1–8. Background colors shall use a six-digit color value preceded by `#`. Required or invalid fields shall prevent saving.

**REQ-022 — Limit product prices, stock, and catalog size.** Product prices shall range from $0.01 to $10,000.00 in whole cents. Stock shall be a whole number from 0 to 10,000. The catalog shall contain at most 500 products; creation beyond that limit shall be rejected. Existing products may still be edited when the catalog is full.

**REQ-023 — Delete products without rewriting past orders.** Administrators shall be asked to confirm deletion in the management page. Deleting a product shall remove it from browsing but shall not rewrite product details already recorded in completed orders. Attempts to edit or delete a product that no longer exists shall receive a product-not-found message.

## Non-Functional Requirements

**REQ-024 — Give clear feedback and reject invalid requests.** The shop shall provide loading, success, empty-state, and error feedback for its main customer actions. Invalid form values shall be rejected by the shop, not only by the browser. Text fields other than passwords shall reject control characters after surrounding spaces are removed. Malformed or oversized submissions shall receive an error; an individual submission shall be limited to 16 KiB. Unexpected failures shall show a general retry message rather than exposing internal details. Unauthorized requests from another website shall be refused.

**REQ-025 — Retain business records within the supported operating model.** The shop shall save accounts, products, bags, and orders locally so that they survive a restart. The supported arrangement shall be one running shop process using that saved information. Passwords shall be stored in a protected, non-readable form rather than as the original password. Sign-in access and sign-in attempt counters shall be temporary and reset on restart. The shop shall support up to 10,000 active sign-in sessions; requests for additional sessions shall receive a try-again-later message.

## Acceptance Criteria

The delivered service is described by REQ-001 through REQ-025, including their stated rejection conditions and inclusive numeric boundaries. Access to a hidden management page alone shall not grant administrative permission. The order confirmation shall not imply that payment or fulfillment has taken place.

## Scope

Included are product discovery, existing-account sign-in, personal bags, one discount code, delivery-detail collection, demonstration order placement, and administrator product management.

Not included are account registration, password recovery, real payment processing, tax calculation, confirmation emails, order-history browsing, fulfillment, refunds, or a customer-facing account-management service.

## Dependencies

The shop depends on operator-provisioned customer and administrator accounts, writable and protected local storage, and a running shop service. Secure public operation requires an encrypted website connection. The implementation supports the requested Node 18 runtime; deployment technology does not change the business rules above.

## Rollout Plan

This is a record of the implemented release, not a proposal for additional functionality. The operator supplies account passwords during initial setup and retains the saved business records. Replacing those records creates a fresh shop rather than migrating existing customer information.
