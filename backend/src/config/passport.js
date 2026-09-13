const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { Strategy: GitHubStrategy } = require("passport-github2");
const prisma = require("./db");

if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback", // where google should redirect after the user aproval 
        scope: ["profile", "email"],  //the data that we want from google
      },
      //after user is approved this function will be called
      //accessToken -> can use to call google api's
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value; //  top choose the primary email of the user 
          if (!email) return done(new Error("No email from Google"), null); //if there is no email

          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { googleId: profile.id },
                { email },
              ],
            },
          });

          if (user) { // user exist 
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                avatar: user.avatar || profile.photos?.[0]?.value,
              },
            });
          } else {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                password: null,
              },
            });
          }

          return done(null, user); // everything was good no errors came
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

if (process.env.GITHUB_CLIENT_ID) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "/api/auth/github/callback",
        scope: ["user:email", "repo"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email from GitHub"), null);

          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { githubId: String(profile.id) },
                { email },
              ],
            },
          });

          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                githubId: String(profile.id),
                githubToken: accessToken,
                avatar: user.avatar || profile.photos?.[0]?.value,
              },
            });
          } else {
            user = await prisma.user.create({
              data: {
                githubId: String(profile.id),
                githubToken: accessToken,
                email,
                name: profile.displayName || profile.username,
                avatar: profile.photos?.[0]?.value,
                password: null,
              },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => done(null, user.id));
//after login store only the user.id in session 
//deserialize needed because we need to get the user from the  database
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
    //on each req, fetching full user form db using the id
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
