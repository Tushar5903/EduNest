import { Router } from "express";
import { createTest, listResults, listTests, publishResult, saveMarks } from "../controllers/test.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import {
  createResultValidator,
  createTestValidator,
  listResultsQueryValidator,
  listTestsQueryValidator,
  testMarksValidator,
} from "../validators/test.validator.js";

const router = Router();

router.use(protect, scopeInstitute, checkStatus);

router.post("/tests", allowRoles("teacher", "admin"), validateBody(createTestValidator), createTest);
router.get("/tests", allowRoles("teacher", "admin", "student"), validateQuery(listTestsQueryValidator), listTests);
router.post("/tests/:id/marks", allowRoles("teacher", "admin"), validateBody(testMarksValidator), saveMarks);
router.patch("/tests/:id/marks", allowRoles("teacher", "admin"), validateBody(testMarksValidator), saveMarks);
router.post("/results", allowRoles("teacher", "admin"), validateBody(createResultValidator), publishResult);
router.get("/results", allowRoles("teacher", "admin", "student"), validateQuery(listResultsQueryValidator), listResults);

export default router;
