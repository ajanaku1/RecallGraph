"""Unit coverage for reversible live-gate mutation control flow."""

import unittest

from scripts.reversible_mutation import RollbackFailure, run_reversible_mutation


class ReversibleMutationTest(unittest.TestCase):
    def test_success_restores_the_original_value(self) -> None:
        values = {"current": "before"}
        writes: list[str] = []

        def write(value: str) -> None:
            writes.append(value)
            values["current"] = value

        outcome = run_reversible_mutation(
            read_original=lambda: values["current"],
            write_value=write,
            readback=lambda _expected: values["current"],
            target="probe",
        )

        self.assertEqual(outcome.original, "before")
        self.assertEqual(outcome.readback, "probe")
        self.assertEqual(outcome.rollback, "before")
        self.assertEqual(writes, ["probe", "before"])

    def test_write_or_readback_failure_still_rolls_back(self) -> None:
        for failure in ("write", "readback"):
            with self.subTest(failure=failure):
                values = {"current": "before"}
                writes: list[str] = []

                def write(value: str) -> None:
                    writes.append(value)
                    values["current"] = value
                    if failure == "write" and value == "probe":
                        raise RuntimeError("write failed")

                def readback(_expected: str) -> str:
                    if failure == "readback" and values["current"] == "probe":
                        raise RuntimeError("readback failed")
                    return values["current"]

                with self.assertRaisesRegex(RuntimeError, failure):
                    run_reversible_mutation(lambda: values["current"], write, readback, "probe")

                self.assertEqual(values["current"], "before")
                self.assertEqual(writes[-1], "before")

    def test_rollback_failure_reports_the_primary_context(self) -> None:
        def write(value: str) -> None:
            if value == "before":
                raise RuntimeError("rollback write failed")

        with self.assertRaisesRegex(RollbackFailure, "rollback failed") as raised:
            run_reversible_mutation(lambda: "before", write, lambda _expected: "probe", "probe")

        self.assertIsInstance(raised.exception.__cause__, RuntimeError)
        self.assertIn("rollback write failed", str(raised.exception))

    def test_primary_and_rollback_failures_are_both_reported(self) -> None:
        def write(value: str) -> None:
            if value == "probe":
                raise RuntimeError("primary write failed")
            raise RuntimeError("rollback write failed")

        with self.assertRaisesRegex(RollbackFailure, "primary write failed") as raised:
            run_reversible_mutation(lambda: "before", write, lambda expected: expected, "probe")

        self.assertIsInstance(raised.exception.__cause__, RuntimeError)
        self.assertIn("rollback write failed", str(raised.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)
