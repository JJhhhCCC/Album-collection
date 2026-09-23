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
- Let each staged book optionally store a trimmed custom title (maximum 30 characters) and a separate cover photo. Blank titles remain dynamic (`book1`, `book2`, …), so reorder and deletion renumber only unnamed books; custom titles stay with their books.
- Keep the home screen as a near-black, white-line stacked shelf: compact spines lead to a larger final cover. Use the persistent book color when no photo cover exists; otherwise center-crop the separate cover photo beneath a dark overlay. Keep the final display title geometrically centered and the page count on the right.
- A cover is not a reader page. Existing books must be editable in manage mode so people can rename or reset the title and add, replace, or remove the cover without affecting pages or reading progress.
- Open books in a single-page reader with tap, swipe, keyboard, and reduced-motion fallbacks.
- Treat storage failures and unsupported image decoding as recoverable: explain the affected file or group, preserve usable staging content, and never silently discard a completed book.
- Do not expose image-upload or deletion actions through WebMCP. Read/navigation tools may only act on the same visible local state.

## Verify

- Run the skill validator after modifying this skill.
- Scaffold into a temporary empty directory and confirm the result has the static entrypoint and no unresolved template markers.
- Before publishing an instance, check mobile-width layout, local persistence after reload, dynamic/default titles, custom titles, cover replacement/removal, book/page ordering, deletion, and reader boundaries.
