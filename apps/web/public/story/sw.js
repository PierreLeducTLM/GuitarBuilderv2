// The story page's service worker (build-story-sharing: Story Update Notifications).
// Story pages show their notifications through it, since Android Chrome offers no
// notifications to a page itself, and it brings the story forward when one is clicked.
// It has no fetch handler and no cache, so it never touches how pages load.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (typeof url !== "string") return;
  const path = new URL(url).pathname;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const story = windows.find((client) => new URL(client.url).pathname === path);
      if (!story) return self.clients.openWindow(url);
      story.postMessage({ type: "story-notification-click" });
      return story.focus();
    }),
  );
});
