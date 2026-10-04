# Three SE references reviewed individually

Only `iphone-se/pick-stars.png`, `pick-dawn.png` and `pick-sea.png` are updated. No tolerance or production code was changed for this step. Pro Max references remain untouched.

The old screenshots show the tall selected-card panel extending into the fan. The current functional checkpoint already uses the compact panel above the fan: all three positions and their labels are readable, the back/Home/setup controls remain visible, and the fan can be operated separately. Stars, dawn and sea were each inspected before copying their actual output into their corresponding expected reference.

Each room has its old `expected`, current `actual` and Playwright `diff` image alongside this file. The earlier merge evidence independently established that the pre-merge functional checkpoint and merged output have identical actual pixels; this change resolves a stale reference, not an unexplained new visual difference.

The pre-update run passed **21/24**: all 18 phone × spread geometry/selection/reload cases and the three Pro Max snapshots passed; only these three old SE references failed. Every visible fan card cleared its selected-card tray by at least 18px in the geometry tests. The tests also selected a card, verified the deck count changed from 78 to 77, reloaded and verified the retained choice. See [before registry](./before-registry.json).

The three reviewed expected files are changed in a separate commit, with normal snapshot comparison rerun after the update. No bulk re-record or looser threshold is used. This remains browser evidence, not physical-iPhone touch or frame-rate acceptance.

After the three replacements, normal comparison passed **6/6** (three rooms × two phones): [after registry](./after-registry.json).
