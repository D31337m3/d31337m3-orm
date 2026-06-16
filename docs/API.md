# REST API Documentation

The backend exposes a JSON REST API protected by JWT authentication.

## Authentication (`/api/auth`)

- `POST /register`: Create a new user account.
- `POST /login`: Authenticate and receive a JWT.
- `GET /me`: Retrieve the current user's profile and active subscription.
- `POST /verify-email`: Confirm email via verification token.
- `POST /forgot-password` & `POST /reset-password`: Account recovery flow.

## Payments (`/api/payments`)

Handles all billing via Stripe, PayPal, Interac, and Web3.

- `POST /stripe/checkout`: Generate a Stripe Checkout session URL for subscription sign-ups.
- `POST /stripe/addon`: Generate a PaymentIntent for one-off premium add-ons (e.g., Deep Scan).
- `POST /stripe/webhook`: Endpoint for Stripe to push subscription lifecycle events.
- `POST /crypto/provision`: Generate an ephemeral Web3 deposit address for a specific invoice amount.
- `POST /crypto/verify`: Manually trigger verification of a Web3 transaction hash.
- `POST /interac/submit`: Submit an Interac e-Transfer reference number for manual/automated verification.
- `GET /history`: Fetch user's payment history.

## ORM Operations (`/api/orm`)

Manages the core reputation platform features.

- `GET /keywords`: List tracked keywords and recent high-risk links.
- `POST /keywords`: Add a new keyword. Triggers an immediate BullMQ SERP scan job.
- `DELETE /keywords/:id`: Remove a tracked keyword.
- `GET /scanned-links`: Paginated list of discovered SERP results, filterable by sentiment and data broker status.
- `POST /opt-out`: Request removal of a specific `scannedLinkId`. Dispatches the Playwright worker.
- `GET /opt-out-tasks`: List all pending and completed removal tasks.
- `POST /legal-doc`: Generate a CCPA, GDPR, or FCRA legal document.
- `GET /legal-docs`: List generated documents and their dispatch status.
- `GET /dashboard-summary`: Aggregated metrics (risk index, total exposed links) for the main UI dashboard.
