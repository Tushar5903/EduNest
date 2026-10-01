import { Router } from "express";
import { auditStats, listAudits } from "../controllers/audit.controller.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { validateQuery } from "../middleware/validation.middleware.js";
import { listAuditQueryValidator } from "../validators/audit.validator.js";

const router = Router();

// Super-admin global audit feed: protect → super-admin only → status → controller.
// NOTE: /stats is registered before / so it is never shadowed.
router.use(protect, allowRoles("super-admin"), checkStatus);

router.get("/stats", auditStats);
router.get("/", validateQuery(listAuditQueryValidator), listAudits);

export default router;
