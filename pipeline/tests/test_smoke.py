"""Smoke test: every stage script imports cleanly."""
import importlib.util
from pathlib import Path

import pytest

SCRIPTS = sorted((Path(__file__).parent.parent / "scripts").glob("[0-9][0-9]_*.py"))


def test_found_all_stages():
    assert len(SCRIPTS) == 7


@pytest.mark.parametrize("path", SCRIPTS, ids=lambda p: p.stem)
def test_imports(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert callable(mod.main)
