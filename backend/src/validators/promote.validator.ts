import { z } from "zod";

const objectIdLike = z.string().trim().min(1);

export const promoteValidator = z
  .object({
    studentIds: z.array(objectIdLike).min(1).optional(),
    entireClass: z.boolean().optional(),
    fromClassId: objectIdLike,
    toClassId: objectIdLike.optional(),
  })
  .strict()
  .refine((v) => (v.studentIds?.length ?? 0) > 0 || v.entireClass === true, {
    message: "Provide studentIds or entireClass: true",
  });
