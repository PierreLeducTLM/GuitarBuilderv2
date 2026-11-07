# Proposal

## Why

Builds, steps, photos and measurements are in place, but a luthier still cannot show a client how their guitar is coming along. `build-story-sharing` is the next capability in the recommended order (`docs/rewrite/README.md`). Its groundwork is already there:
- the `share_token` and `share_enabled` columns, which no client can read or write;
- a disabled "Share" item in the build's "More actions" menu;
- a placeholder page at `/story/<token>`, which the access gate already serves without sign-in.

## What Changes

- **Share links on the server.**
  - Owner-only database functions turn sharing on and off and read the current link.
  - Every time sharing is turned on after being off, the function issues a new random UUID. Turning sharing off removes the token, so an old link never works again.
  - An administrator, another user and an anonymous visitor are all refused.
- **Story data on the server.** One function, callable without signing in, takes a token and returns a shared build's story:
  - name, guitar type, BOBO choice, creation date;
  - for each step that applies to the build's variant: whether it is completed, plus its notes, photos and measurements when it is completed.
  - It returns nothing for an unknown token or a build whose sharing is off.
  - Nothing in it can list shared builds or tokens.
- **Live updates.**
  - Any change to a shared build sends a content-free "changed" signal on a private Realtime channel named after its token.
  - Only a client that presents a valid token may join that channel.
  - The story page then fetches the story again.
- **Share dialog (`build-story-sharing`).** The "Share" menu item opens "Share Build Story" with:
  - the Public Access switch and its status line;
  - when sharing is on: the link field, Copy / "Copied!", "Preview Build Story" and the tip;
  - the failure messages;
  - the state read fresh from the server each time it opens.
- **Public story page at `/story/<token>`**, rendered on the server:
  - loading screen, "Story Not Found";
  - header with "Started <date>", the progress bar;
  - the timeline of completed and documented steps with notes, photos, Sound Analysis and spectrum graphs;
  - the two empty states and a photo lightbox with wrap-around navigation;
  - no shell and no owner information.
- **Updates on the story page.**
  - The "Get Build Updates?" prompt, and the "Get Updates" / "Updates On" switch, remembered per link in this browser.
  - Live refresh while updates are on.
  - A browser notification when the number of timeline steps goes up; clicking it brings the story forward at the last step card.
  - A minimal service worker shows the notifications and handles clicks, so they also work on Android Chrome. It does no caching and no push.
  - Browsers without notification support, such as iOS Safari outside an installed web app, get "This browser does not support notifications."
- **English and French** for the dialog, the story, the prompt, the notification and the dates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `build-story-sharing`: "Anonymous Story Access" now states that the story data carries the notes, photos and measurements of completed steps only. Incomplete steps return their completion state alone. The legacy app sent everything and hid it in the browser; this answers open question 11 of the legacy findings. Every other requirement is implemented as written.

## Impact

- **Database:**
  - a new migration with the share functions, the story function, a SQL list of the variant-restricted steps, the change-signal trigger and the `realtime.messages` policy;
  - new pgTAP files;
  - the local test shim gains a minimal `realtime` schema.
- **Packages:**
  - `@gb/db` gains the new function types;
  - `@gb/ui` gains a `Switch` control (`@radix-ui/react-switch`, pinned exactly).
- **App:**
  - the share dialog in `components/builds/`;
  - the story route and its components under `components/story/`;
  - pure story logic under `lib/story/`;
  - a service worker in `public/`;
  - a long date format;
  - new message keys in both catalogs.
- **Tests:**
  - unit tests for the timeline filter, progress, empty states, notification decision and preference memory;
  - a drift test between the SQL step list and the TypeScript template;
  - component tests for the dialog, the story, the prompt, the switch and the lightbox;
  - the fake Supabase server learns the new functions for end-to-end tests of sharing and the story.
- **Operations:** Realtime must allow private channels; the Supabase default does. Live updates cannot run in the fake end-to-end server, so a manual check against a local Supabase stack covers them.
- **Not included:**
  - link-preview metadata for the story;
  - push notifications when the page is closed, which the spec excludes.
