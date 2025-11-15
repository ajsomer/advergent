import { UserButton, OrganizationSwitcher } from '@clerk/clerk-react';

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Advergent</h1>

        <div className="flex items-center gap-4">
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: 'flex items-center',
                organizationSwitcherTrigger: 'border border-gray-300 rounded-md px-3 py-2 hover:bg-gray-50',
              },
            }}
          />
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-10 h-10',
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
