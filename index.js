const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const users = {}; // in-memory storage

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

// Predict future position
function futurePosition(user, seconds = 3) {
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

  // Basic validation
  if (!userId || lat == null || lng == null) {
    return res.json({
      status: "error",
      warnings: []
    });
  }

  // Store/update user
  users[userId] = { lat, lng, speed, direction };

  let warnings = [];

  const THRESHOLD_METERS = 0.5; // 🎯 very short range

  for (const otherId in users) {
    if (otherId === userId) continue;

    const u1 = users[userId];
    const u2 = users[otherId];

    // 1️⃣ CURRENT distance
    const currentDist = distance(
      u1.lat, u1.lng,
      u2.lat, u2.lng
    );

    // 2️⃣ FUTURE distance (prediction)
    const f1 = futurePosition(u1, 3);
    const f2 = futurePosition(u2, 3);

    const futureDist = distance(
      f1.lat, f1.lng,
      f2.lat, f2.lng
    );

    // 🎯 DECISION LOGIC
    if (currentDist <= THRESHOLD_METERS) {
      warnings.push("⚠️ Collision detected (very close)");
    } 
    else if (futureDist <= THRESHOLD_METERS) {
      warnings.push("⚠️ Collision imminent");
