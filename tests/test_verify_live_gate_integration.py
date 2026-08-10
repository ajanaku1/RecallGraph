"""Integration coverage for live-gate reversible helper wiring without DataHub."""

import importlib.util
import sys
import types
import unittest
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = PROJECT / "scripts" / "verify_live_gate.py"


class LiveGateHelperWiringTest(unittest.TestCase):
    def test_live_gate_wrapper_delegates_to_the_pure_reversible_helper(self) -> None:
        module = load_live_gate_module()
        state = {"probe": "before"}

        class Properties:
            customProperties: dict[str, str]

            @classmethod
            def from_obj(cls, value: dict) -> "Properties":
                instance = cls()
                instance.customProperties = dict(value.get("customProperties", {}))
                return instance

        module.DatasetPropertiesClass = Properties
        module.property_values = lambda: {"customProperties": {module.PROBE_KEY: state["probe"]}}
        module.emit_properties = lambda properties: state.update(
            probe=properties.customProperties.get(module.PROBE_KEY)
        )
        module.wait_for_probe = lambda expected: {"customProperties": {module.PROBE_KEY: expected}}

        outcome = module.run_reversible_mutation()

        self.assertEqual(outcome["before"], "before")
        self.assertEqual(outcome["written"], module.PROBE_VALUE)
        self.assertEqual(outcome["rollback"], "before")


def load_live_gate_module() -> types.ModuleType:
    install_datahub_stubs()
    sys.path.insert(0, str(PROJECT / "scripts"))
    spec = importlib.util.spec_from_file_location("verify_live_gate_test", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load live-gate script")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install_datahub_stubs() -> None:
    modules = {
        "datahub": types.ModuleType("datahub"),
        "datahub.emitter": types.ModuleType("datahub.emitter"),
        "datahub.emitter.mcp": types.ModuleType("datahub.emitter.mcp"),
        "datahub.emitter.rest_emitter": types.ModuleType("datahub.emitter.rest_emitter"),
        "datahub.metadata": types.ModuleType("datahub.metadata"),
        "datahub.metadata.schema_classes": types.ModuleType("datahub.metadata.schema_classes"),
    }
    modules["datahub.emitter.mcp"].MetadataChangeProposalWrapper = object
    modules["datahub.emitter.rest_emitter"].DataHubRestEmitter = object
    modules["datahub.metadata.schema_classes"].DatasetPropertiesClass = object
    sys.modules.update(modules)


if __name__ == "__main__":
    unittest.main(verbosity=2)
