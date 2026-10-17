# Haajari demo script (6 minutes)

Covers all four rubric parts: data collection, design, implementation, demonstration.
Two screens side by side: a laptop (headmaster) and a phone or a narrow browser window (teacher, then parent).

## Before you start (10 minutes earlier)

- [ ] Open the live site so the server wakes up (free hosting sleeps after 15 minutes).
- [ ] Laptop: log in as headmaster, `hm@kps-mysuru.in` / `Haajari@2026`. Leave it on the dashboard.
- [ ] Phone: log in as teacher `9000000007`, PIN `1234`. Open 4-A once (this saves the class on the phone), go back.
- [ ] Second phone or window: parent `9100000001`, PIN `1234`.
- [ ] Have the backup video (`haajari-demo.mp4`) open in another tab, in case of network trouble.
- [ ] If you showed the demo earlier today, reset the data (see DEPLOY.md) so 4-A is unmarked.

## Script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show the research table in the plan doc. | "We read news reports and teacher complaints from Punjab, MP, Bihar, UP and Karnataka. Apps fail because of slow servers at 9 a.m., poor network, and fiddly screens; Karnataka also dropped face recognition over privacy. 15 problems; every feature answers one." **(Data collection)** |
| 0:40 | Show the architecture diagram. | "MERN. The phone saves marks first and syncs later; the server ignores repeats. No GPS, no face data." **(Design)** |
| 1:10 | Phone: turn on airplane mode. Open 4-A. Tap 3 children (absent), one twice (late). Save. | "Everyone starts present; 40 children, 5 taps. No network: it says saved on this phone." |
| 1:50 | Turn airplane mode off. Ticks appear. Laptop: dashboard updates (4-A now counted). | "Synced in the background. If the phone sends twice, the server keeps one copy; we tested 50 classes sending at once, twice." **(Implementation)** |
| 2:30 | Parent phone: Alerts. Riya is absent. Tap **Sick**. | "Parents hear within about 2 minutes. The delay means a mis-tap the teacher fixes never alarms anyone." |
| 3:00 | Teacher phone: open 4-A again; *Sick* shows under Riya's name. | "The reason reaches the teacher; no phone calls needed." |
| 3:20 | Teacher: tap **P** next to Riya to make her present → Save → reason sheet → *Came late* → save. Press and hold her name. | "After the marking time, changes need a reason and are logged: who, when, why." |
| 3:50 | Laptop: dashboard. Point at registers taken, mid-day meal count, class bars. Click **Who is in school now**. | "The headmaster sees which classes are pending and can call the teacher. The meal count goes to the cook on WhatsApp. In a fire drill this is the list." |
| 4:30 | Laptop: **Follow-up**. Open one child. Click *Visited home*, type a note, save. | "Children absent 3 days in a row or below 75% are flagged every evening, like Delhi's early-warning programme." |
| 5:00 | Laptop: **Reports** → monthly register for 4-A → Print preview. Then SATS export. | "This is the paper register, filled in. Totals are checked against the raw data in our tests. The SATS file saves double entry." |
| 5:30 | Optional: LKG teacher `9000000002`, scan the parent's QR pickup pass. | "For LKG and UKG, children are handed only to people on the parent's list." |
| 5:50 | Switch the phone to English and back to Kannada. | "Kannada first, also English and Hindi." **(Demonstration)** |

## Likely viva questions

**Why not face recognition or GPS?**
Karnataka ordered face recognition in June 2025 and withdrew it after privacy concerns; GPS apps showed teachers
kilometres away while inside school. We store only what a paper register holds.

**What happens if two phones mark the same class?**
Each mark carries an id made on the phone and the time it was made. The server ignores ids it has seen, and an older
mark never overwrites a newer one. Tested in `server/tests/attendance.test.js`.

**How does it work with no internet?**
Marks go to IndexedDB on the phone first; a background sync sends them when the network returns. The app itself is cached
by a service worker, so it opens with no network.

**Why does the parent alert wait 2 minutes?**
So a teacher who taps the wrong child and fixes it at once does not frighten a parent. It is a school setting.

**How do you stop fake QR passes?**
The pass is signed by the server (HMAC) and valid only until midnight. The teacher also sees the person's photo.

**Is it fast enough on a cheap phone?**
Field test with Slow 3G and a 6x slower CPU: login page 6.8 s on first visit; opening a class of 40 to "saved" in about
4 s; later visits load 4 KB because the app is on the phone. Lighthouse (mobile): accessibility 100, best practices 100,
performance 84–87.

**How do you know the reports are right?**
`server/tests/reports.test.js` recounts every register total from the raw records and checks the Excel file too.

**What would a real rollout need?**
An SMS provider for OTPs, a paid server that does not sleep, the SATS upload format confirmed with the department,
and a pilot in one school with teacher feedback.

## If something goes wrong

- Site slow to open: it was asleep; wait 30–60 seconds and reload.
- Notifications do not appear: the alert also shows in the Alerts tab; use that.
- Anything else: play the backup video and narrate over it.
