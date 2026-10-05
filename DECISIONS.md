# Decisions

- [ ] **JS API requirement is enriched with JSDoc typings and ts-check annotations.**
- [ ] **Bucket boundaries**: Treat the 0-30 and 31-60 as both inclusive on the right side of the interval so there is no gaps between them. Use ms-precise `minutesUntil ≤ 30 → 25`, `≤ 60 → 15`, otherwise 0. Exactly 30 and exactly 60 are both inclusive.
- [ ] **Overdue `promised_at`**: If timestamp is in the past, score it 25, the most urgent bucket.
- [ ] **`promised_at` on dine_in.** Scores 0 points (the spec scores promises only for delivery and takeout), but a dine_in promise still counts in the tie-break, ahead of orders with no promise.
- [ ] **`placed_at` in the future** (clock skew): Clamp `minutes_waiting` to ≥ 0.
- [ ] **Rounding.** Wait time uses floor of whole minutes, `total_prep` is always an integer sum.
- [ ] **Explicit state machine**: No conditionals should be scattered throughout the code. The module receives the current status and the next and rejects everything not in the map. Endpoints `/start`, `/ready`, `/pickup` e `/cancel` can only map the action to its corresponding destination status.
```
const ALLOWED_TRANSITIONS = {
  received: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["picked_up"],
  picked_up: [],
  cancelled: [],
};
```
- [ ] **Cancel is only allowed from `received`.** Cancelling a `preparing` order returns 409, as the spec says.
- [ ] **Invalid `?status=`** (e.g. `ready`, `foo`). Return 400 `INVALID_STATUS_FILTER` rather than silently falling back to the default.
- [ ] **HTTP statuses.** 404 not found, 409 illegal transition, 400 malformed id/filter/body, 422 (or 400) unknown `menu_item_id` on POST /orders.
- [ ] **Seed tie that stays stable.** Scores drift as wall-clock time passes.
- [ ] **Where wait minutes come from API.** Return a `minutes_waiting` field that is alreadycomputed with the same `now` as the score, so the UI does no time math beyond formatting.