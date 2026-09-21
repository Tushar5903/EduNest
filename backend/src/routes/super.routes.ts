import { Router } from "express";
import {
  approveRequest,
  createInstitute,
  getInstitute,
  listInstitutes,
  listRequests,
  rejectRequest,
  setInstituteStatus,
} from "../controllers/super.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  directCreateValidator,
  instituteStatusValidator,
  rejectValidator,
} from "../services/institute.service.js";

const router = Router();

// Every super route: protect → super-admin only → status → controller.
router.use(protect, allowRoles("super-admin"), checkStatus);

router.get("/requests", listRequests);
router.post("/requests/:id/approve", approveRequest);
router.post("/requests/:id/reject", validateBody(rejectValidator), rejectRequest);

router.post("/institutes", validateBody(directCreateValidator), createInstitute);
router.get("/institutes", listInstitutes);
router.get("/institutes/:id", getInstitute);
router.patch("/institutes/:id/status", validateBody(instituteStatusValidator), setInstituteStatus);

export default router;
