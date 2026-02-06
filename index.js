const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const users = {}; // in-memory storage

// Utility: Haversine distance (meters)
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

// Predict future position (simple math)
function futurePosition(user, seconds = 5) {
  const speed = user.speed; // m/s
  const bearing = user.direction * Math.PI / 180;

  const d = speed * seconds;
  const latOffset = (d * Math.cos(bearing)) / 111111;
  const lonOffset = (d * Math.sin(bearing)) /
    (111111 * Math.cos(user.lat * Math.PI / 180));

  return {
    lat: user.lat + latOffset,
    lng: user.lng + lonOffset
  };
}

// API: receive user data
app.post("/update", (req, res) => {
  const { userId, lat, lng, speed, direction } = req.body;

  users[userId] = { lat, lng, speed, direction };

  const warnings = [];

  for (const otherId in users) {
    if (otherId === userId) continue;

    const u1 = users[userId];
    const u2 = users[otherId];

    const f1 = futurePosition(u1);
    const f2 = futurePosition(u2);

    const d = distance(f1.lat, f1.lng, f2.lat, f2.lng);

    if (d < 10) {
      warnings.push(`Possible collision with ${otherId}`);
    }
  }

  res.json({
    status: "ok",
    warnings
  });
});

app.get("/", (req, res) => {
  res.send("Collision server running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
