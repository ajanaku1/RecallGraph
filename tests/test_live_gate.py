#!/usr/bin/env python3
"""Live, read-only acceptance test for the Phase 0 DataHub seed."""

import json
import os
import unittest
from urllib.parse import quote
from urllib.request import urlopen


GMS_URL = os.environ.get("DATAHUB_GMS_URL", "http://127.0.0.1:8080")
SOURCE_URN = "urn:li:dataset:(urn:li:dataPlatform:recallgraph,license-revoked-training,PROD)"
MODEL_URNS = (
    "urn:li:mlModel:(urn:li:dataPlatform:recallgraph,license-classifier,PROD)",
    "urn:li:mlModel:(urn:li:dataPlatform:recallgraph,license-risk-scorer,PROD)",
)
DEPLOYMENT_URN = "urn:li:mlModelDeployment:(urn:li:dataPlatform:recallgraph,license-classifier-prod,PROD)"
RUN_URN = "urn:li:dataProcessInstance:recallgraph-license-training-run"


def entity_aspects(urn: str) -> dict:
    endpoint = f"{GMS_URL}/entitiesV2/{quote(urn, safe='')}"
    with urlopen(endpoint, timeout=10) as response:
        return json.load(response)["aspects"]


class LiveGateSeedTest(unittest.TestCase):
    def test_seed_has_two_models_and_one_deployment(self) -> None:
        source = entity_aspects(SOURCE_URN)
        self.assertIn("datasetProperties", source, "source dataset is not seeded")
        for model_urn in MODEL_URNS:
            model = entity_aspects(model_urn)
            self.assertIn("mlModelProperties", model, f"model missing: {model_urn}")
        deployment = entity_aspects(DEPLOYMENT_URN)
        self.assertIn("mlModelDeploymentProperties", deployment, "deployment is not seeded")
        classifier = entity_aspects(MODEL_URNS[0])["mlModelProperties"]["value"]
        self.assertIn(DEPLOYMENT_URN, classifier["deployments"])
        run = entity_aspects(RUN_URN)
        input_edges = run["dataProcessInstanceInput"]["value"]["inputEdges"]
        self.assertEqual([edge["destinationUrn"] for edge in input_edges], [SOURCE_URN])
        output_edges = run["dataProcessInstanceOutput"]["value"]["outputEdges"]
        self.assertEqual(
            [edge["destinationUrn"] for edge in output_edges], list(MODEL_URNS)
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
