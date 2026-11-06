// shubinwang.com/<repo> has to become /<repo>/ before it's proxied: project
// pages load their files by relative path (js/app.js), which only resolve
// inside the project with the slash. A redirect rule can't add it, since
// Netlify matches /midi and /midi/ alike, but edge functions see the raw path.
export default (request) => {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/")) return;
  url.pathname += "/";
  return Response.redirect(url, 301);
};

// One extensionless segment: /midi, but not /index.html or /midi/js/app.js.
export const config = { pattern: "^/[^/.]+$" };
