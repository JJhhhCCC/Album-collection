# Product contract

## Privacy and storage

The site is publicly reachable, but it stores image bytes only in the browser that selected them. It makes no upload request for photo data and has no account, share, backup, or synchronization feature. Explain that browser-managed local storage is not a backup.

Store ready books in IndexedDB `books` and image pages in `pages`. A book has an ID, integer order, timestamps, page count, last-read page, import status, and a persistent `colorKey` for its visual cover. A page has an ID, book ID, integer order, optimized Blob, dimensions, MIME type, and original filename. Clean up `importing` books at startup.

## Import

Each selected group creates exactly one book. Keep the selected sequence by default, while allowing group and page reordering before import. Import one file at a time; normalize display orientation, resize to a 2560px maximum long edge, and prefer WebP at 0.86 quality with JPEG fallback. A failed group must be removable and retryable without disturbing successfully completed groups.

## Reader

Show one page at a time with `object-fit: contain`; do not crop. Left swipe/tap advances and right swipe/tap returns. Support pinch-to-zoom and panning while zoomed, reset zoom on page changes, and respect `prefers-reduced-motion`. Browser back closes the reader before exiting the app.

## Home screen

Use a near-black surface with white structural outlines and high-contrast colored book covers. All but the last book are compact spines; the last becomes the large visible cover. Give each book an automatically assigned persistent color, center its `bookN` title in the visual book area, and keep the page count on the right. For constrained height, preserve 44px book controls and allow the stack to scroll.
