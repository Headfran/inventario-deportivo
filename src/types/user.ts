export type UserRole = 'owner' | 'seller';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}
