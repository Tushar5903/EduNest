import { Router } from "express";
import { schoolReport, teacherReport } from "../controllers/reports.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";

const router = Router();

router.use(protect, allowRoles("admin"), scopeInstitute, checkStatus);

router.get("/school", schoolReport);
router.get("/teacher/:id", teacherReport);

export default router;
