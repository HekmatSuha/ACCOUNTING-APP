# ACCOUNTING-APP

## Account provisioning and user management

Tenant access is now controlled entirely by staff members or account owners. The
open registration endpoint has been removed and replaced with an invitation
workflow that honours subscription seat limits.

### Creating users as staff or account admins

Authenticated staff members can create users for any account by calling
`POST /api/auth/users/` with the desired account identifier, user details and
optional role flags:

```json
{
  "account": 12,
  "email": "analyst@example.com",
  "username": "analyst",
  "password": "Sup3rS3cret!",
  "is_admin": true,
  "is_billing_manager": false
}
```

Account owners or admins can omit the `account` field; their primary account is
selected automatically. Passwords are validated against Django's password
policies and the request is rejected if the account has already consumed its
entire seat allocation.

### Sending invitations

To invite a new teammate without setting their password, submit the same request
with `"invite": true` and omit the password:

```json
{
  "email": "bookkeeper@example.com",
  "invite": true,
  "is_billing_manager": true
}
```

The API returns a token that can be distributed to the user. Invitations can be
previewed anonymously via `GET /api/auth/invitations/<token>/`.

### Accepting invitations

Invitees can activate their access by visiting the public acceptance route
(`/invite/<token>` in the React application) or by POSTing directly to
`/api/auth/invitations/<token>/accept/` with their chosen credentials:

```json
{
  "username": "bookkeeper",
  "password": "Sup3rS3cret!",
  "confirm_password": "Sup3rS3cret!"
}
```

Successful acceptance reactivates any recycled memberships and immediately frees
or consumes seats based on account limits.

### Seat management

Seat usage is recalculated whenever memberships are activated or deactivated.
Inactive memberships free their seats, allowing administrators to invite or add
replacement users without manual intervention.
