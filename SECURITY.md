# Security Setup

Member access is controlled in two layers:

1. **Firestore security rules** (the real boundary). Rules check the signed-in
   user's verified phone number against an allowlist document in Firestore.
   An unapproved number can complete SMS sign-in but cannot read or write any
   data, and the app signs them out immediately.
2. **A client-side pre-check** in `index.html` against SHA-256 *hashes* of the
   approved numbers. This only exists to show a friendly "not authorized"
   message before an SMS is sent. It is not a security boundary, and no
   plaintext phone numbers appear anywhere in this repository.

## One-time setup (do these in order)

### 1. Create the allowlist document

In [Firebase Console](https://console.firebase.google.com/project/port-committee/firestore)
→ Firestore Database → `portCommittee` collection → **Add document**:

- Document ID: `config_approvedPhones`
- Field: `phones`, type **array**, containing each approved member's number in
  E.164 format (e.g. `+447123456789` — that's `07123 456789` with `07` replaced
  by `+447`, no spaces).

**Do this before publishing the rules below**, otherwise everyone is locked out.

### 2. Publish the Firestore rules

Firestore Database → Rules → paste the contents of `firestore.rules` → Publish.

### 3. Publish the Storage rules

Storage → Rules → paste the contents of `storage.rules` → Publish.

### 4. Deploy the updated app

Push `index.html` to GitHub so GitHub Pages serves the version without
plaintext numbers.

## Adding or removing a member

1. Add/remove their E.164 number in the `phones` array of
   `portCommittee/config_approvedPhones` (Firebase Console). This is what
   actually grants or revokes access — it takes effect immediately.
2. Update `APPROVED_PHONE_HASHES` in `index.html` so the pre-check matches.
   Generate the hash in any browser console:

   ```js
   const n = '+447123456789'; // the member's E.164 number
   crypto.subtle.digest('SHA-256', new TextEncoder().encode(n)).then(d =>
     console.log(Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('')));
   ```

## Notes

- Any approved member can technically edit the allowlist document (the app is
  trust-based and all members share full read/write access to the collection).
- The plaintext numbers that used to be hardcoded in `index.html` remain in
  old git history. Consider making the repository private, or rewriting
  history if that matters to you.
- Hashes of phone numbers are not strongly secret (the UK mobile number space
  is small enough to brute-force), but they prevent casual scraping and carry
  no member names.
