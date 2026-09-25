import { Router } from "express";
import { listAttendance, markAttendance, updateAttendance } from "../controllers/attendance.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import {
  listAttendanceQueryValidator,
  markAttendanceValidator,
  updateAttendanceValidator,
} from "../validators/attendance.validator.js";

const router = Router();

// Shared chain first; role gates differ per endpoint below.
router.use(protect, scopeInstitute, checkStatus);

router.post("/", allowRoles("teacher", "admin"), validateBody(markAttendanceValidator), markAttendance);
router.get(
  "/",
  allowRoles("teacher", "admin", "student"),
  validateQuery(listAttendanceQueryValidator),
  listAttendance,
);
router.patch("/:id", allowRoles("teacher", "admin"), validateBody(updateAttendanceValidator), updateAttendance);

export default router;
