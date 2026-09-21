import { Router } from "express";
import { adminRequest, login, logout, me, refresh } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { loginRateLimit } from "../middleware/rateLimit.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { adminRequestValidator, loginValidator } from "../validators/auth.validator.js";

const router = Router();

router.post("/admin-request", validateBody(adminRequestValidator), adminRequest);
router.post("/login", loginRateLimit, validateBody(loginValidator), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, me);

export default router;
