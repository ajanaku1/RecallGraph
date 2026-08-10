# RecallGraph limitations

## Hosted evidence mode

The hosted console uses a recorded fixture and browser-session state. It does not connect to DataHub. The interface labels this limitation at the top of the page and records fixture mode in the receipt.

## Live DataHub proof

The retained live evidence comes from a local DataHub OSS gate. It proves two downstream ML models, one model-to-deployment association, one MCP lineage read, and one reversible metadata mutation. It does not prove that the hosted Vercel application can reach that local catalog.

## Security boundary

The fixture route has no production authentication, authorization, or durable session store. Known fixture identifiers are not security credentials. Production use requires authenticated case identity, policy enforcement, and durable trusted receipt storage.

## Operational scope

RecallGraph records recall warnings, dispositions, writeback references, and closure evidence. It does not stop deployments, invoke retraining, execute unlearning, or control Kubernetes and MLflow.

## Lineage coverage

The engine evaluates the supplied catalog graph. It cannot infer undeclared data overlap or assets that were never cataloged. Incomplete or uncertain lineage blocks closure only when the uncertainty is represented in the graph.

## Receipt claim

The receipt uses canonical JSON and SHA-256 for change detection. It is not a digital signature. It does not prove authenticity, authorship, provenance, or nonrepudiation.

## Rollback failure

The live gate attempts and confirms restoration after every mutation path. If DataHub becomes unreachable during restoration, RecallGraph raises `RollbackFailure` with primary context. An operator may still need to restore the property after catalog recovery.
