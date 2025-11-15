export interface SharedUser {
  id: string;
  email: string;
  name?: string;
  agencyId: string;
  role: 'owner' | 'member';
}
