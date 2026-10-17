# Stratum mill operations and optional camera pilot

Status: draft implementation only. No production schema, Edge Function or data import has been applied by this change. GeoMind remains available throughout the handover.

## User journey

Signed-in users open **Mill operations** in the marketplace header, or `/?view=processing-director`. Refreshing that address restores the destination. Sign-in uses Stratum's existing AuthProvider and Supabase client. A marketplace profile role is not a mill permission: owners create a workspace; staff require an invitation and owner approval.

The dashboard has service buttons for Receiving, Suppliers, Manager, Production, Supervisor, Dispatch, Staff & invitations and Reports. Forms open only for the selected task. Receiving accepts 100 bags without inventing kilograms, supplier name/phone and optional bank details. Account numbers retain leading zeros. Bank details are limited to director, manager and receiving roles, and excluded from shared activity and exports.

Each submitted operation produces an attributed, immutable activity event. Realtime inserts trigger refresh, with a 15-second visible-page fallback. Retries use the same request UUID; stale batch updates retain the task. Reports export complete loaded batch history as text. PDF, processing offline sync and structured assay workflows are not included.

Market intelligence opens Stratum's existing market page. This change does not introduce a new mineral-news service or licensed daily-price feed. It does not call GeoMind APIs.

## Camera pilot

Only the mill owner sees **Cameras & alerts**. Camera RLS separately checks workspace ownership; approved mill staff do not gain camera access. One camera row contains one review rule and one normalized frame rectangle. Outside-hours rules use a daily interval in the selected timezone; end-before-start means overnight. Restricted-zone rules apply at all times.

The Node/FFmpeg gateway uses one RTSP source per process, one grayscale 160×90 frame per second, a 30-level pixel-change threshold, at least 5% changed pixels in the rectangle for three consecutive comparisons, and a 60-second local cooldown. Server-side checks enforce rule revision, a two-minute event-time bound, deduplication and another 60-second cooldown.

Snapshots contain the **whole frame**, although detection uses the rectangle. They are stored with private alert rows; list queries omit the snapshot and review loads it on demand. The director records Expected activity or Needs follow-up with a reason; actor/time/revision are stamped by the database. Previous event evidence stays immutable. Only the latest review decision is stored, not a complete decision audit trail. Motion does not establish identity, wrongdoing, mineral grade or weight.

The queue polls every 20 seconds while visible and no camera draft, review or credential is open. Dashboard refresh includes the camera section when mounted. Open camera forms protect section navigation. Last movement received is not an online heartbeat.

## Deployment order — not executed

1. Confirm the target is Stratum's Supabase project, not GeoMind's. Record its current schema/migration history and take an appropriate backup. Confirm no existing objects conflict with `processing_director_*`, `processing_mill_*` or the private Stratum schemas. These are additive, fresh-workspace migrations, not idempotent replay scripts.
2. Apply `20261015172252_processing_mill_workspace.sql`, then `20261015172314_processing_camera_alerts.sql`. This preserves the creation order for workspace, team, supplier and camera objects. Check actual grants, RLS, Data API schema exposure and the `processing_mill_events` realtime publication. Run Supabase database advisors and investigate findings before release.
3. Deploy `processing-camera-events` to **Stratum**. The checked-in function config disables platform JWT verification because gateway requests use a per-camera token. The handler must remain intact: owner routes verify the user JWT using `getUser` and an owner-scoped camera query; config/motion routes verify hashed, expiring camera credentials. No service key goes to the browser or gateway. Required server environment: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the target project.
4. Release the Stratum frontend with its existing target-project browser environment. Verify signed-in owner create/save/reopen, staff invitation/approval/revocation and Android text download before company use. Signed-out access must not render workspace records.
5. Establish the camera host's Node/FFmpeg compatibility, RTSP access, HTTPS egress, clock synchronization, power and supervised restart behavior. Keep RTSP credentials and gateway tokens in protected host configuration. RTSP credentials may appear in FFmpeg process arguments. Rotate/revoke credentials through the owner UI; issued keys expire after 90 days.

Gateway environment (set locally; never commit values):

- STRATUM_CAMERA_ENDPOINT: the **Stratum** project's HTTPS `/functions/v1/processing-camera-events` URL.
- STRATUM_CAMERA_ID: the owner-issued camera ID.
- STRATUM_CAMERA_TOKEN: the one-time displayed gateway credential.
- STRATUM_CAMERA_RTSP: the actual local RTSP feed URL.

Run `node tools/processing-camera-gateway.mjs`. Configuration is polled every 30 seconds. Configuration/feed failure stops the gateway for supervised restart. Motion-submission failure is logged but not queued or retried. No SMS/push, live player, clips or emergency response is provided.

## One-camera acceptance

Use an isolated test workspace, one fixed camera, one owner and one outside-hours rule in Africa/Lagos. Agree the camera view, reviewer and pilot retention/removal procedure before collecting snapshots.

1. Save/reload the rule; confirm real decoded frames and the monitored rectangle against the actual view.
2. During permitted hours, generate sustained in-zone movement. Confirm `within_permitted_hours` at ingestion and no alert row.
3. After the permitted interval ends, wait over 60 seconds since the last detected event (the local gate also advances for suppressed events). Sustained outside-zone movement must not alert; sustained in-zone movement must create exactly one Activity needs review.
4. Replay the accepted event ID while its timestamp is fresh: duplicate response, no new row. A new event during the server cooldown must not add another row.
5. On Android, open the grayscale image, verify names/time/revision, record a reason, save and reload. Verify reviewer/time in the database. Check that an approved manager, outsider and anonymous session cannot read camera records/snapshots, issue credentials or alter reviews.
6. Rotate the token: old token fails. Pause: ingestion fails. Resume, then revoke: current token fails. Disconnect feed/network: supervision exposes failure; restoration plus restart recovers. Record that outage events are lost.

Leave the rule paused after acceptance unless a monitored pilot session is continuing. Actual camera/network tests remain pending.

## Existing GeoMind records and eventual removal

This PR copies implementation, **not data or authentication identities**. No migration in this PR reads GeoMind or deletes its records. Before a separate handover:

- Inventory actual workspaces, batches, supplier details, memberships, events, legacy revisions and any camera records, without exposing private banking or snapshot data publicly.
- Establish a verified GeoMind-user to Stratum-user mapping. Auth UUIDs and owners must not be copied blindly between projects; no account is automatically granted access by matching a display name.
- Prepare a controlled export/import plan preserving IDs or an explicit ID map, relationships, actors, original timestamps and revisions. Reconcile counts and content, and explicitly resolve owner/staff reapproval and audit-history semantics.
- Validate Stratum sign-in, company isolation, history, exports and the physical camera pilot. Cutover needs a coordinated write boundary and a tested rollback path so edits in two systems do not diverge.
- Only after verified handover replace GeoMind's mill entry with a Stratum link. Removing the entry does not authorize dropping source tables or historical evidence.

## Provenance and validation

Adapted from GeoMind main `8463dc84c5d685c233185ee70883e8ac6799c7e9` and camera PR #84 head `068b8614d867cb11fd01110be0fdb927e3544ac8`. Private schemas and gateway environment variables are renamed for Stratum; runtime imports and endpoint configuration are independent of GeoMind.

`npm test` runs the existing metals-price adapter suite plus PostgreSQL/PGlite permission/workflow tests, React StrictMode operations/camera flows, handler authentication and motion/PNG tests. CI installs FFmpeg so encoding is exercised. `npm run build` produces the frontend; the mill page is loaded lazily. Automated checks do not prove live database configuration, Android browser behavior, retention policy or real camera compatibility.
