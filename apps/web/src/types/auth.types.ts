export interface User {
  id: string;
  email: string;
  name?: string;
  agencyId: string;
  role: 'owner' | 'member';
}
