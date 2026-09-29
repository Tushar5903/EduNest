import { Router } from "express";
import { myAttendance } from "../controllers/attendance.controller.js";
import {
  myAttendanceSelf,
  myDashboard,
  myFeesSelf,
  myProfile,
  myResultsSelf,
  myTeachers,
  myTimetable,
} from "../controllers/student.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateQuery } from "../middleware/validation.middleware.js";
import { myAttendanceQueryValidator } from "../validators/attendance.validator.js";
import { myTimetableQueryValidator } from "../validators/student.validator.js";
import { myResultsQueryValidator } from "../validators/test.validator.js";

const router = Router();

// Student self-service section: identity always forced from req.user.
router.use(protect, allowRoles("student"), scopeInstitute, checkStatus);

router.get("/me", myProfile);
router.get("/me/dashboard", myDashboard);
router.get("/me/attendance", validateQuery(myAttendanceQueryValidator), myAttendance);
router.get("/me/attendance-self", validateQuery(myAttendanceQueryValidator), myAttendanceSelf);
router.get("/me/timetable", validateQuery(myTimetableQueryValidator), myTimetable);
router.get("/me/teachers", myTeachers);
router.get("/me/results", validateQuery(myResultsQueryValidator), myResultsSelf);
router.get("/me/fees", myFeesSelf);

export default router;
