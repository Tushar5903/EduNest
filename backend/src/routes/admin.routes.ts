import { Router } from "express";
import {
  assignClassTeacher,
  createStudent,
  createTeacher,
  deleteUser,
  getCredentials,
  getUser,
  listStudents,
  listTeachers,
  reassignStudent,
  removeStudentFromClass,
  resequenceRoll,
  resetPassword,
  setTerminalClass,
  updateUser,
} from "../controllers/admin.controller.js";
import { adminAuditStats, listAdminAudits } from "../controllers/audit.controller.js";
import { adminInbox } from "../controllers/complaint.controller.js";
import { feeAudit, listFees } from "../controllers/fee.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import { terminalClassValidator } from "../validators/class.validator.js";
import { listAuditQueryValidator } from "../validators/audit.validator.js";
import {
  assignClassTeacherValidator,
  createStudentValidator,
  createTeacherValidator,
  listUsersQueryValidator,
  reassignStudentValidator,
  updateUserValidator,
} from "../validators/user.validator.js";

const router = Router();

// Every admin route: protect → admin only → institute scope → status → controller.
router.use(protect, allowRoles("admin"), scopeInstitute, checkStatus);

router.post("/teachers", validateBody(createTeacherValidator), createTeacher);
router.post("/students", validateBody(createStudentValidator), createStudent);

router.get("/teachers", validateQuery(listUsersQueryValidator), listTeachers);
router.get("/students", validateQuery(listUsersQueryValidator), listStudents);
router.get("/users/:id", getUser);

// Stable credential read — same tempPassword every time, no rotation.
router.get("/users/:id/credentials", getCredentials);

router.patch("/users/:id", validateBody(updateUserValidator), updateUser);
router.delete("/users/:id", deleteUser);

router.post("/users/:id/reset-password", resetPassword); // explicit rotation only

router.patch("/students/:id/remove-class", removeStudentFromClass);
router.patch("/students/:id/reassign", validateBody(reassignStudentValidator), reassignStudent);

router.patch("/classes/:id/teacher", validateBody(assignClassTeacherValidator), assignClassTeacher);
router.post("/classes/:id/resequence-roll", resequenceRoll);

router.patch("/settings/terminal-class", validateBody(terminalClassValidator), setTerminalClass);

// Plan §11/§14 read aliases (same handlers as /api/fees + /api/complaints/admin).
router.get("/complaints", adminInbox);
router.get("/fees", listFees);
router.get("/fees/:id/audit", feeAudit);

// Institute-scoped audit trail for the authenticated admin's own school.
router.get("/audit-logs/stats", adminAuditStats);
router.get("/audit-logs", validateQuery(listAuditQueryValidator), listAdminAudits);

export default router;
