"""Geometry and parsing checks that need no kernels and no network."""
import importlib.util
import pathlib
import sys

import numpy as np

SCRIPTS = pathlib.Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
import common  # noqa: E402


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_site_frame_is_orthonormal_and_right_handed():
    pos, east, north, up = common.site_vectors(-85.3, 31.7)
    for v in (east, north, up):
        assert abs(np.linalg.norm(v) - 1) < 1e-12
    assert abs(east @ north) < 1e-12 and abs(east @ up) < 1e-12 and abs(north @ up) < 1e-12
    assert np.allclose(np.cross(east, north), up)
    assert abs(np.linalg.norm(pos) - common.MOON_RADIUS_KM) < 1e-9


def test_north_points_towards_the_north_pole():
    _, _, north, _ = common.site_vectors(-80, 0)
    assert north[2] > 0


def test_az_el_convention():
    _, east, north, up = common.site_vectors(10, 20)
    az, el = common.az_el(north, east, north, up)
    assert min(az, 360 - az) < 1e-9 and abs(el) < 1e-9  # 0 and 360 are the same direction
    assert np.allclose(common.az_el(east, east, north, up), (90, 0))
    assert np.allclose(common.az_el(-north, east, north, up), (180, 0))
    assert np.allclose(common.az_el(-east, east, north, up), (270, 0))
    assert np.allclose(common.az_el(up, east, north, up)[1], 90)


def test_horizons_parse_and_compare():
    v = load("06_validate")
    text = "header\n$$SOE\n 2027-Mar-01 00:00, , , 40.5, 0.75,\n 2027-Mar-01 01:00, ,m, 41.0, 0.80,\n$$EOE\nfooter"
    rows = v.parse_az_el(text)
    assert rows.tolist() == [[40.5, 0.75], [41.0, 0.80]]
    same = v.compare(rows, rows)
    assert same["maxSeparationDeg"] == 0 and same["maxElevationDiffDeg"] == 0
    shifted = v.compare(rows, rows + [0.0, 0.1])
    assert abs(shifted["maxElevationDiffDeg"] - 0.1) < 1e-6
    assert abs(shifted["maxSeparationDeg"] - 0.1) < 1e-4


def test_compare_handles_azimuth_wraparound():
    v = load("06_validate")
    a = np.array([[359.99, 5.0]])
    b = np.array([[0.01, 5.0]])
    assert v.compare(a, b)["maxSeparationDeg"] < 0.03
