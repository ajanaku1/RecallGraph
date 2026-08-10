# RecallGraph

Every affected model. Traced. Resolved.

## Inspiration

Training data can become unsafe after a model reaches production. A license can be revoked, a person can request erasure, or a critical correction can invalidate source material. Teams can find individual assets, but they still need defensible evidence that every affected model received a reviewed disposition before closure.

RecallGraph treats that work as a recall command, not a dashboard filter.

## What it does

RecallGraph opens a typed recall event and traverses downstream lineage. It identifies affected models and deployments, then blocks closure until every required human decision, uncertainty resolution, owner assignment, and writeback is valid.

The main fixture demonstrates a `LICENSE_REVOKED` recall with two models and one deployment. Two model decisions begin unresolved. The deployment has a recorded retirement decision. Closure stays blocked until both human approvals and the fixture writeback succeed.

After closure, RecallGraph exports a canonical JSON receipt with lineage evidence, decisions, approval timestamps, evidence mode, and writeback references. A SHA-256 digest detects changed receipt material. The interface states that this checksum is not a signature or proof of authorship.

## How we built it

The project is a Next.js App Router application with a pure TypeScript recall core.

- The graph layer normalizes stable entity IDs and traverses descendants with cycle protection.
- The recall layer opens cases, validates human records, computes revision digests, and evaluates closure.
- The receipt layer canonicalizes the full evidence payload and verifies it against a separately retained digest.
- The browser console handles inspection, approvals, writeback, guarded closure, and receipt verification.
- Server route handlers own hashing and closure commands. Node-only crypto never enters the client bundle.

DataHub OSS is the live catalog proof. The live gate seeds a minimal ML lineage, reads downstream entities through `mcp-server-datahub`, writes one probe metadata property, confirms readback, and restores the original value. The retained evidence records the exact two model URNs and one deployment association.

The public console defaults to a recorded fixture so judges can run the full workflow without a local DataHub stack. It labels that state as fixture evidence and does not silently substitute it for live proof.

## Challenges

The hardest part was defining what closure means when evidence can arrive malformed or stale. Runtime types cannot be trusted after hydration, so the core validates full records before traversal or hashing. Approval records bind to the case revision digest. A material evidence change makes earlier approvals stale.

Canonical JSON also needed strict behavior for Unicode ordering, duplicate identifiers, accessors, non-enumerable fields, `undefined`, negative zero, and `__proto__`. The receipt must reject lossy material instead of hashing a misleading projection.

The live mutation gate had another failure mode: a readback error could leave DataHub changed. The final helper restores the original value after success, failure, or interruption and reports both primary and rollback failures when necessary.

## Accomplishments

- Deterministic closure rules cover cycles, diamonds, duplicates, ownership, uncertainty, stale approvals, and partial writeback.
- Receipt verification recomputes the submitted payload and compares it with server-retained trust.
- The fixture journey exposes blocked, approved, writeback, closed, trusted-match, and planted-mismatch states.
- The DataHub gate retains real MCP lineage and reversible writeback evidence.
- The interface supports keyboard inspection, native dialog behavior, reduced motion, mobile lineage order, recovery boundaries, and high-contrast states.
- One hundred and three automated checks cover the core, route boundary, UI journey, rollback control flow, submission contract, and demo-video evidence.

## What we learned

Integrity and authenticity are different claims. A SHA-256 digest can prove that material changed relative to a trusted reference, but it cannot identify who created the receipt. RecallGraph states that limit in both the core result and the interface.

We also learned that fixture accessibility and sponsor proof should be separate. A hosted fixture makes judging reliable. It becomes misleading only when the product labels it as live. RecallGraph retains the real DataHub evidence and keeps the hosted mode explicit.

## What's next

- Connect the server-side catalog port to DataHub for hosted authenticated environments.
- Add durable case identity, access control, and approval policy integration.
- Store closure documents and dispositions through the DataHub adapter.
- Add signed receipts when authorship and nonrepudiation become requirements.
- Expand typed fixtures for erasure requests and critical corrections in the console.

## Links

- Public repository: https://github.com/ajanaku1/RecallGraph
- Live application: https://recallgraph.vercel.app
- Feedback survey: https://github.com/ajanaku1/RecallGraph/issues/new?template=feedback.yml
- Demo video (2:03): https://github.com/ajanaku1/RecallGraph/releases/download/v1.0.0-demo/recallgraph-demo.mp4
