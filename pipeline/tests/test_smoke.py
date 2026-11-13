import importlib.util
import pathlib

SCRIPTS = sorted((pathlib.Path(__file__).parent.parent / "scripts").glob("0*.py"))


def test_scripts_import():
    assert len(SCRIPTS) == 7
    for path in SCRIPTS:
        spec = importlib.util.spec_from_file_location(path.stem, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert callable(mod.main)
