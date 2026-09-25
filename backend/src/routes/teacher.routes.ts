import { Router } from "express";
import { createStudent, getClassDashboard, getMyClasses, postClassInfo } from "../controllers/teacher.controller.js";
import { todaySchedule } from "../controllers/timetable.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import { teacherCreateStudentValidator } from "../validators/teacher.validator.js";
import { todayScheduleQueryValidator } from "../validators/timetable.validator.js";
import { classInfoValidator } from "../validators/notice.validator.js";

const router = Router();

// Every teacher route: protect → teacher only → institute scope → status → controller.
// No DELETE route by design — student deletion is admin-only (→ 404 here).
router.use(protect, allowRoles("teacher"), scopeInstitute, checkStatus);

router.get("/classes", getMyClasses);
router.get("/classes/:id/dashboard", getClassDashboard);
router.post("/students", validateBody(teacherCreateStudentValidator), createStudent);
router.get("/today-schedule", validateQuery(todayScheduleQueryValidator), todaySchedule);
router.post("/class-info", validateBody(classInfoValidator), postClassInfo);

export default router;
