import { Router } from "express";
import { createSalary, listSalaries, updateSalary } from "../controllers/salary.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import { createSalaryValidator, listSalaryQueryValidator, updateSalaryValidator } from "../validators/salary.validator.js";

const router = Router();

router.use(protect, scopeInstitute, checkStatus);

router.post("/", allowRoles("admin"), validateBody(createSalaryValidator), createSalary);
router.get("/", allowRoles("admin", "teacher"), validateQuery(listSalaryQueryValidator), listSalaries);
router.patch("/:id", allowRoles("admin"), validateBody(updateSalaryValidator), updateSalary);

export default router;
