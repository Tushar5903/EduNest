import { Router } from "express";
import { createFee, feeAudit, listFees, teacherFeeStatus, updateFee } from "../controllers/fee.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import { createFeeValidator, listFeesQueryValidator, teacherFeeStatusValidator, updateFeeValidator } from "../validators/fee.validator.js";

const router = Router();

router.use(protect, scopeInstitute, checkStatus);

router.post("/", allowRoles("admin"), validateBody(createFeeValidator), createFee);
router.get("/", allowRoles("admin", "teacher", "student"), validateQuery(listFeesQueryValidator), listFees);
router.patch("/:id", allowRoles("admin"), validateBody(updateFeeValidator), updateFee);
router.patch("/teacher/:id/status", allowRoles("teacher"), validateBody(teacherFeeStatusValidator), teacherFeeStatus);
router.get("/:id/audit", allowRoles("admin"), feeAudit);

export default router;
