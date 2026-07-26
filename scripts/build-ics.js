/* Builds a single events.ics from data/events.json at deploy time, so members
   can subscribe ONCE in their phone's native Calendar app and never open this
   app to see what's next. Run by .github/workflows/deploy-pages.yml before
   publishing — see docs/BACKEND.md. Plain Node, no dependencies. */
"use strict";
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var events = JSON.parse(fs.readFileSync(path.join(root, "data", "events.json"), "utf8")).events || [];

function dt(date, time) {
  var iso = (date || "").replace(/-/g, "");
  var t = (time || "").replace(/[^0-9]/g, "");
  if (!t) t = "0000";
  if (t.length === 3) t = "0" + t;
  return iso + "T" + t.slice(0, 4) + "00";
}
function escText(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }

var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shiloh Church App//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
events.forEach(function (ev) {
  lines.push(
    "BEGIN:VEVENT",
    "UID:" + ev.id + "@shiloh-church-app",
    "DTSTAMP:" + dt(new Date().toISOString().slice(0, 10)),
    "DTSTART:" + dt(ev.date, ev.time),
    "SUMMARY:" + escText(ev.title),
    "LOCATION:" + escText(ev.location),
    "DESCRIPTION:" + escText(ev.body),
    "END:VEVENT"
  );
});
lines.push("END:VCALENDAR");

fs.writeFileSync(path.join(root, "events.ics"), lines.join("\r\n") + "\r\n");
console.log("Wrote events.ics with " + events.length + " event(s).");
