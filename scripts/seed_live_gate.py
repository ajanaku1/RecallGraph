#!/usr/bin/env python3
"""Seed the minimal real DataHub graph used by the RecallGraph Phase 0 gate."""

import os
import time

from datahub.emitter.mce_builder import make_data_process_instance_urn
from datahub.emitter.mcp import MetadataChangeProposalWrapper
from datahub.emitter.rest_emitter import DataHubRestEmitter
from datahub.metadata.schema_classes import (
    AuditStampClass,
    DataProcessInstanceInputClass,
    DataProcessInstanceOutputClass,
    DataProcessInstancePropertiesClass,
    DatasetPropertiesClass,
    EdgeClass,
    MLModelDeploymentPropertiesClass,
    MLModelPropertiesClass,
)


GMS_URL = os.environ.get("DATAHUB_GMS_URL", "http://127.0.0.1:8080")
SOURCE_URN = "urn:li:dataset:(urn:li:dataPlatform:recallgraph,license-revoked-training,PROD)"
MODEL_URNS = (
    "urn:li:mlModel:(urn:li:dataPlatform:recallgraph,license-classifier,PROD)",
    "urn:li:mlModel:(urn:li:dataPlatform:recallgraph,license-risk-scorer,PROD)",
)
DEPLOYMENT_URN = "urn:li:mlModelDeployment:(urn:li:dataPlatform:recallgraph,license-classifier-prod,PROD)"
RUN_URN = make_data_process_instance_urn("recallgraph-license-training-run")
SEED_MARKER = "recallgraph.phase0.seed"


def emit(emitter: DataHubRestEmitter, urn: str, aspect: object) -> None:
    proposal = MetadataChangeProposalWrapper(entityUrn=urn, aspect=aspect)
    emitter.emit_mcp(proposal)


def seed_source(emitter: DataHubRestEmitter) -> None:
    emit(
        emitter,
        SOURCE_URN,
        DatasetPropertiesClass(
            name="recallgraph-license-revoked-training",
            description="Training data selected for the RecallGraph license-revocation demo.",
            customProperties={SEED_MARKER: "true"},
        ),
    )


def seed_models(emitter: DataHubRestEmitter) -> None:
    common = {SEED_MARKER: "true"}
    emit(
        emitter,
        MODEL_URNS[0],
        MLModelPropertiesClass(
            name="recallgraph-license-classifier",
            description="Affected classifier model in the RecallGraph live gate.",
            customProperties=common,
            trainingJobs=[RUN_URN],
            deployments=[DEPLOYMENT_URN],
        ),
    )
    emit(
        emitter,
        MODEL_URNS[1],
        MLModelPropertiesClass(
            name="recallgraph-license-risk-scorer",
            description="Affected risk scorer model in the RecallGraph live gate.",
            customProperties=common,
            trainingJobs=[RUN_URN],
        ),
    )


def seed_deployment(emitter: DataHubRestEmitter) -> None:
    emit(
        emitter,
        DEPLOYMENT_URN,
        MLModelDeploymentPropertiesClass(
            description="Production deployment associated with recallgraph-license-classifier.",
            customProperties={SEED_MARKER: "true"},
            status="IN_SERVICE",
        ),
    )


def seed_training_run(emitter: DataHubRestEmitter) -> None:
    stamp = AuditStampClass(time=int(time.time() * 1000), actor="urn:li:corpuser:__datahub_system")
    emit(
        emitter,
        RUN_URN,
        DataProcessInstancePropertiesClass(
            name="recallgraph-license-training-run", created=stamp, type="BATCH_SCHEDULED"
        ),
    )
    emit(
        emitter,
        RUN_URN,
        DataProcessInstanceInputClass(
            inputs=[], inputEdges=[EdgeClass(destinationUrn=SOURCE_URN, created=stamp)]
        ),
    )
    emit(
        emitter,
        RUN_URN,
        DataProcessInstanceOutputClass(
            outputs=[],
            outputEdges=[EdgeClass(destinationUrn=model, created=stamp) for model in MODEL_URNS],
        ),
    )


def main() -> None:
    emitter = DataHubRestEmitter(gms_server=GMS_URL)
    seed_source(emitter)
    seed_deployment(emitter)
    seed_training_run(emitter)
    seed_models(emitter)
    print(f"seeded {SOURCE_URN}")


if __name__ == "__main__":
    main()
