const jwt = require("jsonwebtoken");
const User = require("../models/user-model");
const Session = require("../models/session-model");

// Check nilai cookie, jika ada verify token
async function tokenVerify(req, res, next) {
   if (!req.cookies.__main_access_token && !req.cookies.__secure_refresh_token) {
      return res.status(403).json({ message: "Invalid credential. Go to login page" });
   }

   if (!req.cookies.__secure_refresh_token && req.cookies.__main_access_token) {
      res.clearCookie("__main_access_token");
      res.clearCookie("__secure_refresh_token");
      return res.status(403).json({ message: "Refresh token not found. Go to login page" });
   }

   try {
      let newAccessToken; // Untuk access token yang baru

      if (req.cookies.__secure_refresh_token && !req.cookies.__main_access_token) {
         const decoded = jwt.verify(req.cookies.__secure_refresh_token, process.env.REFRESH_TOKEN_SECRET);

         const decode = Buffer.from(decoded._session_id, "base64").toString("ascii"); // decode base64

         const session = await Session.findOne({
            where: {
               session_id: decode,
            },
         });

         if (Date.now() + 5000000000 > session.expires) {
            await Session.update({
               expires: Date.now() + process.env.REFRESH_TOKEN_AGE,
            });

            res.cookie("__secure_refresh_token", accessToken, {
               maxAge: process.env.REFRESH_TOKEN_AGE,
               httpOnly: true,
               sameSite: "Strict",
            });
         }

         if (!session) {
            res.clearCookie("__secure_refresh_token");
            return res.status(400).json({ message: "Sorry, we can't find your credentials" });
         }

         const user = await User.findOne({
            where: {
               uid: session.uid,
            },
         });

         const payload = {
            id: user.id,
            uid: user.uid,
            role: user.role,
            isReguler: user.isReguler,
         };

         const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET);

         res.cookie("__main_access_token", accessToken, {
            maxAge: process.env.ACCESS_TOKEN_AGE,
            httpOnly: true,
            sameSite: "Strict",
         });

         newAccessToken = accessToken;
      }

      const newToken = req.cookies.__main_access_token || newAccessToken; // Ambil token dari client, jika tidak ada ambil dari access token baru

      jwt.verify(newToken, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
         if (err) return res.status(403).json({ message: "Invalid Token" });
         const reguler = { uid: data.uid, isReguler: data.isReguler, role: data.role };
         req.user = data.role == "guru" || data.role == "siswa" ? data : reguler;
      });
      next();
   } catch (error) {
      req.user = "Internal server error. (Error during token checking)";
      next();
   }
}

module.exports = tokenVerify;
