// ─── Enums ─────────────────────────────────────────────
export type TripStatus = "draft" | "active" | "settled" | "archived";
export type MemberRole = "owner" | "member";
export type TransactionType =
  | "shared_expense"
  | "personal_expense"
  | "transfer"
  | "income";
export type SplitMethod = "equal" | "exact" | "percentage" | "shares";
export type Category =
  | "food"
  | "accommodation"
  | "transport"
  | "ticket"
  | "shopping"
  | "entertainment"
  | "health"
  | "other";

export type SyncStatus = "synced" | "pending" | "conflict" | "error";

// ─── Database Models ───────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  currency_code: string;
  status: TripStatus;
  start_date: string | null;
  end_date: string | null;
  invite_code: string | null;
  share_enabled: boolean;
  share_token: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string | null;
  display_name: string;
  role: MemberRole;
  is_guest: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  joined_at: string;
}

export interface Transaction {
  id: string;
  trip_id: string;
  paid_by: string; // trip_member id
  amount: number;
  currency_code: string;
  exchange_rate: number;
  description: string;
  category: Category;
  type: TransactionType;
  split_method: SplitMethod;
  paid_from_fund: boolean;
  transaction_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  member_id: string;
  amount: number;
  is_settled: boolean;
  created_at: string;
}

export interface Settlement {
  id: string;
  trip_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  currency_code: string;
  is_paid: boolean;
  paid_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Computed / View Models ────────────────────────────
export interface MemberBalance {
  member_id: string;
  display_name: string;
  is_guest: boolean;
  total_paid: number;
  total_owed: number;
  balance: number; // positive = creditor, negative = debtor
}

export interface OptimizedDebt {
  from: TripMember;
  to: TripMember;
  amount: number;
}

export interface TripSummary {
  trip: Trip;
  member_count: number;
  total_spent: number;
  transaction_count: number;
}

// ─── Form Types ────────────────────────────────────────
export interface CreateTripInput {
  name: string;
  description?: string;
  currency_code: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateTransactionInput {
  trip_id: string;
  paid_by: string;
  amount: number;
  currency_code: string;
  description: string;
  category: Category;
  type: TransactionType;
  split_method: SplitMethod;
  paid_from_fund?: boolean;
  transaction_date: string;
  splits: { member_id: string; amount: number }[];
}

export interface AddMemberInput {
  trip_id: string;
  display_name: string;
}
