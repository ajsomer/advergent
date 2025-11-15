export interface AuthenticatedRequestUser {
  id: string;
  email: string;
  name?: string;
  agency_id: string;
  role: 'owner' | 'member';
}
