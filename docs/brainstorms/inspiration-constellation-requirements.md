---
date: 2026-10-09
topic: inspiration-constellation
---

# Inspiration Constellation (working title)

## Problem Frame

Creative people capture inspiration constantly — mostly as phone photos — but those moments get buried in a chronological camera roll and are rarely revisited. The phone itself is a noisy place to have the moment (notifications, other apps), so the inspiration is never "sat with," learned from, or connected to anything.

This project gives an inspiring photo somewhere meaningful to go: a shared map organized by **meaning instead of time**. Each photo lands in an embedding space alongside public-domain masterworks and other people's captures. Writing *why* it inspired you moves it through that space, surfacing kindred paintings and people. Your captures stay findable on the map so they can be revisited instead of buried again.

It also answers the Shared Minds "Handles in Hyperspace" assignment: a social network where people find each other through embeddings, visualized with UMAP, populated with a clearly-labeled "God" button, and navigated *by creation* rather than by feed or search. Conceptual hook from the readings: the camera roll indexes inspiration by chronology; thoughts (and inspiration) aren't related that way.

```
  open app ──► shared map (my captures highlighted)
        │
        ▼  "+" add
  capture photo ──► palette shown ──► lands on map among paintings + people
        │
        ▼
  write why it caught you ──► press Enter ──► node glides to new neighborhood
        │
        ▼
  nearest painting (+ curator's note)  ·  nearest person (+ name, why line)
```

## Requirements

**Capture**
- R1. A user can add one photo at a time via camera or upload, in a calm single-screen flow (no feed, no clutter around the moment).
- R2. On capture, the app shows the photo's extracted color palette as swatches; the palette is kept with the capture and used as the node's accent on the map.
- R3. Each capture requires a display name (remembered on the device after first entry) so classmates can recognise each other. The capture screen states clearly that captures are public to everyone using the app.

**The map (shared space)**
- R4. Every capture is embedded and placed on a shared 2D map where closeness means visual/semantic similarity. All viewers see the same layout, and existing nodes do not reshuffle when new ones are added.
- R5. The map contains three kinds of nodes, distinguishable by shape/treatment (not color alone), with a small legend: public-domain paintings, people's captures, and God-generated samples. The user's own captures have a distinct treatment.
- R6. The map is seeded with a set of public-domain paintings from a museum open-access collection so it is meaningful before any other users exist.
- R7. Similarity is conveyed primarily by spatial distance; raw similarity numbers are hidden by default (optionally shown small on tap).
- R8. The map supports pan and pinch-zoom on touch; when zoomed out nodes may render as dots, when zoomed in as thumbnails. After capture or movement, the view centers on the user's node and its nearest neighbors.
- R9. Captures are public: everyone using the app sees everyone's captures on the same map.

**Navigation by creation**
- R10. After capturing, the user writes a short line about why it inspired them. When they press Enter, the photo and the words are combined into a new position and the node glides there, with its nearest neighbors updating.
- R11. The user can edit the line and press Enter again to move again; the latest line is saved with the capture. An empty line means the photo-only position.
- R12. While the new position is being computed, the node stays put with a visible "thinking" state; on failure it stays put and the user can retry.

**Revisiting**
- R13. "My captures" — a user's past captures (remembered on their device, no account) are highlighted on the map and available as a simple list; tapping one centers the map on it and shows its photo, why line, and neighbors.

**Learning and finding people**
- R14. After each Enter, the app shows two results: the **nearest painting** with an AI-written curator's note (1–2 sentences on what the photo and painting share — light, color, mood, composition), and the **nearest person** (their capture, display name, and why line). Nearest is computed by similarity in the full embedding space, with a line drawn to each on the map.
- R15. Tapping a painting node shows the artwork, artist, date, and museum, plus whether it is currently on view when the museum data provides that.
- R16. Tapping another person's capture shows their photo, display name, and why line.
- R17. If the curator's note fails or is slow, the painting result still shows without the note.

**God button**
- R18. A God button generates synthetic inspiration photos, embeds them, and adds them to the map so it feels populated. A generated node is added only once both generation and embedding succeed.
- R19. Generated nodes are always labeled as generated (on the map and in detail cards) and are never presented as real people — including never appearing as "nearest person."

## Success Criteria
- A classmate can capture a photo, write one line, press Enter, and watch their node move to a neighborhood that feels right to them, within a couple of minutes and without instruction.
- Writing different "why" lines for the same photo visibly leads to different nearest paintings/people.
- At least one demo pair of classmates discovers each other through "nearest person."
- The nearest-painting curator's note makes at least some users say they learned something or want to look up the artist.
- A user can reopen the app later and find their earlier captures.
- The project clearly demonstrates the assignment pieces: embeddings, UMAP, God button, navigation by creation, people finding each other.

## Scope Boundaries
- No accounts or profiles in v1; identity is a display name plus device memory.
- No feed, likes, comments, messaging, or follower graph — finding people happens through the map and "nearest person"; follow-up happens in real life.
- No private captures in v1; everything is public to the class.
- Movement happens on Enter, not on every keystroke.
- Generated "in-between" image (photo ↔ painting via Nano Banana or similar) is **not** in v1; candidate for v2.
- God-generated "why" lines are not in v1 (images only).
- Voice memos and other capture types are out of scope; photography only.
- Exhibition info is limited to what the museum collection data provides; no general exhibition search.
- Cropping-as-navigation and blend sliders are deferred.

## Key Decisions
- **Map-first, not match-first:** The artist match is the nearest painting on the shared map, so one mechanism serves both "learn from art" and "find people."
- **Navigation knob = writing why, applied on Enter:** Closest to the class "Navigation by Creation" example. Moving on Enter (not per keystroke) keeps the moment reflective rather than game-like and keeps model calls few.
- **Two results per move — nearest painting and nearest person:** Ensures "people finding each other" actually happens rather than paintings dominating.
- **Show similarity spatially + one curator's note:** Keeps the feeling of space while teaching *why* things are close.
- **Paintings as fixed stars, map computed once:** Paintings are embedded and laid out ahead of time and the layout is saved and shared; new captures are placed into that existing layout. Solves the empty map, keeps the map stable for everyone, and keeps load fast.
- **Public for the class:** The assignment is about finding each other; the capture screen says so plainly.
- **New project, not an extension of the existing prototypes:** The flowers piece and the inspiration-app prototype are reference only.

## Dependencies / Assumptions
- Models are called through the class ITP/IMA Replicate proxy (per the assignment). Calls take seconds, so every model step needs a waiting state.
- Shared real-time storage follows the class's existing Firebase usage (as in `index.html`, which uses Realtime Database only); shared photos will additionally need file storage.
- **Unverified, highest risk:** that an embedding model reachable through the proxy embeds images and text in a shared space such that adding a "why" line meaningfully changes the nearest neighbors. Image and text vectors in such models often sit apart, so this must be tested before building around it.
- Museum open-access data (Art Institute of Chicago or the Met) is assumed usable for images and metadata; on-view data availability is unverified (AIC appears to expose it more directly).

## Outstanding Questions

### Deferred to Planning
- [Affects R10, R14][Needs research — do first] Spike: which Replicate model (via the proxy) gives image + text embeddings in one space, and does a "why" line actually change the top-3 painting neighbors for the same photo? If not, options include also embedding paintings with text captions, normalizing each modality before mixing, or scoring neighbors as a weighted sum of image and text similarity.
- [Affects R4, R6] How new and moved captures are placed into the saved layout (UMAP transform vs. weighted average of nearest anchors), and when/if the layout is refit (offline, never during use).
- [Affects R6, R15][Needs research] Art Institute of Chicago vs. the Met; how many paintings to seed (~100–300) and at what image size; one-time seeding step that stores embeddings, metadata, and positions.
- [Affects R1, R9] Photo resizing and storage, and how images are passed to the proxy.
- [Affects R14] Which multimodal model writes the curator's note; cache it per (capture, painting) so it's only generated when the nearest painting changes after Enter.
- [Affects R18] Which image model for God-generated photos (e.g., flux-schnell from the class example) and how prompts are varied for diversity; who can press it during demos.
- [Affects R9] Moderation/cleanup approach for a shared public map during class demos (e.g., delete own capture from device, admin cleanup).
- [Affects R8] Desktop/projector layout for the class demo; text alternative to the map (neighbor list) and reduced-motion handling.

## Next Steps
-> /ce:plan for structured implementation planning (start with the embedding spike)
