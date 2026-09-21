---
name: mobile-photo-book
description: Create or maintain a privacy-first mobile web photo book that groups local image uploads into stacked books and browses one image per turning page. Use for this specific local-only photo-book experience, not cloud galleries or multi-user sharing products.
---

# Mobile Photo Book

Create the requested experience as a static, mobile-first website. Its photos must remain in the current browser's IndexedDB: do not add a backend, analytics, remote image service, account system, or cloud synchronization unless the user explicitly changes that requirement.

## Start from the included template

- Use `scripts/scaffold_site.py` to copy `assets/site-template` into an **empty** target directory. It refuses to overwrite existing content.
- Keep the site dependency-free: use the supplied HTML, CSS, and browser ES modules instead of adding a framework or external runtime.
- Read [the product contract](references/product-contract.md) before changing photo import, storage, book ordering, or reader behavior.

## Preserve the product behavior

- A person creates one image group per book, can preview and order groups and pages, then generates the library in one action.
- Display names are derived from stored order (`book1`, `book2`, …), so a reorder or deletion always renumbers the library without gaps.
- Keep the home screen as cyan line-art stacked book spines. Open books in a single-page reader with tap, swipe, keyboard, and reduced-motion fallbacks.
- Treat storage failures and unsupported image decoding as recoverable: explain the affected file or group, preserve usable staging content, and never silently discard a completed book.
- Do not expose image-upload or deletion actions through WebMCP. Read/navigation tools may only act on the same visible local state.

## Verify

- Run the skill validator after modifying this skill.
- Scaffold into a temporary empty directory and confirm the result has the static entrypoint and no unresolved template markers.
- Before publishing an instance, check mobile-width layout, local persistence after reload, book/page ordering, deletion, and reader boundaries.
