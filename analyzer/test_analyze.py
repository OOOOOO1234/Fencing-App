import tempfile
import unittest
from pathlib import Path

from sample_bout import write_bout
from analyze import analyze


class AnalyzeSampleTest(unittest.TestCase):
    def test_left_fencer_reads_the_sample_bout(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bout.mp4"
            write_bout(path)
            result = analyze(str(path), "left", "Alex")
        simple = next(row for row in result["exchanges"] if row["action"] == "simple attack")
        compound = next(row for row in result["exchanges"] if row["action"] == "compound attack")
        counter = next(row for row in result["exchanges"] if row["action"] == "counterattack")
        preparation = next(row for row in result["exchanges"] if row["action"] == "attack on the preparation")
        self.assertEqual(simple["result"], "success")
        self.assertIsNone(simple["remark"])
        self.assertEqual(compound["result"], "success")
        self.assertEqual(counter["result"], "failed")
        self.assertEqual(counter["remark"], "This looks like Alex's point.")
        self.assertEqual(preparation["result"], "success")
        self.assertTrue(any(row["result"] == "neither" for row in result["exchanges"]))


if __name__ == "__main__":
    unittest.main()
