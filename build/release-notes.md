Version 41: overlay check fixed.

- "Overlay open in OBS" now counts only the BBR overlay. Before, it counted every BBR page open in OBS (Starting Soon, BRB, Big Cam, Ballon d'Or...), so it could say 6 when the overlay itself wasn't one of them.
- No more false "the overlay is not reporting": OBS slows down sources in scenes you're not on, so the overlay's regular check-in could be a minute late. The System check now asks the overlay directly and gets an answer at once.
- If the overlay really isn't open, the check says so and lists the BBR pages that are open.
