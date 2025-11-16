# TODO: Fix Message Visibility for Non-Logged-In Users

- [x] Modify `loadMessages()` to not load old messages if !window.currentUser
- [x] Modify real-time subscription to only subscribe if logged in
- [x] Test that non-logged-in users see no messages at all, logged-in users see everything
- [x] Ensure the delete button still works for mods/admins
