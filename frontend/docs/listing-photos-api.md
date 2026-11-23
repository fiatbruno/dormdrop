# Listing photo connection

Frontend only: 1?5 JPG/PNG photos, at most 5 MB each. No backend changes included.

## Read listings

Return `imageUrls: ["/api/v1/images/first.jpg", "..."]` from listing endpoints in display order. The first is the cover. Existing single `imageUrl` remains a fallback.

## Save photos (future endpoint)

`PUT /images/{listingId}/photos`, relative to the configured API base URL, with multipart form data:

- `retainedImageUrls`: JSON string array of existing photo URLs to keep in order. The frontend sends resolved absolute URLs; normalize to local paths and verify they belong to this listing.
- `files`: repeated file field for new photos in selection order, appended after retained photos.

Replace the collection atomically: retain specified photos, remove omitted photos, append uploads, and use the first photo as the cover. Validate ownership, total limit, types, and file sizes server-side. Failed requests must leave the previous photo collection intact for safe retries. Return the resulting `imageUrls`. Image GET routes must serve every listing photo.

Until connected, saving changed photos displays an error and keeps selections. Text details may already be saved before the photo request. Create retries reuse the created listing ID.
