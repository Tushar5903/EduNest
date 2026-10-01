import { z } from "zod";

/** GET /api/audit-logs — super-admin only. All filters optional. */
export const listAuditQueryValidator = z.object({
  search: z.string().trim().optional(),
  action: z.string().trim().optional(),
  instituteId: z.string().trim().optional(),
  limit: z.string().trim().optional(),
});
