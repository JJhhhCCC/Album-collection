# Product contract

## Privacy and storage

The site is publicly reachable, but it stores image bytes only in the browser that selected them. It makes no upload request for photo data and has no account, share, backup, or synchronization feature. Explain that browser-managed local storage is not a backup.

Store ready books in IndexedDB `books`, image pages in `pages`, and optional cover records in `covers` keyed by book ID. A book has an ID, integer order, timestamps, page count, last-read page, import status, persistent `colorKey`, optional `customTitle`, and `hasCover`. A page has an ID, book ID, integer order, optimized Blob, dimensions, MIME type, and original filename. A cover stores the same image metadata but remains separate from pages. Clean up `importing` books and their pages/covers at startup.

## Import

Each selected group creates exactly one book. Keep the selected sequence by default, while allowing group and page reordering before import. Each staged book may have an optional title and a separately selected optional cover. Trim titles, store whitespace-only input as null, and limit custom titles to 30 characters. Import one file at a time; normalize display orientation, resize pages to a 2560px maximum long edge, and prefer WebP at 0.86 quality with JPEG fallback. Optimize covers separately to a 1600px maximum long edge at about 0.84 quality. A failed group must be removable and retryable without disturbing successfully completed groups.

## Reader

Show one page at a time with `object-fit: contain`; do not crop. Left swipe/tap advances and right swipe/tap returns. Support pinch-to-zoom and panning while zoomed, reset zoom on page changes, and respect `prefers-reduced-motion`. Browser back closes the reader before exiting the app.

## Home screen

Use a near-black surface with white structural outlines and high-contrast colored book covers. All but the last book are compact spines; the last becomes the large visible cover. Give each book an automatically assigned persistent fallback color. When a cover exists, center-crop it to fill both spine and large-cover shapes and add a dark overlay for legibility. Center the final display title in the visual book area and keep the page count on the right. Empty custom titles resolve dynamically from current order as `bookN`; non-empty titles stay attached to their books. Manage mode must edit/reset titles and add, replace, or remove covers. For constrained height, preserve 44px book controls and allow the stack to scroll.
