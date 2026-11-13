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


class FakeDem:
    """A DEM stand-in: height is a function of (lat, lon)."""

    radius_m = 1737400.0

    def __init__(self, fn):
        self.fn = fn

    def height(self, lat, lon):
        lat, lon = np.broadcast_arrays(np.asarray(lat, dtype=float), np.asarray(lon, dtype=float))
        return np.asarray(self.fn(lat, lon), dtype=float).reshape(-1) if lat.ndim == 0 else self.fn(lat, lon)


def test_destination_distance_and_bearing():
    one_deg_m = np.radians(1) * 1737400.0
    lat, lon = common.destination(-89, 0, 0, one_deg_m)       # north, away from the south pole
    assert abs(lat - -88) < 1e-9 and abs(lon) < 1e-9
    lat, lon = common.destination(-89, 0, 180, one_deg_m)     # south, onto the pole
    assert abs(lat - -90) < 1e-6
    lat, lon = common.destination(0, 10, 90, one_deg_m)       # east along the equator
    assert abs(lat) < 1e-9 and abs(lon - 11) < 1e-9


def test_horizon_on_a_smooth_sphere_is_the_dip_angle():
    flat = FakeDem(lambda lat, lon: np.zeros_like(lat))
    mask, dist = common.horizon_mask(flat, flat, -89.0, 30.0, eye_m=2.0, near_m=15000.0, far_m=20000.0)
    dip = -np.degrees(np.arccos(1737400.0 / 1737402.0))        # about -0.087 deg
    assert np.allclose(mask, dip, atol=2e-4)
    assert np.allclose(dist, np.sqrt(2 * 1737400.0 * 2.0), atol=40)  # horizon about 2.6 km away


def test_horizon_sees_a_wall_to_the_north_only():
    site_lat = -85.0
    wall_lat = common.destination(site_lat, 0.0, 0.0, 1000.0)[0]
    wall = FakeDem(lambda lat, lon: np.where(lat >= wall_lat, 100.0, 0.0))
    mask, _ = common.horizon_mask(wall, wall, site_lat, 0.0, eye_m=2.0, near_m=5000.0, far_m=6000.0)
    assert abs(mask[0] - np.degrees(np.arctan2(98.0, 1000.0))) < 0.15   # 100 m wall 1 km away
    assert mask[180] < 0                                                  # open to the south


def test_visible_fraction_interpolates_and_wraps():
    mask = np.zeros(360)
    mask[0] = 10.0                                   # a spike at due north
    az_el = np.array([[359.5, 6.0], [359.5, 4.0], [180.0, -1.0], [180.0, 1.0]])
    assert common.visible_fraction(mask, az_el) == 0.5   # mask is 5 deg at az 359.5


def test_local_grid_orientation_row0_north_col0_west():
    crop = load("03_crop_local_frame")
    site_lat, site_lon = -80.0, 0.0
    # Height grows with latitude (northward) and with east longitude.
    dem = FakeDem(lambda lat, lon: (lat - site_lat) * 1e5 + ((lon + 180) % 360 - 180) * 1e3)
    h = crop.local_grid(dem, site_lat, site_lon, size=5, spacing=40)
    assert h.shape == (5, 5)
    assert h[0, 2] > h[2, 2] > h[4, 2]     # row 0 is the north edge
    assert h[2, 4] > h[2, 2] > h[2, 0]     # col 0 is the west edge
    assert abs(h[2, 2]) < 1e-6             # centre is the site


def test_polar_pixel_mapping_matches_the_pds_label_convention():
    dem = object.__new__(common.PolarDem)
    dem.radius_m, dem.scale_m, dem.line0, dem.samp0 = 1737400.0, 40.0, 3791.5, 3791.5
    line, samp = dem.pixel(-90.0, 0.0)
    assert abs(line - 3791.5) < 1e-6 and abs(samp - 3791.5) < 1e-6        # the pole is the grid centre
    line, samp = dem.pixel(-89.0, 0.0)
    assert line < 3791.5 and abs(samp - 3791.5) < 1e-6                     # lon 0 points up the image
    line, samp = dem.pixel(-89.0, 90.0)
    assert samp > 3791.5 and abs(line - 3791.5) < 1e-6                     # 90 E points right
    r = 2 * 1737400.0 * np.tan(np.radians(1.0) / 2) / 40.0
    assert abs((samp - 3791.5) - r) < 1e-6
