# Kiawah Golf Manual Test Checklist

Target environment: `https://golf.sbcctears.com`

## 1) Home page

- [ ] Loads at <https://golf.sbcctears.com>
- [ ] Page title is "Kiawah Golf" (or similar)
- [ ] Dark mode toggle works (if present) or OS dark mode applies correctly
- [ ] Text is legible in dark mode (no near-invisible text)
- [ ] No console errors on load

## 2) Tournament join flow

- [ ] Enter code `DEMO26` -> arrives at player selection or tournament landing page
- [ ] Join as a player -> can see match scorecard
- [ ] Enter invalid code `XXXXXX` -> error message shown, no crash

## 3) Commissioner login

- [ ] Navigate to `/manage/login`
- [ ] Enter `coffey.mikey@gmail.com` -> "Magic link sent" message appears
- [ ] Check email inbox for magic link from `SBCC Tears <michael@sbcctears.com>`
- [ ] Click magic link -> lands on commissioner dashboard
- [ ] Commissioner dashboard shows Demo Cup 2026 tournament

## 4) Commissioner dashboard

- [ ] Can view the `DEMO26` tournament
- [ ] Can see teams, players, rounds listed
- [ ] Can navigate to match management

## 5) Score entry (player flow)

- [ ] Join as a player in `DEMO26`
- [ ] Navigate to a match
- [ ] Enter a score for a hole -> score saved (appears in UI)
- [ ] Offline score entry: disable network in DevTools -> enter a score -> re-enable -> score syncs

## 6) Spectator / live ticker

- [ ] Navigate to live ticker for `DEMO26` (`/t/DEMO26/live`)
- [ ] Scores visible without login
- [ ] Updates in real-time (or on refresh) when scores change

## 7) PWA

- [ ] App is installable (browser shows install prompt or Install button)
- [ ] Manifest shows "Kiawah Golf" as name

## 8) Cross-browser

- [ ] Tested in Chrome
- [ ] Tested in Safari (mobile if possible)
