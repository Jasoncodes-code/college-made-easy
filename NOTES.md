After each save point, push it to GitHub.
OpenAI model available: gpt-5.6-luna
The AI connects through getKey().
## Maybe Later
- The user can click a link to each college's official website.
- The user can see why each college matches their choices.
- The user can save a shortlist of colleges in the browser.
- The user can ask the AI questions about a specific college program.
- The user can see a warning not to enter passwords or private info.
- The user can see application deadlines for saved colleges.
- The user can look up what classes a major usually includes.
- The user can rank their shortlist by what matters most to them.

## How to run
1. Put your MindDo values in `.env`.
2. Run `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node server.js` from the project folder.
3. Open http://localhost:3000.

## What is done
- Version 1 searches for multiple colleges by major.
- The comparison view shows three AI-picked colleges side by side.
- The comparison view includes a chart with each college's own pros and cons.
- Filters are included for state, cost, and size.
- The server keeps the AI key away from the page.
- The local server rereads the current `.env` values, so filling them in does not leave stale placeholders running.
- The last search saves in the browser.
- Saves on this computer only for now.

## Put online with Vercel
- Vercel serves the files in `public/` as the page.
- Vercel runs `api/ask.js` as the small server function; it calls `getKey()` and keeps the AI key off the page.
- `vercel.json` includes `BRIEF.md` and `NOTES.md` inside that function so the deployed AI instructions and model setting are available online.
- In Vercel Project Settings → Environment Variables, add `KEYGEN_URL` and `KEYGEN_TOKEN` for the environments you use (Preview and Production).
- No build command or extra Vercel setting is needed for this project.

## What is next
- Test with students and improve the comparison layout.
- Add later features only after the MVP is demonstrated.
