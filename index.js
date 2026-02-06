const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory user store
const users = {};

// ---------------- UTILITY FUNCTIONS ----------------

// Haversine distance (meters)
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Predict future position (short lookahead)
function futurePosition(user, seconds = 1.5) {
  const speed = user.speed || 0; // m/s
  const bearing = (user.direction || 0) * Math.PI / 180;

  const d = speed * seconds;

  const latOffset = (d * Math.cos(bearing)) / 111111;
  const lonOffset =
    (d * Math.sin(bearing)) /
    (111111 * Math.cos(user.lat * Math.PI / 180));

  return {
    lat: user.lat + latOffset,
    lng: user.lng + lonOffset
  };
}

// ---------------- API ----------------

app.post("/update", (req, res) => {
  const { userId, lat, lng, speed, direction } = req.body;

  if (!userId || lat == null || lng == null) {
    return res.json({ status: "error", warnings: [] });
  }

  // Store/update user with timestamp + warning state
  users[userId] = {
    lat,
    lng,
    speed,
    direction,
    lastSeen: Date.now(),
    inWarning: users[userId]?.inWarning || false
  };

  const NOW = Date.now();
  const TIMEOUT_MS = 8000;

  // 🔑 DEMO-TUNED VALUES
  const ENTER_DIST = 2.0;  // meters → trigger warning
  const EXIT_DIST  = 3.5;  // meters → clear warning

  let warnings = [];

  for (const otherId in users) {
    if (otherId === userId) continue;

    // Remove inactive users
    if (NOW - users[otherId].lastSeen > TIMEOUT_MS) {
      delete users[otherId];
      continue;
    }

    const u1 = users[userId];
    const u2 = users[otherId];

    const currentDist = distance(
      u1.lat, u1.lng,
      u2.lat, u2.lng
    );

    const f1 = futurePosition(u1);
    const f2 = futurePosition(u2);

    const futureDist = distance(
      f1.lat, f1.lng,
      f2.lat, f2.lng
    );

    // ---------------- DECISION LOGIC ----------------

    // ENTER warning
    if (!u1.inWarning &&
        (currentDist <= ENTER_DIST || futureDist <= ENTER_DIST)) {
      u1.inWarning = true;
      warnings.push("⚠️ Possible collision very close");
    }

    // EXIT warning
    else if (u1.inWarning && currentDist >= EXIT_DIST) {
      u1.inWarning = false;
    }

    // STAY in warning
    else if (u1.inWarning) {
      warnings.push("⚠️ Possible collision very close");
    }
  }

  res.json({
    status: "ok",
    warnings
  });
});

// Health check
app.get("/", (req, res) => {
  res.send("Collision detection server running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
