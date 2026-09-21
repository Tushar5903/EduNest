import { Schema, model, type Document } from "mongoose";

export type AuditAction =
  | "admin.approved"
  | "admin.rejected"
  | "institute.created"
  | "admin.blocked"
  | "admin.unblocked"
  | "school.suspended"
  | "school.unsuspended";

/**
 * Append-only trail for super-admin (and later admin) actions.
 * Stores who/what/why — never passwords, tokens, or complaint bodies.
 */
export interface AuditLogDoc extends Document {
  /** Approver id: a users._id, or the "super-admin" sentinel for the env-backed identity. */
  by: Schema.Types.ObjectId | string | null;
  instituteId?: Schema.Types.ObjectId | null;
  action: AuditAction;
  reason?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    by: { type: Schema.Types.Mixed, default: null, index: true },
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", default: null, index: true },
    action: {
      type: String,
      enum: [
        "admin.approved",
        "admin.rejected",
        "institute.created",
        "admin.blocked",
        "admin.unblocked",
        "school.suspended",
        "school.unsuspended",
      ],
      required: true,
      index: true,
    },
    reason: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
