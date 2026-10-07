"""Roof coverage tests for irregular street parcels, run with Shapely 2.1+."""
import importlib.util, pathlib, unittest
from shapely.geometry import Polygon
from shapely.ops import unary_union
spec=importlib.util.spec_from_file_location('geometry',pathlib.Path(__file__).with_name('architectural-geometry.py'))
geometry=importlib.util.module_from_spec(spec);spec.loader.exec_module(geometry)

class RoofTests(unittest.TestCase):
    def test_irregular_roofs_cover_exact_footprints(self):
        examples=[Polygon([(0,0),(12,0),(12,20),(0,20)]),
                  Polygon([(0,0),(16,0),(14,9),(7,9),(7,20),(0,20)]),
                  Polygon([(0,0),(9,2),(13,13),(2,17)])]
        for footprint in examples:
            roof=geometry.pitched_roof(footprint,20,'noble_west')
            projection=unary_union([Polygon([v[:2]for v in face])for face in roof['surfaces']])
            self.assertLess(projection.symmetric_difference(footprint).area,1e-6)
            zs=[v[2]for face in roof['surfaces']for v in face]
            self.assertGreater(max(zs),20)
            self.assertGreaterEqual(min(zs),20)
            self.assertLessEqual(max(zs),27)

if __name__=='__main__':unittest.main()
