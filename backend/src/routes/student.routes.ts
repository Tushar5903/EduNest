import { Router } from "express";
import { myAttendance } from "../controllers/attendance.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateQuery } from "../middleware/validation.middleware.js";
import { myAttendanceQueryValidator } from "../validators/attendance.validator.js";

const router = Router();

// Student self-service section: identity always forced from req.user.
router.use(protect, allowRoles("student"), scopeInstitute, checkStatus);

router.get("/me/attendance", validateQuery(myAttendanceQueryValidator), myAttendance);

export default router;
