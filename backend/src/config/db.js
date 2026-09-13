const { PrismaClient } = require("@prisma/client");
const { createEncryptionMiddleware } = require("./prismaMiddleware");

let prisma;
//global is node global object
//needed this because if we don't use global then on every reload 
//prisma connection will be made that can crash our database

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {  //once the connection is made 
    global.prisma = new PrismaClient();
  }
  //now when the file will reload the global prisma connection will be used
  prisma = global.prisma;
}

if (process.env.ENCRYPTION_KEY) {
  prisma.$use(createEncryptionMiddleware());
}

module.exports = prisma;
