# LAGAN Scriptable widget

This widget reads the signed-in user's existing LAGAN data from Supabase. The
password is sent directly to Supabase during first-time setup and is never
saved. Scriptable stores the resulting refresh token in its iOS Keychain.

## Install on iPhone

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188).
2. Open [`LaganWidget.js`](https://raw.githubusercontent.com/hridayunadkat/lagan/main/scriptable/LaganWidget.js) in Safari.
3. Use Share → Save to Files and save it as `LaganWidget.js` inside
   **iCloud Drive → Scriptable**.
4. Open Scriptable. Tap **LaganWidget**, run it once, and sign in with the same
   email and password used by LAGAN.
5. Long-press the iPhone Home Screen, tap **+**, choose **Scriptable**, and add
   a small or medium widget.
6. Long-press the new widget, choose **Edit Widget**, and select
   **LaganWidget**.

The widget shows today's progress, completed and scheduled habit counts, the
current streak, and—at medium size—up to three incomplete habits.

## Refresh behavior

iOS decides when Home Screen widgets refresh. The script requests an update
every 20 minutes, but iOS may refresh less often depending on battery and usage.
Opening Scriptable and running `LaganWidget` forces an immediate refresh.

If the widget says there is no synced data, open LAGAN once while online, then
run the script again. If the session expires, open the script and sign in again.
