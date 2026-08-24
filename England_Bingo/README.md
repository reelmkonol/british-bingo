# England Bingo

Spot-it bingo for a group trip. Everyone draws their own random 5×5 board from one
shared list of things to spot, ticks off what they find, and can flip through
everyone else's boards read-only.

## Do I need a database?

No — not one you have to sign up for, pay for, or configure. The app uses
**Netlify Blobs**, a key/value store that comes free with any Netlify site. There
is no connection string, no dashboard setup, no schema. It's enabled the moment
the site deploys.

State lives in two places, which is what makes reloads safe:

- **Netlify Blobs (the source of truth).** One record per game config, one record
  per player. Because each player only ever writes their own record, four people
  ticking squares at the same second can't overwrite each other.
- **`localStorage` (the fast path).** The last known board is cached on the
  device, so the app paints instantly on reload even before the network answers.
  A tick made with no signal is queued and pushed the moment the connection
  comes back.

Closing the tab, force-quitting the app, switching from phone to laptop — the
board comes back.

## Deploy

### Option A — connect a Git repo (recommended)

1. Push this folder to GitHub/GitLab.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Leave the build settings alone — `netlify.toml` already sets publish
   directory (`public`), functions directory, and the `/api/*` redirect.
4. Deploy. Netlify runs `npm install` for you, which is what pulls in
   `@netlify/blobs`.

### Option B — Netlify CLI

```bash
npm install
npx netlify deploy --prod
```

### Option C — drag and drop

Drag-and-drop deploys don't run `npm install`, so do it first:

```bash
npm install
```

Then drag the **whole project folder** (not just `public/`) onto the Netlify
deploys page, so `netlify.toml`, `netlify/functions/`, and `node_modules/` all
come along.

### Local development

```bash
npm install
npx netlify dev
```

`netlify dev` emulates Blobs locally. A plain static server won't work, because
`/api/*` needs the function.

## How to use it

1. **Start a new game.** Set a title, write the centre square text, and edit the
   list of things to spot (a starter list of ~60 England-specific ones is
   pre-filled). Longer list = less overlap between boards.
2. **Share the link.** Tap the game code in the header to copy an invite link
   like `https://yoursite.netlify.app/?g=KX4T9`. Or just read the five-character
   code out loud.
3. **Everyone joins** with their name and gets a shuffled board.
4. **Tap squares** on your own board to tick them. Tap another player's chip at
   the top to watch their board fill up — read-only.
5. **Five in a row** draws a line across the board and flips the header red.

## Notes

- The centre square is ticked by default but can be unticked, in case you'd
  rather make it a real task.
- Editing the centre square from the menu updates it on **everyone's** board.
- "Shuffle my board" re-deals your 24 squares and clears your ticks. It only
  affects you.
- Up to 12 players per game.
- Boards refresh every 7 seconds while the tab is visible, and immediately when
  you switch back to it.
- Anyone with the code can join or resume as an existing player. There are no
  passwords — it's designed for people who are already on holiday together.

## File map

```
netlify.toml                  publish dir, functions dir, /api/* redirect
package.json                  the one dependency: @netlify/blobs
netlify/functions/api.mjs     create / state / join / marks / shuffle / config
public/index.html             app shell, three screens
public/styles.css             visual system
public/app.js                 board logic, offline queue, polling
```
