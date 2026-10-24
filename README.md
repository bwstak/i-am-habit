# Dawn

A personal habit tracker that works offline, lives on your iPhone home screen and runs on your PC. Plain HTML, CSS and JavaScript modules: no framework, no build step, nothing to install.

## Run it on your computer

```sh
npm start    # serves the app at http://localhost:5173 (the first run downloads a small local server)
npm test     # checks the rules: streaks, scores, XP (Node 18 or later)
```

No Node? `python3 -m http.server 5173` works too (`python -m http.server 5173` on Windows). Opening `index.html` straight from disk won't work, because browsers refuse to load JavaScript modules from `file://` addresses.

On localhost the service worker fetches fresh files first, so a normal reload shows your edits. Your phone needs the https version for offline mode and installing, so deploy it (next section) rather than testing over Wi-Fi.

## Put it online for free

GitHub Pages is free for public repositories. Only the code goes to GitHub: your habit data never leaves your devices.

1. Create a repository on GitHub, for example `dawn`.
2. Push this folder to it:
   ```sh
   git init
   git add .
   git commit -m "Dawn v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/dawn.git
   git push -u origin main
   ```
   Or use "Add file → Upload files" on the repository page and drag everything in.
3. In the repository, open Settings → Pages. Under "Build and deployment", choose "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. After a minute or two the app is live at `https://YOUR-USERNAME.github.io/dawn/`.

Pick one address and keep it. Browsers store data per address, so the same app on a different host starts empty (Export and Import move your data across).

Netlify or Vercel work too: connect the repository, or on Netlify drag the folder onto app.netlify.com/drop. There's no build command, and the folder to publish is the project root.

## Install it

**iPhone:** open the address in Safari, tap Share (in the ⋯ menu on newer iOS), then "Add to Home Screen". If you see "Open as Web App", leave it on. From then on, open Dawn from its icon.

- The home-screen app has its own storage, separate from Safari. Anything you logged in a Safari tab won't appear in it, so start using the icon straight away.
- Removing the icon deletes its data. Export a backup first.

**PC:** open the address in Chrome or Edge and click the install icon in the address bar. The installed app keeps its own data, separate from your phone's.

## Moving data between devices

Until sync exists, each device keeps its own copy. To copy everything across, use Habits → Export backup on one device and Habits → Import backup on the other. Importing replaces what was there. On iPhone, Export opens the share sheet, so you can save the file to Files or AirDrop it to a Mac.

Export now and then anyway: a backup is your only copy outside the device.

## How the code works

```
index.html            app shell: tab bar, bottom sheet, toast
manifest.webmanifest  name, icons and colours for the installed app
sw.js                 service worker: the offline copy and updates
css/styles.css        all styling (colours are variables; dark mode swaps them)
js/app.js             starts the app: routing, events, re-rendering
js/store.js           the data: load, save, change, back up
js/logic.js           the rules: streaks, scores, XP, comparisons
js/dates.js           date helpers
js/ui.js              shared helpers: escaping, icons, the sky, toast, sheet
js/starter.js         your starter habits, as data
js/views/             one file per screen: today, week, stats, habits, edit
tests/logic.test.js   tests for the rules
icons/                app icons
```

What happens when you tap a habit:

1. The button has `data-action="tap"`. One click listener in `app.js` finds the nearest `data-action` and calls `actions.tap` in the current view, `views/today.js`.
2. That calls `setEntry()` in `store.js`, which changes the data, saves it to localStorage and notifies its subscribers.
3. `app.js` is subscribed, so it re-renders the view: each view's `render(app)` builds an HTML string from the current data.

That's the whole architecture. Three rules keep it tidy: only `store.js` changes data; `logic.js` only calculates (no DOM, no storage, so it's easy to test); views read data and call store functions.

DevTools → Application shows the saved data (Local Storage), the offline copy (Cache Storage) and the service worker.

### The data

Everything is one object, saved as JSON in localStorage under `dawn-habits`. To look at it, run `JSON.parse(localStorage.getItem('dawn-habits'))` in the DevTools console.

```js
{
  schema: 1,
  habits: [{
    id, name, emoji, color,
    type,        // 'check' (done or not), 'count' (one tap per time), 'amount' (towards a target)
    target,      // 3 for dishes, 3300 for kcal (always 1 for 'check')
    unit,        // 'meals', 'kcal'
    schedule,    // { kind: 'daily' | 'days' | 'weekly', days: [1, 3, 5], perWeek: 4 }
    times,       // target time per weekday: { 1: '06:30', 6: '07:30' }, where 0 = Sunday
    weight,      // importance, 1–5
    difficulty,  // 1–3, sets the XP
    startDate, archivedAt, createdAt,
  }],
  entries: {
    '2026-10-24': { [habitId]: { value: 1, skipped: false, updatedAt: 1792851743565 } },
  },
  settings: { weekStart, dayStartHour, partialCredit, xp },
}
```

Days are local date strings like `'2026-10-24'`, never `Date` objects: they mean the same day everywhere, sort correctly as text and work as object keys. The top of `dates.js` explains why.

### The rules

These all live in `logic.js`, with tests in `tests/logic.test.js`. Change a rule, change its test.

- **Done** means the value reached the target. Streaks need done. Scores can give partial credit (2 of 3 dishes scores 67%), which you can switch off in Habits.
- **Streaks** count scheduled days in a row that were done. Unscheduled and skipped days are stepped over, and today never breaks a streak because the day isn't over.
- **Weekly goals** like Gym 4× count their streak in weeks, and the current week can't break it until it ends. A week you start partway through, or with skipped days, needs a proportional number of sessions.
- **Scores** are each habit's completion rate, averaged with importance as the weight. Weekly goals are pro-rated: by Wednesday, 4× a week expects 4 × 3/7 ≈ 1.7 sessions, so 2 sessions scores 100%.
- **Skipped days** are left out of scores entirely. They're for rest and sick days.
- **The comparison** on Progress only uses finished days: the start of the week to yesterday, against the same days last week. On the first day of a week it compares the last two full weeks. "% better" is relative: 73% → 82% is +9 points, which is 12% better.
- **XP** per completion depends on difficulty: 10, 20 or 35 by default, editable in Habits. Level L starts at 50 × L × (L − 1) XP, so levels 2, 3, 4 and 5 start at 100, 300, 600 and 1,000 XP.
- **The day starts at 03:00** by default, so ticking something off at 01:00 still counts for the evening before.

Importance and difficulty are separate on purpose. Importance is how much a habit counts towards your score; difficulty is how much effort it takes, so how much XP it pays.

## Shipping an update

1. Make your changes and test them locally.
2. In `sw.js`, change `VERSION`, for example to `'1.0.1'`. If you added a file, add it to `FILES` as well.
3. Push. The next time you open the app, it downloads the new version in the background and shows "A new version is ready" with an Update button.

Skip step 2 and installed copies keep showing the old version, because they load from the offline copy.

Stuck on an old version? In Chrome DevTools, open Application → Service workers, click Unregister and reload. Avoid "Clear site data" unless you've exported a backup, because it deletes your habits too.

## Make it yours

- **Saturday shift:** edit "Wake up on time" in the app and change Saturday's target time. Every day of the week has its own.
- **Starter habits:** `js/starter.js`, only used when you tap "Load my starter habits" on an empty app.
- **Habit colours:** the `--c-*` variables at the top of `css/styles.css`, plus their names in `COLORS` in `js/ui.js`.
- **The sky:** `NIGHT`, `DUSK` and `MORNING` in `js/ui.js`.
- **The level curve:** `levelFromXp()` in `js/logic.js`.

## Things to try, to learn the codebase

Each one touches a different part of the app, roughly from easiest to hardest.

1. Make levels come faster by changing `levelFromXp()`. Run `npm test`, watch the level test fail, then update the test.
2. Add a ninth habit colour.
3. Show the best streak next to the current one on Today. `streaks()` already returns `best`.
4. After you check something off, show a toast with an Undo button. `toast()` in `ui.js` already supports an action.
5. Let a day's entry hold a short note, typed in the habit sheet. Entries keep extra fields, including through backups.

## Roadmap

### 1. Wake-time logging

Each entry already stores `updatedAt`, the moment you last changed it. For "Wake up on time" that's roughly when you got up, so you could chart it today. A cleaner version saves an explicit `wokeAt: '06:34'` on the entry (editable in the habit sheet, defaulting to now). It then compares that with `habit.times[weekday]` and shows your weekly average, and how many minutes early or late you were, on Progress.

### 2. Sync between phone and PC

Only `store.js` needs to change. Keep localStorage as each device's copy so the app stays offline-first, and sync in the background whenever there's a connection. Entries already carry `updatedAt`, and unchecking stores 0 instead of deleting, so merging can be "newest change wins" for each entry. Habits will need an `updatedAt` too. Mark a deleted habit as deleted instead of removing it, so the deletion reaches your other device. With Supabase, that means:

- a `habits` table and an `entries` table
- row-level security, so you only ever see your own rows
- a magic-link sign-in

### 3. Push reminders

On iPhone, push works only for home-screen apps (iOS 16.4 or later), and the permission prompt has to come from a tap. Something also has to send each reminder at the right time, so this needs a small server. Each device's push subscription goes into the sync database, and a scheduled function sends reminders based on `habit.times`. That's why it comes after sync. The service worker receives the `push` event and shows the notification.
