# Kiawah Golf App

A lightweight, mobile-first web app for running team golf tournaments (match play, four-ball, foursomes, scramble). Production URL: `https://golf.sbcctears.com`.

## Project planning artifacts

- Product requirements: `plan/golf-rebrand/prd.md`
- Execution task graph: `plan/golf-rebrand/tasks.md`

## Commissioner login (first-time)

- **Commissioner email:** `coffey.mikey@gmail.com` is the designated initial commissioner. At `/manage/login`, enter that email, submit, receive a magic link by email, click it — you're in.
- **Local dev flow:** In `npm run dev`, if `EMAIL_API_KEY` / `FROM_EMAIL` are unset the magic-link URL is printed to server stdout with prefix `[dev] MAGIC LINK for <email>: <url>`. Copy it from the terminal and open it in a browser. No smtp2go account needed locally.
- **Production flow:** `wrangler pages deployment tail --project-name golf` surfaces any send errors. A successful send returns a smtp2go 200 and the email arrives within seconds.
