import { Router } from "express";
import { promote } from "../controllers/promote.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { promoteValidator } from "../validators/promote.validator.js";

const router = Router();

router.use(protect, scopeInstitute, checkStatus);

router.post("/", allowRoles("admin", "teacher"), validateBody(promoteValidator), promote);

export default router;
