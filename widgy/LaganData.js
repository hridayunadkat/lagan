// Paste this into a Widgy Async JavaScript data source.
// Change FIELD for each text layer: progress, count, streak, or habits.

const ENDPOINT = "https://dawg-app.vercel.app/api/widget"
const TOKEN = "PASTE_YOUR_WIDGET_TOKEN"
const FIELD = "progress"

fetch(ENDPOINT, {
  headers: { Authorization: `Bearer ${TOKEN}` },
})
  .then((response) => {
    if (!response.ok) throw new Error(`Request failed (${response.status})`)
    return response.json()
  })
  .then((data) => {
    const values = {
      progress: `${data.progress}%`,
      count: `${data.completed}/${data.total}`,
      streak: `🔥 ${data.streak}`,
      habits: data.habits
        .filter((habit) => !habit.complete)
        .slice(0, 3)
        .map((habit) => habit.name)
        .join(" · ") || "All done",
    }
    sendToWidgy(values[FIELD] ?? "")
  })
  .catch((error) => sendToWidgy(`LAGAN error: ${error.message}`))
