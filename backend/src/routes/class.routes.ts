import { Router } from "express";
import { createClass, deleteClass, getClass, listClasses, updateClass } from "../controllers/class.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import {
  createClassValidator,
  listClassesQueryValidator,
  updateClassValidator,
} from "../validators/class.validator.js";

const router = Router();

// Shared chain first; role gates differ per endpoint below.
router.use(protect, scopeInstitute, checkStatus);

router.post("/", allowRoles("admin"), validateBody(createClassValidator), createClass);
router.get("/", allowRoles("admin", "teacher"), validateQuery(listClassesQueryValidator), listClasses);
router.get("/:id", allowRoles("admin", "teacher", "student"), getClass);
router.patch("/:id", allowRoles("admin"), validateBody(updateClassValidator), updateClass);
router.delete("/:id", allowRoles("admin"), deleteClass);

export default router;
