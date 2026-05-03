# Functional Acceptance Criteria

## Access and session
- [ ] Unauthenticated user opening `/admin` is redirected to login.
- [ ] User without required role is redirected to `/acesso-negado`.
- [ ] Session invalidation (HTTP 401) returns user to login flow.
- [ ] Token removal in another tab re-evaluates session and blocks protected routes.

## Core operation
- [ ] Login succeeds with valid credentials and fails with clear error for invalid ones.
- [ ] Cashier (`/caixa`) can complete a sale and receive confirmation.
- [ ] Stock adjustment updates quantities and records audit trail when required.
- [ ] Discount/admin screens are accessible only for proper roles.

## Error behavior
- [ ] Network failure surfaces user-friendly message.
- [ ] Timeout surfaces user-friendly timeout message.
- [ ] Permission errors (403) show standardized message.
