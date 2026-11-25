Version 42: OBS dock, Starting Soon and credits.

- The app now also answers on localhost's second (IPv6) address. On some PCs "localhost" goes there first, so OBS docks and Browser Sources set to http://localhost:3000 could miss the app: a white dock, and Starting Soon / credits that never react when you switch to them.
- If another program on your PC is already using that address, the System check says so and gives you the address to use instead (http://127.0.0.1:3000/...).
- Fixed: the credits didn't roll by themselves when the app had no stream to put in them.
- The System check lists the BBR pages OBS has open (dock, overlay, Starting Soon, credits...), so you can see at a glance what's connected.
