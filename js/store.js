/* Shiloh — the data layer.
   One API for the app (index.html) and the admin backend (admin.html),
   three ways to run it, chosen in data/config.json:

     mode "demo"      Everything lives in this browser's localStorage.
                      Zero setup — perfect for trying the app and for
                      the church's own pilot before a real database exists.
     mode "supabase"  Real database + real admin login (magic link).
                      Row Level Security policies (docs/supabase-setup.sql)
                      keep pastoral/giving data behind the right tier.
     webhookUrl       Fires in ANY mode: every visitor card, RSVP, prayer
                      request, and reservation request POSTs to this URL —
                      point it at Zapier / Make / n8n / Resend to fan out
                      to email, texts, or a CRM.

   See docs/BACKEND.md for the full setup guide. This file intentionally
   mirrors the shape of the Faith & Results store.js it was forked from,
   so anyone who knows one knows the other. */
"use strict";

window.ShilohStore = (function () {
  var config = null;
  var LS = {
    profile: "shiloh.profile",
    visitorCards: "shiloh.visitorCards",
    rsvps: "shiloh.rsvps",
    myRsvps: "shiloh.myRsvps",
    prayers: "shiloh.prayers",
    prayed: "shiloh.prayed",
    reservations: "shiloh.reservations",
    volunteers: "shiloh.volunteers",
    localEvents: "shiloh.localEvents",
    onboarding: "shiloh.onboardingDone",
    session: "shiloh.adminSession"
  };

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function uid(prefix) {
    return (prefix || "SH") + "-" + Date.now().toString(36).toUpperCase() + "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function init() {
    if (config) return Promise.resolve(config);
    return fetch("data/config.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (c) { config = c; return c; })
      .catch(function () { config = { mode: "demo" }; return config; });
  }

  /* ---------------- supabase REST helpers ---------------- */
  function sb(path, opts) {
    opts = opts || {};
    var headers = {
      "apikey": config.supabaseAnonKey,
      "Authorization": "Bearer " + (opts.token || config.supabaseAnonKey),
      "Content-Type": "application/json"
    };
    if (opts.prefer) headers["Prefer"] = opts.prefer;
    return fetch(config.supabaseUrl + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("Backend error " + r.status + ": " + t); });
      return r.status === 204 ? null : r.json();
    });
  }
  function adminToken() {
    var s = read(LS.session, null);
    return s && s.access_token;
  }
  function isSupabase() { return config.mode === "supabase" && !!config.supabaseUrl; }

  /* ---------------- automations: outbound webhook ---------------- */
  function fireWebhook(type, data) {
    if (!config.webhookUrl) return Promise.resolve(false);
    return fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "shiloh-church-app", type: type, sentAt: new Date().toISOString(), data: data })
    }).then(function () { return true; }).catch(function () { return false; });
  }

  /* ---------------- profile (this device's person) ---------------- */
  function getProfile() { return read(LS.profile, null); }
  function saveProfile(p) {
    p.updatedAt = new Date().toISOString();
    write(LS.profile, p);
    var pushes = [fireWebhook("profile", p)];
    if (isSupabase()) {
      pushes.push(sb("/rest/v1/members?on_conflict=email", {
        method: "POST", body: p, prefer: "resolution=merge-duplicates"
      }).catch(function () {}));
    }
    return Promise.all(pushes).then(function () { return p; });
  }

  /* ---------------- onboarding ---------------- */
  function isOnboardingDone() { return read(LS.onboarding, false) === true; }
  function setOnboardingDone(val) { write(LS.onboarding, !!val); }

  /* ---------------- visitor / connect cards ---------------- */
  function submitVisitorCard(card) {
    card.id = uid("VC");
    card.status = "received";
    card.submittedAt = new Date().toISOString();
    var all = read(LS.visitorCards, []);
    all.unshift(card);
    write(LS.visitorCards, all);
    var pushes = [fireWebhook("visitor-card", card)];
    if (isSupabase()) pushes.push(sb("/rest/v1/visitor_cards", { method: "POST", body: card }));
    return Promise.all(pushes).then(function () { return card; });
  }
  function listVisitorCards() {
    if (isSupabase()) return sb("/rest/v1/visitor_cards?select=*&order=submittedAt.desc", { token: adminToken() });
    return Promise.resolve(read(LS.visitorCards, []));
  }
  function updateVisitorCard(id, patch) {
    patch.reviewedAt = new Date().toISOString();
    var all = read(LS.visitorCards, []);
    var i = all.findIndex(function (a) { return a.id === id; });
    if (i >= 0) { Object.assign(all[i], patch); write(LS.visitorCards, all); }
    var pushes = [fireWebhook("visitor-card-update", Object.assign({ id: id }, patch))];
    if (isSupabase()) pushes.push(sb("/rest/v1/visitor_cards?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, token: adminToken() }));
    return Promise.all(pushes).then(function () { return i >= 0 ? all[i] : patch; });
  }

  /* ---------------- events + RSVPs ---------------- */
  function submitRsvp(r) {
    r.id = uid("RSVP");
    r.submittedAt = new Date().toISOString();
    var all = read(LS.rsvps, []);
    all.unshift(r);
    write(LS.rsvps, all);
    var mine = read(LS.myRsvps, []);
    mine.unshift(r.id);
    write(LS.myRsvps, mine);
    var pushes = [fireWebhook("rsvp", r)];
    if (isSupabase()) pushes.push(sb("/rest/v1/rsvps", { method: "POST", body: r }));
    return Promise.all(pushes).then(function () { return r; });
  }
  function listRsvps() {
    if (isSupabase()) return sb("/rest/v1/rsvps?select=*&order=submittedAt.desc", { token: adminToken() });
    return Promise.resolve(read(LS.rsvps, []));
  }
  function myRsvps() {
    var mine = read(LS.myRsvps, []);
    return read(LS.rsvps, []).filter(function (r) { return mine.indexOf(r.id) !== -1; });
  }
  function getLocalEvents() { return read(LS.localEvents, []); }
  function saveLocalEvents(list) { write(LS.localEvents, list); }

  /* ---------------- prayer requests (tiered visibility) ---------------- */
  /* visibility: "church" (everyone) | "team" (prayer team + admin) | "pastor" (admin only) */
  function submitPrayerRequest(p) {
    p.id = uid("PR");
    p.submittedAt = new Date().toISOString();
    p.prayingCount = 0;
    p.visibility = p.visibility || "church";
    var all = read(LS.prayers, []);
    all.unshift(p);
    write(LS.prayers, all);
    var pushes = [fireWebhook("prayer-request", p)];
    if (isSupabase()) pushes.push(sb("/rest/v1/prayer_requests", { method: "POST", body: p }));
    return Promise.all(pushes).then(function () { return p; });
  }
  function listVisiblePrayerRequests() {
    /* Demo mode has no real per-user auth, so the public app view only ever
       shows "church"-visibility requests — "team"/"pastor" tiers require the
       admin panel (or, in supabase mode, a signed-in member with that role). */
    if (isSupabase()) return sb("/rest/v1/prayer_requests?select=*&visibility=eq.church&order=submittedAt.desc");
    return Promise.resolve(read(LS.prayers, []).filter(function (p) { return p.visibility === "church"; }));
  }
  function listAllPrayerRequests() {
    if (isSupabase()) return sb("/rest/v1/prayer_requests?select=*&order=submittedAt.desc", { token: adminToken() });
    return Promise.resolve(read(LS.prayers, []));
  }
  function markPraying(id) {
    var prayed = read(LS.prayed, []);
    if (prayed.indexOf(id) !== -1) return Promise.resolve(false); /* one tap per device */
    prayed.push(id);
    write(LS.prayed, prayed);
    var all = read(LS.prayers, []);
    var i = all.findIndex(function (p) { return p.id === id; });
    if (i >= 0) { all[i].prayingCount = (all[i].prayingCount || 0) + 1; write(LS.prayers, all); }
    if (isSupabase()) sb("/rest/v1/rpc/increment_praying", { method: "POST", body: { request_id: id } }).catch(function () {});
    return Promise.resolve(true);
  }
  function hasPrayed(id) { return read(LS.prayed, []).indexOf(id) !== -1; }

  /* ---------------- ministry / facility reservation requests ---------------- */
  function submitReservationRequest(r) {
    r.id = uid("RES");
    r.status = "pending";
    r.submittedAt = new Date().toISOString();
    var all = read(LS.reservations, []);
    all.unshift(r);
    write(LS.reservations, all);
    var pushes = [fireWebhook("reservation-request", r)];
    if (isSupabase()) pushes.push(sb("/rest/v1/reservations", { method: "POST", body: r }));
    return Promise.all(pushes).then(function () { return r; });
  }
  function listReservationRequests() {
    if (isSupabase()) return sb("/rest/v1/reservations?select=*&order=submittedAt.desc", { token: adminToken() });
    return Promise.resolve(read(LS.reservations, []));
  }
  function updateReservationRequest(id, patch) {
    patch.reviewedAt = new Date().toISOString();
    var all = read(LS.reservations, []);
    var i = all.findIndex(function (a) { return a.id === id; });
    if (i >= 0) { Object.assign(all[i], patch); write(LS.reservations, all); }
    var pushes = [fireWebhook("reservation-update", Object.assign({ id: id }, patch))];
    if (isSupabase()) pushes.push(sb("/rest/v1/reservations?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, token: adminToken() }));
    return Promise.all(pushes).then(function () { return i >= 0 ? all[i] : patch; });
  }
  /* naive same-facility/date/time overlap check against APPROVED reservations only */
  function hasConflict(facilityId, date, startTime, endTime) {
    var all = read(LS.reservations, []);
    return all.some(function (r) {
      return r.status === "approved" && r.facilityId === facilityId && r.date === date &&
        startTime < (r.endTime || "23:59") && (endTime || "23:59") > r.startTime;
    });
  }

  /* ---------------- volunteer safety status ----------------
     Liability-driven, independent of church size — tracked from day one
     even before a full member directory exists. Never exposed to the
     public app; admin-only, per the Church OS tiered-access principle. */
  function listVolunteers() {
    if (isSupabase()) return sb("/rest/v1/safety_status?select=*&order=name.asc", { token: adminToken() });
    return Promise.resolve(read(LS.volunteers, []));
  }
  function addVolunteer(v) {
    v.id = uid("VOL");
    v.status = v.status || "not started";
    var all = read(LS.volunteers, []);
    all.push(v);
    write(LS.volunteers, all);
    if (isSupabase()) sb("/rest/v1/safety_status", { method: "POST", body: v, token: adminToken() }).catch(function () {});
    return Promise.resolve(v);
  }
  function updateVolunteer(id, patch) {
    var all = read(LS.volunteers, []);
    var i = all.findIndex(function (v) { return v.id === id; });
    if (i >= 0) { Object.assign(all[i], patch); write(LS.volunteers, all); }
    if (isSupabase()) sb("/rest/v1/safety_status?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, token: adminToken() }).catch(function () {});
    return Promise.resolve(i >= 0 ? all[i] : patch);
  }

  /* ---------------- the appliance (Church OS Phase 1: "the brain and the pipe") ----------------
     A local Ollama model running on a box in the building, reached through a
     Cloudflare Tunnel — see docs/APPLIANCE-SETUP.md. Deliberately narrow: it
     answers a question and nothing else. No member/giving/prayer data is ever
     sent to it, it cannot send a message or move money, and it is not wired
     into any other part of the app. Both config fields blank is the normal,
     fully-supported "not set up yet" state. */
  function applianceConfigured() { return !!(config.applianceUrl && config.applianceToken); }
  function askAppliance(prompt) {
    if (!applianceConfigured()) return Promise.reject(new Error("not-configured"));
    return fetch(config.applianceUrl.replace(/\/$/, "") + "/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + config.applianceToken },
      body: JSON.stringify({ prompt: prompt })
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (e) {
        throw new Error(e.error || ("The appliance answered with an error (" + r.status + ")."));
      });
      return r.json();
    }).then(function (data) { return data.response; });
  }

  /* ---------------- admin auth ---------------- */
  function adminSignIn(email, password) {
    if (!isSupabase()) return Promise.resolve({ demo: true });
    return fetch(config.supabaseUrl + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (r) {
      if (!r.ok) throw new Error("Sign-in failed — check email and password.");
      return r.json();
    }).then(function (s) { write(LS.session, s); return s; });
  }
  function adminSignOut() { localStorage.removeItem(LS.session); }
  function isAdminSignedIn() { return !isSupabase() || !!adminToken(); }

  function listProfiles() {
    if (isSupabase()) return sb("/rest/v1/members?select=*&order=updatedAt.desc", { token: adminToken() });
    var p = getProfile();
    return Promise.resolve(p ? [p] : []);
  }

  /* ---------------- CSV export ---------------- */
  function toCsv(rows) {
    if (!rows.length) return "";
    var cols = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); }); });
    function cell(v) {
      if (v === null || v === undefined) return "";
      var s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return [cols.map(cell).join(",")].concat(rows.map(function (r) {
      return cols.map(function (c) { return cell(r[c]); }).join(",");
    })).join("\r\n");
  }
  function downloadCsv(rows, filename) {
    var blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- ICS (single event, one-way, no server needed) ---------------- */
  function downloadEventIcs(ev) {
    function dt(d, t) {
      var iso = (d || "").replace(/-/g, "");
      var time = (t || "0000").replace(/[^0-9]/g, "").padEnd(4, "0") + "00";
      return iso + "T" + time;
    }
    var body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shiloh Church App//EN",
      "BEGIN:VEVENT",
      "UID:" + (ev.id || uid("EVT")) + "@shiloh-church-app",
      "DTSTAMP:" + dt(new Date().toISOString().slice(0, 10)),
      "DTSTART:" + dt(ev.date, ev.time),
      "SUMMARY:" + (ev.title || "Event"),
      "LOCATION:" + (ev.location || ""),
      "DESCRIPTION:" + (ev.body || "").replace(/\n/g, "\\n"),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (ev.id || "event") + ".ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    init: init,
    getConfig: function () { return config; },
    isSupabase: isSupabase,
    getProfile: getProfile, saveProfile: saveProfile,
    isOnboardingDone: isOnboardingDone, setOnboardingDone: setOnboardingDone,
    submitVisitorCard: submitVisitorCard, listVisitorCards: listVisitorCards, updateVisitorCard: updateVisitorCard,
    submitRsvp: submitRsvp, listRsvps: listRsvps, myRsvps: myRsvps,
    getLocalEvents: getLocalEvents, saveLocalEvents: saveLocalEvents,
    submitPrayerRequest: submitPrayerRequest, listVisiblePrayerRequests: listVisiblePrayerRequests,
    listAllPrayerRequests: listAllPrayerRequests, markPraying: markPraying, hasPrayed: hasPrayed,
    submitReservationRequest: submitReservationRequest, listReservationRequests: listReservationRequests,
    updateReservationRequest: updateReservationRequest, hasConflict: hasConflict,
    listVolunteers: listVolunteers, addVolunteer: addVolunteer, updateVolunteer: updateVolunteer,
    applianceConfigured: applianceConfigured, askAppliance: askAppliance,
    adminSignIn: adminSignIn, adminSignOut: adminSignOut, isAdminSignedIn: isAdminSignedIn, listProfiles: listProfiles,
    fireWebhook: fireWebhook, downloadCsv: downloadCsv, downloadEventIcs: downloadEventIcs
  };
})();
