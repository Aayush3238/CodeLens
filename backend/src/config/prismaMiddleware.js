//to encrypot and decrypt user data 
const { encrypt, decrypt } = require("../utils/encryption");
// the fields that we want to encrypt
const ENCRYPTED_FIELDS = {
  User: ["githubToken", "leetcodeSession"],
};


function createEncryptionMiddleware() { //outer function that creates the middleware
  return async (params, next) => { // actual middleware
    const { model, action, args } = params;

    if (!model || !ENCRYPTED_FIELDS[model]) {
      return next(params);
    }

    const fieldsToEncrypt = ENCRYPTED_FIELDS[model];

    if (action === "create" || action === "update" || action === "upsert") {
      if (args.data) {
        for (const field of fieldsToEncrypt) {
          if (args.data[field] !== undefined && args.data[field] !== null) {
            args.data[field] = encrypt(args.data[field]);
          }
        }
      }
    }

    const result = await next(params);

    if (result && (action === "findUnique" || action === "findFirst" || action === "findMany" || action === "create" || action === "update" || action === "upsert")) {
      if (Array.isArray(result)) {
        for (const item of result) {
          for (const field of fieldsToEncrypt) {
            if (item[field]) {
              item[field] = decrypt(item[field]);
            }
          }
        }
      } else if (result) {
        for (const field of fieldsToEncrypt) {
          if (result[field]) {
            result[field] = decrypt(result[field]);
          }
        }
      }
    }

    return result;
  };
}

module.exports = { createEncryptionMiddleware };
