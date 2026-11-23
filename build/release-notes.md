Version 39: giveaway spin, secret end time, Ballon d'Or fixes.

- NEW: Spin for a winner (Giveaways > Giveaway list). The names scroll on stream for 30 seconds and stop on a random winner. They then have 60 seconds to type !claim in chat from the same account they entered with: anyone else typing it is ignored. Claimed = applause and confetti. Not claimed = they're out of the list and you press SPIN AGAIN, as many times as you need.
- Upload your own music for the spin and your own applause sound (no music = ticking sounds; no applause = the app's fanfare). Change the spin length, the claim time, the command, the title, the prize and the chat messages.
- The spin shows on the BBR overlay (or its own Browser Source: http://localhost:3000/spin). SPIN buttons on the dock and the Stream Deck (/control/spin-start). "Test spin" uses made-up names and tells nobody.
- Secret end time (Giveaways > Giveaway meter): the clock keeps running for you, but the stream shows ENTRIES OPEN with no time, and chat isn't told how long is left.
- Bans: someone banned or timed out is now also taken out of the giveaway meter's own entries, and out of the spin if they were picked.
- Fixed: the Ballon d'Or Edit button did nothing.
- Fixed: after Remove, the Ballon d'Or page wouldn't take typing. This was the app window's own yes/no box, which on Windows can stop text boxes taking typing. Every yes/no question in the dashboard and the dock is now asked inside the page.
