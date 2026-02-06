# Port Committee - Technical Documentation

Developer reference for the Port Committee web application.

**Repository:** https://github.com/gbowdler/port-committee
**Live URL:** https://gbowdler.github.io/port-committee

---

## Architecture

The entire application is a **single HTML file** (`index.html`) with no build system, no bundler, and no server-side component. All dependencies are loaded from CDNs. All React code is written in a single `<script type="text/babel">` block and transpiled in the browser.

### CDN Dependencies

| Library | Version | CDN |
|---------|---------|-----|
| React | 18 | unpkg.com/react@18/umd/react.production.min.js |
| ReactDOM | 18 | unpkg.com/react-dom@18/umd/react-dom.production.min.js |
| Babel Standalone | latest | unpkg.com/@babel/standalone/babel.min.js |
| Tailwind CSS | latest | cdn.tailwindcss.com |
| Firebase App (compat) | 10.7.1 | gstatic.com/firebasejs/10.7.1/firebase-app-compat.js |
| Firebase Firestore (compat) | 10.7.1 | gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js |
| Firebase Storage (compat) | 10.7.1 | gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js |
| Firebase Auth (compat) | 10.7.1 | gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js |
| Playfair Display | - | Google Fonts |
| Inter | - | Google Fonts |

### Why Compat SDK?

The app uses Firebase **compat** (v9 compatibility) SDK rather than the modular v9+ SDK. This provides the global `firebase` namespace and avoids the need for a bundler to tree-shake imports.

---

## Authentication

### Phone Authentication Flow

```
User → PhoneLoginScreen → SMS Code → Profile Setup (first time) → Dashboard
```

- **Provider:** Firebase Phone Authentication with invisible reCAPTCHA
- **Format:** UK mobile numbers: `07xxx xxxxxx` → converted to `+447xxxxxxxxx`
- **Allowlist:** `APPROVED_PHONE_NUMBERS` array in code (international format `+447...`)
- **Profiles:** Stored in Firestore at `portCommittee/user_profile:{userId}`
- **Sessions:** Persistent via Firebase auth tokens (survives page reloads)
- **Name auto-fill:** `currentUserName` prop passed to components for form pre-population

### User Profile (`user_profile:{userId}`)
```javascript
{
  userId: "firebase_auth_uid",
  name: "Gareth",
  phoneNumber: "+447123456789",
  createdAt: "2025-02-06T10:00:00Z",
  lastLogin: "2025-02-06T15:30:00Z"
}
```

### Adding New Members

1. Add phone number to `APPROVED_PHONE_NUMBERS` array (format: `+447xxxxxxxxx`)
2. Commit and deploy
3. Share app URL with new member
4. They sign in with their approved number and set their display name

---

## Firebase Configuration

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAdBfk1roLWIrND0UpsCyejcirT0RVXtbM",
  authDomain: "port-committee.firebaseapp.com",
  projectId: "port-committee",
  storageBucket: "port-committee.firebasestorage.app",
  messagingSenderId: "603218289835",
  appId: "1:603218289835:web:e95d41e140dc53818843ee",
  measurementId: "G-CLYQ44S74E"
};
```

### Services Used

- **Firestore:** All application data (ports, meetings, library, user profiles)
- **Firebase Storage:** Photos, documents, video assets
- **Firebase Auth:** Phone number verification with SMS

### Security Rules

- **Firestore:** Time-based access rules (expires Dec 2026)
- **Storage:** Time-based read/write rules
- **API Key:** Restricted to `*.github.io` domain
- **Phone Auth:** Allowlist array in application code

---

## Data Layer

### Storage Helper

All Firestore access goes through a `storage` helper object that wraps values in `{ value }` documents:

```javascript
const storage = {
  async get(key)          // Returns doc.data().value or null
  async set(key, value)   // Sets { value } doc; if value is null/undefined, deletes the doc
  async remove(key)       // Deletes the doc
  async getMulti(keys)    // Promise.all of get() calls
};
```

**Key pattern:** Every piece of data is a separate Firestore document identified by a string key within the `portCommittee` collection. The document contains a single field `value` holding the actual data.

### localStorage

Only `pc_member` is stored in localStorage (the user's name preference, also set from auth profile). Everything else is in Firestore.

### Data Schemas

#### Port (`port:{id}`)
```javascript
{
  id: "port_1706000000000",
  name: "Dow's 2017 Vintage",
  producer: "Dow's",
  type: "Vintage",              // One of PORT_TYPES
  year: "2017",                 // String: vintage year or age statement (e.g., "10 Year Old")
  officialNotes: "Deep purple...", // Official tasting notes from producer
  photo: "data:image/...",      // Compressed base64 data URL or empty string
  purchaseLocation: "Wine shop",
  dateAdded: "2024-01-23T...",
  datesTasted: []
}
```

**PORT_TYPES:** `['Vintage', 'Tawny', 'Ruby', 'LBV', 'White', 'Rose', 'Crusted']`

**Note:** `year` was changed from `Number` to `String` to support age statements like "10 Year Old" alongside vintage years like "2016".

#### Ratings (`ratings:{portId}`)
```javascript
{
  portId: "port_1706000000000",
  ratings: [
    {
      memberName: "Gareth",
      rating: 8,             // 1-10
      notes: "Rich and fruity...",
      date: "2024-01-23T..."
    }
  ]
}
```

Ratings are stored per-port. When a member submits a rating, any existing rating from the same `memberName` is replaced (filtered out then re-added).

#### Port ID List (`ports:list`)
```javascript
["port_1706000000000", "port_1706000000001", ...]
```

#### Meeting (`meeting:{id}`)
```javascript
{
  id: "meeting_1706000000000",
  date: "2024-03-15",        // YYYY-MM-DD string
  location: "John's house",
  host: "John",
  status: "upcoming",        // "upcoming" or "completed"
  notes: "Bring cheese",
  attendees: [
    { name: "Gareth", rsvp: "yes", bringing: "Dow's 2017" }
  ],
  portsTasted: ["port_1706000000000"],  // Array of port IDs
  attachments: [
    {
      id: "att_1706000000000",
      name: "tasting-notes.pdf",
      type: "application/pdf",
      size: 245000,
      url: "https://firebasestorage.googleapis.com/...",
      path: "meetings/meeting_1706.../1706..._tasting-notes.pdf"
    }
  ],
  photos: [
    {
      id: "photo_1706000000000",
      url: "https://firebasestorage.googleapis.com/...",
      caption: "Taylor's 2016 with the committee",
      size: 180000,
      uploadedBy: "Gareth",
      uploadedAt: "2025-03-15T20:30:00Z",
      path: "meetings/meeting_1706.../photos/1706..._photo.jpg"
    }
  ],
  dateCreated: "2024-01-23T..."
}
```

**Note:** Some migrated attachments may have a `data` field (base64) instead of `url`. The rendering code handles both: `att.url || att.data`.

#### Meeting ID List (`meetings:list`)
```javascript
["meeting_1706000000000", ...]
```

#### Library Document (`library:{id}`)
```javascript
{
  id: "lib_1706000000000",
  name: "Vintage Chart 2020-2024",
  description: "Comprehensive vintage ratings...",
  category: "Vintage Charts",   // One of LIBRARY_CATEGORIES
  tags: ["tawny", "douro"],
  file: {
    name: "vintage-chart.pdf",
    type: "application/pdf",
    size: 1200000,
    url: "https://firebasestorage.googleapis.com/...",
    path: "library/lib_1706.../1706..._vintage-chart.pdf"
  },
  uploadedBy: "Gareth",
  uploadedAt: "2024-01-23T..."
}
```

**LIBRARY_CATEGORIES:** `['Vintage Charts', 'Presentations', 'Tasting Guides', 'Port Producers Info', 'Reference Books', 'Other']`

#### Library ID List (`library:list`)
```javascript
["lib_1706000000000", ...]
```

#### Storage Stats (`storage_stats`)

This is a special document stored directly (not through the `storage` helper) at `portCommittee/storage_stats`:

```javascript
{
  totalBytes: 15000000,
  fileCount: 12,
  lastUpdated: "2024-01-23T..."
}
```

### Firebase Storage Paths

| Content | Path Pattern |
|---------|-------------|
| Meeting attachments | `meetings/{meetingId}/{timestamp}_{filename}` |
| Meeting photos | `meetings/{meetingId}/photos/{timestamp}_{filename}` |
| Library documents | `library/{docId}/{timestamp}_{filename}` |
| Dashboard video | `Assets/douro-background.mp4` |

Port photos are **not** stored in Firebase Storage. They are compressed to base64 data URLs and stored inline in the Firestore document (subject to the 1MB Firestore document size limit).

---

## Component Architecture

### Routing (Root Component)

The app uses a simple state-based routing system in the `Root` component:

```
Root
├── PhoneLoginScreen     (not authenticated)
├── LandingPage          (entered === false)
├── Dashboard            (entered === true, activeSection === null)
├── LibrarySection       (activeSection === 'library')
└── App                  (activeSection === 'garrafeira' | 'meetings')
    ├── Garrafeira views: PortList → PortDetail → PortForm
    └── Meeting views:   MeetingList → MeetingDetail → MeetingForm
```

**Cross-section navigation:** The `App` component receives an `onNavigateToSection` callback. When viewing a port detail, clicking a linked meeting calls `onNavigateToSection('meetings', { type: 'meeting', id: mid })`. The `Root` component sets `activeSection` and `initialNav`, and `App` is re-mounted with a new `key` to pick up the initial navigation target.

### Component Reference

| Component | Props | Description |
|-----------|-------|-------------|
| `Root` | - | Top-level router; manages auth state, `entered`, `activeSection`, `initialNav` |
| `PhoneLoginScreen` | `onLoginSuccess` | SMS phone login with 3 steps: phone, code, name |
| `LandingPage` | `onEnter` | Cinematic entry with random subheading, exit animation |
| `Dashboard` | `onSelectSection, currentUserName, onLogout` | Section cards with video background + sign out |
| `StorageUsage` | - | Displays storage stats from Firestore |
| `App` | `section, onBack, initialNav, onNavigateToSection, currentUserName, showToast` | Main section container for Garrafeira and Meetings |
| `LibrarySection` | `onBack, currentUserName, showToast` | Self-contained library with upload, search, filter, preview, delete |
| `PortList` | `onSelect, onAdd` | Searchable/filterable/sortable port grid |
| `PortCard` | `port, avgRating, ratingCount, onClick, onQuickRate` | Port list item card |
| `PortDetail` | `portId, onBack, onEdit, onDelete, showToast, onNavigateToMeeting, currentUserName` | Full port view with collapsible ratings |
| `PortForm` | `port?, onSave, onCancel` | Add/edit port form with photo upload, official notes, year/age |
| `QuickRateModal` | `port, onClose, onSaved` | Quick rating modal from port list |
| `MeetingList` | `onSelect, onAdd` | Meetings split into Upcoming/Past sections |
| `MeetingCard` | `meeting, onClick` | Meeting list item card |
| `MeetingDetail` | `meetingId, onBack, onEdit, showToast, onNavigateToPort, currentUserName` | Full meeting view with collapsible RSVP, photos, attachments |
| `MeetingForm` | `meeting?, onSave, onCancel` | Add/edit meeting form |
| `PortPicker` | `linkedIds, onSelect, onClose` | Modal to search and link ports to a meeting |
| `LibraryUploadForm` | `onSave, onCancel, currentUserName` | Library document upload form |
| `StarRating` | `rating, max?, size?, interactive?, onChange?` | 1-10 star display/input |
| `Toast` | `message, type?, onClose` | Auto-dismissing notification |
| `ConfirmDialog` | `title, message, onConfirm, onCancel` | Modal confirmation dialog |
| `Spinner` | - | Loading indicator |
| `FileIcon` | `type` | SVG icon for image/PDF/document file types |

---

## Dashboard Video Background

The dashboard features a cinematic entrance with a Douro Valley video.

- **Source:** MP4 hosted in Firebase Storage at `Assets/douro-background.mp4`
- **Session tracking:** `_dashboardVideoSeen` ref ensures video only plays on first dashboard visit per session
- **Fallback:** 3-second timeout skips to content if video fails to load

**Timeline:**
| Time | Phase | Video Opacity | Content |
|------|-------|---------------|---------|
| 0-0.5s | `fade-in` | 0 → 1 | Hidden |
| 0.5-3s | `playing` | 1 | Hidden |
| 3-4s | `fade-out` | 1 → 0.08 | Cards animate in |
| 4s+ | `complete` | 0.08 | Fully interactive |

**CSS gating:** Dashboard card/title animations are gated behind `.dashboard-content-visible` class, which is only added when `showContent` becomes true.

---

## Collapsible Form Sections

Both RSVP (in MeetingDetail) and rating (in PortDetail) forms use a collapsible pattern:

1. Check if current user has already submitted (by matching `currentUserName` or `localStorage` name)
2. If not submitted: form is expanded by default
3. If already submitted: form is collapsed, showing an "Edit My RSVP/Rating" button
4. On successful save: form auto-collapses
5. Cancel button available when editing

---

## Meeting Photo Albums

Photos are stored in the meeting's `photos` array and uploaded to Firebase Storage.

### Upload Flow
1. Multi-file select via hidden `<input type="file" multiple>`
2. Each file compressed via `compressImageFile()` (max 1600px, 80% JPEG quality)
3. Upload to Firebase Storage at `meetings/{meetingId}/photos/{timestamp}_{filename}`
4. Photo metadata appended to meeting's `photos` array in Firestore
5. Storage stats updated

### Display
- Grid layout: 2 columns mobile, 3 columns desktop
- 4:3 aspect ratio cards with `object-fit: cover`
- Hover reveals uploader name and delete button
- Caption overlay at bottom of card

### Preview Modal
- Full-size viewer matching attachment preview style
- Header with uploader info, delete button, close button
- Inline caption editing (click to edit, Enter to save, Escape to cancel)
- Escape key or click-outside to close

---

## File Upload System

### Upload Limits

```javascript
const MAX_FILE_SIZE = 5 * 1024 * 1024;              // 5 MB per file
const MAX_TOTAL_STORAGE = 2.5 * 1024 * 1024 * 1024; // 2.5 GB total (50% of Firebase free tier)
const MAX_FILE_COUNT = 500;
```

### Allowed File Types

```javascript
const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.pptx,.txt,.xls,.xlsx';
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
```

### Upload Flow

1. `validateFileUpload(file)` - Checks size, MIME type, total storage, file count
2. `compressImageFile(file)` - Compresses images > 1600px or > 500KB (returns original file for non-images)
3. Upload to Firebase Storage via `firebaseStorage.ref().child(path).put(file)`
4. Get download URL via `fileRef.getDownloadURL()`
5. Save metadata to Firestore via `storage.set()`
6. Update `storage_stats` via `updateStorageStats(size, true)`
7. On Firestore failure: clean up orphaned Storage file

### Image Compression

Two separate compression functions exist:

- **`compressImage(dataUrl, maxWidth=1200, quality=0.8)`** - For port photos (base64 data URL in, base64 data URL out). Uses canvas resize and `toDataURL('image/jpeg', quality)`.
- **`compressImageFile(file, maxDim=1600, quality=0.8)`** - For meeting/library file uploads and meeting photos (File in, File out). Uses canvas resize and `toBlob()`. Skips if not an image or if already small enough (both dimensions <= 1600px and size <= 500KB).

---

## Theming

### Color Palette

Custom Tailwind colors defined in `tailwind.config`:

- **`port-50` to `port-950`**: Ruby/burgundy scale (main UI)
- **`gold-300` to `gold-600`**: Gold accent (ratings, stars, hover)

### Background

Standardised across all screens:
```css
background: linear-gradient(135deg, #1a0505 0%, #2d0a0a 100%);
```

Applied to body (with `background-attachment: fixed`), landing page, and login screen.

### CSS Classes

| Class | Purpose |
|-------|---------|
| `glass` | Frosted glass card: `rgba(92, 14, 48, 0.25)` bg, blur, border |
| `glass-light` | Lighter glass variant for nested elements |
| `fade-in` | Fade + slide up animation (0.3s) |
| `star-glow` | Gold drop-shadow on filled stars |
| `font-display` | Playfair Display serif font |
| `landing` | Full-screen centered landing page |
| `landing.exit` | Landing page exit animation (scale + blur) |
| `section-enter` | Slide-in animation for section views |
| `dashboard-card` | Glass card with hover glow effect for dashboard |
| `dashboard-content-visible` | Triggers card/title reveal animations |

---

## Utility Functions

| Function | Description |
|----------|-------------|
| `formatFileSize(bytes)` | Returns human-readable size (B, KB, MB) |
| `getStorageStats()` | Reads `storage_stats` doc from Firestore |
| `updateStorageStats(fileSize, increment)` | Updates total bytes and file count |
| `validateFileUpload(file)` | Throws if file fails size/type/quota checks |
| `compressImage(dataUrl)` | Compresses base64 image for port photos |
| `compressImageFile(file)` | Compresses File object for uploads |
| `isPhoneApproved(phone)` | Checks phone number against allowlist |
| `getUserProfile(uid)` | Fetches user profile from Firestore |
| `saveUserProfile(uid, name)` | Creates/updates user profile |
| `updateLastLogin(uid)` | Updates last login timestamp |
| `exportData()` | Downloads all data as JSON backup file |
| `importData(file)` | Restores ports, ratings, and meetings from JSON |

---

## Export/Import

`exportData()` creates a JSON file containing all ports, ratings, meetings, and library documents. The filename follows the pattern `port-committee-backup-YYYY-MM-DD.json`.

`importData(file)` overwrites existing ports, ratings, and meetings from a backup file. **Note:** Library documents are not currently imported.

---

## Deployment

The app is hosted on **GitHub Pages** from the `main` branch. Since it's a single `index.html` file, no build step is required.

To deploy:
```bash
git add index.html
git commit -m "Description of changes"
git push origin main
```

GitHub Pages serves the file automatically at `https://gbowdler.github.io/port-committee`. Deploys typically complete within 1-2 minutes.

### Prerequisites

- Firebase project on Blaze plan (for Storage and Auth)
- Phone Authentication enabled in Firebase Console
- Authorized domains configured for reCAPTCHA
- Dashboard video uploaded to Firebase Storage (`Assets/` folder)
- Phone number allowlist configured in code

---

## Known Patterns & Gotchas

1. **Port photos vs file attachments**: Port photos use base64 stored inline in Firestore (1MB doc limit). Meeting photos, attachments, and library files use Firebase Storage with download URLs. Don't mix these approaches.

2. **Backward-compatible attachment rendering**: Migrated meetings may have `att.data` (base64) instead of `att.url`. Always use `att.url || att.data` as the source.

3. **ID generation**: All IDs use `{type}_{Date.now()}` (e.g., `port_1706000000000`). This is not collision-safe for simultaneous creates but acceptable for the use case.

4. **Year field type**: The `year` field on ports is a `String` (not `Number`) to support both vintage years ("2016") and age statements ("10 Year Old"). Existing numeric values from older ports still display correctly.

5. **List + item pattern**: Data is stored as separate documents with a list document holding all IDs (e.g., `ports:list` + individual `port:{id}` docs). This avoids Firestore document size limits but requires multiple reads.

6. **Component re-mounting for navigation**: Cross-section navigation works by changing the `key` prop on `App`, forcing a full remount: `key={activeSection + ':' + (initialNav?.id || '')}`.

7. **Meeting date handling**: Meeting dates are stored as `YYYY-MM-DD` strings. When displaying, `T12:00:00` is appended to avoid timezone offset issues: `new Date(meeting.date + 'T12:00:00')`.

8. **Video session tracking**: `_dashboardVideoSeen` is a plain object `{ current: false }` outside the component to persist across re-renders without causing re-render cycles. Not a `useRef` because the Dashboard component unmounts when navigating to sections.

9. **Collapsible form identity**: RSVP and rating forms identify the current user by matching `currentUserName` (from auth) or `localStorage('pc_member')` against existing entries. If a user changes their display name, their previous entries won't match.
