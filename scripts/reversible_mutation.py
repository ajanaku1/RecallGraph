"""Pure reversible mutation control flow for the live verification gate."""

from dataclasses import dataclass
from typing import Callable, Generic, TypeVar


Value = TypeVar("Value")


@dataclass(frozen=True)
class MutationOutcome(Generic[Value]):
    original: Value
    written: Value
    readback: Value
    rollback: Value


class RollbackFailure(RuntimeError):
    """Reports rollback failure without discarding the primary mutation error."""

    def __init__(self, primary: BaseException | None, rollback: BaseException) -> None:
        detail = f"rollback failed: {rollback}"
        if primary is not None:
            detail = f"{detail}; primary mutation failure: {primary}"
        super().__init__(detail)


def run_reversible_mutation(
    read_original: Callable[[], Value],
    write_value: Callable[[Value], None],
    readback: Callable[[Value], Value],
    target: Value,
) -> MutationOutcome[Value]:
    original = read_original()
    try:
        write_value(target)
        observed = readback(target)
        if observed != target:
            raise RuntimeError(f"mutation readback mismatch: expected {target!r}")
    except BaseException as primary:
        rollback_after_failure(original, write_value, readback, primary)
        raise
    return rollback_after_success(original, target, observed, write_value, readback)


def rollback_after_failure(
    original: Value,
    write_value: Callable[[Value], None],
    readback: Callable[[Value], Value],
    primary: BaseException,
) -> None:
    try:
        restore_original(original, write_value, readback)
    except BaseException as rollback:
        raise RollbackFailure(primary, rollback) from primary


def rollback_after_success(
    original: Value,
    target: Value,
    observed: Value,
    write_value: Callable[[Value], None],
    readback: Callable[[Value], Value],
) -> MutationOutcome[Value]:
    try:
        rollback = restore_original(original, write_value, readback)
    except BaseException as error:
        raise RollbackFailure(None, error) from error
    return MutationOutcome(original, target, observed, rollback)


def restore_original(
    original: Value,
    write_value: Callable[[Value], None],
    readback: Callable[[Value], Value],
) -> Value:
    write_value(original)
    rollback = readback(original)
    if rollback != original:
        raise RuntimeError(f"rollback readback mismatch: expected {original!r}")
    return rollback
