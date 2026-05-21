# TODO — Private Notifications & Private Questions

## Plan Summary
Implement a private, role- and recipient-scoped notification box (and private student→teacher questions) without replacing the existing public-ish `Announcement` flow.

## Steps
1. Inspect current frontend API usage for announcements and identify where to add notification UI.
2. Add new Prisma models for `Notification` + `NotificationRecipient` (and optional `PrivateConversation` + `ConversationMessage`).
3. Add Prisma migration.
4. Implement backend notification authorization + create/list endpoints.
5. Implement frontend notification box UI.
6. Implement private question threads (student↔teacher).
7. Register new backend routes.
8. Run typecheck/build and do quick smoke tests with demo roles.

