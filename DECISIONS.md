# Decisions

## Scope

All core requirements were implemented. The application is split into npm workspaces for `api` and `web`, with root commands to install dependencies, start development, run tests, set up the database, and build the application. The API exposes the active queue, status filters, and explicit transition endpoints. The web client renders the queue in the server-defined order, exposes only the actions allowed by the API, and reloads the queue after each mutation. The API also validates requested actions, even though the UI does not expose disallowed ones.

I also added a focused Vitest component test for the `QueueTable` component. It checks that the UI preserves the order returned by the API, renders only the allowed actions, forwards the selected action correctly, and disables the actions while a mutation is in progress.

The optional `POST /orders` endpoint and the Playwright end-to-end setup were left out. Both would add useful functionality and coverage but would exceed the agreed four-hour scope.

## Layers

The domain module owns the business logic and use-case orchestration. It is responsible for calculating priority, applying tiebreakers, validating status transitions, deriving allowed actions, and shaping the queue response.

The repository owns data persistence. It queries Postgres using Sequelize, eagerly loads order items and menu items, maps ORM instances to plain objects, and performs conditional status updates to protect against concurrent transitions.

The UI primarily owns the presentation layer and allows the user to interact with the application. It displays the queue in order without rearranging it and handles filtering, loading, error, and empty states. It allows the user to perform only the permitted actions. After a mutation, it reloads the queue instead of trying to manipulate the state locally.

## Priority

Priority is calculated when the queue is requested rather than stored in the database. A persisted score would become stale as waiting time and promised time proximity change.

The scoring functions are **pure** and receive `now` explicitly. A request uses the same timestamp to calculate every score and `minutes_waiting` field, avoiding small inconsistencies between orders. This also makes the tests deterministic.

The scoring logic is centralized in `PRIORITY_RULES`. Scoring and comparison are separate operations, so either can change without mixing their responsibilities.

## Transitions

Allowed status changes are defined in one explicit state machine:

```js
const ALLOWED_TRANSITIONS = {
  received: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["picked_up"],
  picked_up: [],
  cancelled: [],
};
```

Endpoints map actions such as `start`, `ready`, `pickup`, and `cancel` to their destination statuses. The state machine decides whether a transition is valid. If it is invalid or repeated, the API returns a `409 INVALID_TRANSITION` response.

Cancellation is allowed only while the order is `received`. Once preparation starts, the order cannot be cancelled.

The repository updates the status using a **compare-and-set** operation:

```sql
UPDATE orders
SET status = ?
WHERE id = ? AND status = ?
```

This prevents two concurrent requests from applying a transition based on the same stale status. If another request changes the order status first, the service reloads the order's current state and returns a conflict.

## AI suggestion

Claude Code was used in this assignment. I retained its suggestion to use the external `concurrently` library to provide a single root `dev` command. I rejected its initial implementation, which used `placed_at` as the tiebreaker for `dine_in` orders. I determined that the `promised_at` field might be defined for those orders and should therefore be used **only** as a tiebreaker.

## Next

Given more time, I'd add a confirmation dialog for the `cancel` action to prevent accidental cancellations. I'd also add a table loading state, shown both on page load and when applying a filter, to prevent flickering, as well as an automated browser smoke test.
