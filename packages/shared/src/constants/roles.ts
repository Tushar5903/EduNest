export const ROLES = ["super-admin", "admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

export const PORTAL_ROLES: Role[] = ["teacher", "student"];
export const CONSOLE_ROLES: Role[] = ["admin", "super-admin"];

export const USER_STATUSES = ["pending", "active", "suspended", "rejected"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const INSTITUTE_STATUSES = ["pending", "active", "suspended"] as const;

export const FEE_STATUSES = ["pending", "submitted", "collected", "paid", "overdue"] as const;
export const SALARY_STATUSES = ["pending", "paid"] as const;
export const COMPLAINT_STATUSES = ["open", "in-review", "resolved", "rejected", "escalated"] as const;
export const COMPLAINT_CATEGORIES = ["against-student", "against-teacher", "other"] as const;
export const NOTICE_AUDIENCES = ["all", "student", "teacher", "class"] as const;
export const ATTENDANCE_STATUSES = ["present", "absent"] as const;
