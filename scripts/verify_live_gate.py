#!/usr/bin/env python3
"""Prove the Phase 0 DataHub read and reversible metadata writeback."""

import json
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

from reversible_mutation import run_reversible_mutation as execute_reversible_mutation
from datahub.emitter.mcp import MetadataChangeProposalWrapper
from datahub.emitter.rest_emitter import DataHubRestEmitter
from datahub.metadata.schema_classes import DatasetPropertiesClass


GMS_URL = os.environ.get("DATAHUB_GMS_URL", "http://127.0.0.1:8080")
SOURCE_URN = "urn:li:dataset:(urn:li:dataPlatform:recallgraph,license-revoked-training,PROD)"
MODEL_URNS = (
    "urn:li:mlModel:(urn:li:dataPlatform:recallgraph,license-classifier,PROD)",
    "urn:li:mlModel:(urn:li:dataPlatform:recallgraph,license-risk-scorer,PROD)",
)
DEPLOYMENT_URN = "urn:li:mlModelDeployment:(urn:li:dataPlatform:recallgraph,license-classifier-prod,PROD)"
MCP_VERSION = "0.6.0"
PROBE_KEY = "recallgraph.phase0.liveGateProbe"
PROBE_VALUE = "LICENSE_REVOKED"
EVIDENCE_PATH = Path(".evidence/live-gate.json")


def fetch_aspects(urn: str) -> dict:
    endpoint = f"{GMS_URL}/entitiesV2/{quote(urn, safe='')}"
    for attempt in range(3):
        try:
            with urlopen(endpoint, timeout=15) as response:
                return json.load(response)["aspects"]
        except OSError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise AssertionError("unreachable")


def emit_properties(properties: DatasetPropertiesClass) -> None:
    emitter = DataHubRestEmitter(gms_server=GMS_URL)
    proposal = MetadataChangeProposalWrapper(entityUrn=SOURCE_URN, aspect=properties)
    emitter.emit_mcp(proposal)


def property_values() -> dict:
    aspects = fetch_aspects(SOURCE_URN)
    value = aspects.get("datasetProperties", {}).get("value")
    if value is None:
        raise RuntimeError("source datasetProperties is missing")
    return value


def replace_probe(properties: DatasetPropertiesClass, value: str | None) -> None:
    custom_properties = dict(properties.customProperties)
    if value is None:
        custom_properties.pop(PROBE_KEY, None)
    else:
        custom_properties[PROBE_KEY] = value
    properties.customProperties = custom_properties


def wait_for_probe(expected: str | None) -> dict:
    for attempt in range(3):
        current = property_values()
        actual = current.get("customProperties", {}).get(PROBE_KEY)
        if actual == expected:
            return current
        time.sleep(attempt + 1)
    raise RuntimeError(f"metadata readback mismatch; expected {expected!r}")


def mcp_command() -> list[str]:
    child = " ".join(
        (
            "env",
            "DATAHUB_TELEMETRY_ENABLED=false",
            f"DATAHUB_GMS_URL={GMS_URL}",
            "DATAHUB_GMS_TOKEN=local-dev",
            f"uvx mcp-server-datahub=={MCP_VERSION}",
        )
    )
    return [
        "uvx", "--from", f"mcp-server-datahub=={MCP_VERSION}", "fastmcp", "call",
        "--command", child, "--target", "get_lineage", "--input-json",
        json.dumps({"urn": SOURCE_URN, "upstream": False, "max_hops": 3, "max_results": 10}),
        "--json", "--timeout", "45",
    ]


def read_mcp_lineage() -> dict:
    environment = os.environ.copy()
    environment.pop("DEBUG", None)
    environment["DATAHUB_TELEMETRY_ENABLED"] = "false"
    result = subprocess.run(mcp_command(), capture_output=True, text=True, timeout=60, env=environment)
    if result.returncode != 0:
        raise RuntimeError(f"MCP get_lineage failed: {result.stderr.strip()}")
    response = json.loads(result.stdout)
    if response.get("is_error"):
        raise RuntimeError("MCP get_lineage returned an error result")
    return response["structured_content"]["downstreams"]


def assert_lineage(downstreams: dict) -> None:
    results = downstreams.get("searchResults", [])
    model_urns = {item.get("entity", {}).get("urn") for item in results if item.get("entity", {}).get("type") == "MLMODEL"}
    if model_urns != set(MODEL_URNS):
        raise RuntimeError(f"MCP model descendants mismatch: {sorted(model_urns)}")


def run_reversible_mutation() -> dict:
    before = property_values()
    properties = DatasetPropertiesClass.from_obj(before)
    outcome = execute_reversible_mutation(
        read_original=current_probe,
        write_value=lambda value: write_probe(properties, value),
        readback=read_probe,
        target=PROBE_VALUE,
    )
    return {
        "before": outcome.original,
        "written": outcome.written,
        "readback": outcome.readback,
        "rollback": outcome.rollback,
    }


def current_probe() -> str | None:
    return property_values().get("customProperties", {}).get(PROBE_KEY)


def write_probe(properties: DatasetPropertiesClass, value: str | None) -> None:
    replace_probe(properties, value)
    emit_properties(properties)


def read_probe(expected: str | None) -> str | None:
    return wait_for_probe(expected).get("customProperties", {}).get(PROBE_KEY)


def write_evidence(lineage: dict, mutation: dict) -> None:
    EVIDENCE_PATH.parent.mkdir(exist_ok=True)
    evidence = {
        "schemaVersion": 1,
        "mode": "live-datahub-oss",
        "gmsUrl": GMS_URL,
        "sourceUrn": SOURCE_URN,
        "modelUrns": list(MODEL_URNS),
        "deploymentUrn": DEPLOYMENT_URN,
        "deploymentAssociation": "MLModelProperties.deployments",
        "mcp": {"server": "mcp-server-datahub", "version": MCP_VERSION, "tool": "get_lineage", "downstreams": lineage},
        "mutation": {"aspect": "datasetProperties", "key": PROBE_KEY, **mutation},
    }
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n")


def main() -> None:
    lineage = read_mcp_lineage()
    assert_lineage(lineage)
    mutation = run_reversible_mutation()
    write_evidence(lineage, mutation)
    print(f"live gate verified: {EVIDENCE_PATH}")


if __name__ == "__main__":
    main()
