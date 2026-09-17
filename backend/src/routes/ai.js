const express = require("express");
const {
  getConversations,
  createConversation,
  sendMessage,
  chatStream,
  generateRevisionPlan,
  getRevisionPlans,
  explainCode,
  deleteConversation,
  renameConversation,
  toggleRevisionItem,
} = require("../controllers/aiController");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  sendMessageSchema,
  createConversationSchema,
  generateRevisionPlanSchema,
  explainCodeSchema,
} = require("../validators/ai");

const router = express.Router();

router.get("/conversations", authenticate, getConversations);
router.post("/conversations", authenticate, validate(createConversationSchema), createConversation);
router.post("/chat", authenticate, validate(sendMessageSchema), sendMessage);
router.post("/chat/stream", authenticate, validate(sendMessageSchema), chatStream);
router.post("/revision-plan", authenticate, validate(generateRevisionPlanSchema), generateRevisionPlan);
router.get("/revision-plans", authenticate, getRevisionPlans);
router.post("/explain", authenticate, validate(explainCodeSchema), explainCode);
router.delete("/conversations/:id", authenticate, deleteConversation);
router.patch("/conversations/:id", authenticate, renameConversation);
router.patch("/revision-plans/:planId/items/:itemId", authenticate, toggleRevisionItem);

module.exports = router;
