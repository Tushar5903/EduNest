import { Router } from "express";
import { createNotice, deleteNotice, listNotices, updateNotice } from "../controllers/notice.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { checkStatus } from "../middleware/status.middleware.js";
import { allowRoles } from "../middleware/role.middleware.js";
import { scopeInstitute } from "../middleware/institute.middleware.js";
import { validateBody, validateQuery } from "../middleware/validation.middleware.js";
import { createNoticeValidator, listNoticesQueryValidator, updateNoticeValidator } from "../validators/noticeList.validator.js";

const router = Router();

router.use(protect, scopeInstitute, checkStatus);

router.post("/", allowRoles("admin", "teacher"), validateBody(createNoticeValidator), createNotice);
router.get("/", allowRoles("admin", "teacher", "student"), validateQuery(listNoticesQueryValidator), listNotices);
router.patch("/:id", allowRoles("admin", "teacher"), validateBody(updateNoticeValidator), updateNotice);
router.delete("/:id", allowRoles("admin", "teacher"), deleteNotice);

export default router;
