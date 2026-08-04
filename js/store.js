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

/* Tiny polyfills, loaded before every page's own script. These three are
   the whole gap between "fetch-era browser" (2015-2017) and this app being
   fully navigable — without them, ~2016 browsers render the home screen
   and then die on the first tab tap. A dozen lines buys those years back. */
(function () {
  if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
  if (window.Element && !Element.prototype.prepend) {
    var prepend = function () {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < arguments.length; i++) {
        var n = arguments[i];
        frag.appendChild(n instanceof Node ? n : document.createTextNode(String(n)));
      }
      this.insertBefore(frag, this.firstChild);
    };
    Element.prototype.prepend = prepend;
    if (window.Document && !Document.prototype.prepend) Document.prototype.prepend = prepend;
  }
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (len, pad) {
      var s = String(this);
      pad = pad === undefined ? " " : String(pad);
      while (s.length < len && pad.length) s = pad.slice(0, len - s.length) + s;
      return s;
    };
  }
})();

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
    session: "shiloh.adminSession",
    role: "shiloh.staffRole",
    rentals: "shiloh.rentals",
    myRentals: "shiloh.myRentals",
    grants: "shiloh.accessGrants",
    adminTour: "shiloh.adminTourDone"
  };

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    /* Old-Safari private browsing throws on EVERY setItem. Swallowing it
       beats crashing mid-submit — worst case the device just doesn't
       remember, which private mode was asking for anyway. */
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

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
    var mine = read(LS.myRsvps, []);
    /* One answer per person per event: changing your RSVP replaces this
       device's previous record instead of stacking a new one — otherwise the
       control snaps back to the oldest answer and the headcount double-counts. */
    var replaced = all.filter(function (x) { return x.eventId === r.eventId && mine.indexOf(x.id) !== -1; })
      .map(function (x) { return x.id; });
    all = all.filter(function (x) { return replaced.indexOf(x.id) === -1; });
    mine = mine.filter(function (id) { return replaced.indexOf(id) === -1; });
    all.unshift(r);
    write(LS.rsvps, all);
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

  /* ---------------- space rentals (the "Airbnb" layer) ----------------
     Outside churches and community groups renting Shiloh's spaces. Space
     ids match the bookable facility ids in ministries.json, so ONE overlap
     check covers member reservations and outside rentals. A request is not
     a booking until the office approves it, the app never takes a payment,
     and every approved rental can carry a building-access pass. */
  function rentalCode() {
    /* Booking codes are references, not secrets — friendly alphabet, no 0/O/1/I. */
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
    return "SHILOH-" + s;
  }
  function listRentalSpaces() {
    return fetch("data/rentals.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .catch(function () { return { spaces: [] }; });
  }
  function submitRentalRequest(r) {
    r.id = uid("RENT");
    r.code = rentalCode();
    r.status = "pending";
    r.submittedAt = new Date().toISOString();
    var all = read(LS.rentals, []);
    all.unshift(r);
    write(LS.rentals, all);
    var mine = read(LS.myRentals, []);
    mine.unshift(r.code);
    write(LS.myRentals, mine);
    var pushes = [fireWebhook("rental-request", r)];
    if (isSupabase()) pushes.push(sb("/rest/v1/rentals", { method: "POST", body: r }));
    return Promise.all(pushes).then(function () { return r; });
  }
  function listRentalRequests() {
    if (isSupabase()) return sb("/rest/v1/rentals?select=*&order=submittedAt.desc", { token: adminToken() });
    return Promise.resolve(read(LS.rentals, []));
  }
  function updateRentalRequest(id, patch) {
    patch.reviewedAt = new Date().toISOString();
    var all = read(LS.rentals, []);
    var i = all.findIndex(function (a) { return a.id === id; });
    if (i >= 0) { Object.assign(all[i], patch); write(LS.rentals, all); }
    var pushes = [fireWebhook("rental-update", Object.assign({ id: id }, patch))];
    if (isSupabase()) pushes.push(sb("/rest/v1/rentals?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, token: adminToken() }));
    return Promise.all(pushes).then(function () { return i >= 0 ? all[i] : patch; });
  }
  function findRentalByCode(code) {
    var c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!c) return Promise.resolve(null);
    if (c.indexOf("SHILOH") === 0) c = c.slice(6);
    var norm = "SHILOH-" + c;
    if (isSupabase()) {
      return sb("/rest/v1/rentals?select=*&code=eq." + encodeURIComponent(norm))
        .then(function (rows) { return (rows && rows[0]) || null; });
    }
    var hit = read(LS.rentals, []).filter(function (r) { return r.code === norm; })[0];
    return Promise.resolve(hit || null);
  }
  function myRentalCodes() { return read(LS.myRentals, []); }
  function rentalConflict(spaceId, date, startTime, endTime) {
    var clash = read(LS.rentals, []).some(function (r) {
      return r.status === "approved" && r.spaceId === spaceId && r.date === date &&
        (startTime || "00:00") < (r.endTime || "23:59") && (endTime || "23:59") > (r.startTime || "00:00");
    });
    return clash || hasConflict(spaceId, date, startTime, endTime);
  }

  /* ---------------- building access (doors, cameras, passes) ----------------
     The app manages ACCESS PASSES: who may enter, through which doors, in
     which time window, with a door code. That model is exactly what smart
     locks speak (a scheduled code is the one credential every major system
     can be given remotely — fingerprints enroll at the door). The pass list
     works with no hardware at all; connecting a bridge (docs/ACCESS-SETUP.md)
     makes the same passes program real locks and surface real cameras. The
     bridge URL + token live in THIS DEVICE's localStorage only — data files
     are public. Admin-only, per the Church OS tiered-access principle. */
  function accessBridge() {
    try {
      var b = JSON.parse(localStorage.getItem("shiloh.accessBridge"));
      return b && typeof b.url === "string" && b.url.trim() ? { url: b.url.trim().replace(/\/$/, ""), token: b.token || "" } : null;
    } catch (e) { return null; }
  }
  function accessBridgeConfigured() { return !!accessBridge(); }
  function bridgeFetch(path, opts) {
    var b = accessBridge();
    if (!b) return Promise.reject(new Error("No security bridge is connected yet."));
    opts = opts || {};
    return fetch(b.url + path, {
      method: opts.method || "GET",
      headers: Object.assign({ "Content-Type": "application/json" },
        b.token ? { "Authorization": "Bearer " + b.token } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error("The security bridge answered " + r.status + ".");
      return r.status === 204 ? null : r.json();
    });
  }
  function testAccessBridge() {
    /* Strict: no static fallback. "Test connection" must never say
       Connected because a hardcoded door list papered over a dead bridge. */
    return bridgeFetch("/doors").then(function (d) {
      var doors = (d && d.doors) || d || [];
      return { ok: true, doors: doors.length };
    });
  }
  function staticAccess() {
    return fetch("data/access.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .catch(function () { return { doors: [], cameras: [] }; });
  }
  function listDoors() {
    if (accessBridgeConfigured()) {
      return bridgeFetch("/doors").then(function (d) { return d.doors || d || []; })
        .catch(function () { return staticAccess().then(function (a) { return a.doors || []; }); });
    }
    return staticAccess().then(function (a) { return a.doors || []; });
  }
  function listCameras() {
    if (accessBridgeConfigured()) {
      return bridgeFetch("/cameras").then(function (d) { return d.cameras || d || []; })
        .catch(function () { return staticAccess().then(function (a) { return a.cameras || []; }); });
    }
    return staticAccess().then(function (a) { return a.cameras || []; });
  }
  function setDoorLocked(doorId, locked) {
    return bridgeFetch("/doors/" + encodeURIComponent(doorId) + "/" + (locked ? "lock" : "unlock"), { method: "POST" });
  }
  function listAccessGrants() {
    return Promise.resolve(read(LS.grants, []));
  }
  function addAccessGrant(g) {
    g.id = uid("PASS");
    g.status = "active";
    g.createdAt = new Date().toISOString();
    /* A readable 6-digit door code. Demo-grade by design: when a bridge is
       connected, the LOCK SYSTEM's own code (returned below) replaces it. */
    g.doorCode = g.doorCode || String(Math.floor(100000 + Math.random() * 900000));
    g.synced = false;
    var finish = function () {
      var all = read(LS.grants, []);
      all.unshift(g);
      write(LS.grants, all);
      fireWebhook("access-grant", g);
      return g;
    };
    if (!accessBridgeConfigured()) return Promise.resolve(finish());
    return bridgeFetch("/grants", { method: "POST", body: g }).then(function (resp) {
      if (resp && resp.code) g.doorCode = String(resp.code);
      if (resp && resp.id) g.bridgeId = resp.id;
      g.synced = true;
      return finish();
    }).catch(function (e) {
      g.syncError = (e && e.message) || "bridge unreachable";
      return finish(); /* the pass still exists locally — honesty flag shown in UI */
    });
  }
  function revokeAccessGrant(id) {
    var all = read(LS.grants, []);
    var i = all.findIndex(function (g) { return g.id === id; });
    if (i >= 0) { all[i].status = "revoked"; all[i].revokedAt = new Date().toISOString(); write(LS.grants, all); }
    var g = i >= 0 ? all[i] : null;
    fireWebhook("access-revoke", { id: id });
    if (g && g.bridgeId && accessBridgeConfigured()) {
      return bridgeFetch("/grants/" + encodeURIComponent(g.bridgeId), { method: "DELETE" })
        .then(function () { return g; })
        .catch(function () { return g; });
    }
    return Promise.resolve(g);
  }
  function grantForRental(rentalId) {
    return listAccessGrants().then(function (all) {
      return all.filter(function (g) { return g.rentalId === rentalId && g.status === "active"; })[0] || null;
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

  /* ---------------- staff roles: admin vs editor ----------------
     Two tiers, per the Church OS tiered-access principle. EDITOR runs the
     public face of the church: events, announcements, the ministry catalog,
     facility reservations, and the live broadcast. ADMIN adds everything
     people-sensitive on top: visitor cards, member profiles, prayer at the
     team/pastor tiers, volunteer safety status, settings, and automations.
     Pastoral data stays behind the tightest gate — an editor never sees it.

     Demo mode: the passcode itself picks the role (adminPasscode vs
     editorPasscode in data/config.json). Supabase mode: the signed-in
     email is looked up in the `staff` table (docs/supabase-setup.sql) and
     the role comes from there — no row, no access. The client-side check
     is UX; in supabase mode Row Level Security enforces it for real. */
  var STAFF_PERMS = {
    editor: ["dashboard", "inbox", "content", "reservations", "rentals", "live", "assistant"],
    admin: ["dashboard", "inbox", "content", "reservations", "rentals", "live", "assistant",
            "people", "prayer", "volunteers", "settings", "automations", "building"]
  };
  function staffSignIn(passcode, email) {
    /* Passcodes are demo-mode only. In supabase mode a passcode "success"
       would write a role that staffRole() immediately voids (no token) —
       a toast saying welcome over a card still signed out. Fail honestly. */
    if (isSupabase()) return Promise.reject(new Error("This church uses real staff accounts — sign in with your email on the back office page."));
    /* Named demo accounts (config.demoStaff): an email+password that signs
       in like the real thing so a client can preview the back office —
       but it is the same courtesy lock as the passcodes, nothing more. */
    if (email) {
      var em = String(email).trim().toLowerCase();
      var hit = (config.demoStaff || []).filter(function (a) {
        return String(a.email || "").trim().toLowerCase() === em && a.password === passcode;
      })[0];
      if (!hit || (hit.role !== "admin" && hit.role !== "editor")) {
        return Promise.reject(new Error("That email and password didn't match."));
      }
      write(LS.role, { role: hit.role, name: hit.name || "", at: new Date().toISOString() });
      return Promise.resolve(hit.role);
    }
    var role = null;
    if (passcode && config.adminPasscode && passcode === config.adminPasscode) role = "admin";
    else if (passcode && config.editorPasscode && passcode === config.editorPasscode) role = "editor";
    if (!role) return Promise.reject(new Error("That passcode didn't match."));
    write(LS.role, { role: role, at: new Date().toISOString() });
    return Promise.resolve(role);
  }
  function staffSignInSupabase(email, password) {
    /* GoTrue lowercases account emails; match it or the lookup misses. */
    email = String(email || "").trim().toLowerCase();
    return adminSignIn(email, password).then(function () {
      return sb("/rest/v1/staff?select=role&email=eq." + encodeURIComponent(email), { token: adminToken() })
        .catch(function (e) {
          /* Lookup failed (network/5xx): don't leave a live auth token
             sitting in localStorage on a device that showed "sign-in failed". */
          localStorage.removeItem(LS.session);
          throw e;
        });
    }).then(function (rows) {
      var role = rows && rows[0] && rows[0].role;
      if (role !== "admin" && role !== "editor") {
        localStorage.removeItem(LS.session);
        throw new Error("That account isn't on the staff list yet — an admin can add it in the staff table.");
      }
      write(LS.role, { role: role, at: new Date().toISOString() });
      return role;
    });
  }
  function staffRole() {
    var s = read(LS.role, null);
    var role = s && s.role;
    if (role !== "admin" && role !== "editor") return null;
    if (isSupabase() && !adminToken()) return null; /* real auth expired -> role expires with it */
    return role;
  }
  function staffSignOut() {
    localStorage.removeItem(LS.role);
    localStorage.removeItem(LS.session);
  }
  function can(permission) {
    var role = staffRole();
    return !!role && STAFF_PERMS[role].indexOf(permission) !== -1;
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
      /* Real time parsing: "9:00 AM" must become T090000, not T900000. */
      var m = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(t || "");
      var h = 0, min = 0;
      if (m) {
        h = parseInt(m[1], 10) || 0;
        min = parseInt(m[2] || "0", 10) || 0;
        var ap = (m[3] || "").toUpperCase();
        if (ap === "PM" && h < 12) h += 12;
        if (ap === "AM" && h === 12) h = 0;
      }
      var time = String(h).padStart(2, "0") + String(min).padStart(2, "0") + "00";
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
    staffSignIn: staffSignIn, staffSignInSupabase: staffSignInSupabase, staffRole: staffRole,
    staffSignOut: staffSignOut, can: can,
    listRentalSpaces: listRentalSpaces, submitRentalRequest: submitRentalRequest,
    listRentalRequests: listRentalRequests, updateRentalRequest: updateRentalRequest,
    findRentalByCode: findRentalByCode, myRentalCodes: myRentalCodes, rentalConflict: rentalConflict,
    accessBridgeConfigured: accessBridgeConfigured, testAccessBridge: testAccessBridge,
    listDoors: listDoors, listCameras: listCameras,
    setDoorLocked: setDoorLocked, listAccessGrants: listAccessGrants, addAccessGrant: addAccessGrant,
    revokeAccessGrant: revokeAccessGrant, grantForRental: grantForRental,
    adminSignIn: adminSignIn, adminSignOut: adminSignOut, isAdminSignedIn: isAdminSignedIn, listProfiles: listProfiles,
    fireWebhook: fireWebhook, downloadCsv: downloadCsv, downloadEventIcs: downloadEventIcs
  };
})();
