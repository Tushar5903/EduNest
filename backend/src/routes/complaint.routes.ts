import { Router } from "express";
import { adminInbox, createComplaint, moderateComplaint, myComplaints, teacherInbox } from "../controllers/complaint.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { createComplaintValidator, updateComplaintValidator } from "../validators/complaint.validator.js";

const router = Router();

router.use(protect, scopeInstitute, checkStatus);

// Student write + track (privacy-critical: mine only).
router.post("/", allowRoles("student"), validateBody(createComplaintValidator), createComplaint);
router.get("/mine", allowRoles("student"), myComplaints);

// Role inboxes (teacher: own inbox only; admin: full + mirror).
router.get("/teacher", allowRoles("teacher"), teacherInbox);
router.get("/admin", allowRoles("admin"), adminInbox);
router.patch("/:id", allowRoles("teacher", "admin"), validateBody(updateComplaintValidator), moderateComplaint);

export default router;
