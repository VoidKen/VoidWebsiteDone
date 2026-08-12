Put your real downloadable files in this folder — filenames must match
the `file` field in `api/_products.js` (and ideally `src/data/products.js`
too, just for your own reference).

This folder is NOT publicly browsable. Files are only served through
`/api/download`, which checks that the requester is signed in with
Discord AND owns that product before sending the file.

`voidsworld-1.20.1.jar` below is a placeholder text file so you can test
the full purchase → download flow end-to-end before swapping in a real
mod jar.
