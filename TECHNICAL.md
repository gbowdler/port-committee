# Port Committee - Technical Documentation

Developer reference for the Port Committee web application.

**Repository:** https://github.com/gbowdler/port-committee
**Live URL:** https://gbowdler.github.io/port-committee

---

## Architecture

The entire application is a **single HTML file** (`index.html`, ~2775 lines) with no build system, no bundler, and no server-side component. All dependencies are loaded from CDNs. All React code is written in a single `<script type="text/babel">` block and transpiled in the browser.

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
| Playfair Display | - | Google Fonts |
| Inter | - | Google Fonts |

### Why Compat SDK?

The app uses Firebase **compat** (v9 compatibility) SDK rather than the modular v9+ SDK. This provides the global `firebase` namespace and avoids the need for a bundler to tree-shake imports.

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

- **Firestore collection:** `portCommittee` (all documents live in this single collection)
- **Firebase Storage:** Used for meeting attachments and library files
- **Authentication:** None. The app is trust-based with access controlled by URL knowledge only.

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

Only `pc_member` is stored in localStorage (the user's name preference). Everything else is in Firestore.

### Data Schemas

#### Port (`port:{id}`)
```javascript
{
  id: "port_1706000000000",
  name: "Dow's 2017 Vintage",
  producer: "Dow's",
  type: "Vintage",          // One of PORT_TYPES
  year: 2017,               // Number or null
  photo: "data:image/...",  // Compressed base64 data URL or empty string
  purchaseLocation: "Wine shop",
  dateAdded: "2024-01-23T...",
  datesTasted: []
}
```

**PORT_TYPES:** `['Vintage', 'Tawny', 'Ruby', 'LBV', 'White', 'Rose', 'Crusted']`

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
| Library documents | `library/{docId}/{timestamp}_{filename}` |

Port photos are **not** stored in Firebase Storage. They are compressed to base64 data URLs and stored inline in the Firestore document (subject to the 1MB Firestore document size limit).

---

## Component Architecture

### Routing (Root Component)

The app uses a simple state-based routing system in the `Root` component:

```
Root
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
| `Root` | - | Top-level router; manages `entered`, `activeSection`, `initialNav` state |
| `LandingPage` | `onEnter` | Cinematic entry with random subheading, exit animation |
| `Dashboard` | `onSelectSection` | Three section cards (Meetings, Garrafeira, Library) + StorageUsage |
| `StorageUsage` | - | Displays storage stats from Firestore |
| `App` | `section, onBack, initialNav, onNavigateToSection` | Main section container for Garrafeira and Meetings |
| `LibrarySection` | `onBack` | Self-contained library with upload, search, filter, preview, delete |
| `PortList` | `onSelect, onAdd` | Searchable/filterable/sortable port grid |
| `PortCard` | `port, avgRating, ratingCount, onClick, onQuickRate` | Port list item card |
| `PortDetail` | `portId, onBack, onEdit, onDelete, showToast, onNavigateToMeeting` | Full port view with ratings and meeting links |
| `PortForm` | `port?, onSave, onCancel` | Add/edit port form with photo upload |
| `QuickRateModal` | `port, onClose, onSaved` | Quick rating modal from port list |
| `MeetingList` | `onSelect, onAdd` | Meetings split into Upcoming/Past sections |
| `MeetingCard` | `meeting, onClick` | Meeting list item card |
| `MeetingDetail` | `meetingId, onBack, onEdit, showToast, onNavigateToPort` | Full meeting view with RSVP, ports, attachments |
| `MeetingForm` | `meeting?, onSave, onCancel` | Add/edit meeting form |
| `PortPicker` | `linkedIds, onSelect, onClose` | Modal to search and link ports to a meeting |
| `LibraryUploadForm` | `onSave, onCancel` | Library document upload form |
| `LibraryCard` | `doc, onPreview, onDownload, onDelete` | Library document list item |
| `StarRating` | `rating, max?, size?, interactive?, onChange?` | 1-10 star display/input |
| `Toast` | `message, type?, onClose` | Auto-dismissing notification |
| `ConfirmDialog` | `title, message, onConfirm, onCancel` | Modal confirmation dialog |
| `Spinner` | - | Loading indicator |
| `FileIcon` | `type` | SVG icon for image/PDF/document file types |

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
- **`compressImageFile(file, maxDim=1600, quality=0.8)`** - For meeting/library file uploads (File in, File out). Uses canvas resize and `toBlob()`. Skips if not an image or if already small enough (both dimensions <= 1600px and size <= 500KB).

---

## Theming

### Color Palette

Custom Tailwind colors defined in `tailwind.config`:

- **`port-50` to `port-950`**: Ruby/burgundy scale (main UI)
- **`gold-300` to `gold-600`**: Gold accent (ratings, stars, hover)

### CSS Classes

| Class | Purpose |
|-------|---------|
| `glass` | Frosted glass card: `rgba(255,255,255,0.03)` bg, blur, border |
| `glass-light` | Lighter glass variant for nested elements |
| `fade-in` | Fade + slide up animation (0.5s) |
| `star-glow` | Gold drop-shadow on filled stars |
| `font-display` | Playfair Display serif font |
| `landing` | Full-screen centered landing page |
| `landing.exit` | Landing page exit animation (scale + blur) |
| `section-enter` | Slide-in animation for section views |
| `dashboard-card` | Glass card with hover glow effect for dashboard |

### Background

`DOURO_BG` is an inline radial gradient + SVG topographic contour map pattern applied to `#theme-bg`. The landing page has its own similar contour pattern via `LANDING_CONTOURS`.

---

## Utility Functions

| Function | Description |
|----------|-------------|
| `formatFileSize(bytes)` | Returns human-readable size (B, KB, MB) |
| `getStorageStats()` | Reads `storage_stats` doc from Firestore |
| `updateStorageStats(fileSize, increment)` | Updates total bytes and file count |
| `validateFileUpload(file)` | Throws if file fails size/type/quota checks |
| `exportData()` | Downloads all data as JSON backup file |
| `importData(file)` | Restores ports, ratings, and meetings from JSON |
| `migrateLocalStorageToFirebase()` | One-time migration from localStorage to Firestore (console utility) |

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

GitHub Pages serves the file automatically at `https://gbowdler.github.io/port-committee`.

---

## Known Patterns & Gotchas

1. **Port photos vs file attachments**: Port photos use base64 stored inline in Firestore (1MB doc limit). Meeting/library files use Firebase Storage with download URLs. Don't mix these approaches.

2. **Backward-compatible attachment rendering**: Migrated meetings may have `att.data` (base64) instead of `att.url`. Always use `att.url || att.data` as the source.

3. **ID generation**: All IDs use `{type}_{Date.now()}` (e.g., `port_1706000000000`). This is not collision-safe for simultaneous creates but acceptable for the use case.

4. **No authentication**: Anyone with the URL can read/write all data. The app is designed for a small trusted group.

5. **List + item pattern**: Data is stored as separate documents with a list document holding all IDs (e.g., `ports:list` + individual `port:{id}` docs). This avoids Firestore document size limits but requires multiple reads.

6. **Component re-mounting for navigation**: Cross-section navigation works by changing the `key` prop on `App`, forcing a full remount: `key={activeSection + ':' + (initialNav?.id || '')}`.

7. **Meeting date handling**: Meeting dates are stored as `YYYY-MM-DD` strings. When displaying, `T12:00:00` is appended to avoid timezone offset issues: `new Date(meeting.date + 'T12:00:00')`.
