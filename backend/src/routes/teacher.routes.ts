import { Router } from "express";
import { createStudent, getClassDashboard, getMyClasses } from "../controllers/teacher.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { teacherCreateStudentValidator } from "../validators/teacher.validator.js";

const router = Router();

// Every teacher route: protect → teacher only → institute scope → status → controller.
// No DELETE route by design — student deletion is admin-only (→ 404 here).
router.use(protect, allowRoles("teacher"), scopeInstitute, checkStatus);

router.get("/classes", getMyClasses);
router.get("/classes/:id/dashboard", getClassDashboard);
router.post("/students", validateBody(teacherCreateStudentValidator), createStudent);

export default router;
